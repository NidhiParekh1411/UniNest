// The orchestrator. One entry point — ask() — implementing the deck's query
// algorithm end to end:
//   authenticate (done upstream) → parse question → detect missing detail →
//   ask a follow-up, or classify intent → structured lookup or scoped retrieval
//   → grounded synthesis → answer with citation.
import db from '../lib/db.js';
import { classify } from './router.js';
import { runStructured } from './structured.js';
import { retrieve, MIN_SCORE } from './retrieve.js';
import { compose, providerName, chooseTool } from './llm.js';
import { declarationsFor, runTool, parseToolCall } from './records.js';
import { detectAction, prepareAction } from './actions.js';

const BRANCH_LABELS = { CE: 'Computer Engineering', IT: 'Information Technology', ME: 'Mechanical Engineering' };

function clarifyResponse(intent, missing, scope) {
  const need = missing[0];
  if (need === 'semester') {
    return {
      answer: 'Which semester do you mean? I want to give you the right cohort rather than guess.',
      followUp: {
        field: 'semester',
        question: 'Select a semester',
        options: Array.from({ length: 8 }, (_, i) => ({ label: `Semester ${i + 1}`, value: i + 1 })),
      },
    };
  }
  if (need === 'branch') {
    return {
      answer: 'Which branch should I look at?',
      followUp: {
        field: 'branch',
        question: 'Select a branch',
        options: Object.entries(BRANCH_LABELS).map(([value, label]) => ({ label, value })),
      },
    };
  }
  return { answer: 'I need one more detail before I can answer that accurately.', followUp: null };
}

function abstainResponse(question, degradedReason = null) {
  // Rule 6: a silent downgrade is the worst outcome. If the record lookup was
  // skipped because the allowance ran out, say so — otherwise this reads as
  // "the college has no such record" when it means "I could not go and look".
  const suffix = degradedReason
    ? ' I could not run a records lookup for this one either, because AI assistance is currently unavailable — try rephrasing it the way the records screens label things, or check back later.'
    : '';
  return {
    kind: 'abstain',
    answer: `I could not find this in the official documents available to you, so I would rather not guess. Try naming the specific circular or policy area, or ask your department office — and if the document exists but has not been uploaded yet, an administrator can add it to the knowledge base.${suffix}`,
    data: null,
    citations: [],
    followUp: null,
  };
}

