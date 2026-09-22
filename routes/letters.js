const express = require("express");
const fs = require("fs");
const multer = require("multer");
const db = require("../database");
const { requireLogin } = require("../middleware/auth");

const router = express.Router();
router.use(requireLogin);

const UPLOAD_DIR = require("../config").UPLOAD_DIR;
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
	storage: multer.diskStorage({
		destination: (req, file, cb) => cb(null, UPLOAD_DIR),
		filename: (req, file, cb) =>
			cb(null, `letter-${req.params.type}-${Date.now()}.pdf`),
	}),
	limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
	fileFilter: (req, file, cb) => {
		if (file.mimetype !== "application/pdf")
			return cb(new Error("Only PDF files are accepted."));
		cb(null, true);
	},
});

// Only 'issue' or 'receive' are valid letter types.
router.param("type", (req, res, next, type) => {
	if (type !== "issue" && type !== "receive") {
		return res.status(404).json({ error: "Unknown letter type." });
	}
	next();
});

async function canUpload(req) {
	const row = await db.get("SELECT can_upload_letter FROM users WHERE id = ?", [
		req.session.user.id,
	]);
	return !!row && row.can_upload_letter === 1;
}

// GET /api/letters/:type -> metadata: has this letter been uploaded yet
router.get("/:type", async (req, res) => {
	const row = await db.get(
		`SELECT l.*, u.display_name AS uploaded_by_name FROM letters l
     LEFT JOIN users u ON u.id = l.uploaded_by WHERE l.type = ?`,
		[req.params.type],
	);
	res.json({
		letter: row
			? {
					filename: row.filename,
					uploadedBy: row.uploaded_by_name,
					uploadedAt: row.uploaded_at,
				}
			: null,
		canUpload: await canUpload(req),
	});
});
