// Regenerates the entire demo dataset. Destructive and idempotent: run it as
// often as you like, you always get the same shape of data back.
//
// Everything produced here is DEMO DATA. The deck is explicit that a real
// college's timetables, attendance and results are private and must not be
// sourced from any public dataset — so this generator produces realistic
// records in exactly the shape the college's own records will take, so that
// real data can replace it directly at deployment.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import db, { connect, close, id, mongoUri, dbName, driverName } from '../lib/db.js';
import { hash } from '../lib/auth.js';
import { chunkText } from '../rag/chunk.js';
import { CORPUS, NOTES } from './corpus.js';
import { BRANCHES, subjectsFor, FACULTY, FIRST_NAMES, LAST_NAMES, DEPARTMENT_OF_BRANCH } from './catalogue.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

// Deterministic PRNG so a demo looks the same every time it is reseeded.
let seedState = 20260902;
function rnd() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const daysAhead = (n) => new Date(Date.now() + n * 86400000).toISOString();

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOTS = [
  ['09:00', '10:00'], ['10:00', '11:00'], ['11:15', '12:15'],
  ['12:15', '13:15'], ['14:00', '15:00'], ['15:00', '16:00'],
];

await connect();
console.log(`Seeding College RAG Assistant demo data into ${dbName()}…\n`);

for (const c of ['users', 'subjects', 'timetable', 'attendance', 'results', 'documents', 'chunks', 'assignments', 'submissions', 'announcements', 'questionbanks', 'conversations']) {
  await db[c].replaceAll([]);
}

// ------------------------------------------------------------------- users

const PASSWORD = 'demo1234';
const pw = hash(PASSWORD);

const admin = await db.users.insert({
  id: 'usr_admin',
  role: 'admin',
  name: 'Registrar Office',
  email: 'admin@college.edu',
  password: pw,
  department: 'Administration',
  designation: 'Registrar',
  joinedAt: daysAgo(1200),
});

const faculty = await db.users.insertMany(FACULTY.map(([name, department], i) => ({
  id: `usr_fac${String(i + 1).padStart(2, '0')}`,
  role: 'faculty',
  name,
  email: `${name.toLowerCase().replace(/^(dr|prof)\.\s*/, '').replace(/\s+/g, '.')}@college.edu`,
  password: pw,
  department,
  designation: name.startsWith('Dr.') ? 'Associate Professor' : 'Assistant Professor',
  joinedAt: daysAgo(between(400, 2000)),
})));

const facultyByName = new Map(faculty.map((f, i) => [FACULTY[i][0], f]));
const subjectOwner = new Map();
for (const [name, , subjects] of FACULTY) {
  for (const s of subjects) subjectOwner.set(s, facultyByName.get(name).id);
}

// ---------------------------------------------------------------- subjects

// Anything the explicit lists do not cover goes to the least-loaded faculty
// member in the right department, so nobody ends up nominally teaching thirty
// subjects and every subject still has exactly one owner.
const load = new Map(faculty.map((f) => [f.id, 0]));
function assignFaculty(subjectName, branchCode, semester) {
  const explicit = subjectOwner.get(subjectName);
  if (explicit) { load.set(explicit, (load.get(explicit) ?? 0) + 1); return explicit; }
  const department = semester <= 2 ? 'Applied Sciences' : DEPARTMENT_OF_BRANCH[branchCode];
  const pool = faculty.filter((f) => f.department === department);
  const candidates = pool.length ? pool : faculty;
  const chosen = candidates.reduce((best, f) => ((load.get(f.id) ?? 0) < (load.get(best.id) ?? 0) ? f : best));
  load.set(chosen.id, (load.get(chosen.id) ?? 0) + 1);
  return chosen.id;
}

const allSubjects = [];
for (const branch of BRANCHES) {
  for (let sem = 1; sem <= 8; sem += 1) {
    for (const s of subjectsFor(branch.code, sem)) {
      allSubjects.push(db.subjects.insert({
        id: `sub_${branch.code}${sem}_${s.code}`,
        code: s.code,
        name: s.name,
        credits: s.credits,
        branch: branch.code,
        semester: sem,
        hasLab: s.hasLab,
        facultyId: assignFaculty(s.name, branch.code, sem),
      }));
    }
  }
}
console.log(`  ${faculty.length} faculty · ${allSubjects.length} subjects across ${BRANCHES.length} branches × 8 semesters`);

