import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import db, { lookup, UPLOAD_DIR, id as newId } from '../lib/db.js';
import { authenticate, requireRole, scopeOf, ROLES } from '../lib/auth.js';
import { extract, kindOf } from '../lib/parse.js';
import { chunkText } from '../rag/chunk.js';
import { visibleDocuments, visibleTo } from '../rag/retrieve.js';

const router = Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${newId('f')}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!kindOf(file.originalname)) return cb(new Error(`Unsupported file type. Accepted: PDF, Word, Excel, PowerPoint, text, and images of handwritten notes.`));
    return cb(null, true);
  },
});

router.get('/', async (req, res) => {
  const scope = await scopeOf(req);
  let rows = await visibleDocuments(scope);
  if (req.query.category) rows = rows.filter((d) => d.category === req.query.category);
  if (req.query.mine === 'true') rows = rows.filter((d) => d.uploadedBy === req.user.id);
  const uploaders = await lookup('users', rows.map((d) => d.uploadedBy));
  const subjects = await lookup('subjects', rows.map((d) => d.subjectId));
  res.json({
    documents: rows
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .map((d) => ({ ...d, uploader: uploaders.get(d.uploadedBy)?.name ?? 'Unknown', subject: d.subjectId ? subjects.get(d.subjectId)?.name : null })),
  });
});

router.get('/:id', async (req, res) => {
  const doc = await db.documents.byId(req.params.id);
  const scope = await scopeOf(req);
  if (!doc || !visibleTo({ ...doc, docId: doc.id }, scope, { includeSuperseded: scope.role !== 'student' })) {
    return res.status(404).json({ error: 'Document not found' });
  }
  const chunks = await db.chunks.find({ docId: doc.id });
  return res.json({
    document: { ...doc, uploader: (await db.users.byId(doc.uploadedBy))?.name ?? 'Unknown' },
    sections: [...new Set(chunks.map((c) => c.section).filter(Boolean))],
    preview: chunks.slice(0, 4).map((c) => ({ section: c.section, page: c.page, text: c.text })),
  });
});

router.get('/:id/file', async (req, res) => {
  const doc = await db.documents.byId(req.params.id);
  const scope = await scopeOf(req);
  if (!doc || !visibleTo({ ...doc, docId: doc.id }, scope, { includeSuperseded: scope.role !== 'student' })) {
    return res.status(404).json({ error: 'Document not found' });
  }
  if (!doc.storedName) {
    return res.status(404).json({ error: 'This is seeded demo content and has no original file attached.' });
  }
  const filePath = path.join(UPLOAD_DIR, doc.storedName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File is missing from storage' });
  return res.download(filePath, doc.fileName);
});

// Ingestion — the offline half of the deck's architecture: authenticate the
// uploader, detect the file type, extract with the right parser, chunk, index,
// and stamp everything with the upload date and source file.
router.post('/', requireRole(ROLES.FACULTY, ROLES.ADMIN), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Attach a file to upload' });
    const { title, category = 'notes', audience = 'all', branch = 'ALL', subjectId, supersedes } = req.body ?? {};
    const semester = req.body?.semester ? Number(req.body.semester) : 0;

    const parsed = await extract(req.file.path, req.file.originalname);
    const now = new Date().toISOString();

    // Versioning: a new upload may retire an earlier document. The old one stays
    // readable in the library but is excluded from retrieval, so the assistant
    // can never quote a superseded circular.
    let version = 1;
    if (supersedes) {
      const prior = await db.documents.byId(supersedes);
      if (prior) {
        version = (prior.version ?? 1) + 1;
        await db.documents.update(prior.id, { superseded: true, supersededBy: 'pending' });
        await db.chunks.updateWhere({ docId: prior.id }, { superseded: true });
      }
    }

    const doc = await db.documents.insert({
      title: title?.trim() || req.file.originalname.replace(/\.[^.]+$/, ''),
      fileName: req.file.originalname,
      storedName: req.file.filename,
      fileType: parsed.kind,
      category,
      audience,
      branch,
      semester,
      subjectId: subjectId || null,
      version,
      supersedes: supersedes || null,
      superseded: false,
      status: 'published',
      uploadedBy: req.user.id,
      uploadedAt: now,
      sizeBytes: req.file.size,
      pages: parsed.pages ?? 1,
      needsOcr: Boolean(parsed.needsOcr),
      note: parsed.note ?? null,
      isDemo: false,
      chunkCount: 0,
    });

    if (supersedes) await db.documents.update(supersedes, { supersededBy: doc.id });

    const chunks = chunkText(parsed.text ?? '', { pages: parsed.pages }).map((c) => ({
      docId: doc.id,
      title: doc.title,
      section: c.section,
      page: c.page,
      ordinal: c.ordinal,
      text: c.text,
      category: doc.category,
      audience: doc.audience,
      branch: doc.branch,
      semester: doc.semester,
      uploadedAt: doc.uploadedAt,
      uploadedBy: doc.uploadedBy,
      status: 'published',
      superseded: false,
    }));
    if (chunks.length) await db.chunks.insertMany(chunks);
    await db.documents.update(doc.id, { chunkCount: chunks.length });

    return res.status(201).json({
      document: { ...doc, chunkCount: chunks.length },
      indexed: chunks.length,
      warning: parsed.needsOcr
        ? 'The file is stored and downloadable, but an image cannot be searched until OCR is enabled — the assistant will not be able to quote from it.'
        : (chunks.length === 0 ? 'No text could be extracted, so this file will not appear in assistant answers.' : null),
    });
  } catch (err) { return next(err); }
});

router.delete('/:id', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
  const doc = await db.documents.byId(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  if (req.user.role === ROLES.FACULTY && doc.uploadedBy !== req.user.id) {
    return res.status(403).json({ error: 'You can only remove documents you uploaded' });
  }
  await db.chunks.removeWhere({ docId: doc.id });
  await db.documents.remove(doc.id);
  if (doc.storedName) {
    fs.promises.unlink(path.join(UPLOAD_DIR, doc.storedName)).catch(() => {});
  }
  return res.json({ ok: true });
});

export default router;
