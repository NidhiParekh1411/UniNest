// Things the assistant can *do*, as opposed to answer.
//
// The rule that shapes this file: **chat proposes, it never commits.** Every
// handler here returns a description of a form — the fields, the options the
// asker is allowed to choose from, and which existing endpoint will receive it.
// Nothing is written. The user confirms in the chat, and the frontend then calls
// the same route the Assignments or Notices screen calls.
//
// That is deliberate, and it is what makes the feature safe. Publishing a notice
// to every student, or creating an assignment, off a *guessed* intent would be a
// mutation from a phrase nobody confirmed. It also means role enforcement stays
// exactly where it already is: in the routes, which check `req.user` against the
// subject's faculty. Chat never becomes a second way in.
import db, { lookup } from '../lib/db.js';
import { ROLES } from '../lib/auth.js';

// An action verb is required. Without one, "what assignments are pending" would
// open a create-assignment form instead of answering the question asked.
const VERB = {
  create: /\b(create|add|new|make|set up|setup|schedule|assign)\b/i,
  submit: /\b(submit|upload|turn in|hand in)\b/i,
  grade: /\b(grade|mark|marking|evaluate|score)\b/i,
  publish: /\b(publish|post|announce|send out|circulate)\b/i,
  generate: /\b(generate|create|make|prepare|build)\b/i,
};

// Asking what the rules are is not asking to do the thing.
const ASKING_ABOUT = /\b(polic(y|ies)|rule|rules|procedure|guideline|criteria|deadline is|what is the|when is the)\b/i;

const DAYS_AHEAD = (n) => new Date(Date.now() + n * 86400000);

// `date` and `datetime-local` inputs carry *local* wall-clock time, and the
// sentence beside them is formatted with toLocaleString. Slicing toISOString()
// here put the two 5.5 hours apart in IST: the message read 5:12 pm while the
// field said 21:12, which is the sort of mismatch nobody notices until a notice
// goes out at the wrong time.
const localParts = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
const isoDate = (d) => localParts(d).slice(0, 10);
const isoLocalMinutes = (d) => localParts(d).slice(0, 16);

// "next friday", "tomorrow", "in 3 days", "on 20 September" — enough to prefill
// the field. The user sees the date and can correct it before confirming, so an
// imperfect reading costs a glance, never a wrong record.
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
function parseWhen(text, { defaultDays = 7 } = {}) {
  const t = text.toLowerCase();
  if (/\btomorrow\b/.test(t)) return DAYS_AHEAD(1);
  if (/\btoday\b|\bnow\b/.test(t)) return new Date();
  const inDays = t.match(/\bin (\d{1,2}) days?\b/);
  if (inDays) return DAYS_AHEAD(Number(inDays[1]));
  const weekday = t.match(/\b(?:next|this|on|by)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/)
    ?? t.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (weekday) {
    const target = WEEKDAYS.indexOf(weekday[1]);
    const now = new Date();
    let delta = (target - now.getDay() + 7) % 7;
    if (delta === 0 || /\bnext\b/.test(t)) delta += 7;
    return DAYS_AHEAD(delta);
  }
  const onDate = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (onDate) {
    const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(onDate[2]);
    const now = new Date();
    const d = new Date(now.getFullYear(), month, Number(onDate[1]), 23, 59);
    if (d < now) d.setFullYear(now.getFullYear() + 1);
    return d;
  }
  return DAYS_AHEAD(defaultDays);
}

// Subject named in the question, matched against the ones the asker may use.
async function matchSubject(text, allowed) {
  const t = text.toLowerCase();
  const code = t.match(/\b(\d{7}|[a-z]{2}\d{3,4})\b/);
  if (code) {
    const hit = allowed.find((s) => s.code.toLowerCase() === code[1]);
    if (hit) return hit;
  }
  let best = null;
  for (const s of allowed) {
    const words = s.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (!words.length) continue;
    const hits = words.filter((w) => t.includes(w)).length;
    if (hits && (!best || hits > best.hits)) best = { s, hits };
  }
  // An acronym the catalogue does not spell out — DBMS, OOP, DSA.
  if (!best) {
    const acronym = text.match(/\b([A-Z]{2,6})\b/);
    if (acronym) {
      const initials = (name) => name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0].toUpperCase()).join('');
      const hit = allowed.find((s) => initials(s.name).startsWith(acronym[1]));
      if (hit) return hit;
    }
  }
  return best?.s ?? null;
}

const facultySubjects = async (scope) => (scope.role === ROLES.ADMIN
  ? await db.subjects.all()
  : (await db.subjects.find({ facultyId: scope.userId })));

