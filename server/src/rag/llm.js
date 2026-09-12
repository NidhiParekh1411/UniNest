// LLM adapter. Two providers, one contract.
//
//  - `extractive` (default): no network, no key. Composes an answer by selecting
//    and stitching the highest-signal sentences from retrieved passages. Never
//    invents a claim, because it can only quote.
//  - `gemini`: set GEMINI_API_KEY to enable. Same input, same output shape,
//    fluent prose instead of stitched sentences.
//
// Every provider path MUST return { text, provider, grounded }. A change that
// only works with a key is not done — the demo runs offline.
import { tokenize } from './tokenize.js';

export function providerName() {
  return process.env.GEMINI_API_KEY ? 'gemini' : 'extractive';
}

export function modelName() {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL;
}

export function providerStatus() {
  const name = providerName();
  const status = {
    provider: name,
    model: name === 'gemini' ? modelName() : null,
    label: name === 'gemini' ? 'Gemini' : 'Offline extractive',
    description: name === 'gemini'
      ? 'Answers are synthesised by Gemini from retrieved passages, with citations enforced.'
      : 'Answers are composed by quoting the most relevant passages verbatim. No external service is used.',
  };
  // A silent downgrade is the worst possible failure here: answers keep coming,
  // they are just worse, and nobody knows why. Surfacing the last quota refusal
  // is what turns "the AI stopped working" into "the daily allowance ran out".
  if (quotaBlock && quotaBlock.until > Date.now()) {
    status.degraded = true;
    status.degradedReason = quotaBlock.message;
    status.retryAt = new Date(quotaBlock.until).toISOString();
  }
  return status;
}

/* ---------------------------------------------------------------- transport

   Every Gemini call in the product goes through `callGemini`, so quota
   handling, retry and error reporting exist once.

   The free tier's per-day request allowance is small and varies sharply by
   model — gemini-3.6-flash allows twenty a day, which a single afternoon of
   testing exhausts. When that happens the API answers 429 with a RetryInfo
   telling us how long to wait. Short waits are worth sitting out; a wait
   measured in hours means the allowance is gone for the day, and the honest
   response is to degrade to the offline path and *say so* rather than retry
   into a wall on every subsequent request. */

const DEFAULT_MODEL = 'gemini-3.5-flash';
const RETRY_CEILING_MS = 8000;

let quotaBlock = null;

