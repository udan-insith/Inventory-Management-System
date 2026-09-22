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

// Public-facing path for an item's image (served as a static file — see server.js)
function toPublicImagePath(absPath) {
	if (!absPath) return null;
	return `/item-images/${path.basename(absPath)}`;
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