export const ACTIONS = {
  // ---------------------------------------------------------- faculty: create
  createAssignment: {
    roles: [ROLES.FACULTY, ROLES.ADMIN],
    match: (t) => VERB.create.test(t) && /\bassignment\b|\bhomework\b/i.test(t) && !VERB.submit.test(t),
    async prepare(text, scope) {
      const subjects = await facultySubjects(scope);
      if (!subjects.length) {
        return { answer: 'You are not mapped to any subject, so there is nothing to set an assignment for.' };
      }
      const picked = await matchSubject(text, subjects);
      const due = parseWhen(text, { defaultDays: 7 });
      return {
        answer: `Here is a new assignment${picked ? ` for ${picked.name}` : ''} — check the details and create it.`,
        action: {
          name: 'createAssignment',
          title: 'New assignment',
          submitLabel: 'Create assignment',
          fields: [
            { name: 'subjectId', label: 'Subject', type: 'select', required: true, value: picked?.id ?? subjects[0].id, options: subjects.map((s) => ({ value: s.id, label: `${s.name} · ${s.branch} sem ${s.semester}` })) },
            { name: 'title', label: 'Title', type: 'text', required: true, value: '', placeholder: 'e.g. Normalisation exercise' },
            { name: 'description', label: 'Instructions', type: 'textarea', value: '' },
            { name: 'dueDate', label: 'Due date', type: 'date', required: true, value: isoDate(due) },
            { name: 'maxMarks', label: 'Marks', type: 'number', value: 10 },
          ],
        },
      };
    },
  },

  // ---------------------------------------------------------- student: submit
  submitAssignment: {
    roles: [ROLES.STUDENT],
    match: (t) => VERB.submit.test(t) && /\bassignment\b|\bhomework\b|\bwork\b/i.test(t),
    async prepare(text, scope) {
      const mine = new Set((await db.subjects.find({ branch: scope.branch, semester: scope.semester })).map((s) => s.id));
      const all = (await db.assignments.all()).filter((a) => mine.has(a.subjectId));
      const submitted = new Set((await db.submissions.find({ studentId: scope.userId })).map((s) => s.assignmentId));
      const pending = all.filter((a) => !submitted.has(a.id)).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

      if (!pending.length) {
        return { answer: 'You have submitted everything that has been set for your semester — nothing is outstanding.' };
      }
      const subjects = await lookup('subjects', pending.map((a) => a.subjectId));
      const named = await matchSubject(text, [...subjects.values()]);
      const preferred = named ? pending.find((a) => a.subjectId === named.id) : null;

      return {
        answer: `Pick the assignment and attach your file — ${pending.length} ${pending.length === 1 ? 'is' : 'are'} outstanding.`,
        action: {
          name: 'submitAssignment',
          title: 'Submit assignment',
          submitLabel: 'Submit',
          fields: [
            {
              name: 'assignmentId',
              label: 'Assignment',
              type: 'select',
              required: true,
              value: preferred?.id ?? pending[0].id,
              options: pending.map((a) => ({ value: a.id, label: `${a.title} · ${subjects.get(a.subjectId)?.name ?? ''} · due ${new Date(a.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` })),
            },
            { name: 'file', label: 'Your work', type: 'file', required: true, accept: '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt' },
            { name: 'note', label: 'Note for your teacher', type: 'text', value: '' },
          ],
        },
      };
    },
  },

  // ----------------------------------------------------------- faculty: grade
  gradeSubmissions: {
    roles: [ROLES.FACULTY, ROLES.ADMIN],
    match: (t) => VERB.grade.test(t) && /\bsubmission|\bassignment|\bstudents?\b|\bpending\b|\bremaining\b/i.test(t),
    async prepare(text, scope) {
      let assignments = await db.assignments.all();
      if (scope.role === ROLES.FACULTY) assignments = assignments.filter((a) => a.facultyId === scope.userId);
      if (!assignments.length) return { answer: 'You have not set any assignments yet, so there is nothing waiting to be graded.' };

      const subjects = await lookup('subjects', assignments.map((a) => a.subjectId));
      const named = await matchSubject(text, [...subjects.values()]);
      const scoped = named ? assignments.filter((a) => a.subjectId === named.id) : assignments;

      const byId = new Map(scoped.map((a) => [a.id, a]));
      const ungraded = (await db.submissions.find({ assignmentId: [...byId.keys()] }))
        .filter((s) => s.status !== 'graded');
      if (!ungraded.length) {
        return { answer: `Everything${named ? ` for ${named.name}` : ''} has been graded — nothing is waiting.` };
      }
      const students = await lookup('users', ungraded.map((s) => s.studentId));

      return {
        answer: `${ungraded.length} submission${ungraded.length === 1 ? '' : 's'} waiting${named ? ` for ${named.name}` : ''}. Enter the marks and save.`,
        action: {
          name: 'gradeSubmissions',
          title: 'Grade submissions',
          submitLabel: 'Save grades',
          rows: ungraded.slice(0, 25).map((s) => {
            const a = byId.get(s.assignmentId);
            return {
              submissionId: s.id,
              student: students.get(s.studentId)?.name ?? 'Unknown',
              assignment: a?.title ?? '',
              subject: subjects.get(a?.subjectId)?.name ?? '',
              maxMarks: a?.maxMarks ?? 10,
              late: Boolean(s.late),
            };
          }),
        },
      };
    },
  },

  // --------------------------------------------------------- faculty: publish
  createAnnouncement: {
    roles: [ROLES.FACULTY, ROLES.ADMIN],
    match: (t) => VERB.publish.test(t) && /\bnotice\b|\bannouncement\b|\bcircular\b|\bupdate\b|\bnews\b/i.test(t),
    async prepare(text, scope) {
      // A time only becomes a schedule if one was actually mentioned. Defaulting
      // to a future time would silently delay a notice meant to go out now.
      const mentionsTime = /\btomorrow\b|\bnext\b|\bin \d{1,2} days?\b|\bmonday|tuesday|wednesday|thursday|friday|saturday|sunday\b|\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(text);
      const when = mentionsTime ? parseWhen(text, { defaultDays: 0 }) : null;

      return {
        answer: when
          ? `Ready to schedule. It stays hidden from its audience until ${when.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`
          : 'Ready to publish. Leave the time empty to send it out immediately.',
        action: {
          name: 'createAnnouncement',
          title: when ? 'Schedule a notice' : 'New notice',
          submitLabel: when ? 'Schedule' : 'Publish',
          fields: [
            { name: 'title', label: 'Title', type: 'text', required: true, value: '' },
            { name: 'body', label: 'Notice', type: 'textarea', required: true, value: '' },
            { name: 'audience', label: 'Audience', type: 'select', value: 'all', options: [
              { value: 'all', label: 'Everyone' },
              { value: 'students', label: 'Students only' },
              { value: 'faculty', label: 'Staff only' },
            ] },
            { name: 'branch', label: 'Branch', type: 'select', value: 'ALL', options: [
              { value: 'ALL', label: 'All branches' },
              { value: 'CE', label: 'Computer Engineering' },
              { value: 'IT', label: 'Information Technology' },
              { value: 'ME', label: 'Mechanical Engineering' },
            ] },
            { name: 'publishAt', label: 'Publish at', type: 'datetime-local', value: when ? isoLocalMinutes(when) : '', hint: 'Leave empty to publish now' },
          ],
        },
      };
    },
  },

  // ------------------------------------------------------ faculty: generation
  generateQuestionBank: {
    roles: [ROLES.FACULTY, ROLES.ADMIN],
    match: (t) => VERB.generate.test(t) && /\bquestion bank\b|\bquestion paper\b|\bquestions\b|\bpaper\b|\bquiz\b/i.test(t),
    async prepare(text, scope) {
      const docs = (await db.documents.all())
        .filter((d) => !d.supersededBy)
        .filter((d) => scope.role === ROLES.ADMIN || d.audience !== 'faculty' || d.uploadedBy === scope.userId)
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        .slice(0, 40);
      if (!docs.length) return { answer: 'There is no source material in the library yet to generate questions from.' };

      const subjects = await facultySubjects(scope);
      const picked = subjects.length ? await matchSubject(text, subjects) : null;
      const count = Number(text.match(/\b(\d{1,2})\s*(?:questions?|marks? questions?)\b/i)?.[1]) || 12;

      return {
        answer: 'Choose the source material and I will draft a question bank for you to review.',
        action: {
          name: 'generateQuestionBank',
          title: 'Generate a question bank',
          submitLabel: 'Generate draft',
          note: 'The result is always a draft — nothing reaches students until you publish it.',
          fields: [
            { name: 'documentId', label: 'Source document', type: 'select', required: true, value: docs[0].id, options: docs.map((d) => ({ value: d.id, label: d.title })) },
            ...(subjects.length ? [{ name: 'subjectId', label: 'Subject', type: 'select', value: picked?.id ?? '', options: [{ value: '', label: 'Not subject-specific' }, ...subjects.map((s) => ({ value: s.id, label: s.name }))] }] : []),
            { name: 'count', label: 'How many questions', type: 'number', value: Math.min(30, Math.max(4, count)) },
            { name: 'difficulty', label: 'Difficulty', type: 'select', value: 'mixed', options: [
              { value: 'mixed', label: 'Mixed' },
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ] },
          ],
        },
      };
    },
  },
};

// Detection is deterministic and costs nothing: an action verb plus its object.
// Returning null is the common case, and it leaves the question to the record
// and document paths exactly as before.
export function detectAction(text, scope) {
  if (ASKING_ABOUT.test(text) && !VERB.submit.test(text)) return null;
  for (const [name, action] of Object.entries(ACTIONS)) {
    if (!action.roles.includes(scope.role)) continue;
    if (action.match(text)) return name;
  }
  return null;
}

export async function prepareAction(name, text, scope) {
  const action = ACTIONS[name];
  if (!action) return null;
  if (!action.roles.includes(scope.role)) {
    return { answer: 'Your account does not have access to that.' };
  }
  return action.prepare(text, scope);
}
