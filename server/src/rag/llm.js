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

export function providerStatus() {
  const name = providerName();
  return {
    provider: name,
    label: name === 'gemini' ? 'Gemini' : 'Offline extractive',
    description: name === 'gemini'
      ? 'Answers are synthesised by Gemini from retrieved passages, with citations enforced.'
      : 'Answers are composed by quoting the most relevant passages verbatim. No external service is used.',
  };
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
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const passages = hits.map((h, i) => `[${i + 1}] ${h.citation.title}${h.citation.section ? ` — ${h.citation.section}` : ''}\n${h.text}`).join('\n\n');
  const priorTurns = history.slice(-4).map((m) => `${m.role === 'user' ? 'Student' : 'Assistant'}: ${m.text}`).join('\n');

  const prompt = [
    priorTurns ? `Conversation so far:\n${priorTurns}\n` : '',
    `Passages:\n${passages}`,
    `\nQuestion: ${question}`,
  ].filter(Boolean).join('\n');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      }),
    },
  );

  if (!res.ok) throw new Error(`Gemini responded ${res.status}`);
  const json = await res.json();
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

// Free-form generation for the content agent. Returns null when no provider can
// generate — callers fall back to their own template path.
export async function generate(systemPrompt, userPrompt, { temperature = 0.4, maxOutputTokens = 2048 } = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature, maxOutputTokens, responseMimeType: 'application/json' },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini responded ${res.status}`);
    const json = await res.json();
    return partsText(json) || null;
  } catch (err) {
    console.warn('[llm] generation unavailable:', err.message);
    return null;
  }
}
