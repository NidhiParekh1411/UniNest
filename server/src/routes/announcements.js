import { Router } from 'express';
import db, { lookup } from '../lib/db.js';
import { authenticate, requireRole, ROLES } from '../lib/auth.js';

const router = Router();
router.use(authenticate);

// Scheduling is enforced at read time rather than by a background job: an item
// with a future publishAt is simply not visible to its audience yet. That keeps
// the MVP stateless and means a missed tick can never lose an announcement.
// releaseDue() additionally flips the stored status so the admin list reflects
// reality without anyone having to open the app at the right moment.
export async function releaseDue() {
  const now = Date.now();
  const due = (await db.announcements.all())
    .filter((a) => a.status === 'scheduled' && new Date(a.publishAt).getTime() <= now);
  if (!due.length) return 0;
  return db.announcements.updateWhere(
    { id: due.map((a) => a.id) },
    { status: 'published', releasedAt: new Date().toISOString() },
  );
}

function visible(a, user) {
  if (a.status !== 'published') return false;
  if (a.audience === 'faculty' && user.role === ROLES.STUDENT) return false;
  if (a.audience === 'admin' && user.role !== ROLES.ADMIN) return false;
  if (user.role !== ROLES.STUDENT) return true;
  if (a.branch && a.branch !== 'ALL' && a.branch !== user.branch) return false;
  if (a.semester && a.semester !== 0 && a.semester !== user.semester) return false;
  return true;
}

router.get('/', async (req, res) => {
  await releaseDue();
  const rows = await db.announcements.all();
  const authors = await lookup('users', rows.map((a) => a.createdBy));
  const author = (a) => ({ ...a, author: authors.get(a.createdBy)?.name ?? 'Administration' });

  if (req.user.role === ROLES.STUDENT) {
    return res.json({
      announcements: rows.filter((a) => visible(a, req.user))
        .sort((a, b) => new Date(b.publishAt) - new Date(a.publishAt))
        .map(author),
      scheduled: [],
    });
  }

  // Staff see their own scheduled items alongside what is live, so the queue is
  // reviewable before it goes out.
  const mine = (a) => req.user.role === ROLES.ADMIN || a.createdBy === req.user.id;
  return res.json({
    announcements: rows.filter((a) => a.status === 'published').sort((a, b) => new Date(b.publishAt) - new Date(a.publishAt)).map(author),
    scheduled: rows.filter((a) => a.status === 'scheduled' && mine(a)).sort((a, b) => new Date(a.publishAt) - new Date(b.publishAt)).map(author),
  });
});

router.post('/', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
  const { title, body, audience = 'all', branch = 'ALL', publishAt } = req.body ?? {};
  const semester = req.body?.semester ? Number(req.body.semester) : 0;
  if (!title?.trim()) return res.status(400).json({ error: 'Give the announcement a title' });
  if (!body?.trim()) return res.status(400).json({ error: 'Write the announcement body' });

  const when = publishAt ? new Date(publishAt) : new Date();
  if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'That publish time is not a valid date' });
  const scheduled = when.getTime() > Date.now() + 30_000;

  const row = await db.announcements.insert({
    title: title.trim(),
    body: body.trim(),
    audience,
    branch,
    semester,
    status: scheduled ? 'scheduled' : 'published',
    publishAt: when.toISOString(),
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
    attachments: Array.isArray(req.body?.attachments) ? req.body.attachments : [],
  });
  return res.status(201).json({
    announcement: row,
    message: scheduled
      ? `Scheduled. It becomes visible to its audience on ${when.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`
      : 'Published. It is visible to its audience now.',
  });
});

router.post('/:id/publish-now', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
  const a = await db.announcements.byId(req.params.id);
  if (!a) return res.status(404).json({ error: 'Announcement not found' });
  if (req.user.role === ROLES.FACULTY && a.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'You can only publish your own announcements' });
  }
  const now = new Date().toISOString();
  return res.json({ announcement: await db.announcements.update(a.id, { status: 'published', publishAt: now, releasedAt: now }) });
});

router.delete('/:id', requireRole(ROLES.FACULTY, ROLES.ADMIN), async (req, res) => {
  const a = await db.announcements.byId(req.params.id);
  if (!a) return res.status(404).json({ error: 'Announcement not found' });
  if (req.user.role === ROLES.FACULTY && a.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'You can only remove your own announcements' });
  }
  await db.announcements.remove(a.id);
  return res.json({ ok: true });
});

export default router;
