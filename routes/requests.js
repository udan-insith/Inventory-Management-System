const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../database');
const { requireLogin, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireLogin);

const REQUEST_FILE_DIR = require('../config').REQUEST_FILE_DIR;
if (!fs.existsSync(REQUEST_FILE_DIR)) fs.mkdirSync(REQUEST_FILE_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, REQUEST_FILE_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '';
      cb(null, `request-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB — Word docs/scans can run bigger than a photo
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || ALLOWED_MIME.has(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only images, PDFs, or Word documents are accepted.'));
  },
});

// GET /api/requests -> every received request, newest first
router.get('/', async (req, res) => {
  const requests = await db.all(
    `SELECT r.id, r.branch_name, r.request_date, r.description, r.file_name, r.file_type, r.uploaded_at,
            u.display_name AS uploaded_by
     FROM received_requests r
     LEFT JOIN users u ON u.id = r.uploaded_by
     ORDER BY r.request_date DESC, r.uploaded_at DESC`
  );
  res.json({ requests });
});

// POST /api/requests -> log a new request with its supporting document
router.post('/', (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
      if (!req.file) return res.status(400).json({ error: 'Attach a file (image, PDF, or Word document).' });

      const { branchName, date, description } = req.body || {};
      if (!branchName || !branchName.trim()) {
        return res.status(400).json({ error: 'Choose a branch.' });
      }
      if (!date) {
        return res.status(400).json({ error: 'Pick a date.' });
      }

      const info = await db.run(
        `INSERT INTO received_requests (branch_name, request_date, description, file_path, file_name, file_type, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          branchName.trim(),
          date,
          (description || '').trim(),
          req.file.path,
          req.file.originalname,
          req.file.mimetype,
          req.session.user.id,
        ]
      );

      res.status(201).json({ id: info.lastInsertRowid });
    } catch (dbErr) {
      next(dbErr);
    }
  });
});

// GET /api/requests/:id/file -> view/download the attached document
router.get('/:id/file', async (req, res) => {
  const row = await db.get('SELECT * FROM received_requests WHERE id = ?', [req.params.id]);
  if (!row || !fs.existsSync(row.file_path)) {
    return res.status(404).json({ error: 'File not found.' });
  }
  res.setHeader('Content-Type', row.file_type);
  // Images and PDFs render fine inline; Word docs should just download.
  const disposition = row.file_type.startsWith('image/') || row.file_type === 'application/pdf' ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disposition}; filename="${row.file_name}"`);
  fs.createReadStream(row.file_path).pipe(res);
});

// DELETE /api/requests/:id -> remove a logged request (Admins only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const row = await db.get('SELECT * FROM received_requests WHERE id = ?', [req.params.id]);
  if (!row) return res.status(404).json({ error: 'Request not found.' });

  await db.run('DELETE FROM received_requests WHERE id = ?', [row.id]);
  if (fs.existsSync(row.file_path)) fs.unlink(row.file_path, () => {});

  res.json({ ok: true });
});

module.exports = router;
