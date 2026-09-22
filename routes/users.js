const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../database");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// All routes here require an admin session
router.use(requireAdmin);

// GET /api/users  -> list everyone (admins can see the full team,
// but can only edit/delete Normal User accounts)
router.get("/", async (req, res) => {
	const users = await db.all(
		"SELECT id, username, display_name, role, created_at FROM users ORDER BY role DESC, display_name ASC",
	);
	res.json({ users });
});

// POST /api/users  -> add a new Normal User
router.post("/", async (req, res) => {
	const { username, displayName, password } = req.body || {};

	if (!username || !displayName || !password) {
		return res
			.status(400)
			.json({ error: "Username, display name and password are all required." });
	}
	if (password.length < 6) {
		return res
			.status(400)
			.json({ error: "Password should be at least 6 characters." });
	}

	const cleanUsername = String(username)
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ".");
	const existing = await db.get("SELECT id FROM users WHERE username = ?", [
		cleanUsername,
	]);
	if (existing) {
		return res.status(409).json({ error: "That username is already taken." });
	}

	const hash = bcrypt.hashSync(password, 10);
	const info = await db.run(
		"INSERT INTO users (username, display_name, password_hash, role) VALUES (?, ?, ?, ?)",
		[cleanUsername, displayName.trim(), hash, "normal"],
	);

	res.status(201).json({
		user: {
			id: info.lastInsertRowid,
			username: cleanUsername,
			display_name: displayName.trim(),
			role: "normal",
		},
	});
});

// PUT /api/users/me -> the logged-in admin changes their OWN username
// and/or password. This is the one way an admin account can be edited —
// only by that admin, on themselves, and only after re-confirming their
// current password (so a session left open on a shared PC can't be used
// to silently take over the account).
router.put("/me", async (req, res) => {
	const { currentPassword, newUsername, newPassword } = req.body || {};
	const me = await db.get("SELECT * FROM users WHERE id = ?", [
		req.session.user.id,
	]);

	if (
		!currentPassword ||
		!bcrypt.compareSync(currentPassword, me.password_hash)
	) {
		return res.status(401).json({ error: "Current password is incorrect." });
	}
	if (!newUsername && !newPassword) {
		return res
			.status(400)
			.json({ error: "Enter a new username and/or a new password." });
	}
	if (newPassword && newPassword.length < 6) {
		return res
			.status(400)
			.json({ error: "New password should be at least 6 characters." });
	}

	let cleanUsername = me.username;
	if (newUsername) {
		cleanUsername = String(newUsername)
			.trim()
			.toLowerCase()
			.replace(/\s+/g, ".");
		const clash = await db.get(
			"SELECT id FROM users WHERE username = ? AND id != ?",
			[cleanUsername, me.id],
		);
		if (clash) {
			return res.status(409).json({ error: "That username is already taken." });
		}
	}

	if (newPassword) {
		const hash = bcrypt.hashSync(newPassword, 10);
		await db.run(
			"UPDATE users SET username = ?, password_hash = ? WHERE id = ?",
			[cleanUsername, hash, me.id],
		);
	} else {
		await db.run("UPDATE users SET username = ? WHERE id = ?", [
			cleanUsername,
			me.id,
		]);
	}

	// Username may have changed — keep the session's display copy in sync.
	req.session.user.username = cleanUsername;

	res.json({
		user: {
			id: me.id,
			username: cleanUsername,
			displayName: me.display_name,
			role: me.role,
		},
	});
});

// Helper: fetch a Normal User by id, or null. Admin accounts are protected
// from edits/deletes made through this API (see PUT /me above for how an
// admin manages their own account instead).
async function getEditableNormalUser(id) {
	const user = await db.get("SELECT * FROM users WHERE id = ?", [id]);
	if (!user || user.role !== "normal") return null;
	return user;
}

// PUT /api/users/:id  -> change a Normal User's username / display name,
// and optionally reset their password (e.g. if they forgot it).
router.put("/:id", async (req, res) => {
	const target = await getEditableNormalUser(Number(req.params.id));
	if (!target) {
		return res
			.status(404)
			.json({
				error:
					"That user was not found, or is an admin account (admin accounts are protected).",
			});
	}

	const { username, displayName, password } = req.body || {};
	if (!username && !displayName && !password) {
		return res
			.status(400)
			.json({
				error: "Provide a new username, display name, and/or password.",
			});
	}
	if (password && password.length < 6) {
		return res
			.status(400)
			.json({ error: "Password should be at least 6 characters." });
	}

	let newUsername = target.username;
	if (username) {
		newUsername = String(username).trim().toLowerCase().replace(/\s+/g, ".");
		const clash = await db.get(
			"SELECT id FROM users WHERE username = ? AND id != ?",
			[newUsername, target.id],
		);
		if (clash) {
			return res.status(409).json({ error: "That username is already taken." });
		}
	}
	const newDisplayName = displayName ? displayName.trim() : target.display_name;

	if (password) {
		const hash = bcrypt.hashSync(password, 10);
		await db.run(
			"UPDATE users SET username = ?, display_name = ?, password_hash = ? WHERE id = ?",
			[newUsername, newDisplayName, hash, target.id],
		);
	} else {
		await db.run(
			"UPDATE users SET username = ?, display_name = ? WHERE id = ?",
			[newUsername, newDisplayName, target.id],
		);
	}

	res.json({
		user: {
			id: target.id,
			username: newUsername,
			display_name: newDisplayName,
			role: "normal",
		},
	});
});

// DELETE /api/users/:id -> remove a Normal User
router.delete("/:id", async (req, res) => {
	const target = await getEditableNormalUser(Number(req.params.id));
	if (!target) {
		return res
			.status(404)
			.json({
				error:
					"That user was not found, or is an admin account (admin accounts are protected).",
			});
	}

	await db.run("DELETE FROM users WHERE id = ?", [target.id]);
	res.json({ ok: true });
});

module.exports = router;
