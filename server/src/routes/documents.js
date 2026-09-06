import path from 'node:path';
import fs from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import db, { lookup, UPLOAD_DIR, id as newId } from '../lib/db.js';
import { authenticate, requireRole, scopeOf, ROLES } from '../lib/auth.js';
import { extract, kindOf } from '../lib/parse.js';
import { chunkText } from '../rag/chunk.js';
import { enrichDocument, enrichInBackground } from '../rag/enrich.js';
import { providerName } from '../rag/llm.js';
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
  const chunks = (await db.chunks.find({ docId: doc.id }))
    .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
  return res.json({
    document: { ...doc, uploader: (await db.users.byId(doc.uploadedBy))?.name ?? 'Unknown' },
    sections: [...new Set(chunks.map((c) => c.section).filter(Boolean))],
    // The viewer renders the document itself; these passages are the text
    // *behind* it — what the assistant can actually quote — so it is the whole
    // set in order, not the first four.
    passages: chunks.map((c) => ({ section: c.section, page: c.page, text: c.text })),
    canAnalyse: req.user.role !== ROLES.STUDENT && providerName() === 'gemini',
  });
});

// Re-read and re-describe a document on demand. Deliberately synchronous: the
// caller pressed a button and is watching a spinner, and transcription of a
// scanned file takes long enough that a fire-and-forget would just look broken.
router.post('/:id/analyse', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res, next) => {
  try {
    const doc = await db.documents.byId(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (req.user.role === ROLES.FACULTY && doc.uploadedBy !== req.user.id && doc.audience === 'faculty') {
      return res.status(403).json({ error: 'You cannot analyse that document' });
    }
    const analysis = await enrichDocument(doc.id, { force: true });
    const fresh = await db.documents.byId(doc.id);
    return res.json({ analysis, document: fresh });
  } catch (err) { return next(err); }
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
  // `download` forces an attachment, which is right for a Save button and
  // wrong for the viewer — a PDF cannot be rendered in a frame if the browser
  // is told to save it. The default is now inline; `?download=1` asks for the
  // old behaviour.
  if (req.query.download) return res.download(filePath, doc.fileName);
  res.type(path.extname(doc.fileName || doc.storedName) || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
  return res.sendFile(filePath);
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

    // Whatever the local parse managed, hand the file to the model as well:
    // it transcribes what could not be parsed and describes what could. In the
    // background, because the uploader should not wait on it.
    const willEnrich = providerName() === 'gemini';
    if (willEnrich) enrichInBackground(doc.id);

    return res.status(201).json({
      document: { ...doc, chunkCount: chunks.length },
      indexed: chunks.length,
      analysing: willEnrich,
      warning: willEnrich
        ? null
        : (parsed.needsOcr
          ? 'The file is stored and downloadable, but an image cannot be searched until OCR is enabled — the assistant will not be able to quote from it.'
          : (chunks.length === 0 ? 'No text could be extracted, so this file will not appear in assistant answers.' : null)),
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
