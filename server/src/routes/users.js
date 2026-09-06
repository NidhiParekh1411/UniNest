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

router.patch('/:id', requireRole(ROLES.ADMIN), async (req, res) => {
  const user = await db.users.byId(req.params.id);
  if (!user) return res.status(404).json({ error: 'Account not found' });
  const patch = {};
  for (const key of ['name', 'department', 'branch', 'division', 'designation']) {
    if (typeof req.body?.[key] === 'string') patch[key] = req.body[key].trim();
  }
  if (req.body?.semester != null) patch.semester = Number(req.body.semester);
  if (req.body?.password) patch.password = hash(String(req.body.password));
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