// ---------------------------------------------------------------- students

// Students are concentrated in the semesters a demo actually visits, with a
// thinner spread elsewhere so cohort filters have something to show.
const ACTIVE_SEMESTERS = [3, 4, 5, 6, 7];
const students = [];
let roll = 1;
for (const branch of BRANCHES) {
  for (const sem of ACTIVE_SEMESTERS) {
    const size = sem === 5 ? 8 : 4;
    for (let i = 0; i < size; i += 1) {
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const year = 2026 - Math.ceil(sem / 2);
      const enrollment = `${year}${branch.code === 'CE' ? '01' : branch.code === 'IT' ? '02' : '03'}${String(roll).padStart(4, '0')}`;
      students.push({
        id: `usr_stu${String(roll).padStart(3, '0')}`,
        role: 'student',
        name: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${roll}@student.college.edu`,
        password: pw,
        branch: branch.code,
        semester: sem,
        enrollment,
        division: i < size / 2 ? 'A' : 'B',
        joinedAt: daysAgo(sem * 180),
      });
      roll += 1;
    }
  }
}
await db.users.insertMany(students);
console.log(`  ${students.length} students`);

// --------------------------------------------------------------- timetable

for (const branch of BRANCHES) {
  for (const sem of ACTIVE_SEMESTERS) {
    const subs = await db.subjects.find({ branch: branch.code, semester: sem });
    if (!subs.length) continue;
    const rows = [];
    let cursor = 0;
    for (const day of DAYS) {
      // Saturday is a half day — laboratory and remedial slots only.
      const slots = day === 'Saturday' ? SLOTS.slice(0, 3) : SLOTS;
      for (const [start, end] of slots) {
        // Leave the post-lunch slot free twice a week so the grid has breathing room.
        if (start === '14:00' && rnd() < 0.35) continue;
        const subject = subs[cursor % subs.length];
        cursor += 1;
        const isLab = subject.hasLab && (day === 'Saturday' || rnd() < 0.18);
        rows.push({
          branch: branch.code,
          semester: sem,
          day,
          startTime: start,
          endTime: isLab ? SLOTS[Math.min(SLOTS.length - 1, SLOTS.findIndex((s) => s[0] === start) + 1)][1] : end,
          subjectId: subject.id,
          type: isLab ? 'lab' : 'lecture',
          room: isLab ? `Lab ${branch.code}-${between(1, 4)}` : `${branch.code}-${200 + between(1, 12)}`,
        });
      }
    }
    await db.timetable.insertMany(rows);
  }
}
console.log(`  ${(await db.timetable.all()).length} timetable entries`);

// -------------------------------------------------- attendance and results

// Attendance is stored aggregated per student per subject, plus a short session
// log so the UI can show a recent-sessions trail. The shape mirrors what a real
// attendance export contains.
const attendanceRows = [];
const resultRows = [];

for (const student of students) {
  const subs = await db.subjects.find({ branch: student.branch, semester: student.semester });
  // Each student gets a baseline diligence, so charts show believable variation
  // between people rather than uniform noise.
  const diligence = 0.62 + rnd() * 0.36;
  for (const sub of subs) {
    const total = between(38, 52);
    const rate = Math.min(0.99, Math.max(0.42, diligence + (rnd() - 0.5) * 0.22));
    const attended = Math.round(total * rate);
    const sessions = [];
    for (let i = 0; i < 10; i += 1) {
      sessions.push({ date: daysAgo(i * 3 + between(0, 2)).slice(0, 10), status: rnd() < rate ? 'present' : 'absent' });
    }
    attendanceRows.push({
      studentId: student.id,
      subjectId: sub.id,
      semester: student.semester,
      branch: student.branch,
      attended,
      total,
      sessions: sessions.reverse(),
      updatedAt: daysAgo(between(1, 6)),
    });
  }

  // Current-semester mid-semester results, plus finals for every semester passed.
  const ability = 0.48 + rnd() * 0.45;
  for (const sub of subs) {
    const base = Math.min(0.98, Math.max(0.30, ability + (rnd() - 0.5) * 0.24));
    resultRows.push({
      studentId: student.id,
      subjectId: sub.id,
      semester: student.semester,
      branch: student.branch,
      examType: 'midsem',
      marks: Math.round(20 * base),
      maxMarks: 20,
      publishedAt: daysAgo(between(20, 40)),
    });
  }
  for (let sem = 1; sem < student.semester; sem += 1) {
    for (const sub of await db.subjects.find({ branch: student.branch, semester: sem })) {
      const base = Math.min(0.97, Math.max(0.35, ability + (rnd() - 0.5) * 0.22));
      resultRows.push({
        studentId: student.id,
        subjectId: sub.id,
        semester: sem,
        branch: student.branch,
        examType: 'final',
        marks: Math.round(100 * base),
        maxMarks: 100,
        publishedAt: daysAgo((student.semester - sem) * 180),
      });
    }
  }
}
await db.attendance.insertMany(attendanceRows);
await db.results.insertMany(resultRows);
console.log(`  ${attendanceRows.length} attendance records · ${resultRows.length} result records`);

// --------------------------------------------------------------- documents

async function ingest(doc) {
  const record = await db.documents.insert({
    id: doc.id ?? id('doc'),
    title: doc.title,
    fileName: doc.fileName,
    fileType: doc.fileType,
    category: doc.category,
    audience: doc.audience ?? 'all',
    branch: doc.branch ?? 'ALL',
    semester: doc.semester ?? 0,
    subjectId: doc.subjectId ?? null,
    version: doc.version ?? 1,
    supersedes: doc.supersedes ?? null,
    superseded: false,
    status: 'published',
    uploadedBy: doc.uploadedBy,
    uploadedAt: doc.uploadedAt,
    sizeBytes: doc.body.length * 2,
    isDemo: true,
    chunkCount: 0,
  });
  const chunks = chunkText(doc.body, { pages: Math.max(1, Math.round(doc.body.length / 1800)) }).map((c) => ({
    docId: record.id,
    title: record.title,
    section: c.section,
    page: c.page,
    ordinal: c.ordinal,
    text: c.text,
    category: record.category,
    audience: record.audience,
    branch: record.branch,
    semester: record.semester,
    uploadedAt: record.uploadedAt,
    uploadedBy: record.uploadedBy,
    status: 'published',
    superseded: false,
  }));
  await db.chunks.insertMany(chunks);
  await db.documents.update(record.id, { chunkCount: chunks.length });
  return record;
}

for (const doc of CORPUS) {
  await ingest({ ...doc, uploadedBy: admin.id, uploadedAt: daysAgo(doc.daysAgo) });
}

for (const note of NOTES) {
  const subject = await db.subjects.findOne({ code: note.subjectCode });
  await ingest({
    ...note,
    category: 'notes',
    audience: 'all',
    branch: subject?.branch ?? 'ALL',
    semester: subject?.semester ?? 0,
    subjectId: subject?.id ?? null,
    uploadedBy: subject?.facultyId ?? pick(faculty).id,
    uploadedAt: daysAgo(between(4, 25)),
  });
}

// A superseded document, so the "which circular is current" behaviour is
// demonstrable: this older revision must never appear in an answer.
const current = await db.documents.findOne({ title: 'Academic Calendar — Odd Semester 2025-26' });
const old = await ingest({
  title: 'Academic Calendar — Odd Semester 2025-26 (Provisional)',
  fileName: 'academic-calendar-odd-provisional.pdf',
  fileType: 'pdf',
  category: 'circular',
  audience: 'all',
  branch: 'ALL',
  semester: 0,
  version: 1,
  uploadedBy: admin.id,
  uploadedAt: daysAgo(120),
  body: `Term Schedule
Instruction for the odd semester was provisionally scheduled to commence in the second week of July. The first mid-semester examination was provisionally placed in the seventh week of the term.

Examination Period
End-semester examinations were provisionally scheduled for the second week of November. This provisional calendar has since been revised.`,
});
await db.documents.update(old.id, { superseded: true, supersededBy: current.id });
await db.chunks.updateWhere({ docId: old.id }, { superseded: true });
await db.documents.update(current.id, { supersedes: old.id });

console.log(`  ${(await db.documents.all()).length} documents · ${(await db.chunks.all()).length} indexed passages`);

// ------------------------------------------------------------- assignments

const ASSIGNMENT_TEMPLATES = [
  ['Problem Set {n}', 'Solve the problems listed in the attached sheet. Show complete working for each; answers without derivation carry no marks.'],
  ['Lab Journal — Experiment {n}', 'Submit the observation table, the calculations and your conclusion for the experiment performed in this week\'s session.'],
  ['Case Study Report', 'Prepare a report of not more than eight pages analysing the case discussed in class. Cite every source you refer to.'],
  ['Unit {n} Assignment', 'Answer all questions from the unit assignment sheet. Handwritten submissions are accepted; scan them clearly before uploading.'],
  ['Mini Project Proposal', 'Submit a two-page proposal covering the problem statement, the proposed approach, the tools you intend to use, and a week-by-week plan.'],
];

const assignments = [];
for (const branch of BRANCHES) {
  for (const sem of ACTIVE_SEMESTERS) {
    const subs = await db.subjects.find({ branch: branch.code, semester: sem });
    for (const sub of subs.slice(0, 3)) {
      const n = between(1, 4);
      const [titleTpl, description] = pick(ASSIGNMENT_TEMPLATES);
      const overdue = rnd() < 0.4;
      assignments.push({
        subjectId: sub.id,
        facultyId: sub.facultyId,
        branch: branch.code,
        semester: sem,
        title: titleTpl.replace('{n}', n),
        description,
        maxMarks: pick([10, 15, 20, 25]),
        dueDate: overdue ? daysAgo(between(1, 12)) : daysAhead(between(2, 18)),
        createdAt: daysAgo(between(14, 30)),
        acceptedFormats: ['pdf', 'docx', 'xlsx', 'image'],
        id: id('asg'),
      });
    }
  }
}

await db.assignments.insertMany(assignments);

// Submissions: roughly two thirds of students submit, some graded, some not.
const submissions = [];
for (const a of assignments) {
  const cohort = students.filter((s) => s.branch === a.branch && s.semester === a.semester);
  for (const student of cohort) {
    if (rnd() > 0.68) continue;
    const graded = rnd() < 0.55;
    submissions.push({
      assignmentId: a.id,
      studentId: student.id,
      fileName: rnd() < 0.4 ? `${student.enrollment}-notes.jpg` : `${student.enrollment}-${a.title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      fileType: rnd() < 0.4 ? 'image' : 'pdf',
      submittedAt: daysAgo(between(1, 10)),
      status: graded ? 'graded' : 'submitted',
      marks: graded ? between(Math.floor(a.maxMarks * 0.5), a.maxMarks) : null,
      feedback: graded ? pick([
        'Well structured. Watch the units in question 3.',
        'Correct approach throughout. Present the derivation more clearly next time.',
        'Good effort. Two answers are incomplete — see the marked copy.',
        'Excellent work, particularly the analysis section.',
      ]) : null,
      isDemo: true,
    });
  }
}
await db.submissions.insertMany(submissions);
console.log(`  ${assignments.length} assignments · ${submissions.length} submissions`);

// ------------------------------------------------------------ announcements

const announcements = [
  { title: 'Mid-semester examination timetable published', body: 'The timetable for the second mid-semester examination is now available on the notice board and the student portal. Papers begin at 10:00 a.m. Candidates must be seated fifteen minutes before the start of the paper and must carry their institute identity card.', audience: 'all', branch: 'ALL', semester: 0, offset: -2 },
  { title: 'Campus drive — Infosys, 18 September', body: 'Infosys will conduct a campus recruitment drive for the 2026 batch. Registration closes three days before the drive. Eligibility is a CPI of 6.0 with not more than two live backlogs. Registered candidates must attend the pre-placement talk.', audience: 'all', branch: 'ALL', semester: 0, offset: -5 },
  { title: 'Library will remain open till 11 p.m. during examinations', body: 'The reading hall will remain open until 11:00 p.m. from the first day of the end-semester examinations until the last paper. Institute identity cards must be produced at entry after 8:00 p.m.', audience: 'all', branch: 'ALL', semester: 0, offset: -9 },
  { title: 'Fee payment window closes on Friday', body: 'The last date for payment of semester fees without a late charge is this Friday. Payment is accepted through the online gateway only. Students with unpaid dues will not receive an examination hall ticket.', audience: 'all', branch: 'ALL', semester: 0, offset: -12 },
  { title: 'Data Structures remedial classes for semester 3', body: 'Remedial sessions for Data Structures will be held every Saturday from 11:00 a.m. in CE-204 for students who scored below 50% in the first mid-semester test. Attendance is recorded.', audience: 'all', branch: 'CE', semester: 3, offset: -4 },
  { title: 'Machine Learning lab manual updated', body: 'The laboratory manual for Machine Learning has been revised for the current term. Experiments 6 and 7 have changed. Download the updated manual from the study material section before the next session.', audience: 'all', branch: 'CE', semester: 7, offset: -3 },
  { title: 'Faculty meeting — semester result review', body: 'A meeting of all subject faculty to review mid-semester results and identify students needing academic support will be held on Thursday at 3:30 p.m. in the seminar hall.', audience: 'faculty', branch: 'ALL', semester: 0, offset: -1 },
];

for (const a of announcements) {
  await db.announcements.insert({
    ...a,
    status: 'published',
    publishAt: daysAgo(Math.abs(a.offset)),
    createdBy: a.audience === 'faculty' ? admin.id : admin.id,
    createdAt: daysAgo(Math.abs(a.offset) + 1),
    attachments: [],
  });
}

// Scheduled items — the brief's reminder/scheduling feature, visible to their
// author as pending and invisible to students until the publish time passes.
const scheduled = [
  { title: 'End-semester examination hall ticket release', body: 'Hall tickets for the end-semester examinations will be available for download from the student portal. Verify your subject list and photograph immediately, and report any discrepancy to the examination section the same day.', audience: 'all', branch: 'ALL', semester: 0, ahead: 3 },
  { title: 'Project I first review schedule — semester 7', body: 'The first project review will be conducted over two days. Each group is allotted fifteen minutes for presentation and five minutes for questions. Bring a printed copy of your literature survey.', audience: 'all', branch: 'ALL', semester: 7, ahead: 6 },
  { title: 'Winter internship registration opens', body: 'Registration for winter internships opens next week. Students of semester 5 and above may apply. The list of participating organisations will be circulated along with the registration link.', audience: 'all', branch: 'ALL', semester: 0, ahead: 9 },
];
for (const s of scheduled) {
  await db.announcements.insert({
    title: s.title,
    body: s.body,
    audience: s.audience,
    branch: s.branch,
    semester: s.semester,
    status: 'scheduled',
    publishAt: daysAhead(s.ahead),
    createdBy: admin.id,
    createdAt: daysAgo(1),
    attachments: [],
  });
}
console.log(`  ${(await db.announcements.all()).length} announcements (${scheduled.length} scheduled for future release)`);

// Read before close() — closing resets the driver to null.
const destination = driverName() === 'file'
  ? 'the local JSON files in server/data/'
  : `${dbName()} at ${mongoUri().replace(/\/\/[^@]*@/, '//<credentials>@')}`;

await close();

console.log(`\nData written to ${destination}`);
console.log('\nDemo accounts — password for every account is: ' + PASSWORD);
console.log('  admin    admin@college.edu');
console.log('  faculty  ' + faculty[0].email + '   (' + faculty[0].name + ')');
console.log('  faculty  ' + faculty[4].email + '   (' + faculty[4].name + ')');
const demoStudent = students.find((s) => s.semester === 5 && s.branch === 'CE');
console.log('  student  ' + demoStudent.email + '   (' + demoStudent.name + ', CE sem 5)');
console.log('');
