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
