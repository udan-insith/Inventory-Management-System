const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../database');
const { requireLogin } = require('../middleware/auth');
const { renderLetter, formatDate } = require('../lib/letterMerge');

const router = express.Router();
router.use(requireLogin);

const UPLOAD_DIR = require('../config').UPLOAD_DIR;
const LETTER_DIR = path.join(UPLOAD_DIR, 'letters');
if (!fs.existsSync(LETTER_DIR)) fs.mkdirSync(LETTER_DIR, { recursive: true });

// The bundled default templates (built from the bank's actual letter
// format) — used whenever nobody has uploaded a custom one.
const DEFAULT_TEMPLATE = {
  issue: path.join(__dirname, '..', 'templates', 'issue-letter-template.docx'),
  receive: path.join(__dirname, '..', 'templates', 'receive-letter-template.docx'),
};

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, LETTER_DIR),
    filename: (req, file, cb) => cb(null, `letter-${req.params.type}-${Date.now()}.docx`),
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== DOCX_MIME) return cb(new Error('Only Word (.docx) files are accepted.'));
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

// Resolve which template file to use: a custom-uploaded one if present and
// still on disk, otherwise the bundled default for that type.
async function resolveTemplatePath(type) {
  const row = await db.get('SELECT * FROM letters WHERE type = ?', [type]);
  if (row && fs.existsSync(row.filepath)) return { path: row.filepath, custom: true, row };
  return { path: DEFAULT_TEMPLATE[type], custom: false, row: null };
}

// GET /api/letters/:type -> metadata: is a custom letter uploaded, who can upload
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

// POST /api/letters/:type/upload -> replace the letter template (Udan School
// Leaver only). Not a strict one-time upload any more — the template can be
// swapped if the bank's letter format ever changes; re-uploading replaces
// whatever was there.
router.post('/:type/upload', async (req, res, next) => {
  if (!(await canUpload(req))) {
    return res.status(403).json({ error: 'Only Udan School Leaver can upload this letter.' });
  }

  upload.single('letter')(req, res, async (err) => {
    try {
      if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
      if (!req.file) return res.status(400).json({ error: 'Choose a Word (.docx) file to upload.' });

      const existing = await db.get('SELECT * FROM letters WHERE type = ?', [req.params.type]);
      await db.run(
        `INSERT INTO letters (type, filename, filepath, uploaded_by) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE filename = VALUES(filename), filepath = VALUES(filepath),
           uploaded_by = VALUES(uploaded_by), uploaded_at = CURRENT_TIMESTAMP`,
        [req.params.type, req.file.originalname, req.file.path, req.session.user.id]
      );

      // Clean up the file it's replacing (if any).
      if (existing && existing.filepath && existing.filepath !== req.file.path && fs.existsSync(existing.filepath)) {
        fs.unlink(existing.filepath, () => {});
      }

      res.status(201).json({ ok: true, filename: req.file.originalname });
    } catch (dbErr) {
      next(dbErr);
    }
  });
});

// POST /api/letters/:type/print -> fill the template with this transaction's
// details and send back a ready-to-print .docx.
// Body: { branchName, date, items: [{ name, qty }], receiverName, pfNumber }
router.post('/:type/print', async (req, res, next) => {
  try {
    const { branchName, date, items, receiverName, pfNumber } = req.body || {};
    if (!branchName || !date || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Branch, date and at least one item are required.' });
    }

    const { path: templatePath } = await resolveTemplatePath(req.params.type);
    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: 'No letter template is available for this type.' });
    }

    const buffer = renderLetter(templatePath, {
      branchName: String(branchName),
      dateFormatted: formatDate(date),
      items: items.map((i) => ({ name: String(i.name || ''), qty: Number(i.qty) || 0 })),
      receiverName: receiverName ? String(receiverName) : '',
      pfNumber: pfNumber ? String(pfNumber) : '',
    });

    const safeBranch = String(branchName).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');
    const label = req.params.type === 'issue' ? 'Issuing' : 'Receiving';
    const filename = `Gift-${label}-Letter-${safeBranch}-${date}.docx`;

    res.setHeader('Content-Type', DOCX_MIME);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
