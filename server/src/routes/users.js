import { Router } from 'express';
import db, { lookup } from '../lib/db.js';
import { authenticate, requireRole, hash, publicUser, ROLES } from '../lib/auth.js';

const router = Router();
router.use(authenticate);

// Directory lookup is available to staff (to pick a student for grading or a
// faculty member for a subject assignment); full user management is admin only.
router.get('/', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
  const { role, branch, semester, q } = req.query;
  let rows = await db.users.find({
    role: role || undefined,
    branch: branch || undefined,
    semester: semester ? Number(semester) : undefined,
  });
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter((u) => u.name.toLowerCase().includes(needle)
      || u.email.toLowerCase().includes(needle)
      || (u.enrollment ?? '').includes(needle));
  }
  // One query for every faculty member's subject tally, rather than one per row.
  const facultyIds = rows.filter((u) => u.role === ROLES.FACULTY).map((u) => u.id);
  const subjectCounts = new Map();
  for (const s of await db.subjects.find({ facultyId: facultyIds })) {
    subjectCounts.set(s.facultyId, (subjectCounts.get(s.facultyId) ?? 0) + 1);
  }
  res.json({
    users: rows
      .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))
      .slice(0, 300)
      .map((u) => ({
        ...publicUser(u),
        subjectCount: u.role === ROLES.FACULTY ? (subjectCounts.get(u.id) ?? 0) : undefined,
      })),
  });
});

router.post('/', requireRole(ROLES.ADMIN), async (req, res) => {
  const { name, email, role, branch, semester, department, password } = req.body ?? {};
  if (!name?.trim() || !email?.trim()) return res.status(400).json({ error: 'Name and email are required' });
  if (!['student', 'faculty', 'admin'].includes(role)) return res.status(400).json({ error: 'Choose a valid role' });
  if (await db.users.findOne({ email: email.trim().toLowerCase() })) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  if (role === 'student' && (!branch || !semester)) {
    return res.status(400).json({ error: 'A student account needs a branch and a semester' });
  }

  const user = await db.users.insert({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role,
    password: hash(password?.trim() || 'demo1234'),
    branch: role === 'student' ? branch : null,
    semester: role === 'student' ? Number(semester) : null,
    department: role === 'student' ? null : (department ?? 'Administration'),
    enrollment: role === 'student' ? `${new Date().getFullYear()}${branch === 'CE' ? '01' : branch === 'IT' ? '02' : '03'}${String(await db.users.count({ role: 'student' }) + 1).padStart(4, '0')}` : undefined,
    division: role === 'student' ? 'A' : undefined,
    joinedAt: new Date().toISOString(),
  });
  return res.status(201).json({ user: publicUser(user) });
});

// Editing an account. Role is deliberately not editable: it decides the shape
// of the record (a student carries an enrollment number, a branch and a
// semester; staff carry a department), so flipping it would leave a half-built
// account behind. Removing and re-adding is the honest way to change a role.
router.patch('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  const user = await db.users.byId(req.params.id);
  if (!user) return res.status(404).json({ error: 'Account not found' });
  const patch = {};

  for (const key of ['name', 'department', 'branch', 'division', 'designation', 'enrollment']) {
    if (typeof req.body?.[key] === 'string') patch[key] = req.body[key].trim();
  }
  if (patch.name === '') return res.status(400).json({ error: 'Name cannot be empty' });

  // Email is the sign-in identity, so it may change but must stay unique.
  if (typeof req.body?.email === 'string') {
    const email = req.body.email.trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email cannot be empty' });
    if (email !== user.email) {
      const clash = await db.users.findOne({ email });
      if (clash) return res.status(409).json({ error: 'Another account already uses that email' });
      patch.email = email;
    }
  }

  if (req.body?.semester != null && req.body.semester !== '') {
    const semester = Number(req.body.semester);
    if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
      return res.status(400).json({ error: 'Semester must be between 1 and 8' });
    }
    patch.semester = semester;
  }

  if (req.body?.password) {
    const password = String(req.body.password);
    if (password.length < 6) return res.status(400).json({ error: 'A password needs at least 6 characters' });
    patch.password = hash(password);
  }

  if (!Object.keys(patch).length) return res.json({ user: publicUser(user) });
  return res.json({ user: publicUser(await db.users.update(user.id, patch)) });
});

router.delete('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  const user = await db.users.byId(req.params.id);
  if (!user) return res.status(404).json({ error: 'Account not found' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'You cannot remove your own account' });
  if (user.role === ROLES.FACULTY && await db.subjects.count({ facultyId: user.id })) {
    return res.status(409).json({ error: 'Reassign this faculty member’s subjects before removing the account' });
  }
  await db.users.remove(user.id);
  return res.json({ ok: true });
});

// Reassigning a subject to a different faculty member — the deck's
// "subject-faculty assignments tracked per semester".
router.post('/subjects/:subjectId/assign', requireRole(ROLES.ADMIN), async (req, res) => {
  const subject = await db.subjects.byId(req.params.subjectId);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });
  const faculty = await db.users.byId(req.body?.facultyId);
  if (!faculty || faculty.role !== ROLES.FACULTY) return res.status(400).json({ error: 'Choose a faculty account' });
  return res.json({ subject: await db.subjects.update(subject.id, { facultyId: faculty.id }) });
});

export default router;
