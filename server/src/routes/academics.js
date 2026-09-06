import { Router } from 'express';
import db, { lookup } from '../lib/db.js';
import { authenticate, requireRole, ROLES } from '../lib/auth.js';

const router = Router();
router.use(authenticate);

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// A student may only ever read their own records. Staff may name a student.
// This helper is the single place that decision is made.
function targetStudent(req) {
  if (req.user.role === ROLES.STUDENT) return req.user.id;
  const requested = req.query.studentId ?? req.body?.studentId;
  return requested ?? null;
}

// Two queries up front, then a synchronous decorator the row loops can call.
// Resolving a subject and its faculty member per row would be an N+1.
async function decorator(subjectIds) {
  const subjects = await lookup('subjects', subjectIds);
  const faculty = await lookup('users', [...subjects.values()].map((s) => s.facultyId));
  return (subjectId) => {
    const s = subjects.get(subjectId);
    if (!s) return { subject: 'Unknown subject', code: '', faculty: null };
    return { subject: s.name, code: s.code, credits: s.credits, faculty: faculty.get(s.facultyId)?.name ?? null };
  };
}

router.get('/subjects', async (req, res) => {
  const branch = req.query.branch ?? (req.user.role === ROLES.STUDENT ? req.user.branch : undefined);
  const semester = req.query.semester ? Number(req.query.semester) : (req.user.role === ROLES.STUDENT ? req.user.semester : undefined);
  let rows = await db.subjects.find({ branch, semester });
  if (req.query.mine === 'true' && req.user.role === ROLES.FACULTY) {
    rows = await db.subjects.find({ facultyId: req.user.id });
  }
  const faculty = await lookup('users', rows.map((s) => s.facultyId));
  res.json({
    subjects: rows
      .sort((a, b) => a.semester - b.semester || a.name.localeCompare(b.name))
      .map((s) => ({ ...s, faculty: faculty.get(s.facultyId)?.name ?? null })),
  });
});

router.get('/timetable', async (req, res) => {
  const branch = req.query.branch ?? (req.user.role === ROLES.STUDENT ? req.user.branch : null);
  const semester = req.query.semester ? Number(req.query.semester) : (req.user.role === ROLES.STUDENT ? req.user.semester : null);

  // Faculty default to their own teaching schedule across every cohort — the
  // brief's "every faculty teaches different subjects in different semesters".
  if (req.user.role === ROLES.FACULTY && req.query.mine === 'true') {
    const mine = new Set((await db.subjects.find({ facultyId: req.user.id })).map((s) => s.id));
    const rows = (await db.timetable.all()).filter((t) => mine.has(t.subjectId));
    return res.json({ scope: 'faculty', rows: await enrich(rows) });
  }

  if (!branch || !semester) {
    return res.status(400).json({ error: 'Select a branch and semester to view a timetable' });
  }
  return res.json({ scope: 'cohort', branch, semester, rows: await enrich(await db.timetable.find({ branch, semester })) });

  async function enrich(rows) {
    const decorate = await decorator(rows.map((t) => t.subjectId));
    return rows
      .map((t) => ({ ...t, ...decorate(t.subjectId) }))
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startTime.localeCompare(b.startTime));
  }
});

router.get('/attendance', async (req, res) => {
  const studentId = targetStudent(req);

  // Cohort view for staff: one row per student, for a class they can see.
  if (!studentId) {
    if (req.user.role === ROLES.STUDENT) return res.status(403).json({ error: 'Not permitted' });
    const { branch, semester, subjectId } = req.query;
    let rows = await db.attendance.find({
      branch: branch || undefined,
      semester: semester ? Number(semester) : undefined,
      subjectId: subjectId || undefined,
    });
    if (req.user.role === ROLES.FACULTY && !subjectId) {
      const mine = new Set((await db.subjects.find({ facultyId: req.user.id })).map((s) => s.id));
      rows = rows.filter((r) => mine.has(r.subjectId));
    }
    const byStudent = new Map();
    for (const r of rows) {
      const agg = byStudent.get(r.studentId) ?? { attended: 0, total: 0, subjects: 0 };
      agg.attended += r.attended; agg.total += r.total; agg.subjects += 1;
      byStudent.set(r.studentId, agg);
    }
    const students = await lookup('users', [...byStudent.keys()]);
    const cohort = [...byStudent.entries()].map(([id, agg]) => {
      const u = students.get(id);
      return {
        studentId: id,
        name: u?.name ?? 'Unknown',
        enrollment: u?.enrollment ?? '',
        branch: u?.branch, semester: u?.semester, division: u?.division,
        attended: agg.attended, total: agg.total, percent: pct(agg.attended, agg.total),
        subjects: agg.subjects,
      };
    }).sort((a, b) => a.percent - b.percent);
    return res.json({ scope: 'cohort', cohort });
  }

  if (req.user.role === ROLES.STUDENT && studentId !== req.user.id) {
    return res.status(403).json({ error: 'Not permitted' });
  }

  const attendanceRows = await db.attendance.find({ studentId });
  const decorate = await decorator(attendanceRows.map((r) => r.subjectId));
  const rows = attendanceRows.map((r) => ({
    ...r, ...decorate(r.subjectId), percent: pct(r.attended, r.total),
  })).sort((a, b) => a.percent - b.percent);

  const attended = rows.reduce((n, r) => n + r.attended, 0);
  const total = rows.reduce((n, r) => n + r.total, 0);
  return res.json({
    scope: 'student',
    student: { id: studentId, name: (await db.users.byId(studentId))?.name },
    overall: { attended, total, percent: pct(attended, total), belowThreshold: rows.filter((r) => r.percent < 75).length },
    subjects: rows,
  });
});

