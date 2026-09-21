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
