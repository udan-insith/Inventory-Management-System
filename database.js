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
