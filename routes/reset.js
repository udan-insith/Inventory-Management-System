const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("../database");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAdmin);

const { UPLOAD_DIR, ITEM_IMAGE_DIR, REQUEST_FILE_DIR } = require("../config");

// POST /api/reset -> wipe every table, every uploaded item photo, both
// letters, and every received-request file, then reseed the five default
// accounts, exactly like a brand new install. Admins only. Intended for
// test runs, not real data.
router.post("/", async (req, res) => {
	await db.run("DELETE FROM gift_transaction_items");
	await db.run("DELETE FROM gift_transactions");
	await db.run("DELETE FROM items");
	await db.run("DELETE FROM letters");
	await db.run("DELETE FROM received_requests");
	await db.run("DELETE FROM users");

	for (const table of [
		"items",
		"gift_transactions",
		"gift_transaction_items",
		"users",
		"letters",
		"received_requests",
	]) {
		await db.run(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
	}

	await db.seedDefaultUsers();

	// Remove uploaded letter PDFs, item photos, and request files from disk.
	for (const dir of [UPLOAD_DIR, ITEM_IMAGE_DIR, REQUEST_FILE_DIR]) {
		try {
			for (const file of fs.readdirSync(dir)) {
				const full = path.join(dir, file);
				if (file === ".gitkeep" || fs.statSync(full).isDirectory()) continue;
				fs.unlinkSync(full);
			}
		} catch (err) {
			// folder missing or already empty — fine either way
		}
	}

	req.session.destroy(() => {
		res.clearCookie("connect.sid");
		res.json({ ok: true });
	});
});

module.exports = router;
