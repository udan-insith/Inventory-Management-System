const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const db = require("../database");
const { requireLogin, requireAdmin } = require("../middleware/auth");
const { deleteItemKeepingHistory } = require("../lib/itemLifecycle");

const router = express.Router();
router.use(requireLogin);

const ITEM_IMAGE_DIR = require("../config").ITEM_IMAGE_DIR;
if (!fs.existsSync(ITEM_IMAGE_DIR))
	fs.mkdirSync(ITEM_IMAGE_DIR, { recursive: true });

const upload = multer({
	storage: multer.diskStorage({
		destination: (req, file, cb) => cb(null, ITEM_IMAGE_DIR),
		filename: (req, file, cb) => {
			const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
			cb(null, `item-${Date.now()}${ext}`);
		},
	}),
	limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
	fileFilter: (req, file, cb) => {
		if (!file.mimetype.startsWith("image/")) {
			return cb(new Error("Only image files are accepted."));
		}
		cb(null, true);
	},
});

// Only the bare filename is ever stored in items.image_path now (see the
// fix-item-images migration). The public URL is built fresh from whatever
// the CURRENT ITEM_IMAGE_DIR is, so nothing can point at a stale location —
// this is what makes photos survive the project folder being moved again.
function toPublicImagePath(value) {
	if (!value) return null;
	return `/item-images/${path.basename(value)}`;
}

// GET /api/items -> every item with its current balance
router.get("/", async (req, res) => {
	const items = await db.all(
		"SELECT id, name, balance, low_stock_threshold, image_path, created_at FROM items ORDER BY name ASC",
	);
	res.json({
		items: items.map((i) => ({
			...i,
			image_path: toPublicImagePath(i.image_path),
		})),
	});
});
// POST /api/items -> add a new item to the storage, with its current
// balance and an optional photo.
router.post("/", (req, res, next) => {
	upload.single("image")(req, res, async (err) => {
		try {
			if (err)
				return res
					.status(400)
					.json({ error: err.message || "Image upload failed." });

			const { name, balance, lowStockThreshold } = req.body || {};
			if (!name || !name.trim()) {
				return res.status(400).json({ error: "Give the item a name." });
			}
			const startingBalance = Number.isFinite(Number(balance))
				? Math.max(0, Math.trunc(Number(balance)))
				: 0;
			const threshold = Number.isFinite(Number(lowStockThreshold))
				? Math.max(0, Math.trunc(Number(lowStockThreshold)))
				: 5;

			const existing = await db.get("SELECT id FROM items WHERE name = ?", [
				name.trim(),
			]);
			if (existing) {
				return res
					.status(409)
					.json({ error: "An item with that name already exists." });
			}

			// Store just the filename, never the full disk path — see the note
			// above toPublicImagePath().
			const imagePath = req.file ? req.file.filename : null;

			const itemId = await db.transaction(async (tx) => {
				const info = await tx.run(
					"INSERT INTO items (name, balance, low_stock_threshold, image_path, created_by) VALUES (?, ?, ?, ?, ?)",
					[
						name.trim(),
						startingBalance,
						threshold,
						imagePath,
						req.session.user.id,
					],
				);

				// Record the starting balance as a "receive" transaction so the
				// logs always reconcile with the balance shown on screen.
				if (startingBalance > 0) {
					const today = new Date().toISOString().slice(0, 10);
					const txInfo = await tx.run(
						"INSERT INTO gift_transactions (type, branch_name, event_name, log_date, created_by) VALUES (?, ?, ?, ?, ?)",
						[
							"receive",
							"—",
							"Initial stock balance",
							today,
							req.session.user.id,
						],
					);
					await tx.run(
						"INSERT INTO gift_transaction_items (transaction_id, item_id, item_name, quantity, balance_after) VALUES (?, ?, ?, ?, ?)",
						[
							txInfo.lastInsertRowid,
							info.lastInsertRowid,
							name.trim(),
							startingBalance,
							startingBalance,
						],
					);
				}

				return info.lastInsertRowid;
			});

			const item = await db.get(
				"SELECT id, name, balance, low_stock_threshold, image_path, created_at FROM items WHERE id = ?",
				[itemId],
			);
			res.status(201).json({
				item: { ...item, image_path: toPublicImagePath(item.image_path) },
			});
		} catch (dbErr) {
			next(dbErr);
		}
	});
});

// PATCH /api/items/:id/image -> change an item's photo any time
router.patch("/:id/image", (req, res, next) => {
	upload.single("image")(req, res, async (err) => {
		try {
			if (err)
				return res
					.status(400)
					.json({ error: err.message || "Image upload failed." });
			if (!req.file)
				return res.status(400).json({ error: "Choose an image file." });

			const item = await db.get("SELECT * FROM items WHERE id = ?", [
				req.params.id,
			]);
			if (!item)
				return res.status(404).json({ error: "That item no longer exists." });

			await db.run("UPDATE items SET image_path = ? WHERE id = ?", [
				req.file.filename,
				item.id,
			]);

			if (item.image_path) {
				const oldFile = path.join(ITEM_IMAGE_DIR, path.basename(item.image_path));
				if (fs.existsSync(oldFile)) fs.unlink(oldFile, () => {});
			}

			res.json({ image_path: toPublicImagePath(req.file.filename) });
		} catch (dbErr) {
			next(dbErr);
		}
	});
});

// DELETE /api/items/:id -> remove an item entirely (Admins only).
// Its Issue/Receive history stays in Total History (item_name is already
// snapshotted onto each transaction line) — only the item itself, and its
// place on the Stock page, goes away.
router.delete("/:id", requireAdmin, async (req, res) => {
	const item = await db.get("SELECT * FROM items WHERE id = ?", [
		req.params.id,
	]);
	if (!item) {
		return res.status(404).json({ error: "That item no longer exists." });
	}

	await deleteItemKeepingHistory(item.id);

	if (item.image_path) {
		const file = path.join(ITEM_IMAGE_DIR, path.basename(item.image_path));
		if (fs.existsSync(file)) fs.unlink(file, () => {});
	}

	res.json({ ok: true });
});

module.exports = router;
