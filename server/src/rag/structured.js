// Handlers for structured intents — answers built from the record tables rather
// than from documents. Each returns { answer, data?, citations } where `data`
// carries a renderable payload (a timetable grid, a chart series) that the chat
// UI displays inline beneath the sentence.
import db, { lookup } from '../lib/db.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

// Names resolve against a Map the handler preloads with lookup() — see lib/db.js.
// Resolving each row individually would be an N+1 against the database.
const subjectName = (subjects, id) => subjects.get(id)?.name ?? 'this subject';
const facultyName = (faculty, id) => faculty.get(id)?.name ?? 'Not assigned';

// A student may only ever be resolved to themselves. Faculty and admin asking a
// personal question get told to use the records screens instead of being handed
// somebody's data by default.
function resolveStudent(scope) {
  return scope.role === 'student' ? scope.userId : null;
}

export const handlers = {
  async timetable(slots, scope) {
    const { semester, branch, day } = slots;
    const rows = await db.timetable.find({ semester, branch });
    if (!rows.length) {
      return { answer: `No timetable has been published yet for ${branch} semester ${semester}.`, citations: [] };
    }
    let dayFilter = null;
    if (day) {
      const today = new Date();
      if (day === 'today') dayFilter = DAYS[(today.getDay() + 6) % 7] ?? null;
      else if (day === 'tomorrow') dayFilter = DAYS[(today.getDay() + 7) % 7] ?? null;
      else dayFilter = day[0].toUpperCase() + day.slice(1);
    }
    const scoped = dayFilter ? rows.filter((r) => r.day === dayFilter) : rows;
    if (dayFilter && !scoped.length) {
      return { answer: `There are no classes scheduled on ${dayFilter} for ${branch} semester ${semester}.`, citations: [] };
    }
    const subjects = await lookup('subjects', scoped.map((r) => r.subjectId));
    const faculty = await lookup('users', [...subjects.values()].map((s) => s.facultyId));
    const enriched = scoped.map((r) => ({
      ...r,
      subject: subjectName(subjects, r.subjectId),
      code: subjects.get(r.subjectId)?.code ?? '',
      faculty: facultyName(faculty, subjects.get(r.subjectId)?.facultyId),
    })).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || a.startTime.localeCompare(b.startTime));

    const answer = dayFilter
      ? `You have ${enriched.length} ${enriched.length === 1 ? 'class' : 'classes'} on ${dayFilter}, starting with ${enriched[0].subject} at ${enriched[0].startTime}.`
      : `Here is the full week for ${branch} semester ${semester} — ${enriched.length} scheduled sessions across ${new Set(enriched.map((e) => e.day)).size} days.`;
    return { answer, data: { type: 'timetable', rows: enriched, branch, semester, day: dayFilter }, citations: [] };
  },

  async attendance(slots, scope) {
    const studentId = resolveStudent(scope);
    if (!studentId) {
      return { answer: 'Attendance is scoped to a single student. Open the Attendance screen to review a class or an individual student.', citations: [] };
    }
    let rows = await db.attendance.find({ studentId });
    if (slots.subject) rows = rows.filter((r) => r.subjectId === slots.subject);
    if (!rows.length) return { answer: 'No attendance has been recorded for you yet.', citations: [] };

    const subjects = await lookup('subjects', rows.map((r) => r.subjectId));
    const bySubject = rows.map((r) => ({
      subjectId: r.subjectId,
      subject: subjectName(subjects, r.subjectId),
      code: subjects.get(r.subjectId)?.code ?? '',
      attended: r.attended,
      total: r.total,
      percent: pct(r.attended, r.total),
    })).sort((a, b) => a.percent - b.percent);

    const attended = rows.reduce((n, r) => n + r.attended, 0);
    const total = rows.reduce((n, r) => n + r.total, 0);
    const overall = pct(attended, total);
    const short = bySubject.filter((s) => s.percent < 75);

    let answer = `Your overall attendance is ${overall}% — ${attended} of ${total} sessions attended.`;
    if (short.length) {
      answer += ` ${short.length === 1 ? 'One subject is' : `${short.length} subjects are`} below the 75% requirement: ${short.map((s) => `${s.subject} (${s.percent}%)`).join(', ')}.`;
    } else {
      answer += ' Every subject is above the 75% requirement.';
    }
    return { answer, data: { type: 'attendance', overall, attended, total, bySubject }, citations: [] };
  },

  async results(slots, scope) {
    const studentId = resolveStudent(scope);
    if (!studentId) {
      return { answer: 'Results are scoped to a single student. Open the Results screen to review a cohort.', citations: [] };
    }
    let rows = await db.results.find({ studentId });
    if (slots.semester) rows = rows.filter((r) => r.semester === slots.semester);
    if (slots.examType) rows = rows.filter((r) => r.examType === slots.examType);
    if (slots.subject) rows = rows.filter((r) => r.subjectId === slots.subject);
    if (!rows.length) {
      return { answer: 'No results have been published for that combination yet.', citations: [] };
    }
    const subjects = await lookup('subjects', rows.map((r) => r.subjectId));
    const enriched = rows.map((r) => ({
      ...r,
      subject: subjectName(subjects, r.subjectId),
      code: subjects.get(r.subjectId)?.code ?? '',
      percent: pct(r.marks, r.maxMarks),
    }));
    const scored = enriched.reduce((n, r) => n + r.marks, 0);
    const outOf = enriched.reduce((n, r) => n + r.maxMarks, 0);
    const best = enriched.reduce((a, b) => (b.percent > a.percent ? b : a));
    const label = slots.examType ? (slots.examType === 'midsem' ? 'mid-semester' : 'final') : 'published';
    return {
      answer: `Across your ${label} results you scored ${scored} out of ${outOf} — ${pct(scored, outOf)}%. Your strongest subject is ${best.subject} at ${best.percent}%.`,
      data: { type: 'results', rows: enriched, total: scored, outOf, percent: pct(scored, outOf) },
      citations: [],
    };
  },

  async faculty(slots) {
    if (!slots.subject) {
      const all = (await db.subjects.all()).filter((s) => s.facultyId);
      return {
        answer: `I can tell you who teaches a specific subject — name it and I'll look it up. There are ${all.length} subjects with an assigned faculty member.`,
        citations: [],
      };
    }
    const subject = await db.subjects.byId(slots.subject);
    const faculty = await db.users.byId(subject.facultyId);
    if (!faculty) {
      return { answer: `${subject.name} (${subject.code}) does not have a faculty member assigned yet.`, citations: [] };
    }
    const also = (await db.subjects.find({ facultyId: faculty.id })).filter((s) => s.id !== subject.id);
    let answer = `${subject.name} (${subject.code}) is taught by ${faculty.name}, ${faculty.department}, for ${subject.branch} semester ${subject.semester}.`;
    if (also.length) answer += ` They also teach ${also.map((s) => s.name).join(', ')}.`;
    return { answer, data: { type: 'faculty', faculty: { name: faculty.name, email: faculty.email, department: faculty.department }, subject }, citations: [] };
  },

  async subjects(slots) {
    const rows = await db.subjects.find({ semester: slots.semester, branch: slots.branch });
    if (!rows.length) {
      return { answer: `No subjects are registered for ${slots.branch} semester ${slots.semester}.`, citations: [] };
    }
    const credits = rows.reduce((n, s) => n + (s.credits ?? 0), 0);
    const faculty = await lookup('users', rows.map((s) => s.facultyId));
    return {
      answer: `${slots.branch} semester ${slots.semester} has ${rows.length} subjects totalling ${credits} credits.`,
      data: { type: 'subjects', rows: rows.map((s) => ({ ...s, faculty: facultyName(faculty, s.facultyId) })) },
      citations: [],
    };
  },

  async assignments(slots, scope) {
    const now = Date.now();
    let rows = await db.assignments.all();
    if (scope.role === 'student') {
      const mine = (await db.subjects.find({ branch: scope.branch, semester: scope.semester })).map((s) => s.id);
      rows = rows.filter((a) => mine.includes(a.subjectId));
    } else if (scope.role === 'faculty') {
      rows = rows.filter((a) => a.facultyId === scope.userId);
    }
    if (slots.subject) rows = rows.filter((a) => a.subjectId === slots.subject);
    if (!rows.length) return { answer: 'There are no assignments posted for you right now.', citations: [] };

    const submitted = new Set(
      (await db.submissions.find({ studentId: scope.userId })).map((s) => s.assignmentId),
    );
    const subjects = await lookup('subjects', rows.map((a) => a.subjectId));
    const enriched = rows.map((a) => ({
      ...a,
      subject: subjectName(subjects, a.subjectId),
      submitted: submitted.has(a.id),
      overdue: new Date(a.dueDate).getTime() < now && !submitted.has(a.id),
    })).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const pending = enriched.filter((a) => !a.submitted);
    const answer = scope.role === 'student'
      ? (pending.length
        ? `You have ${pending.length} assignment${pending.length === 1 ? '' : 's'} outstanding. The next one due is ${pending[0].title} for ${pending[0].subject}, on ${new Date(pending[0].dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`
        : 'You are up to date — every assignment posted for your semester has been submitted.')
      : `${enriched.length} assignment${enriched.length === 1 ? '' : 's'} across your subjects.`;
    return { answer, data: { type: 'assignments', rows: enriched }, citations: [] };
  },

  async announcements(slots, scope) {
    const rows = (await db.announcements.find({ status: 'published' }))
      .filter((a) => {
        if (scope.role === 'admin') return true;
        if (a.audience === 'faculty' && scope.role === 'student') return false;
        if (scope.role !== 'student') return true;
        if (a.branch && a.branch !== 'ALL' && a.branch !== scope.branch) return false;
        if (a.semester && a.semester !== 0 && a.semester !== scope.semester) return false;
        return true;
      })
      .sort((a, b) => new Date(b.publishAt) - new Date(a.publishAt))
      .slice(0, 5);
    if (!rows.length) return { answer: 'There are no announcements for you at the moment.', citations: [] };
    return {
      answer: `The most recent announcement is "${rows[0].title}", posted ${new Date(rows[0].publishAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}. ${rows.length > 1 ? `There ${rows.length === 2 ? 'is 1 other' : `are ${rows.length - 1} others`} from the past few weeks.` : ''}`.trim(),
      data: { type: 'announcements', rows },
      citations: [],
    };
  },

  async notes(slots, scope) {
    let rows = await db.documents.find({ category: 'notes' });
    if (scope.role === 'student') {
      rows = rows.filter((d) => (!d.branch || d.branch === 'ALL' || d.branch === scope.branch)
        && (!d.semester || d.semester === 0 || d.semester === scope.semester));
    }
    if (slots.subject) rows = rows.filter((d) => d.subjectId === slots.subject);
    if (!rows.length) return { answer: 'No study material has been shared for that subject yet.', citations: [] };
    rows = rows.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).slice(0, 8);
    return {
      answer: `${rows.length} piece${rows.length === 1 ? '' : 's'} of study material ${rows.length === 1 ? 'is' : 'are'} available to you. The most recent is "${rows[0].title}".`,
      data: { type: 'documents', rows },
      citations: [],
    };
  },
};

export function runStructured(intent, slots, scope) {
  const handler = handlers[intent];
  if (!handler) return null;
  return handler(slots, scope);
}
