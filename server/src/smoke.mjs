const BASE = 'http://localhost:4000/api';
let pass = 0, fail = 0;
const results = [];

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

function check(name, cond, detail = '') {
  if (cond) { pass++; results.push(`  ok   ${name}`); }
  else { fail++; results.push(`  FAIL ${name} ${detail}`); }
}

const login = async (email, portal) => (await req('/auth/login', { method: 'POST', body: { email, password: 'demo1234', portal } })).json;

// --- auth
const badPortal = await req('/auth/login', { method: 'POST', body: { email: 'admin@college.edu', password: 'demo1234', portal: 'student' } });
check('staff account rejected on student portal', badPortal.status === 403, JSON.stringify(badPortal.json));
const badPw = await req('/auth/login', { method: 'POST', body: { email: 'admin@college.edu', password: 'wrong', portal: 'staff' } });
check('wrong password rejected', badPw.status === 401);
check('no token = 401', (await req('/overview')).status === 401);

const admin = await login('admin@college.edu', 'staff');
const faculty = await login('anjali.mehta@college.edu', 'staff');
const demoAcc = (await req('/auth/demo-accounts')).json.accounts;
const studentEmail = demoAcc.find(a => a.role === 'student').email;
const student = await login(studentEmail, 'student');
check('all three roles sign in', admin?.token && faculty?.token && student?.token);

const A = admin.token, F = faculty.token, S = student.token;

// --- overview per role
for (const [name, t, role] of [['admin', A, 'admin'], ['faculty', F, 'faculty'], ['student', S, 'student']]) {
  const r = await req('/overview', { token: t });
  check(`${name} overview`, r.status === 200 && r.json.role === role && r.json.stats.length === 4, JSON.stringify(r.json).slice(0,120));
}

// --- role isolation: the security promise
const otherStudent = (await req('/users?role=student', { token: A })).json.users.find(u => u.email !== studentEmail);
const peek = await req(`/academics/attendance?studentId=${otherStudent.id}`, { token: S });
check('student cannot read another student attendance', peek.status === 200 && peek.json.student?.id === student.user.id, `got ${peek.status} ${peek.json?.student?.id}`);
const peekResults = await req(`/academics/results?studentId=${otherStudent.id}`, { token: S });
check('student cannot read another student results', peekResults.status === 200 && peekResults.json.student?.id === student.user.id);
check('student cannot list users', (await req('/users', { token: S })).status === 403);
check('faculty cannot create users', (await req('/users', { token: F, method: 'POST', body: { name: 'X', email: 'x@y.z', role: 'admin' } })).status === 403);
check('student cannot upload documents', (await req('/documents', { token: S, method: 'POST' })).status === 403);
check('student cannot create announcements', (await req('/announcements', { token: S, method: 'POST', body: { title: 'a', body: 'b' } })).status === 403);
check('student cannot generate question banks', (await req('/question-banks/generate', { token: S, method: 'POST', body: { documentId: 'x' } })).status === 403);

// --- academics
const tt = await req('/academics/timetable', { token: S });
check('student timetable scoped to own cohort', tt.status === 200 && tt.json.rows.length > 0 && tt.json.branch === student.user.branch && tt.json.semester === student.user.semester);
const ttFac = await req('/academics/timetable?mine=true', { token: F });
check('faculty timetable spans multiple semesters', ttFac.status === 200 && new Set(ttFac.json.rows.map(r => r.semester)).size > 1, `${new Set((ttFac.json.rows||[]).map(r=>r.semester)).size} semesters`);
const att = await req('/academics/attendance', { token: S });
check('student attendance has subjects + overall', att.json.subjects.length > 0 && att.json.overall.percent > 0);
const cohortAtt = await req('/academics/attendance?branch=CE&semester=5', { token: A });
check('admin cohort attendance', cohortAtt.json.scope === 'cohort' && cohortAtt.json.cohort.length > 0);
const res5 = await req('/academics/results', { token: S });
check('student results have semester history', res5.json.bySemester.length > 1 && res5.json.overall.cpi > 0);

// --- documents
const docs = await req('/documents', { token: S });
const supersededVisible = docs.json.documents.some(d => d.superseded);
check('superseded document hidden from student library', !supersededVisible);
const adminDocs = await req('/documents', { token: A });
check('admin sees superseded document', adminDocs.json.documents.some(d => d.superseded));

// --- chat across roles
const asks = [
  [S, 'what is my attendance', 'structured'],
  [S, 'what is the attendance policy', 'document'],
  [S, 'what is the wifi password', 'abstain'],
  [F, 'what is my timetable', 'clarify'],
  [S, 'who teaches Database Management Systems', 'structured'],
];
for (const [t, q, kind] of asks) {
  const r = await req('/chat/ask', { token: t, method: 'POST', body: { question: q } });
  check(`ask "${q}" -> ${kind}`, r.status === 200 && r.json.kind === kind, `got ${r.json?.kind}`);
}
// citations present on document answers
const cited = await req('/chat/ask', { token: S, method: 'POST', body: { question: 'what are the library timings' } });
check('document answer carries citations', cited.json.citations.length > 0);
// follow-up override resolves the clarify
const resolved = await req('/chat/ask', { token: F, method: 'POST', body: { question: 'what is my timetable', overrides: { semester: 5, branch: 'CE' } } });
check('follow-up override resolves clarification', resolved.json.kind === 'structured' && resolved.json.data?.type === 'timetable', `got ${resolved.json.kind}`);
// conversation persisted
const convo = await req('/chat/conversations', { token: S });
check('conversations persisted', convo.json.conversations.length > 0);

