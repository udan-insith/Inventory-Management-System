const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../database");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
	const { username, password } = req.body || {};

	if (!username || !password) {
		return res.status(400).json({ error: "Enter a username and password." });
	}

	const user = await db.get("SELECT * FROM users WHERE username = ?", [
		String(username).trim().toLowerCase(),
	]);

	if (!user || !bcrypt.compareSync(password, user.password_hash)) {
		return res.status(401).json({ error: "Incorrect username or password." });
	}

	req.session.user = {
		id: user.id,
		username: user.username,
		displayName: user.display_name,
		role: user.role,
	};

	res.json({ user: req.session.user });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
	req.session.destroy(() => {
		res.clearCookie("connect.sid");
		res.json({ ok: true });
	});
});

// GET /api/auth/session
router.get("/session", (req, res) => {
	if (req.session && req.session.user) {
		return res.json({ user: req.session.user });
	}
	res.status(401).json({ error: "Not logged in." });
});

module.exports = router;
