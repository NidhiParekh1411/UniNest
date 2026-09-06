// Content-generation agent: turns faculty material (PPTX, PDF, DOCX, notes) into
// a draft question bank for review. The deck is explicit that this is a *draft a
// professor reviews before publishing*, so nothing generated here is ever
// auto-published — routes mark it status:'draft'.
//
// Two paths, same output shape. Offline the agent mines the source for concepts
// and definitions and builds questions across Bloom levels from them; with a key
// it asks Gemini and validates the JSON that comes back.
import db from '../lib/db.js';
import { tokenize, isStopword } from './tokenize.js';
import { generate as llmGenerate } from './llm.js';

const BLOOM = { remember: 'Remember', understand: 'Understand', apply: 'Apply', analyse: 'Analyse' };

// ------------------------------------------------------- concept extraction

const DEFINITION_PATTERNS = [
  /^(?:the\s+)?(.{3,60}?)\s+(?:is|are)\s+(?:a|an|the)\s+(.{15,220})$/i,
  /^(?:the\s+)?(.{3,60}?)\s+(?:refers to|means|denotes)\s+(.{15,220})$/i,
  /^(?:the\s+)?(.{3,60}?)\s+(?:is|are)\s+defined as\s+(.{15,220})$/i,
  /^(?:the\s+)?(.{3,60}?)\s+consists of\s+(.{15,220})$/i,
];

function sentencesOf(text) {
  return text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map((s) => s.trim()).filter((s) => s.length > 30 && s.length < 400);
}

// Concept extraction.
//
// The naive version of this — "collect capitalised words" — produces garbage on
// real material, because every sentence starts with a capital. So a single
// capitalised word only counts as a concept if it also appears capitalised
// *mid-sentence* somewhere; multi-word capitalised runs are taken as-is, since
// "Query Router" is never an accident. Frequent lowercase bigrams are added for
// material that is written in prose rather than title case.
const GENERIC = new Set(`this that these those there their they them then thus here what which when where while
every each some many most other another such being where whereas however therefore also both either neither
student students faculty college institute semester subject section slide unit chapter figure table example
the and for with from into over under after before during about above below between within without`.split(/\s+/));

function keyPhrases(text, limit = 30) {
  const sentences = sentencesOf(text);

  // Words seen capitalised somewhere other than the first position — the test
  // that separates a real proper noun from an ordinary sentence opener.
  const midSentenceCaps = new Set();
  for (const sentence of sentences) {
    for (const raw of sentence.split(/\s+/).slice(1)) {
      const w = raw.replace(/[^A-Za-z]/g, '');
      if (/^[A-Z][a-z]{2,}$/.test(w) && !GENERIC.has(w.toLowerCase())) midSentenceCaps.add(w);
    }
  }

  const counts = new Map();
  const runs = text.match(/\b[A-Z][a-z]{2,}(?:[\s-]+(?:of|and|for|in|the|to)?[\s-]*[A-Z][a-z]{2,})*/g) ?? [];
  for (const raw of runs) {
    const phrase = raw.trim().replace(/\s+/g, ' ');
    const words = phrase.split(/[\s-]+/);
    if (words.length > 4) continue;
    if (words.every((w) => GENERIC.has(w.toLowerCase()))) continue;
    // Single words must have proved themselves mid-sentence; runs of two or
    // more capitalised words are self-evidently a term.
    if (words.length === 1 && !midSentenceCaps.has(words[0])) continue;
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  }

  // Frequent two-word lowercase terms, for prose that is not title-cased.
  const tokens = text.toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const bigrams = new Map();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (GENERIC.has(tokens[i]) || GENERIC.has(tokens[i + 1])) continue;
    if (isStopword(tokens[i]) || isStopword(tokens[i + 1])) continue;
    const bg = `${tokens[i]} ${tokens[i + 1]}`;
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1);
  }

  const scored = [
    ...[...counts.entries()].map(([p, n]) => ({ phrase: p, score: n * 2 + p.split(' ').length })),
    ...[...bigrams.entries()].filter(([, n]) => n >= 3).map(([p, n]) => ({ phrase: p, score: n })),
  ];
  scored.sort((a, b) => b.score - a.score);

  // De-duplicate near-identical phrases ("Query Router" vs "Query").
  const out = [];
  for (const { phrase } of scored) {
    const key = phrase.toLowerCase();
    if (out.some((p) => p.toLowerCase().includes(key) || key.includes(p.toLowerCase()))) continue;
    out.push(phrase);
    if (out.length >= limit) break;
  }
  return out;
}

