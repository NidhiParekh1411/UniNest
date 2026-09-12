// Retrieval + routing evaluation harness.
//
// The deck names "no ready test set" as a real challenge, so this is a small
// hand-built one. It checks three things the product promises: questions route
// to the right engine, document answers carry citations, and questions with no
// answer in the corpus are abstained on rather than guessed at.
//
// Run: npm run eval
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import db, { connect } from '../lib/db.js';
import { classify } from './router.js';
import { ask } from './answer.js';
import { stats, refresh } from './index.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });
await connect();

const student = await (async () => {
  const s = (await db.users.find({ role: 'student', branch: 'CE', semester: 5 }))[0];
  if (!s) throw new Error('No seeded student found — run `npm run seed` first.');
  return { userId: s.id, role: 'student', name: s.name, branch: s.branch, semester: s.semester, department: null, subjectIds: null };
})();

const faculty = await (async () => {
  const f = (await db.users.find({ role: 'faculty' }))[0];
  return { userId: f.id, role: 'faculty', name: f.name, branch: null, semester: null, department: f.department, subjectIds: (await db.subjects.find({ facultyId: f.id })).map((s) => s.id) };
})();

// expect: 'structured' | 'document' | 'clarify' | 'abstain'
const CASES = [
  // The routing pairs the deck calls out explicitly.
  { q: 'what is my attendance', scope: student, expect: 'structured', intent: 'attendance' },
  { q: 'what is the attendance policy', scope: student, expect: 'document' },
  { q: 'how many classes can I miss', scope: student, expect: 'document' },
  { q: 'which subjects am I short of attendance in', scope: student, expect: 'structured', intent: 'attendance' },

  { q: 'what is my timetable today', scope: student, expect: 'structured', intent: 'timetable' },
  { q: 'show my full week timetable', scope: student, expect: 'structured', intent: 'timetable' },
  // Possessive: the subject mapping already says which sessions are theirs, so
  // asking which cohort they meant was asking a question they had answered.
  { q: 'what is my timetable', scope: faculty, expect: 'structured', intent: 'timetable' },
  { q: 'what is my schedule', scope: faculty, expect: 'structured', intent: 'timetable' },
  // Impersonal, so the cohort is genuinely unknown and worth asking about.
  { q: 'what is the timetable', scope: faculty, expect: 'clarify' },

  { q: 'what were my midsem marks', scope: student, expect: 'structured', intent: 'results' },
  { q: 'how is CGPA calculated', scope: student, expect: 'document' },
  { q: 'what are the passing criteria', scope: student, expect: 'document' },

  { q: 'who teaches Database Management Systems', scope: student, expect: 'structured', intent: 'faculty' },
  { q: 'what assignments are pending for me', scope: student, expect: 'structured', intent: 'assignments' },
  { q: 'what is the latest announcement', scope: student, expect: 'structured', intent: 'announcements' },

  // Pure document questions across the corpus.
  { q: 'what is the placement eligibility criteria', scope: student, expect: 'document' },
  { q: 'can I get a refund if I withdraw admission', scope: student, expect: 'document' },
  { q: 'what are the library timings', scope: student, expect: 'document' },
  { q: 'what is the hostel curfew time', scope: student, expect: 'document' },
  { q: 'what is the plagiarism limit for project reports', scope: student, expect: 'document' },
  { q: 'how do I apply for re-evaluation of my answer book', scope: student, expect: 'document' },
  { q: 'what happens if I am caught using unfair means', scope: student, expect: 'document' },
  { q: 'is a summer internship compulsory', scope: student, expect: 'document' },
  { q: 'how do I report ragging', scope: student, expect: 'document' },
  { q: 'what safety gear is required in the workshop', scope: student, expect: 'document' },

  // Record queries the pattern handlers cannot express. These must reach the
  // tools and be answered from the tables, not from the policy documents —
  // `tool` asserts which query ran, `via` that it took no model call.
  { q: 'list students with attendance below 75%', scope: faculty, expect: 'structured', tool: 'studentsByAttendance', via: 'patterns' },
  { q: 'attendance defaulters in CE', scope: faculty, expect: 'structured', tool: 'studentsByAttendance', via: 'patterns' },
  { q: 'students above 90% attendance', scope: faculty, expect: 'structured', tool: 'studentsByAttendance', via: 'patterns' },
  { q: 'top 3 students by marks', scope: faculty, expect: 'structured', tool: 'studentsByMarks', via: 'patterns' },
  { q: 'which students scored below 60 percent', scope: faculty, expect: 'structured', tool: 'studentsByMarks', via: 'patterns' },
  { q: 'what is my highest mark', scope: student, expect: 'structured', tool: 'myResults', via: 'patterns' },
  { q: 'my worst subject', scope: student, expect: 'structured', tool: 'myResults', via: 'patterns' },
  { q: 'show my marks semester wise', scope: student, expect: 'structured', tool: 'myResults', via: 'patterns' },

  // Rule 4, at the only layer that counts. A student asking a population
  // question is refused outright — answering it with their own row would be
  // safe but dishonest, and answering it with the cohort would be a leak.
  { q: 'list students with attendance below 75%', scope: student, expect: 'structured', refused: true },
  { q: 'who are the top 5 students by marks', scope: student, expect: 'structured', refused: true },
  { q: 'show me every student below 60 percent', scope: student, expect: 'structured', refused: true },

  // Must abstain — nothing in the corpus answers these.
  { q: 'what is the wifi password for the campus network', scope: student, expect: 'abstain' },
  { q: 'who won the inter college cricket tournament last year', scope: student, expect: 'abstain' },
  { q: 'what is the price of a cup of tea in the canteen', scope: student, expect: 'abstain' },
];

