import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import db, { lookup, UPLOAD_DIR, id as newId } from '../lib/db.js';
import { authenticate, requireRole, ROLES } from '../lib/auth.js';
import { kindOf } from '../lib/parse.js';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => cb(null, `${newId('s')}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => (kindOf(file.originalname)
    ? cb(null, true)
    : cb(new Error('Accepted formats: PDF, Word, Excel, and photographs or scans of handwritten work.'))),
});

// As in academics.js: resolve every subject and faculty member for a batch of
// assignments in two queries, then decorate rows synchronously.
async function decorator(rows) {
  const subjects = await lookup('subjects', rows.map((a) => a.subjectId));
  const faculty = await lookup('users', rows.map((a) => a.facultyId));
  return (a) => {
    const s = subjects.get(a.subjectId);
    return { ...a, subject: s?.name ?? 'Unknown', code: s?.code ?? '', faculty: faculty.get(a.facultyId)?.name ?? null };
  };
}

router.get('/', async (req, res) => {
  let rows = await db.assignments.all();
  if (req.user.role === ROLES.STUDENT) {
    const mine = new Set((await db.subjects.find({ branch: req.user.branch, semester: req.user.semester })).map((s) => s.id));
    rows = rows.filter((a) => mine.has(a.subjectId));
    const submissions = await db.submissions.find({ studentId: req.user.id });
    const byAssignment = new Map(submissions.map((s) => [s.assignmentId, s]));
    const decorate = await decorator(rows);
    return res.json({
      assignments: rows
        .map((a) => ({ ...decorate(a), submission: byAssignment.get(a.id) ?? null }))
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)),
    });
  }
  if (req.user.role === ROLES.FACULTY) rows = rows.filter((a) => a.facultyId === req.user.id);
  // Submission counts and cohort sizes come from two queries grouped in memory,
  // not a pair of queries per assignment.
  const subsByAssignment = new Map();
  for (const s of await db.submissions.find({ assignmentId: rows.map((a) => a.id) })) {
    if (!subsByAssignment.has(s.assignmentId)) subsByAssignment.set(s.assignmentId, []);
    subsByAssignment.get(s.assignmentId).push(s);
  }
  const cohortSize = new Map();
  for (const u of await db.users.find({ role: 'student' })) {
    const key = `${u.branch}|${u.semester}`;
    cohortSize.set(key, (cohortSize.get(key) ?? 0) + 1);
  }
  const decorate = await decorator(rows);
  const cards = rows.map((a) => {
    const subs = subsByAssignment.get(a.id) ?? [];
    return {
      ...decorate(a),
      submissionCount: subs.length,
      gradedCount: subs.filter((s) => s.status === 'graded').length,
      cohortSize: cohortSize.get(`${a.branch}|${a.semester}`) ?? 0,
    };
  });

  return res.json({
    assignments: cards.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  });
});

router.post('/', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
  const { subjectId, title, description, dueDate, maxMarks } = req.body ?? {};
  const subject = await db.subjects.byId(subjectId);
  if (!subject) return res.status(404).json({ error: 'Select a subject' });
  if (req.user.role === ROLES.FACULTY && subject.facultyId !== req.user.id) {
    return res.status(403).json({ error: 'You do not teach this subject' });
  }
  if (!title?.trim()) return res.status(400).json({ error: 'Give the assignment a title' });
  if (!dueDate) return res.status(400).json({ error: 'Set a due date' });

  const a = await db.assignments.insert({
    subjectId,
    facultyId: subject.facultyId,
    branch: subject.branch,
    semester: subject.semester,
    title: title.trim(),
    description: description?.trim() ?? '',
    dueDate: new Date(dueDate).toISOString(),
    maxMarks: Number(maxMarks) || 10,
    createdAt: new Date().toISOString(),
    acceptedFormats: ['pdf', 'docx', 'xlsx', 'image'],
  });
  return res.status(201).json({ assignment: (await decorator([a]))(a) });
});

router.get('/:id/submissions', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
  const a = await db.assignments.byId(req.params.id);
  if (!a) return res.status(404).json({ error: 'Assignment not found' });
  if (req.user.role === ROLES.FACULTY && a.facultyId !== req.user.id) {
    return res.status(403).json({ error: 'Not your assignment' });
  }
  const subs = await db.submissions.find({ assignmentId: a.id });
  const students = await lookup('users', subs.map((s) => s.studentId));
  const rows = subs.map((s) => {
    const u = students.get(s.studentId);
    return { ...s, student: u?.name ?? 'Unknown', enrollment: u?.enrollment ?? '', division: u?.division ?? '' };
  }).sort((a1, b1) => a1.student.localeCompare(b1.student));
  return res.json({ assignment: (await decorator([a]))(a), submissions: rows });
});

// Students submit work in any supported format, including a photograph of
// handwritten pages — the brief's requirement for handwritten submission.
router.post('/:id/submit', requireRole(ROLES.STUDENT), upload.single('file'), async (req, res) => {
  const a = await db.assignments.byId(req.params.id);
  if (!a) return res.status(404).json({ error: 'Assignment not found' });
  if (a.branch !== req.user.branch || a.semester !== req.user.semester) {
    return res.status(403).json({ error: 'This assignment is not for your class' });
  }
  if (!req.file) return res.status(400).json({ error: 'Attach your work before submitting' });

  const late = new Date(a.dueDate).getTime() < Date.now();
  const existing = await db.submissions.findOne({ assignmentId: a.id, studentId: req.user.id });
  const payload = {
    assignmentId: a.id,
    studentId: req.user.id,
    fileName: req.file.originalname,
    storedName: req.file.filename,
    fileType: kindOf(req.file.originalname),
    sizeBytes: req.file.size,
    submittedAt: new Date().toISOString(),
    late,
    status: 'submitted',
    marks: null,
    feedback: null,
    isDemo: false,
  };
  const row = existing ? await db.submissions.update(existing.id, payload) : await db.submissions.insert(payload);
  return res.status(201).json({
    submission: row,
    message: late
      ? 'Submitted after the due date — it is recorded as late and your faculty will see that.'
      : 'Submitted on time.',
  });
});

router.post('/submissions/:id/grade', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
  const s = await db.submissions.byId(req.params.id);
  if (!s) return res.status(404).json({ error: 'Submission not found' });
  const a = await db.assignments.byId(s.assignmentId);
  if (req.user.role === ROLES.FACULTY && a?.facultyId !== req.user.id) {
    return res.status(403).json({ error: 'Not your assignment' });
  }
  const marks = Number(req.body?.marks);
  if (Number.isNaN(marks) || marks < 0 || marks > (a?.maxMarks ?? 100)) {
    return res.status(400).json({ error: `Marks must be between 0 and ${a?.maxMarks ?? 100}` });
  }
  const row = await db.submissions.update(s.id, {
    marks,
    feedback: req.body?.feedback?.trim() ?? null,
    status: 'graded',
    gradedAt: new Date().toISOString(),
    gradedBy: req.user.id,
  });
  return res.json({ submission: row });
});

router.get('/submissions/:id/file', async (req, res) => {
  const s = await db.submissions.byId(req.params.id);
  if (!s) return res.status(404).json({ error: 'Submission not found' });
  const a = await db.assignments.byId(s.assignmentId);
  const allowed = req.user.role === ROLES.ADMIN
    || s.studentId === req.user.id
    || (req.user.role === ROLES.FACULTY && a?.facultyId === req.user.id);
  if (!allowed) return res.status(403).json({ error: 'Not permitted' });
  if (!s.storedName) return res.status(404).json({ error: 'This is seeded demo content with no file attached.' });
  return res.download(path.join(UPLOAD_DIR, s.storedName), s.fileName);
});

export default router;
