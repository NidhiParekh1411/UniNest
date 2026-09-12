// The record-query tools — the menu the assistant may choose from when a
// question asks about *data* rather than documents.
//
// Two rules shape this file, both from CLAUDE.md:
//
//   Rule 4. Scoping is enforced here, in run(), against the token's scope. The
//   model chooses which tool and with what arguments; it never chooses *whose*
//   records come back. A studentName argument from a student is discarded, not
//   honoured, so no phrasing can widen a student's access to a cohort.
//
//   Rule 5. A tool that finds nothing says so. It never reaches for the nearest
//   plausible row.
//
// Each tool declares a Gemini-compatible parameter schema because llm.js sends
// exactly these declarations as function declarations. Keeping the schema next
// to the executor is what stops the two drifting apart.
import db, { lookup } from '../lib/db.js';
import { ROLES } from '../lib/auth.js';

const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

const COHORT_ROLES = [ROLES.FACULTY, ROLES.ADMIN];

// Faculty and admin see every student in every semester — the owner's decision,
// on the grounds that a professor fielding "who is at risk" should not have to
// know in advance which cohort a student sits in. Narrowing it later means
// changing this one predicate rather than hunting through four executors.
function visibleStudents(students, scope) {
  if (scope.role === ROLES.STUDENT) return students.filter((s) => s.id === scope.userId);
  return students;
}

async function studentsIn(scope, { semester, branch } = {}) {
  let rows = await db.users.find({ role: ROLES.STUDENT });
  rows = visibleStudents(rows, scope);
  if (semester != null) rows = rows.filter((s) => s.semester === semester);
  if (branch) rows = rows.filter((s) => s.branch === branch);
  return rows;
}

// One pass over each table, joined in memory against a Map. Resolving a name per
// row would be an N+1 against Atlas — see the note in lib/db.js.
async function attendanceByStudent(studentIds, subjectId) {
  const ids = new Set(studentIds);
  let rows = await db.attendance.all();
  rows = rows.filter((r) => ids.has(r.studentId));
  if (subjectId) rows = rows.filter((r) => r.subjectId === subjectId);
  const totals = new Map();
  for (const r of rows) {
    const cur = totals.get(r.studentId) ?? { attended: 0, total: 0 };
    cur.attended += r.attended;
    cur.total += r.total;
    totals.set(r.studentId, cur);
  }
  return totals;
}

async function resultsByStudent(studentIds, { semester, examType, subjectId } = {}) {
  const ids = new Set(studentIds);
  let rows = await db.results.all();
  rows = rows.filter((r) => ids.has(r.studentId));
  if (semester != null) rows = rows.filter((r) => r.semester === semester);
  if (examType) rows = rows.filter((r) => r.examType === examType);
  if (subjectId) rows = rows.filter((r) => r.subjectId === subjectId);
  const totals = new Map();
  for (const r of rows) {
    const cur = totals.get(r.studentId) ?? { marks: 0, maxMarks: 0, rows: [] };
    cur.marks += r.marks;
    cur.maxMarks += r.maxMarks;
    cur.rows.push(r);
    totals.set(r.studentId, cur);
  }
  return totals;
}

// A named student is resolvable only by someone entitled to see them, so the
// match runs over the already-scoped list rather than over db.users.
function matchStudent(students, name) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  if (!n) return null;
  return students.find((s) => s.name.toLowerCase() === n)
    ?? students.find((s) => s.name.toLowerCase().includes(n))
    ?? students.find((s) => (s.enrollment ?? '').toLowerCase() === n)
    ?? null;
}

const SEMESTER = { type: 'number', description: 'Semester number 1-8. Omit for all semesters.' };
const BRANCH = { type: 'string', description: 'Branch code: CE, IT or ME. Omit for all branches.' };