function retryDelayMs(error) {
  const info = (error?.details ?? []).find((d) => String(d['@type']).endsWith('RetryInfo'));
  const seconds = Number(String(info?.retryDelay ?? '').replace(/s$/, ''));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function callGemini(body, { model = modelName(), attempt = 0 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('No GEMINI_API_KEY');
  if (quotaBlock && quotaBlock.until > Date.now()) throw new Error(quotaBlock.message);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );

  if (res.ok) {
    quotaBlock = null;
    return res.json();
  }

  let payload = null;
  try { payload = await res.json(); } catch { /* an error page rather than JSON */ }
  const error = payload?.error;

  if (res.status === 429) {
    const wait = retryDelayMs(error);
    if (wait && wait <= RETRY_CEILING_MS && attempt === 0) {
      await sleep(wait + 250);
      return callGemini(body, { model, attempt: 1 });
    }
    const limit = /limit: (\d+)/.exec(error?.message ?? '')?.[1];
    quotaBlock = {
      until: Date.now() + (wait ?? 60_000),
      message: limit
        ? `Gemini's free-tier allowance for ${model} is exhausted (${limit} requests/day). Answers fall back to offline composition until it resets.`
        : `Gemini is rate limiting requests for ${model}. Answers fall back to offline composition until it clears.`,
    };
    throw new Error(quotaBlock.message);
  }

  throw new Error(error?.message ? `Gemini: ${error.message}` : `Gemini responded ${res.status}`);
}

// ---------------------------------------------------------------- extractive

function splitSentences(text) {
  return text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map((s) => s.trim()).filter((s) => s.length > 25);
}

// What a student is actually asking for in a policy question is the obligation
// and the threshold — "must maintain a minimum of 75%" — not the surrounding
// procedural detail. Sentences carrying a modal obligation or a concrete number
// are weighted up accordingly, which is what puts the operative rule first
// instead of whichever sentence happened to rank highest on term frequency.
const OBLIGATION = /\b(must|shall|is required|are required|will not|not permitted|prohibited|minimum|maximum|at least|no more than|eligible|not eligible)\b/i;

function scoreSentence(sentence, queryTerms, position) {
  const terms = new Set(tokenize(sentence));
  let overlap = 0;
  for (const t of queryTerms) if (terms.has(t)) overlap += 1;
  if (!overlap) return 0;
  const coverage = overlap / Math.max(1, new Set(queryTerms).size);
  // Length preference: mid-length sentences carry the most usable information.
  const len = sentence.length;
  const lengthFit = len < 60 ? 0.6 : len > 320 ? 0.7 : 1;
  // Earlier sentences in a passage are usually the topic statement.
  const positionBonus = position === 0 ? 1.12 : 1;
  const substance = 1 + (OBLIGATION.test(sentence) ? 0.12 : 0) + (/\d/.test(sentence) ? 0.12 : 0);
  return coverage * lengthFit * positionBonus * substance;
}

function extractive(question, hits) {
  const queryTerms = tokenize(question);
  const candidates = [];

  hits.forEach((hit, hitIndex) => {
    splitSentences(hit.text).forEach((sentence, i) => {
      const s = scoreSentence(sentence, queryTerms, i);
      if (s > 0.12) {
        candidates.push({ sentence, score: s * (1 - hitIndex * 0.08), citation: hit.citation });
      }
    });
  });

  candidates.sort((a, b) => b.score - a.score);

  const picked = [];
  const seen = new Set();
  for (const c of candidates) {
    const key = c.sentence.slice(0, 60).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(c);
    if (picked.length >= 3) break;
  }

  if (!picked.length) {
    // Retrieval was confident but no single sentence overlapped well — fall back
    // to the leading passage rather than claiming nothing was found.
    const lead = hits[0];
    return { text: lead.text.slice(0, 480).trim() + (lead.text.length > 480 ? '…' : ''), provider: 'extractive', grounded: true };
  }

  const bodies = picked.map((p) => p.sentence.replace(/\s+/g, ' ').trim());
  return { text: bodies.join(' '), provider: 'extractive', grounded: true };
}

// -------------------------------------------------------------------- gemini

const SYSTEM = `You are the knowledge assistant for an Indian engineering college.

Absolute rules:
- Answer ONLY from the numbered passages supplied. They are the college's official documents.
- If the passages do not contain the answer, reply with exactly: NOT_FOUND
- Never state a policy number, date, percentage or deadline that is not in the passages.
- Do not write citations, source names or passage numbers into your answer; the interface renders those separately.
- Be direct and specific. Two to four sentences. No preamble, no "based on the passages".
- Indian academic English. Write percentages as "75%".`;

// Current flash models reason before answering, so a response can carry thought
// parts beside the answer. Only the non-thought text is the answer; joining
// every part blindly would splice the model's reasoning into what the student
// reads, and parts without text would join as "undefined".
function partsText(json) {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim();
}

async function gemini(question, hits, history = []) {
  const passages = hits.map((h, i) => `[${i + 1}] ${h.citation.title}${h.citation.section ? ` — ${h.citation.section}` : ''}\n${h.text}`).join('\n\n');
  const priorTurns = history.slice(-4).map((m) => `${m.role === 'user' ? 'Student' : 'Assistant'}: ${m.text}`).join('\n');

  const prompt = [
    priorTurns ? `Conversation so far:\n${priorTurns}\n` : '',
    `Passages:\n${passages}`,
    `\nQuestion: ${question}`,
  ].filter(Boolean).join('\n');

  const json = await callGemini({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
  });
  const text = partsText(json);

  // Two very different outcomes both arrive as "no answer text", and conflating
  // them would break the product's central promise. An explicit NOT_FOUND is
  // the model reporting that the passages do not answer the question — a real
  // signal to abstain on. Empty output is the model failing to produce anything
  // (reasoning can exhaust the token budget before writing a word), which says
  // nothing about the corpus and must not be reported as "not in the documents".
  if (/^NOT_FOUND/i.test(text)) return { text: null, provider: 'gemini', grounded: false, refused: true };
  if (!text) return { text: null, provider: 'gemini', grounded: false, refused: false };
  return { text, provider: 'gemini', grounded: true, refused: false };
}

// ------------------------------------------------------------------ dispatch

export async function compose(question, hits, history = []) {
  if (!hits.length) return { text: null, provider: providerName(), grounded: false };
  if (process.env.GEMINI_API_KEY) {
    try {
      const answer = await gemini(question, hits, history);
      // Retrieval already cleared its confidence gate, so the passages do answer
      // the question. If Gemini produced nothing without explicitly refusing,
      // compose the answer by quotation instead — degrading the prose is the
      // right trade; abstaining here would tell the student the college has no
      // such policy when it plainly does.
      if (!answer.text && !answer.refused) {
        console.warn('[llm] Gemini returned no text, using extractive composition');
        return { ...extractive(question, hits), degraded: true };
      }
      return answer;
    } catch (err) {
      // A network failure must degrade, never break the demo.
      console.warn('[llm] Gemini unavailable, using extractive composition:', err.message);
      return { ...extractive(question, hits), degraded: true };
    }
  }
  return extractive(question, hits);
}

// ---------------------------------------------------------------- tool choice

const TOOL_SYSTEM = `You translate a question about a college's records into one function call.

Call a function only when the question asks for record data — attendance figures,
marks, rankings, or a list of students matching a condition. Answer with plain
text instead when the question is about a policy, a rule, a procedure, or
anything that would be written in a document rather than stored in a table.

Only the functions offered to you exist. If none of them fits, do not call one.`;

function partsFunctionCall(json) {
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const call = parts.find((p) => p.functionCall)?.functionCall;
  return call ? { name: call.name, args: call.args ?? {} } : null;
}

// Picks which record query answers a question, and with what arguments. It does
// NOT run anything: the caller executes the chosen tool against the database,
// which is what keeps rule 4 enforceable — the model influences the query, never
// the identity it runs as.
//
// Returns { call: null } for every failure mode, because none of them should
// break the answer path: no key, exhausted quota, a network fault, or the model
// deciding this is a document question after all. `degraded` distinguishes "the
// model declined" from "the model never got asked".
export async function chooseTool(question, declarations, history = []) {
  if (!declarations.length) return { call: null, degraded: false };
  if (!process.env.GEMINI_API_KEY) {
    return { call: null, degraded: true, reason: 'No GEMINI_API_KEY — record questions use pattern matching only.' };
  }

  const priorTurns = history.slice(-4).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');
  const prompt = [priorTurns ? `Conversation so far:\n${priorTurns}\n` : '', `Question: ${question}`].filter(Boolean).join('\n');

  try {
    const json = await callGemini({
      systemInstruction: { parts: [{ text: TOOL_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ functionDeclarations: declarations }],
      // AUTO, not ANY: the model must be free to decline, or every policy
      // question that slipped through the pre-filter becomes a bogus lookup.
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { temperature: 0 },
    });
    return { call: partsFunctionCall(json), degraded: false };
  } catch (err) {
    console.warn('[llm] tool selection unavailable:', err.message);
    return { call: null, degraded: true, reason: err.message };
  }
}

// Reads a *file* with the model — the OCR and transcription path.
//
// This is how a scanned PDF or a photograph of a notice becomes text. The local
// extractors in lib/parse.js handle every format that carries text natively;
// what they cannot do is read pixels, so a scanned circular or a picture of a
// handwritten page previously ingested as an empty document. It was still
// listed in the library, but it had no passages, so it could never be quoted,
// searched or used as a question-bank source — which is exactly what "the
// generator shows none of my uploads" looked like from the outside.
//
// Returns null when no key is set or the call fails, so every caller must have
// a path that survives without it.
const INLINE_LIMIT = 12 * 1024 * 1024; // base64 inflates by a third; stay well inside the request cap

export const READABLE_MIME = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
};

export async function readFile(bytes, mimeType, instruction, { maxOutputTokens = 16384 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!bytes?.length || bytes.length > INLINE_LIMIT) return null;
  try {
    const json = await callGemini({
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: bytes.toString('base64') } },
          { text: instruction },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens },
    });
    return partsText(json) || null;
  } catch (err) {
    console.warn('[llm] file read unavailable:', err.message);
    return null;
  }
}

// Free-form generation for the content agent. Returns null when no provider can
// generate — callers fall back to their own template path.
export async function generate(systemPrompt, userPrompt, { temperature = 0.4, maxOutputTokens = 2048 } = {}) {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const json = await callGemini({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature, maxOutputTokens, responseMimeType: 'application/json' },
    });
    return partsText(json) || null;
  } catch (err) {
    console.warn('[llm] generation unavailable:', err.message);
    return null;
  }
}
