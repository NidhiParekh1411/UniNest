import { Router } from 'express';
import db, { lookup } from '../lib/db.js';
import { authenticate, requireRole, ROLES } from '../lib/auth.js';
import { buildQuestionBank } from '../rag/generate.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  let rows = await db.questionbanks.all();
  // Students only ever see banks a faculty member has explicitly published.
  if (req.user.role === ROLES.STUDENT) {
    const mine = new Set((await db.subjects.find({ branch: req.user.branch, semester: req.user.semester })).map((s) => s.id));
    rows = rows.filter((q) => q.status === 'published' && mine.has(q.subjectId));
  } else if (req.user.role === ROLES.FACULTY) {
    rows = rows.filter((q) => q.createdBy === req.user.id);
  }
  const subjects = await lookup('subjects', rows.map((q) => q.subjectId));
  const authors = await lookup('users', rows.map((q) => q.createdBy));
  res.json({
    banks: rows
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((q) => ({
        ...q,
        subject: q.subjectId ? subjects.get(q.subjectId)?.name : null,
        author: authors.get(q.createdBy)?.name ?? 'Unknown',
        questionCount: q.questions.length,
      })),
  });
});

router.get('/:id', async (req, res) => {
  const bank = await db.questionbanks.byId(req.params.id);
  if (!bank) return res.status(404).json({ error: 'Question bank not found' });
  if (req.user.role === ROLES.STUDENT && bank.status !== 'published') {
    return res.status(404).json({ error: 'Question bank not found' });
  }
  if (req.user.role === ROLES.FACULTY && bank.createdBy !== req.user.id && bank.status !== 'published') {
    return res.status(403).json({ error: 'This draft belongs to another faculty member' });
  }
  return res.json({
    bank: {
      ...bank,
      subject: bank.subjectId ? (await db.subjects.byId(bank.subjectId))?.name : null,
      author: (await db.users.byId(bank.createdBy))?.name ?? 'Unknown',
    },
  });
});

// The content-generation agent. Output is always a DRAFT — the deck is explicit
// that a professor reviews before publishing.
router.post('/generate', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res, next) => {
  try {
    const { documentId, subjectId, count = 12, difficulty = 'mixed' } = req.body ?? {};
    if (!documentId) return res.status(400).json({ error: 'Choose a source document' });

    const doc = await db.documents.byId(documentId);
    if (!doc) return res.status(404).json({ error: 'Source document not found' });
    if (req.user.role === ROLES.FACULTY && doc.uploadedBy !== req.user.id && doc.audience === 'faculty') {
      return res.status(403).json({ error: 'You cannot use that document as a source' });
    }

    const draft = await buildQuestionBank({
      documentId,
      subjectId: subjectId || null,
      count: Math.min(30, Math.max(4, Number(count) || 12)),
      difficulty,
      createdBy: req.user.id,
    });
    const saved = await db.questionbanks.insert(draft);
    return res.status(201).json({
      bank: saved,
      message: draft.engine === 'gemini'
        ? 'Draft generated. Review every question before publishing.'
        : 'Draft generated offline from the document’s own content. Review and edit before publishing — an offline draft needs more editing than one written with a language model.',
    });
  } catch (err) {
    if (/no extractable text|Could not derive|not found/i.test(err.message)) {
      return res.status(422).json({ error: err.message });
    }
    return next(err);
  }
});

router.patch('/:id', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
  const bank = await db.questionbanks.byId(req.params.id);
  if (!bank) return res.status(404).json({ error: 'Question bank not found' });
  if (req.user.role === ROLES.FACULTY && bank.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'Not your question bank' });
  }
  const patch = {};
  if (typeof req.body?.title === 'string') patch.title = req.body.title.trim();
  if (Array.isArray(req.body?.questions)) {
    patch.questions = req.body.questions;
    patch.totalMarks = req.body.questions.reduce((n, q) => n + (Number(q.marks) || 0), 0);
  }
  if (req.body?.status === 'published' || req.body?.status === 'draft') patch.status = req.body.status;
  patch.updatedAt = new Date().toISOString();
  return res.json({ bank: await db.questionbanks.update(bank.id, patch) });
});

router.delete('/:id', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
  const bank = await db.questionbanks.byId(req.params.id);
  if (!bank) return res.status(404).json({ error: 'Question bank not found' });
  if (req.user.role === ROLES.FACULTY && bank.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'Not your question bank' });
  }
  await db.questionbanks.remove(bank.id);
  return res.json({ ok: true });
});

export default router;
