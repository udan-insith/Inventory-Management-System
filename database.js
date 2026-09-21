require("dotenv").config();
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const {
	MYSQL_HOST = "localhost",
	MYSQL_PORT = "3306",
	MYSQL_USER = "root",
	MYSQL_PASSWORD = "",
	MYSQL_DATABASE = "gift_storage",
} = process.env;

let pool;

// dateStrings: true makes DATE/DATETIME columns come back as plain
// 'YYYY-MM-DD' / 'YYYY-MM-DD HH:MM:SS' strings (matching how the old
// SQLite version stored them) instead of JS Date objects, so nothing
// downstream (routes, frontend) needs to change.

function makePool(withDatabase) {
	return mysql.createPool({
		host: MYSQL_HOST,
		port: Number(MYSQL_PORT),
		user: MYSQL_USER,
		password: MYSQL_PASSWORD,
		database: withDatabase ? MYSQL_DATABASE : undefined,
		dateStrings: true,
		waitForConnections: true,
		connectionLimit: 10,
	});
}

// ---------------------------------------------------------------------
// Thin async query helpers, shaped like the old synchronous better-
// sqlite3-style API so route code stays easy to read:
//   await db.get(sql, [params])   -> one row or undefined
//   await db.all(sql, [params])   -> array of rows
//   await db.run(sql, [params])   -> { lastInsertRowid, changes }
//   await db.transaction(fn)      -> runs fn(tx) in a real transaction
// ---------------------------------------------------------------------
async function get(sql, params = []) {
	const [rows] = await pool.query(sql, params);
	return rows[0];
}

async function all(sql, params = []) {
	const [rows] = await pool.query(sql, params);
	return rows;
}

async function run(sql, params = []) {
	const [result] = await pool.query(sql, params);
	return { lastInsertRowid: result.insertId, changes: result.affectedRows };
}

async function transaction(fn) {
	const conn = await pool.getConnection();
	try {
		await conn.beginTransaction();
		const tx = {
			get: async (sql, params = []) => {
				const [rows] = await conn.query(sql, params);
				return rows[0];
			},
			all: async (sql, params = []) => {
				const [rows] = await conn.query(sql, params);
				return rows;
			},
			run: async (sql, params = []) => {
				const [result] = await conn.query(sql, params);
				return {
					lastInsertRowid: result.insertId,
					changes: result.affectedRows,
				};
			},
		};
		const result = await fn(tx);
		await conn.commit();
		return result;
	} catch (err) {
		await conn.rollback();
		throw err;
	} finally {
		conn.release();
	}
}

// ---------------------------------------------------------------------
// Schema. item_id / user_id / created_by / uploaded_by all use
// ON DELETE SET NULL rather than CASCADE — deleting an item or a user
// never deletes history, it just detaches from it. Each log row also
// carries its own item_name snapshot, so Total History reads correctly
// even after the item is long gone.
// ---------------------------------------------------------------------

async function ensureSchema() {
	await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                INT AUTO_INCREMENT PRIMARY KEY,
      username          VARCHAR(100) NOT NULL UNIQUE,
      display_name      VARCHAR(150) NOT NULL,
      password_hash     VARCHAR(255) NOT NULL,
      role              ENUM('admin','normal') NOT NULL,
      can_upload_letter TINYINT(1) NOT NULL DEFAULT 0,
      created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

	await pool.query(`
    CREATE TABLE IF NOT EXISTS items (
      id                  INT AUTO_INCREMENT PRIMARY KEY,
      name                VARCHAR(150) NOT NULL UNIQUE,
      balance             INT NOT NULL DEFAULT 0,
      low_stock_threshold INT NOT NULL DEFAULT 5,
      image_path          VARCHAR(500) NULL,
      created_by          INT NULL,
      created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

	// One row per Issue/Receive event: which branch, what event, what date.
	await pool.query(`
    CREATE TABLE IF NOT EXISTS gift_transactions (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      type         ENUM('issue','receive') NOT NULL,
      branch_name  VARCHAR(200) NOT NULL,
      event_name   VARCHAR(200) NOT NULL,
      log_date     DATE NOT NULL,
      created_by   INT NULL,
      created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

	// One row per item inside a transaction (a single Issue/Receive can cover
	// several items at once). item_name is a snapshot, so history keeps
	// reading correctly even after the item itself is deleted.
	await pool.query(`
    CREATE TABLE IF NOT EXISTS gift_transaction_items (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      transaction_id INT NOT NULL,
      item_id        INT NULL,
      item_name      VARCHAR(150) NOT NULL DEFAULT '',
      quantity       INT NOT NULL,
      balance_after  INT NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES gift_transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

	// The Issue letter and the Receive letter are two independent one-time
	// uploads (both by Udan School Leaver).
	await pool.query(`
    CREATE TABLE IF NOT EXISTS letters (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      type         ENUM('issue','receive') NOT NULL UNIQUE,
      filename     VARCHAR(255) NOT NULL,
      filepath     VARCHAR(500) NOT NULL,
      uploaded_by  INT NULL,
      uploaded_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

	// A branch's incoming request (a scanned letter, photo, or Word doc)
	// logged with its supporting document attached.
	await pool.query(`
    CREATE TABLE IF NOT EXISTS received_requests (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      branch_name   VARCHAR(200) NOT NULL,
      request_date  DATE NOT NULL,
      description   TEXT,
      file_path     VARCHAR(500) NOT NULL,
      file_name     VARCHAR(255) NOT NULL,
      file_type     VARCHAR(100) NOT NULL,
      uploaded_by   INT NULL,
      uploaded_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB
  `);

	await ensureColumn("items", "low_stock_threshold", "INT NOT NULL DEFAULT 5");
}

// Adds a column to an existing table if it isn't already there (for
// databases created before this column existed) — checked via
// INFORMATION_SCHEMA rather than a fragile try/catch around ALTER TABLE.
async function ensureColumn(table, column, definition) {
	const row = await get(
		`SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ? AND column_name = ?`,
		[MYSQL_DATABASE, table, column],
	);
	if (row.c === 0) {
		await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
	}
}

// ---------------------------------------------------------------------
// Seed the five required users. Exported as db.seedDefaultUsers() so the
// "Reset Application" feature can call the exact same logic again later.
// ---------------------------------------------------------------------
async function seedDefaultUsers() {
	// Udan School Leaver is the one account allowed to upload the one-time
	// Issue/Receive letters. This is tracked via can_upload_letter (not the
	// username) so the permission survives an admin renaming the account later.
	const seedUsers = [
		["shanika", "M.D.S Madushanka", "shanikamd@123", "admin", 0],
		["peter", "Gayasri Peter", "gayasripeter@123", "admin", 0],
		["hasindu", "Hasindu Wijekoon", "hasinduwije@123", "admin", 0],
		["udan", "G.U.I Perera", "udaninsith@123", "normal", 1],
		["mihisal", "Mihisal Pamuditha", "mihisalpamu@123", "normal", 0],
	];

	for (const [
		username,
		displayName,
		plainPassword,
		role,
		canUploadLetter,
	] of seedUsers) {
		const hash = bcrypt.hashSync(plainPassword, 10);
		await run(
			"INSERT INTO users (username, display_name, password_hash, role, can_upload_letter) VALUES (?, ?, ?, ?, ?)",
			[username, displayName, hash, role, canUploadLetter],
		);
	}
	console.log("Seeded 5 default users (3 admins, 2 normal users).");
}