export const TOOLS = {
  // ------------------------------------------------------------ attendance
  myAttendance: {
    roles: [ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN],
    declaration: {
      name: 'myAttendance',
      description: "One student's attendance, overall and per subject. For a student this is always their own record. Faculty and admin may name a student.",
      parameters: {
        type: 'object',
        properties: {
          studentName: { type: 'string', description: 'Student name or enrolment number. Ignored when a student asks.' },
        },
      },
    },
    async run(args, scope) {
      const students = await studentsIn(scope);
      const student = scope.role === ROLES.STUDENT
        ? students[0]
        : matchStudent(students, args.studentName);

      if (!student) {
        return args.studentName
          ? { answer: `I could not find a student called "${args.studentName}".`, citations: [] }
          : { answer: 'Name the student whose attendance you want and I will look it up.', citations: [] };
      }

      const rows = (await db.attendance.all()).filter((r) => r.studentId === student.id);
      if (!rows.length) return { answer: `No attendance has been recorded for ${student.name} yet.`, citations: [] };

      const subjects = await lookup('subjects', rows.map((r) => r.subjectId));
      const bySubject = rows.map((r) => ({
        subject: subjects.get(r.subjectId)?.name ?? 'this subject',
        code: subjects.get(r.subjectId)?.code ?? '',
        attended: r.attended,
        total: r.total,
        percent: pct(r.attended, r.total),
      })).sort((a, b) => a.percent - b.percent);

      const attended = rows.reduce((n, r) => n + r.attended, 0);
      const total = rows.reduce((n, r) => n + r.total, 0);
      const overall = pct(attended, total);
      const short = bySubject.filter((s) => s.percent < 75);
      const who = scope.role === ROLES.STUDENT ? 'Your' : `${student.name}'s`;

      let answer = `${who} overall attendance is ${overall}% — ${attended} of ${total} sessions.`;
      answer += short.length
        ? ` Below the 75% requirement: ${short.map((s) => `${s.subject} (${s.percent}%)`).join(', ')}.`
        : ' Every subject is above the 75% requirement.';

      return { answer, data: { type: 'attendance', overall, attended, total, bySubject }, citations: [] };
    },
  },

  studentsByAttendance: {
    roles: COHORT_ROLES,
    declaration: {
      name: 'studentsByAttendance',
      description: 'List students whose overall attendance is below or above a percentage. Use for "who is short of attendance", "students below 75%", "attendance defaulters".',
      parameters: {
        type: 'object',
        properties: {
          comparator: { type: 'string', enum: ['below', 'above'], description: 'Default below.' },
          percentage: { type: 'number', description: 'The threshold. Default 75.' },
          semester: SEMESTER,
          branch: BRANCH,
        },
      },
    },
    async run(args, scope) {
      const comparator = args.comparator === 'above' ? 'above' : 'below';
      const threshold = Number.isFinite(args.percentage) ? args.percentage : 75;
      const students = await studentsIn(scope, args);
      if (!students.length) return { answer: 'No students match that cohort.', citations: [] };

      const totals = await attendanceByStudent(students.map((s) => s.id));
      const rows = students
        .map((s) => {
          const t = totals.get(s.id);
          return t && t.total
            ? { name: s.name, enrollment: s.enrollment ?? '', branch: s.branch, semester: s.semester, attended: t.attended, total: t.total, percent: pct(t.attended, t.total) }
            : null;
        })
        .filter(Boolean)
        .filter((r) => (comparator === 'below' ? r.percent < threshold : r.percent >= threshold))
        .sort((a, b) => (comparator === 'below' ? a.percent - b.percent : b.percent - a.percent));

      const where = describeCohort(args);
      if (!rows.length) {
        return { answer: `No students${where} are ${comparator} ${threshold}% attendance.`, citations: [] };
      }
      return {
        answer: `${rows.length} student${rows.length === 1 ? '' : 's'}${where} ${rows.length === 1 ? 'is' : 'are'} ${comparator} ${threshold}% attendance. The lowest is ${rows[0].name} at ${rows[0].percent}%.`,
        data: { type: 'studentTable', measure: 'attendance', rows },
        citations: [],
      };
    },
  },

  // --------------------------------------------------------------- results
  myResults: {
    roles: [ROLES.STUDENT, ROLES.FACULTY, ROLES.ADMIN],
    declaration: {
      name: 'myResults',
      description: "One student's marks, optionally for a single semester or exam, and optionally only their best or worst subject. For a student this is always their own record.",
      parameters: {
        type: 'object',
        properties: {
          studentName: { type: 'string', description: 'Student name or enrolment number. Ignored when a student asks.' },
          semester: SEMESTER,
          examType: { type: 'string', enum: ['midsem', 'final'] },
          extreme: { type: 'string', enum: ['highest', 'lowest'], description: 'Return only the best or worst subject.' },
          groupBySemester: { type: 'boolean', description: 'Break the totals down semester by semester.' },
        },
      },
    },
    async run(args, scope) {
      const students = await studentsIn(scope);
      const student = scope.role === ROLES.STUDENT
        ? students[0]
        : matchStudent(students, args.studentName);

      if (!student) {
        return args.studentName
          ? { answer: `I could not find a student called "${args.studentName}".`, citations: [] }
          : { answer: 'Name the student whose results you want and I will look them up.', citations: [] };
      }

      let rows = (await db.results.all()).filter((r) => r.studentId === student.id);
      if (args.semester != null) rows = rows.filter((r) => r.semester === args.semester);
      if (args.examType) rows = rows.filter((r) => r.examType === args.examType);
      if (!rows.length) return { answer: 'No results have been published for that combination yet.', citations: [] };

      const subjects = await lookup('subjects', rows.map((r) => r.subjectId));
      const enriched = rows.map((r) => ({
        subject: subjects.get(r.subjectId)?.name ?? 'this subject',
        code: subjects.get(r.subjectId)?.code ?? '',
        semester: r.semester,
        examType: r.examType,
        marks: r.marks,
        maxMarks: r.maxMarks,
        percent: pct(r.marks, r.maxMarks),
      })).sort((a, b) => b.percent - a.percent);

      const who = scope.role === ROLES.STUDENT ? 'your' : `${student.name}'s`;
      const Who = who[0].toUpperCase() + who.slice(1);

      if (args.extreme) {
        const pickTop = args.extreme === 'highest';
        const one = pickTop ? enriched[0] : enriched[enriched.length - 1];
        return {
          answer: `${Who} ${pickTop ? 'highest' : 'lowest'} mark is ${one.subject} — ${one.marks} out of ${one.maxMarks}, ${one.percent}%${args.semester != null ? ` in semester ${args.semester}` : ''}.`,
          data: { type: 'results', rows: [one] },
          citations: [],
        };
      }

      if (args.groupBySemester) {
        const bySem = new Map();
        for (const r of enriched) {
          const cur = bySem.get(r.semester) ?? { semester: r.semester, marks: 0, maxMarks: 0 };
          cur.marks += r.marks;
          cur.maxMarks += r.maxMarks;
          bySem.set(r.semester, cur);
        }
        const sems = [...bySem.values()]
          .map((s) => ({ ...s, percent: pct(s.marks, s.maxMarks) }))
          .sort((a, b) => a.semester - b.semester);
        return {
          answer: `${Who} results by semester: ${sems.map((s) => `semester ${s.semester} ${s.percent}%`).join(', ')}.`,
          data: { type: 'semesterTable', rows: sems },
          citations: [],
        };
      }

      const marks = enriched.reduce((n, r) => n + r.marks, 0);
      const outOf = enriched.reduce((n, r) => n + r.maxMarks, 0);
      return {
        answer: `${Who} total is ${marks} out of ${outOf} — ${pct(marks, outOf)}%. Strongest: ${enriched[0].subject} at ${enriched[0].percent}%. Weakest: ${enriched[enriched.length - 1].subject} at ${enriched[enriched.length - 1].percent}%.`,
        data: { type: 'results', rows: enriched, total: marks, outOf, percent: pct(marks, outOf) },
        citations: [],
      };
    },
  },

  studentsByMarks: {
    roles: COHORT_ROLES,
    declaration: {
      name: 'studentsByMarks',
      description: 'Rank or filter students by marks. Use for "top 5 students", "who scored below 40%", "best performers in semester 5".',
      parameters: {
        type: 'object',
        properties: {
          order: { type: 'string', enum: ['top', 'bottom'], description: 'Default top.' },
          limit: { type: 'number', description: 'How many to return. Default 10.' },
          comparator: { type: 'string', enum: ['below', 'above'], description: 'Filter by a percentage instead of ranking.' },
          percentage: { type: 'number' },
          semester: SEMESTER,
          branch: BRANCH,
          examType: { type: 'string', enum: ['midsem', 'final'] },
        },
      },
    },
    async run(args, scope) {
      const students = await studentsIn(scope, args);
      if (!students.length) return { answer: 'No students match that cohort.', citations: [] };

      const totals = await resultsByStudent(students.map((s) => s.id), args);
      let rows = students
        .map((s) => {
          const t = totals.get(s.id);
          return t && t.maxMarks
            ? { name: s.name, enrollment: s.enrollment ?? '', branch: s.branch, semester: s.semester, marks: t.marks, maxMarks: t.maxMarks, percent: pct(t.marks, t.maxMarks) }
            : null;
        })
        .filter(Boolean);

      const where = describeCohort(args);
      if (!rows.length) return { answer: `No results have been published${where} yet.`, citations: [] };

      if (args.comparator && Number.isFinite(args.percentage)) {
        const below = args.comparator === 'below';
        rows = rows
          .filter((r) => (below ? r.percent < args.percentage : r.percent >= args.percentage))
          .sort((a, b) => (below ? a.percent - b.percent : b.percent - a.percent));
        if (!rows.length) {
          return { answer: `No students${where} scored ${args.comparator} ${args.percentage}%.`, citations: [] };
        }
        return {
          answer: `${rows.length} student${rows.length === 1 ? '' : 's'}${where} scored ${args.comparator} ${args.percentage}%.`,
          data: { type: 'studentTable', measure: 'marks', rows },
          citations: [],
        };
      }

      const bottom = args.order === 'bottom';
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
      rows.sort((a, b) => (bottom ? a.percent - b.percent : b.percent - a.percent));
      const top = rows.slice(0, limit);
      return {
        answer: `${bottom ? 'Lowest' : 'Highest'} ${top.length} by marks${where}: ${top.slice(0, 3).map((r) => `${r.name} (${r.percent}%)`).join(', ')}${top.length > 3 ? ', and more below.' : '.'}`,
        data: { type: 'studentTable', measure: 'marks', rows: top },
        citations: [],
      };
    },
  },
};

