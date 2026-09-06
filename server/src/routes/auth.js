import { Router } from 'express';
import db from '../lib/db.js';
import { sign, verifyPassword, publicUser, authenticate } from '../lib/auth.js';

const router = Router();

// Separate login surfaces per the brief (students on one screen, staff on
// another) share a single endpoint. `portal` is a guard, not a second
// credential: it stops a student credential from being used on the staff screen
// and vice versa, so each portal means what it says.
router.post('/login', async (req, res) => {
  const { email, password, portal } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const user = await db.users.findOne({ email: String(email).trim().toLowerCase() });
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'Those credentials do not match an account' });
  }

  if (portal === 'student' && user.role !== 'student') {
    return res.status(403).json({ error: 'This is a staff account. Use the faculty and admin sign-in.' });
  }
  if (portal === 'staff' && user.role === 'student') {
    return res.status(403).json({ error: 'This is a student account. Use the student sign-in.' });
  }

  return res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

// Demo convenience: the sign-in screens offer one-tap accounts so a reviewer
// does not have to copy credentials. Never expose this in a real deployment.
router.get('/demo-accounts', async (_req, res) => {
  const student = (await db.users.find({ role: 'student', branch: 'CE', semester: 5 }))[0];
  // Pick the faculty account with the most to look at — subjects taught, plus
  // submissions actually waiting to be graded — so the demo opens on a full
  // dashboard rather than a set of empty states.
  // Three queries and an in-memory group-by, rather than three per faculty member.
  const allFaculty = await db.users.find({ role: 'faculty' });
  const allAssignments = await db.assignments.all();
  const allSubmissions = await db.submissions.all();
  const allSubjects = await db.subjects.all();

  const assignmentsBy = new Map();
  for (const a of allAssignments) {
    if (!assignmentsBy.has(a.facultyId)) assignmentsBy.set(a.facultyId, []);
    assignmentsBy.get(a.facultyId).push(a);
  }
  const ungradedBy = new Map();
  const assignmentOwner = new Map(allAssignments.map((a) => [a.id, a.facultyId]));
  for (const s of allSubmissions) {
    if (s.status === 'graded') continue;
    const owner = assignmentOwner.get(s.assignmentId);
    if (owner) ungradedBy.set(owner, (ungradedBy.get(owner) ?? 0) + 1);
  }
  const subjectsBy = new Map();
  for (const sub of allSubjects) {
    if (sub.facultyId) subjectsBy.set(sub.facultyId, (subjectsBy.get(sub.facultyId) ?? 0) + 1);
  }

  const faculty = allFaculty
    .map((f) => ({
      f,
      score: (ungradedBy.get(f.id) ?? 0) * 3
        + (assignmentsBy.get(f.id)?.length ?? 0)
        + (subjectsBy.get(f.id) ?? 0),
    }))
    .sort((a, b) => b.score - a.score)[0]?.f;
  const admin = await db.users.findOne({ role: 'admin' });
  const shape = (u, note) => u && ({ role: u.role, name: u.name, email: u.email, note, password: 'demo1234' });
  res.json({
    accounts: [
      shape(student, `${student?.branch} · Semester ${student?.semester}`),
      shape(faculty, faculty?.department),
      shape(admin, 'Full access'),
    ].filter(Boolean),
  });
});

export default router;
