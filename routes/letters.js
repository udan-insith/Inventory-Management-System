const express = require('express');
const fs = require('fs');
const multer = require('multer');
const db = require('../database');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();
router.use(requireLogin);

const UPLOAD_DIR = require('../config').UPLOAD_DIR;
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => cb(null, `letter-${req.params.type}-${Date.now()}.pdf`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are accepted.'));
    cb(null, true);
  },
});

// Only 'issue' or 'receive' are valid letter types.
router.param('type', (req, res, next, type) => {
  if (type !== 'issue' && type !== 'receive') {
    return res.status(404).json({ error: 'Unknown letter type.' });
  }
  next();
});

async function canUpload(req) {
  const row = await db.get('SELECT can_upload_letter FROM users WHERE id = ?', [req.session.user.id]);
  return !!row && row.can_upload_letter === 1;
}

// GET /api/letters/:type -> metadata: has this letter been uploaded yet
router.get('/:type', async (req, res) => {
  const row = await db.get(
    `SELECT l.*, u.display_name AS uploaded_by_name FROM letters l
     LEFT JOIN users u ON u.id = l.uploaded_by WHERE l.type = ?`,
    [req.params.type]
  );
  res.json({
    letter: row
      ? { filename: row.filename, uploadedBy: row.uploaded_by_name, uploadedAt: row.uploaded_at }
      : null,
    canUpload: await canUpload(req),
  });
});

// GET /api/letters/:type/file -> stream the uploaded PDF (used by "Print")
router.get('/:type/file', async (req, res) => {
  const row = await db.get('SELECT * FROM letters WHERE type = ?', [req.params.type]);
  if (!row || !fs.existsSync(row.filepath)) {
    return res.status(404).json({ error: 'No letter has been uploaded yet.' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="letter.pdf"');
  fs.createReadStream(row.filepath).pipe(res);
});

// POST /api/letters/:type/upload -> one-time upload, Udan School Leaver only
router.post('/:type/upload', async (req, res, next) => {
  if (!(await canUpload(req))) {
    return res.status(403).json({ error: 'Only Udan School Leaver can upload this letter.' });
  }

  const existing = await db.get('SELECT id FROM letters WHERE type = ?', [req.params.type]);
  if (existing) {
    return res.status(409).json({ error: 'This letter has already been uploaded once and cannot be replaced.' });
  }

  upload.single('letter')(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
      if (!req.file) return res.status(400).json({ error: 'Choose a PDF file to upload.' });

      await db.run('INSERT INTO letters (type, filename, filepath, uploaded_by) VALUES (?, ?, ?, ?)', [
        req.params.type,
        req.file.originalname,
        req.file.path,
        req.session.user.id,
      ]);

      res.status(201).json({ ok: true, filename: req.file.originalname });
    } catch (dbErr) {
      next(dbErr);
    }
  });
});

module.exports = router;