function describeCohort({ semester, branch } = {}) {
  if (semester != null && branch) return ` in ${branch} semester ${semester}`;
  if (semester != null) return ` in semester ${semester}`;
  if (branch) return ` in ${branch}`;
  return '';
}

// The declarations a given role is allowed to see. A student is never shown the
// cohort tools, so the model cannot select one on their behalf — defence in
// depth behind the check in runTool().
export function declarationsFor(scope) {
  return Object.values(TOOLS)
    .filter((t) => t.roles.includes(scope.role))
    .map((t) => t.declaration);
}

// The deterministic reading of a record question, tried before Gemini is asked.
//
// It exists for two reasons. The free allowance is a handful of requests a day,
// so spending one to learn that "below 75%" means below 75 is waste; and when
// the allowance is gone this is the difference between answering the question
// and confidently answering a different one out of the policy documents.
//
// Returns null when the question is not plainly one of these shapes, which is
// the model's cue to try. Arguments only — whose records come back is still
// decided by runTool() against the token.
const PERSONAL = /\b(my|mine|i|me|myself)\b/i;
const BELOW = /\b(?:below|under|less than|fewer than|lower than)\s*(\d{1,3})\s*(?:%|percent)?/i;
const ABOVE = /\b(?:above|over|more than|greater than|at least)\s*(\d{1,3})\s*(?:%|percent)?/i;
const RANKED = /\b(top|bottom|best|worst|highest|lowest)\s*(\d{1,2})?\b/i;
const PER_SEMESTER = /\b(each|every|per)\s+semester\b|\bsemester[-\s]?wise\b/i;

