import { Router } from 'express';
import db from '../lib/db.js';
import { authenticate, scopeOf } from '../lib/auth.js';
import { ask, loadConversation, appendTurn } from '../rag/answer.js';
import { suggest } from '../rag/suggest.js';
import { providerStatus } from '../rag/llm.js';
import { stats, refresh } from '../rag/index.js';

const router = Router();
router.use(authenticate);

router.post('/ask', async (req, res, next) => {
  try {
    const { question, conversationId, overrides } = req.body ?? {};
    if (!question || !String(question).trim()) {
      return res.status(400).json({ error: 'Ask me something and I will look it up.' });
    }
    const scope = await scopeOf(req);
    const conversation = await loadConversation(req.user.id, conversationId);

    // Only the last few turns are passed for context — enough for follow-ups
    // ("and for semester 6?") without letting an old topic bleed into a new one.
    const history = conversation.messages.slice(-6).map((m) => ({ role: m.role, text: m.text }));

    const result = await ask({ question: String(question).trim(), scope, history, overrides: overrides ?? {} });

    const now = new Date().toISOString();
    const updated = await appendTurn(
      conversation,
      { role: 'user', text: String(question).trim(), at: now },
      { role: 'assistant', text: result.answer, kind: result.kind, data: result.data, citations: result.citations, followUp: result.followUp, meta: result.meta, at: now },
    );

    return res.json({ ...result, conversationId: updated.id });
  } catch (err) { return next(err); }
});

router.get('/suggest', async (req, res) => {
  res.json({ groups: suggest(req.query.q ?? '', await scopeOf(req)) });
});

router.get('/conversations', async (req, res) => {
  const rows = (await db.conversations.find({ userId: req.user.id }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 30)
    .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, turns: Math.ceil(c.messages.length / 2) }));
  res.json({ conversations: rows });
});

router.get('/conversations/:id', async (req, res) => {
  const c = await db.conversations.byId(req.params.id);
  if (!c || c.userId !== req.user.id) return res.status(404).json({ error: 'Conversation not found' });
  return res.json({ conversation: c });
});

router.delete('/conversations/:id', async (req, res) => {
  const c = await db.conversations.byId(req.params.id);
  if (!c || c.userId !== req.user.id) return res.status(404).json({ error: 'Conversation not found' });
  await db.conversations.remove(c.id);
  return res.json({ ok: true });
});

router.get('/status', async (_req, res) => {
  await refresh();
  res.json({ ...providerStatus(), index: stats() });
});

export default router;