function extractDefinitions(sentences) {
  const out = [];
  for (const s of sentences) {
    const clean = s.replace(/[.]$/, '');
    for (const pattern of DEFINITION_PATTERNS) {
      const m = clean.match(pattern);
      if (m) {
        const term = m[1].trim().replace(/^(a|an|the)\s+/i, '');
        if (term.length >= 3 && term.split(/\s+/).length <= 6) {
          out.push({ term, definition: m[2].trim(), source: s });
        }
        break;
      }
    }
  }
  return out;
}

// ------------------------------------------------------------ offline agent

const SHORT_TEMPLATES = [
  (p) => `Explain the role of ${p} and why it matters.`,
  (p) => `What is meant by ${p}? Support your answer with an example.`,
  (p) => `Describe ${p} and state its main characteristics.`,
  (p) => `Briefly explain ${p}.`,
];

const LONG_TEMPLATES = [
  (s) => `Discuss ${s} in detail, covering its key components and their practical relevance.`,
  (s) => `Write detailed notes on ${s}, with suitable examples.`,
  (s) => `Explain ${s}. Illustrate your answer with a diagram or an example where appropriate.`,
];

function offlineQuestions(source, { count, marksMix }) {
  const text = source.text;
  const sections = source.sections;
  const sentences = sentencesOf(text);
  const definitions = extractDefinitions(sentences);
  const phrases = keyPhrases(text);

  // Real section headings, longest-first, so a substantial topic outranks a
  // one-line heading.
  const headings = [...new Set(sections.map((s) => s.section).filter((h) => h && h.length > 6 && h.split(/\s+/).length <= 9))];

  const questions = [];
  const used = new Set();
  // Concepts are tracked separately from question text: "functional dependency",
  // "Functional Dependencies" and "Functional Dependency" are one concept, and a
  // paper that asks about it three times is a bad paper.
  const coveredConcepts = new Set();
  const conceptKey = (t) => (t ?? '').toLowerCase().replace(/[^a-z ]/g, '').replace(/(ies|s)$/, '').trim();

  const push = (q, concept) => {
    const key = q.question.toLowerCase().slice(0, 45);
    const ck = conceptKey(concept);
    if (used.has(key) || questions.length >= count) return;
    if (ck && coveredConcepts.has(ck)) return;
    used.add(key);
    if (ck) coveredConcepts.add(ck);
    questions.push({ id: `q${questions.length + 1}`, ...q });
  };
  const sectionOf = (needle) => sections.find((s) => needle && s.text.includes(needle))?.section ?? null;

  // 1. Multiple choice from definitions. Distractors are other real terms from
  //    the same material, which makes them plausible rather than absurd.
  for (const d of definitions) {
    if (questions.length >= Math.ceil(count * 0.25)) break;
    const pool = definitions.filter((x) => x.term !== d.term).map((x) => x.term);
    if (pool.length < 3) break;
    const options = [d.term, ...pool.slice(0, 3)].sort(() => Math.random() - 0.5);
    push({
      type: 'mcq',
      marks: 1,
      bloom: BLOOM.remember,
      question: `Which of the following is best described as “${d.definition.replace(/[.]$/, '')}”?`,
      options,
      answer: d.term,
      sourceSection: sectionOf(d.source),
    }, d.term);
  }

  // 2. Definitions the material states outright.
  for (const d of definitions) {
    if (questions.length >= Math.ceil(count * 0.45)) break;
    push({
      type: 'short',
      marks: marksMix.short,
      bloom: BLOOM.understand,
      question: `Define ${d.term} and explain its significance.`,
      answer: d.source,
      sourceSection: sectionOf(d.source),
    }, d.term);
  }

  // 3. One question per section heading — the structure the author chose is
  //    usually the structure a paper should follow.
  headings.forEach((heading, i) => {
    if (questions.length >= Math.ceil(count * 0.7)) return;
    const body = sections.find((s) => s.section === heading)?.text ?? null;
    push({
      type: 'short',
      marks: marksMix.short,
      bloom: BLOOM.understand,
      question: SHORT_TEMPLATES[i % SHORT_TEMPLATES.length](heading),
      answer: body ? body.slice(0, 400).trim() : null,
      sourceSection: heading,
    }, heading);
  });

  // 4. Key concepts drawn out of the body text.
  phrases.forEach((phrase, i) => {
    if (questions.length >= Math.ceil(count * 0.85)) return;
    const evidence = sentences.find((s) => s.toLowerCase().includes(phrase.toLowerCase()));
    if (!evidence) return;
    push({
      type: 'short',
      marks: marksMix.short,
      bloom: BLOOM.understand,
      question: SHORT_TEMPLATES[i % SHORT_TEMPLATES.length](phrase),
      answer: evidence,
      sourceSection: sectionOf(evidence),
    }, phrase);
  });

  // 5. Long answers on the substantial sections.
  const bigSections = sections.filter((s) => s.section && s.text.length > 280);
  bigSections.forEach((s, i) => {
    if (questions.length >= count) return;
    push({
      type: 'long',
      marks: marksMix.long,
      bloom: BLOOM.analyse,
      question: LONG_TEMPLATES[i % LONG_TEMPLATES.length](s.section),
      answer: s.text.slice(0, 500).trim(),
      sourceSection: s.section,
    });
  });

  // 6. Application questions, to reach the requested count.
  for (const phrase of phrases) {
    if (questions.length >= count) break;
    push({
      type: 'long',
      marks: marksMix.long,
      bloom: BLOOM.apply,
      question: `Given a practical scenario from this subject, describe how ${phrase} would be applied and justify your approach.`,
      answer: sentences.find((s) => s.toLowerCase().includes(phrase.toLowerCase())) ?? null,
      sourceSection: null,
    });
  }

  return questions;
}