const GREEN = '\x1b[32m'; const RED = '\x1b[31m'; const DIM = '\x1b[2m'; const RESET = '\x1b[0m';

const results = [];
for (const c of CASES) {
  const res = await ask({ question: c.q, scope: c.scope });
  const routeOk = res.kind === c.expect;
  const intentOk = !c.intent || res.meta.intent === c.intent;
  const citationOk = res.kind !== 'document' || res.citations.length > 0;
  const toolOk = !c.tool || res.meta.tool === c.tool;
  // A refusal that silently answered something else would still be "structured",
  // so the flag is asserted rather than inferred from the route.
  const refusedOk = c.refused === undefined || Boolean(res.meta.refused) === c.refused;
  // Asserted only where it is claimed: it proves the shape was read in Node and
  // cost none of the day's allowance.
  const viaOk = !c.via || res.meta.via === c.via;
  const pass = routeOk && intentOk && citationOk && toolOk && refusedOk && viaOk;
  results.push({ ...c, got: res.kind, gotIntent: res.meta.intent, gotTool: res.meta.tool, gotVia: res.meta.via, gotRefused: Boolean(res.meta.refused), citations: res.citations.length, pass, answer: res.answer });
}

await refresh();
console.log(`\nIndex: ${JSON.stringify(stats())}\n`);
for (const r of results) {
  const mark = r.pass ? `${GREEN}pass${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`${mark}  ${r.q}`);
  if (!r.pass) {
    const want = [r.expect, r.intent, r.tool, r.via, r.refused === undefined ? null : `refused=${r.refused}`].filter(Boolean).join('/');
    const got = [r.got, r.gotIntent, r.gotTool, r.gotVia, `refused=${r.gotRefused}`].filter(Boolean).join('/');
    console.log(`      expected ${want}, got ${got}`);
    console.log(`      ${DIM}${(r.answer ?? '').slice(0, 140)}${RESET}`);
  }
}

const byGroup = (name, filter) => {
  const set = results.filter(filter);
  const ok = set.filter((r) => r.pass).length;
  return `${name}: ${ok}/${set.length}`;
};

const passed = results.filter((r) => r.pass).length;
console.log(`\n${byGroup('routing (structured)', (r) => r.expect === 'structured')}`);
console.log(byGroup('routing (document)', (r) => r.expect === 'document'));
console.log(byGroup('clarification', (r) => r.expect === 'clarify'));
console.log(byGroup('abstention', (r) => r.expect === 'abstain'));
console.log(byGroup('record queries', (r) => Boolean(r.tool)));
console.log(byGroup('role scoping', (r) => r.refused === true));
console.log(`\nTotal: ${passed}/${results.length}\n`);
process.exit(passed === results.length ? 0 : 1);