export function parseToolCall(text, scope) {
  const attendance = /\battendance\b|\bpresent\b|\babsent\b/i.test(text);
  const marks = /\bmarks?\b|\bscor\w*\b|\bresults?\b|\bgrades?\b|\bcgpa\b|\bspi\b/i.test(text);
  const ranked = RANKED.exec(text);
  const perSemester = PER_SEMESTER.test(text);
  const personal = scope.role === ROLES.STUDENT || PERSONAL.test(text);

  // A student's only rankable records are their marks, so "my best subject"
  // needs no measure word to be unambiguous. "bottom 5" from a professor does —
  // bottom by attendance and bottom by marks are different lists, and guessing
  // between them is exactly what rule 5 forbids.
  if (!attendance && !marks && !(personal && (ranked || perSemester))) return null;

  const args = {};
  // Branch is matched on the raw text: lowercased, "it" and "me" are ordinary
  // English words and would tag half the questions with a branch.
  const branch = text.match(/\b(CE|IT|ME)\b/);
  if (branch) args.branch = branch[1];
  const sem = text.match(/\bsem(?:ester)?\.?\s*(\d)\b/i) ?? text.match(/\b(\d)(?:st|nd|rd|th)\s+sem/i);
  if (sem) args.semester = Number(sem[1]);
  if (/\bmid\s?sem|\bmid[-\s]?term|\binternal\b/i.test(text)) args.examType = 'midsem';
  else if (/\bfinal|\bend\s?sem|\bexternal\b/i.test(text)) args.examType = 'final';

  const below = BELOW.exec(text);
  const above = ABOVE.exec(text);

  // A student only ever asks about themselves, so personal framing is assumed
  // rather than required — "highest mark" from a student needs no "my".
  if (personal) {
    if (attendance) return { name: 'myAttendance', args: {} };
    if (perSemester) return { name: 'myResults', args: { ...args, groupBySemester: true } };
    if (ranked) {
      const word = ranked[1].toLowerCase();
      if (['top', 'best', 'highest'].includes(word)) return { name: 'myResults', args: { ...args, extreme: 'highest' } };
      return { name: 'myResults', args: { ...args, extreme: 'lowest' } };
    }
    return { name: 'myResults', args };
  }

  if (attendance) {
    if (below) return { name: 'studentsByAttendance', args: { ...args, comparator: 'below', percentage: Number(below[1]) } };
    if (above) return { name: 'studentsByAttendance', args: { ...args, comparator: 'above', percentage: Number(above[1]) } };
    if (/\bdefaulters?\b|\bshort of attendance\b|\bat risk\b/i.test(text)) {
      return { name: 'studentsByAttendance', args: { ...args, comparator: 'below', percentage: 75 } };
    }
    return null;
  }

  if (below) return { name: 'studentsByMarks', args: { ...args, comparator: 'below', percentage: Number(below[1]) } };
  if (above) return { name: 'studentsByMarks', args: { ...args, comparator: 'above', percentage: Number(above[1]) } };
  if (ranked) {
    const word = ranked[1].toLowerCase();
    const order = ['top', 'best', 'highest'].includes(word) ? 'top' : 'bottom';
    return { name: 'studentsByMarks', args: { ...args, order, limit: ranked[2] ? Number(ranked[2]) : 10 } };
  }
  return null;
}

export async function runTool(name, args, scope) {
  const tool = TOOLS[name];
  if (!tool) return null;
  if (!tool.roles.includes(scope.role)) {
    return { answer: 'That information covers other students, and your account can only see your own records.', citations: [], refused: true };
  }
  return tool.run(args ?? {}, scope);
}