router.get('/results', async (req, res) => {
  const studentId = targetStudent(req);

  if (!studentId) {
    if (req.user.role === ROLES.STUDENT) return res.status(403).json({ error: 'Not permitted' });
    const { branch, semester, examType, subjectId } = req.query;
    let rows = await db.results.find({
      branch: branch || undefined,
      semester: semester ? Number(semester) : undefined,
      examType: examType || undefined,
      subjectId: subjectId || undefined,
    });
    if (req.user.role === ROLES.FACULTY && !subjectId) {
      const mine = new Set((await db.subjects.find({ facultyId: req.user.id })).map((s) => s.id));
      rows = rows.filter((r) => mine.has(r.subjectId));
    }
    const byStudent = new Map();
    for (const r of rows) {
      const agg = byStudent.get(r.studentId) ?? { marks: 0, max: 0, count: 0 };
      agg.marks += r.marks; agg.max += r.maxMarks; agg.count += 1;
      byStudent.set(r.studentId, agg);
    }
    const students = await lookup('users', [...byStudent.keys()]);
    const cohort = [...byStudent.entries()].map(([id, agg]) => {
      const u = students.get(id);
      return {
        studentId: id, name: u?.name ?? 'Unknown', enrollment: u?.enrollment ?? '',
        branch: u?.branch, semester: u?.semester,
        marks: agg.marks, maxMarks: agg.max, percent: pct(agg.marks, agg.max), subjects: agg.count,
      };
    }).sort((a, b) => b.percent - a.percent);
    return res.json({ scope: 'cohort', cohort });
  }

  if (req.user.role === ROLES.STUDENT && studentId !== req.user.id) {
    return res.status(403).json({ error: 'Not permitted' });
  }

  const all = await db.results.find({ studentId });
  const decorateResult = await decorator(all.map((r) => r.subjectId));
  const semesters = [...new Set(all.map((r) => r.semester))].sort((a, b) => a - b);
  const bySemester = semesters.map((sem) => {
    const rows = all.filter((r) => r.semester === sem);
    const marks = rows.reduce((n, r) => n + r.marks, 0);
    const max = rows.reduce((n, r) => n + r.maxMarks, 0);
    return {
      semester: sem,
      examType: rows[0].examType,
      percent: pct(marks, max),
      // SPI on the ten-point scale described in the examination rules.
      spi: Math.round((pct(marks, max) / 10) * 100) / 100,
      rows: rows.map((r) => ({ ...r, ...decorateResult(r.subjectId), percent: pct(r.marks, r.maxMarks) })),
    };
  });
  const marks = all.reduce((n, r) => n + r.marks, 0);
  const max = all.reduce((n, r) => n + r.maxMarks, 0);
  return res.json({
    scope: 'student',
    student: { id: studentId, name: (await db.users.byId(studentId))?.name },
    overall: { percent: pct(marks, max), cpi: Math.round((pct(marks, max) / 10) * 100) / 100, subjects: all.length },
    bySemester,
  });
});

// Faculty record attendance for a session — the write side of the record system.
router.post('/attendance/mark', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
  const { subjectId, entries, date } = req.body ?? {};
  const subject = await db.subjects.byId(subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  if (req.user.role === ROLES.FACULTY && subject.facultyId !== req.user.id) {
    return res.status(403).json({ error: 'You do not teach this subject' });
  }
  if (!Array.isArray(entries) || !entries.length) {
    return res.status(400).json({ error: 'Provide at least one attendance entry' });
  }
  const when = date ?? new Date().toISOString().slice(0, 10);
  let updated = 0;
  for (const entry of entries) {
    const row = await db.attendance.findOne({ studentId: entry.studentId, subjectId });
    if (!row) continue;
    const present = entry.status === 'present';
    await db.attendance.update(row.id, {
      attended: row.attended + (present ? 1 : 0),
      total: row.total + 1,
      sessions: [...(row.sessions ?? []).slice(-9), { date: when, status: present ? 'present' : 'absent' }],
      updatedAt: new Date().toISOString(),
    });
    updated += 1;
  }
  return res.json({ ok: true, updated, date: when });
});

router.post('/results/publish', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
  const { subjectId, examType, maxMarks, entries } = req.body ?? {};
  const subject = await db.subjects.byId(subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  if (req.user.role === ROLES.FACULTY && subject.facultyId !== req.user.id) {
    return res.status(403).json({ error: 'You do not teach this subject' });
  }
  const now = new Date().toISOString();
  let written = 0;
  for (const entry of entries ?? []) {
    const existing = await db.results.findOne({ studentId: entry.studentId, subjectId, examType });
    const payload = {
      studentId: entry.studentId, subjectId, examType,
      semester: subject.semester, branch: subject.branch,
      marks: Number(entry.marks), maxMarks: Number(maxMarks), publishedAt: now,
    };
    if (existing) await db.results.update(existing.id, payload); else await db.results.insert(payload);
    written += 1;
  }
  return res.json({ ok: true, written });
});

export default router;