// --- suggestions (the dropdown feature)
const sugExam = await req('/chat/suggest?q=exam', { token: S });
check('typing "exam" yields suggestions', sugExam.json.groups.length > 0 && sugExam.json.groups[0].items.length > 0);
const sugStudent = JSON.stringify(sugExam.json.groups);
check('student not offered staff actions', !sugStudent.includes('Generate a question bank'));
const sugFac = await req('/chat/suggest?q=exam', { token: F });
check('faculty offered staff actions', JSON.stringify(sugFac.json.groups).includes('question bank'));
const starters = await req('/chat/suggest?q=', { token: S });
check('empty query returns starters', starters.json.groups[0].items.length === 4);

// --- assignments lifecycle
const facAssign = await req('/assignments', { token: F });
check('faculty sees own assignments with counts', facAssign.json.assignments.length > 0 && facAssign.json.assignments[0].cohortSize > 0);
const subj = (await req('/academics/subjects?mine=true', { token: F })).json.subjects[0];
const created = await req('/assignments', { token: F, method: 'POST', body: { subjectId: subj.id, title: 'Smoke test assignment', description: 'x', dueDate: new Date(Date.now()+86400000).toISOString(), maxMarks: 25 } });
check('faculty creates assignment', created.status === 201 && created.json.assignment.title === 'Smoke test assignment');
const target = facAssign.json.assignments.find(a => a.submissionCount > a.gradedCount) ?? facAssign.json.assignments[0];
const subs = await req(`/assignments/${target.id}/submissions`, { token: F });
check('faculty reads submissions', subs.status === 200);
const ungraded = subs.json.submissions.find(s => s.status !== 'graded');
if (ungraded) {
  const graded = await req(`/assignments/submissions/${ungraded.id}/grade`, { token: F, method: 'POST', body: { marks: 5, feedback: 'smoke' } });
  check('faculty grades submission', graded.status === 200 && graded.json.submission.status === 'graded');
  const overMax = await req(`/assignments/submissions/${ungraded.id}/grade`, { token: F, method: 'POST', body: { marks: 99999 } });
  check('marks above maximum rejected', overMax.status === 400);
} else { check('found ungraded submission to grade', false, '(none in seed)'); }

// --- announcements + scheduling
const future = new Date(Date.now() + 3 * 86400000).toISOString();
const sched = await req('/announcements', { token: A, method: 'POST', body: { title: 'Smoke scheduled', body: 'later', publishAt: future } });
check('scheduled announcement created', sched.status === 201 && sched.json.announcement.status === 'scheduled');
const studentSees = await req('/announcements', { token: S });
check('student cannot see scheduled item', !studentSees.json.announcements.some(a => a.title === 'Smoke scheduled'));
const adminSees = await req('/announcements', { token: A });
check('admin sees it in the scheduled queue', adminSees.json.scheduled.some(a => a.title === 'Smoke scheduled'));
const pub = await req(`/announcements/${sched.json.announcement.id}/publish-now`, { token: A, method: 'POST' });
check('publish-now flips it live', pub.json.announcement.status === 'published');
const studentSeesNow = await req('/announcements', { token: S });
check('student now sees it', studentSeesNow.json.announcements.some(a => a.title === 'Smoke scheduled'));
await req(`/announcements/${sched.json.announcement.id}`, { token: A, method: 'DELETE' });
// staff-only announcement invisible to students
check('staff-only notice hidden from students', !studentSeesNow.json.announcements.some(a => a.audience === 'faculty'));

// --- question bank agent
const source = adminDocs.json.documents.find(d => d.chunkCount > 5 && !d.superseded);
const bank = await req('/question-banks/generate', { token: F, method: 'POST', body: { documentId: source.id, count: 10 } });
check('question bank generated', bank.status === 201 && bank.json.bank.questions.length >= 4, `${bank.status} ${bank.json?.error ?? bank.json?.bank?.questions?.length}`);
check('generated bank is a draft', bank.json.bank?.status === 'draft');
check('bank has mixed question types', new Set(bank.json.bank.questions.map(q => q.type)).size > 1);
check('bank totals marks', bank.json.bank.totalMarks > 0);
const bankId = bank.json.bank.id;
const studentBanksBefore = await req('/question-banks', { token: S });
check('draft bank invisible to students', !studentBanksBefore.json.banks.some(b => b.id === bankId));
await req(`/question-banks/${bankId}`, { token: F, method: 'PATCH', body: { status: 'published' } });
await req(`/question-banks/${bankId}`, { token: F, method: 'DELETE' });

// --- admin user management
const newUser = await req('/users', { token: A, method: 'POST', body: { name: 'Smoke Student', email: 'smoke@student.college.edu', role: 'student', branch: 'CE', semester: 3 } });
check('admin creates student', newUser.status === 201 && newUser.json.user.enrollment);
const dup = await req('/users', { token: A, method: 'POST', body: { name: 'Smoke Student', email: 'smoke@student.college.edu', role: 'student', branch: 'CE', semester: 3 } });
check('duplicate email rejected', dup.status === 409);
await req(`/users/${newUser.json.user.id}`, { token: A, method: 'DELETE' });
const facWithSubjects = (await req('/users?role=faculty', { token: A })).json.users.find(u => u.subjectCount > 0);
check('faculty with subjects cannot be deleted', (await req(`/users/${facWithSubjects.id}`, { token: A, method: 'DELETE' })).status === 409);

console.log(results.join('\n'));
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