// -------------------------------------------------------------- gemini path

const GEN_SYSTEM = `You are an experienced Indian engineering college professor preparing an examination question bank.

Return ONLY a JSON array. Each element:
{"type":"mcq"|"short"|"long","marks":number,"bloom":"Remember"|"Understand"|"Apply"|"Analyse","question":string,"options":string[] (mcq only, exactly 4),"answer":string,"sourceSection":string|null}

Rules:
- Base every question strictly on the supplied material. Do not introduce outside topics.
- MCQ distractors must be plausible and drawn from the same material.
- "answer" for short/long questions is a concise model answer (2-4 sentences).
- Cover a spread of Bloom levels and difficulty.
- Use Indian academic English. No markdown, no commentary, JSON only.`;

async function geminiQuestions(source, { count, marksMix }) {
  const material = source.text.slice(0, 18000);
  const prompt = `Subject: ${source.subjectName ?? 'Not specified'}
Material title: ${source.title}
Generate exactly ${count} questions. Use ${marksMix.short} marks for short answers and ${marksMix.long} marks for long answers; MCQs are 1 mark.

Material:
${material}`;

  const raw = await llmGenerate(GEN_SYSTEM, prompt, { temperature: 0.5, maxOutputTokens: 4096 });
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    if (!Array.isArray(parsed) || !parsed.length) return null;
    return parsed
      .filter((q) => q && typeof q.question === 'string' && q.question.length > 10)
      .map((q, i) => ({
        id: `q${i + 1}`,
        type: ['mcq', 'short', 'long'].includes(q.type) ? q.type : 'short',
        marks: Number(q.marks) || marksMix.short,
        bloom: q.bloom ?? BLOOM.understand,
        question: q.question.trim(),
        options: q.type === 'mcq' && Array.isArray(q.options) ? q.options.slice(0, 4) : undefined,
        answer: typeof q.answer === 'string' ? q.answer.trim() : null,
        sourceSection: q.sourceSection ?? null,
      }))
      .slice(0, count);
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ public

export async function buildQuestionBank({ documentId, subjectId, count = 12, difficulty = 'mixed', createdBy }) {
  const doc = await db.documents.byId(documentId);
  if (!doc) throw new Error('Source document not found');

  const chunks = await db.chunks.find({ docId: documentId });
  if (!chunks.length) {
    throw new Error('This document has no extractable text — an image-only file cannot be used as a source until OCR is available.');
  }

  const source = {
    title: doc.title,
    text: chunks.map((c) => c.text).join('\n\n'),
    sections: chunks.map((c) => ({ section: c.section, text: c.text })),
    subjectName: subjectId ? (await db.subjects.byId(subjectId))?.name : null,
  };

  const marksMix = difficulty === 'easy' ? { short: 2, long: 4 }
    : difficulty === 'hard' ? { short: 4, long: 10 }
      : { short: 3, long: 7 };

  let questions = await geminiQuestions(source, { count, marksMix });
  let engine = 'gemini';
  if (!questions || questions.length < Math.min(4, count)) {
    questions = offlineQuestions(source, { count, marksMix });
    engine = 'offline-extraction';
  }

  if (!questions.length) {
    throw new Error('Could not derive questions from this document — it may be too short or contain mostly tabular data.');
  }

  const totalMarks = questions.reduce((n, q) => n + (q.marks ?? 0), 0);
  return {
    title: `Question bank — ${doc.title}`,
    subjectId: subjectId ?? doc.subjectId ?? null,
    sourceDocumentId: documentId,
    sourceTitle: doc.title,
    createdBy,
    createdAt: new Date().toISOString(),
    status: 'draft',            // never auto-published; faculty reviews first
    engine,
    difficulty,
    totalMarks,
    questions,
  };
}
