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

// GET /api/requests -> every received request, newest first
router.get("/", async (req, res) => {
	const requests = await db.all(
		`SELECT r.id, r.branch_name, r.request_date, r.description, r.file_name, r.file_type, r.uploaded_at,
            u.display_name AS uploaded_by
     FROM received_requests r
     LEFT JOIN users u ON u.id = r.uploaded_by
     ORDER BY r.request_date DESC, r.uploaded_at DESC`,
	);
	res.json({ requests });
});

// POST /api/requests -> log a new request with its supporting document
router.post("/", (req, res, next) => {
	upload.single("file")(req, res, async (err) => {
		try {
			if (err)
				return res.status(400).json({ error: err.message || "Upload failed." });
			if (!req.file)
				return res
					.status(400)
					.json({ error: "Attach a file (image, PDF, or Word document)." });

			const { branchName, date, description } = req.body || {};
			if (!branchName || !branchName.trim()) {
				return res.status(400).json({ error: "Choose a branch." });
			}
			if (!date) {
				return res.status(400).json({ error: "Pick a date." });
			}

			const info = await db.run(
				`INSERT INTO received_requests (branch_name, request_date, description, file_path, file_name, file_type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[
					branchName.trim(),
					date,
					(description || "").trim(),
					req.file.path,
					req.file.originalname,
					req.file.mimetype,
					req.session.user.id,
				],
			);

			res.status(201).json({ id: info.lastInsertRowid });
		} catch (dbErr) {
			next(dbErr);
		}
	});
});

// GET /api/requests/:id/file -> view/download the attached document
router.get("/:id/file", async (req, res) => {
	const row = await db.get("SELECT * FROM received_requests WHERE id = ?", [
		req.params.id,
	]);
	if (!row || !fs.existsSync(row.file_path)) {
		return res.status(404).json({ error: "File not found." });
	}
	res.setHeader("Content-Type", row.file_type);
	// Images and PDFs render fine inline; Word docs should just download.
	const disposition =
		row.file_type.startsWith("image/") || row.file_type === "application/pdf"
			? "inline"
			: "attachment";
	res.setHeader(
		"Content-Disposition",
		`${disposition}; filename="${row.file_name}"`,
	);
	fs.createReadStream(row.file_path).pipe(res);
});
