import { Router } from 'express';
import db, { lookup } from '../lib/db.js';
import { authenticate, ROLES } from '../lib/auth.js';
import { stats, refresh } from '../rag/index.js';
import { providerStatus } from '../rag/llm.js';
import { releaseDue } from './announcements.js';

const router = Router();
router.use(authenticate);

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const todayName = () => DAYS[(new Date().getDay() + 6) % 7] ?? null;

// One endpoint per role, because the three dashboards answer different
// questions and a single generic shape would serve none of them well.
router.get('/', async (req, res) => {
  await releaseDue();
  const user = req.user;

  if (user.role === ROLES.STUDENT) {
    const attendance = await db.attendance.find({ studentId: user.id });
    const attended = attendance.reduce((n, r) => n + r.attended, 0);
    const total = attendance.reduce((n, r) => n + r.total, 0);
    const short = attendance.filter((r) => pct(r.attended, r.total) < 75);

    const midsem = await db.results.find({ studentId: user.id, examType: 'midsem' });
    const marks = midsem.reduce((n, r) => n + r.marks, 0);
    const maxMarks = midsem.reduce((n, r) => n + r.maxMarks, 0);

    const day = todayName();
    const todayRows = day
      ? await db.timetable.find({ branch: user.branch, semester: user.semester, day })
      : [];
    const todaySubjects = await lookup('subjects', todayRows.map((t) => t.subjectId));
    const todayFaculty = await lookup('users', [...todaySubjects.values()].map((s) => s.facultyId));
    const classes = todayRows
      .map((t) => {
        const s = todaySubjects.get(t.subjectId);
        return { ...t, subject: s?.name, code: s?.code, faculty: todayFaculty.get(s?.facultyId)?.name };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const mySubjectIds = new Set((await db.subjects.find({ branch: user.branch, semester: user.semester })).map((s) => s.id));
    const submitted = new Set((await db.submissions.find({ studentId: user.id })).map((s) => s.assignmentId));
    const pendingRows = (await db.assignments.all())
      .filter((a) => mySubjectIds.has(a.subjectId) && !submitted.has(a.id));
    const pendingSubjects = await lookup('subjects', pendingRows.map((a) => a.subjectId));
    const pending = pendingRows
      .map((a) => ({ ...a, subject: pendingSubjects.get(a.subjectId)?.name, overdue: new Date(a.dueDate) < new Date() }))
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const shortSubjects = await lookup('subjects', short.map((r) => r.subjectId));
    return res.json({
      role: 'student',
      stats: [
        { label: 'Attendance', value: `${pct(attended, total)}%`, tone: pct(attended, total) < 75 ? 'bad' : 'ok', hint: `${attended} of ${total} sessions` },
        { label: 'Mid-sem average', value: `${pct(marks, maxMarks)}%`, tone: 'neutral', hint: `${midsem.length} subjects` },
        { label: 'Pending work', value: String(pending.length), tone: pending.some((p) => p.overdue) ? 'warn' : 'neutral', hint: pending.filter((p) => p.overdue).length ? `${pending.filter((p) => p.overdue).length} overdue` : 'All on schedule' },
        { label: 'Subjects', value: String(mySubjectIds.size), tone: 'neutral', hint: `Semester ${user.semester}` },
      ],
      today: { day, classes },
      pending: pending.slice(0, 4),
      shortAttendance: short.map((r) => ({ subject: shortSubjects.get(r.subjectId)?.name, percent: pct(r.attended, r.total) })),
      announcements: (await db.announcements.find({ status: 'published' }))
        .filter((a) => a.audience !== 'faculty'
          && (!a.branch || a.branch === 'ALL' || a.branch === user.branch)
          && (!a.semester || a.semester === 0 || a.semester === user.semester))
        .sort((a, b) => new Date(b.publishAt) - new Date(a.publishAt))
        .slice(0, 3),
    });
  }

  if (user.role === ROLES.FACULTY) {
    const subjects = await db.subjects.find({ facultyId: user.id });
    const subjectIds = new Set(subjects.map((s) => s.id));
    const assignments = await db.assignments.find({ facultyId: user.id });
    const submissions = (await db.submissions.all()).filter((s) => assignments.some((a) => a.id === s.assignmentId));
    const ungraded = submissions.filter((s) => s.status !== 'graded');

    const attendance = (await db.attendance.all()).filter((r) => subjectIds.has(r.subjectId));
    const attended = attendance.reduce((n, r) => n + r.attended, 0);
    const total = attendance.reduce((n, r) => n + r.total, 0);
    const studentsTaught = new Set(attendance.map((r) => r.studentId)).size;

    const day = todayName();
    const byId = new Map(subjects.map((s) => [s.id, s]));
    const classes = day
      ? (await db.timetable.all()).filter((t) => subjectIds.has(t.subjectId) && t.day === day)
        .map((t) => ({ ...t, subject: byId.get(t.subjectId)?.name, code: byId.get(t.subjectId)?.code }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
      : [];

    // Cohort sizes and per-subject attendance are computed from two queries and
    // grouped in memory, rather than a pair of queries per subject.
    const cohortRows = await db.users.find({ role: 'student' });
    const cohortSize = new Map();
    for (const u of cohortRows) {
      const key = `${u.branch}|${u.semester}`;
      cohortSize.set(key, (cohortSize.get(key) ?? 0) + 1);
    }
    const subjectAttendance = new Map();
    for (const r of attendance) {
      const agg = subjectAttendance.get(r.subjectId) ?? { attended: 0, total: 0 };
      agg.attended += r.attended; agg.total += r.total;
      subjectAttendance.set(r.subjectId, agg);
    }
    const subjectCards = subjects.map((s) => {
      const agg = subjectAttendance.get(s.id) ?? { attended: 0, total: 0 };
      return {
        ...s,
        students: cohortSize.get(`${s.branch}|${s.semester}`) ?? 0,
        attendance: pct(agg.attended, agg.total),
      };
    });

    const top = ungraded.slice(0, 5);
    const ungradedStudents = await lookup('users', top.map((s) => s.studentId));
    const ungradedAssignments = await lookup('assignments', top.map((s) => s.assignmentId));
    const ungradedCards = top.map((s) => ({
      ...s,
      student: ungradedStudents.get(s.studentId)?.name,
      assignment: ungradedAssignments.get(s.assignmentId)?.title,
    }));

    return res.json({
      role: 'faculty',
      stats: [
        { label: 'Subjects taught', value: String(subjects.length), tone: 'neutral', hint: `${new Set(subjects.map((s) => s.semester)).size} semesters` },
        { label: 'Students', value: String(studentsTaught), tone: 'neutral', hint: 'Across all your classes' },
        { label: 'To grade', value: String(ungraded.length), tone: ungraded.length ? 'warn' : 'ok', hint: `${submissions.length} submissions total` },
        { label: 'Class attendance', value: `${pct(attended, total)}%`, tone: pct(attended, total) < 75 ? 'warn' : 'ok', hint: 'Average across subjects' },
      ],
      today: { day, classes },
      subjects: subjectCards,
      ungraded: ungradedCards,
      documents: (await db.documents.find({ uploadedBy: user.id })).length,
      banks: (await db.questionbanks.find({ createdBy: user.id })).length,
    });
  }

  // Admin
  const students = await db.users.find({ role: 'student' });
  const faculty = await db.users.find({ role: 'faculty' });
  const attendance = await db.attendance.all();
  const attended = attendance.reduce((n, r) => n + r.attended, 0);
  const total = attendance.reduce((n, r) => n + r.total, 0);
  const unassigned = (await db.subjects.all()).filter((s) => !s.facultyId);

  const byBranch = ['CE', 'IT', 'ME'].map((code) => {
    const rows = attendance.filter((r) => r.branch === code);
    return {
      branch: code,
      students: students.filter((s) => s.branch === code).length,
      attendance: pct(rows.reduce((n, r) => n + r.attended, 0), rows.reduce((n, r) => n + r.total, 0)),
    };
  });

  const bySemester = [1, 2, 3, 4, 5, 6, 7, 8].map((sem) => ({
    semester: sem,
    students: students.filter((s) => s.semester === sem).length,
  })).filter((r) => r.students > 0);

  await refresh();
  const allSubjects = await db.subjects.all();
  const allDocuments = await db.documents.all();
  const recentUploads = allDocuments
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .slice(0, 5);
  const uploaders = await lookup('users', recentUploads.map((d) => d.uploadedBy));

  return res.json({
    role: 'admin',
    stats: [
      { label: 'Students', value: String(students.length), tone: 'neutral', hint: `${new Set(students.map((s) => s.branch)).size} branches` },
      { label: 'Faculty', value: String(faculty.length), tone: 'neutral', hint: `${allSubjects.length} subjects mapped` },
      { label: 'Indexed passages', value: String(stats().chunks), tone: 'neutral', hint: `${allDocuments.length} documents` },
      { label: 'Overall attendance', value: `${pct(attended, total)}%`, tone: pct(attended, total) < 75 ? 'warn' : 'ok', hint: 'Institute-wide' },
    ],
    byBranch,
    bySemester,
    unassignedSubjects: unassigned.length,
    scheduled: (await db.announcements.find({ status: 'scheduled' }))
      .sort((a, b) => new Date(a.publishAt) - new Date(b.publishAt))
      .slice(0, 5),
    recentUploads: recentUploads.map((d) => ({ ...d, uploader: uploaders.get(d.uploadedBy)?.name })),
    engine: { ...providerStatus(), index: stats() },
  });
});

export default router;