export async function ask({ question, scope, history = [], overrides = {} }) {
  const started = Date.now();
  const text = (question ?? '').trim();
  if (!text) throw new Error('Question is required');

  // Actions come first: an imperative is unambiguous in a way a question is not,
  // and "create an assignment" should never be answered with the assignment
  // policy. Detection is a verb plus its object, so it costs nothing and cannot
  // fire on "what assignments are pending".
  const actionName = detectAction(text, scope);
  if (actionName) {
    const prepared = await prepareAction(actionName, text, scope);
    if (prepared) {
      return {
        kind: prepared.action ? 'action' : 'structured',
        answer: prepared.answer,
        data: null,
        action: prepared.action ?? null,
        citations: [],
        followUp: null,
        meta: { intent: actionName, action: actionName, provider: 'records', via: 'patterns', ms: Date.now() - started },
      };
    }
  }

  const route = await classify(text, scope);
  const slots = { ...route.slots, ...overrides };

  // Naming a cohort outranks the self-scoped reading: a faculty member who
  // picked a branch or semester wants that cohort, not their own teaching week.
  if (overrides.semester != null || overrides.branch != null) delete slots.self;

  // A follow-up answer ("Semester 5") arrives with overrides that fill the gap,
  // so the same question re-routes cleanly instead of asking twice.
  const stillMissing = (route.missing ?? []).filter((m) => slots[m] == null);

  if (route.kind === 'clarify' && stillMissing.length) {
    const c = clarifyResponse(route.intent, stillMissing, scope);
    return {
      kind: 'clarify',
      answer: c.answer,
      data: null,
      citations: [],
      followUp: c.followUp,
      pendingIntent: route.intent,
      meta: { intent: route.intent, confidence: route.confidence, provider: providerName(), ms: Date.now() - started },
    };
  }

  if (route.kind === 'structured' || (route.kind === 'clarify' && !stillMissing.length)) {
    const result = await runStructured(route.intent, slots, scope);
    if (result) {
      return {
        kind: 'structured',
        answer: result.answer,
        data: result.data ?? null,
        citations: result.citations ?? [],
        followUp: null,
        meta: { intent: route.intent, confidence: route.confidence, provider: 'records', ms: Date.now() - started },
      };
    }
  }

  // Record path. classify() reports 'records' for questions its patterns cannot
  // express — Node first, the model only on that miss. The model chooses the
  // query; this process runs it, scoped to the token. See records.js.
  let toolDegraded = null;
  if (route.kind === 'records') {
    // A student asking a population question is refused here, before any call is
    // spent. Answering it with their own row instead would be safe but dishonest
    // — it looks like a reply to what they asked.
    if (route.cohort && scope.role === 'student') {
      return {
        kind: 'structured',
        answer: 'That covers other students, and your account can only see your own records. Ask about your own attendance or marks and I will pull them up.',
        data: null,
        citations: [],
        followUp: null,
        meta: { intent: null, refused: true, provider: 'records', ms: Date.now() - started },
      };
    }

    // Node reads the question first. Only a shape it cannot parse costs one of
    // the day's small allowance of model calls.
    let call = parseToolCall(text, scope);
    let via = 'patterns';
    if (!call) {
      const chosen = await chooseTool(text, declarationsFor(scope), history);
      if (chosen.degraded) toolDegraded = chosen.reason ?? 'AI assist unavailable';
      call = chosen.call;
      via = 'gemini';
    }

    if (call) {
      const result = await runTool(call.name, call.args, scope);
      if (result) {
        return {
          kind: 'structured',
          answer: result.answer,
          data: result.data ?? null,
          citations: result.citations ?? [],
          followUp: null,
          meta: {
            intent: call.name,
            tool: call.name,
            args: call.args,
            refused: result.refused ?? false,
            provider: 'records',
            via,
            ms: Date.now() - started,
          },
        };
      }
    }
  }

  // Document path.
  const { hits, top, coverage, confident } = await retrieve(text, scope, { k: 5 });
  if (!confident || !hits.length) {
    return { ...abstainResponse(text, toolDegraded), meta: { intent: null, topScore: Number(top.toFixed(2)), coverage: Number((coverage ?? 0).toFixed(2)), threshold: MIN_SCORE, provider: providerName(), degraded: Boolean(toolDegraded), degradedReason: toolDegraded, ms: Date.now() - started } };
  }

  const composed = await compose(text, hits, history);
  if (!composed.text) {
    return { ...abstainResponse(text), meta: { intent: null, topScore: Number(top.toFixed(2)), threshold: MIN_SCORE, provider: composed.provider, ms: Date.now() - started } };
  }

  // Citations are structural, never embedded in the prose (CLAUDE.md rule 5).
  const citations = [];
  const seen = new Set();
  for (const h of hits) {
    const key = `${h.citation.docId}:${h.citation.section ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({ ...h.citation, score: h.score, excerpt: h.text.slice(0, 220).trim() });
    if (citations.length >= 3) break;
  }

  return {
    kind: 'document',
    answer: composed.text,
    data: null,
    citations,
    followUp: null,
    meta: {
      intent: null,
      topScore: Number(top.toFixed(2)),
      coverage: Number(coverage.toFixed(2)),
      provider: composed.provider,
      degraded: composed.degraded ?? false,
      ms: Date.now() - started,
    },
  };
}

// ------------------------------------------------------------ conversation

export async function loadConversation(userId, conversationId) {
  if (conversationId) {
    const c = await db.conversations.byId(conversationId);
    if (c && c.userId === userId) return c;
  }
  return await db.conversations.insert({
    userId,
    title: 'New conversation',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function appendTurn(conversation, userMessage, assistantMessage) {
  const messages = [...conversation.messages, userMessage, assistantMessage];
  const title = conversation.messages.length === 0
    ? userMessage.text.slice(0, 60)
    : conversation.title;
  return await db.conversations.update(conversation.id, {
    messages,
    title,
    updatedAt: new Date().toISOString(),
  });
}
