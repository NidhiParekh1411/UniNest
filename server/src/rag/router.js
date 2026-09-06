// Intent router — the deck's "structured vs document" decision.
//
// The hard case named in the problem statement is telling "what's my attendance"
// (a record lookup) apart from "what's the attendance policy" (a document
// question). Both contain "attendance". The discriminator is possessive/personal
// framing versus policy framing, so those markers are scored explicitly rather
// than left to bag-of-words luck.
import db from '../lib/db.js';

const PERSONAL = /\b(my|mine|i|me|i'm|im|our|we)\b/i;
const POLICY = /\b(polic(y|ies)|rule|rules|regulation|criteria|requirement|norms|guideline|guidelines|procedure|process|eligibility|how (do|does|is|are|to)|what happens|calculated|calculation|computed|minimum|circular|notification)\b|\b(can|may|am i allowed to) (i|we|a student|students)?\s*(miss|skip|bunk|apply|repeat|carry|appear)/i;

const INTENTS = [
  {
    name: 'timetable',
    patterns: [/\btime\s?table\b/i, /\bschedule\b/i, /\bclass(es)? (today|tomorrow|on)\b/i, /\bwhich class\b/i, /\blab (session|schedule)\b/i, /\bperiod\b/i],
    slots: ['semester', 'branch', 'day'],
  },
  {
    name: 'attendance',
    patterns: [/\battendance\b/i, /\bpresent\b/i, /\babsent\b/i, /\bhow many (classes|lectures)\b/i, /\bshort of attendance\b/i],
    slots: ['semester', 'subject'],
  },
  {
    name: 'results',
    patterns: [/\bresult(s)?\b/i, /\bmarks\b/i, /\bscore(s)?\b/i, /\bgrade(s)?\b/i, /\bcgpa\b/i, /\bspi\b/i, /\bmid\s?sem\b/i, /\bhow did i (do|score)\b/i],
    slots: ['semester', 'examType', 'subject'],
  },
  {
    name: 'faculty',
    patterns: [/\bwho teaches\b/i, /\bwho is teaching\b/i, /\bfaculty (for|of)\b/i, /\bprofessor (for|of)\b/i, /\bwhich (teacher|faculty|professor)\b/i, /\bteaches\b/i],
    slots: ['subject', 'semester'],
  },
  {
    name: 'subjects',
    patterns: [/\b(what|which) subjects\b/i, /\bsubject list\b/i, /\bcourses? (in|for) sem\b/i, /\bsyllabus subjects\b/i, /\bhow many subjects\b/i],
    slots: ['semester', 'branch'],
  },
  {
    name: 'assignments',
    patterns: [/\bassignment(s)?\b/i, /\bsubmission(s)?\b/i, /\bdue\b/i, /\bdeadline\b/i, /\bpending work\b/i, /\bsubmit(ted)?\b/i],
    slots: ['subject'],
  },
  {
    name: 'announcements',
    patterns: [/\bannouncement(s)?\b/i, /\bnotice(s)?\b/i, /\bnews\b/i, /\bwhat'?s new\b/i, /\blatest update\b/i, /\bcircular(s)? (posted|shared)\b/i],
    slots: [],
  },
  {
    name: 'notes',
    patterns: [/\bnotes\b/i, /\bstudy material\b/i, /\bslides\b/i, /\bppt\b/i, /\breference (book|material)\b/i],
    slots: ['subject'],
  },
];

const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8 };

export async function extractSlots(text) {
  const slots = {};
  const t = text.toLowerCase();

  const semNum = t.match(/\b(?:sem(?:ester)?\.?\s*|s)(\d)\b/) || t.match(/\b(\d)(?:st|nd|rd|th)\s*sem(?:ester)?\b/);
  if (semNum) slots.semester = Number(semNum[1]);
  if (!slots.semester) {
    for (const [word, n] of Object.entries(ORDINALS)) {
      if (new RegExp(`\\b${word}\\s+sem`).test(t)) { slots.semester = n; break; }
    }
  }

  const branch = t.match(/\b(computer engineering|information technology|mechanical engineering|computer|comp|ce|it|me|mech)\b/);
  if (branch) {
    const map = { ce: 'CE', comp: 'CE', computer: 'CE', 'computer engineering': 'CE', it: 'IT', 'information technology': 'IT', me: 'ME', mech: 'ME', 'mechanical engineering': 'ME' };
    slots.branch = map[branch[1]] ?? null;
  }

  const day = t.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|today|tomorrow)\b/);
  if (day) slots.day = day[1];

  if (/\bmid\s?sem|\bmid[- ]?term|\binternal\b/.test(t)) slots.examType = 'midsem';
  else if (/\bfinal|\bend\s?sem|\bexternal\b/.test(t)) slots.examType = 'final';

  // Subject matching against the real catalogue: try codes first (unambiguous),
  // then the longest name whose significant words all appear in the question.
  const code = t.match(/\b(\d{7}|[a-z]{2}\d{3,4})\b/);
  const subjects = await db.subjects.all();
  if (code) {
    const hit = subjects.find((s) => s.code.toLowerCase() === code[1]);
    if (hit) slots.subject = hit.id;
  }
  if (!slots.subject) {
    let best = null;
    for (const s of subjects) {
      const words = s.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      if (!words.length) continue;
      const hits = words.filter((w) => t.includes(w)).length;
      if (hits === words.length && (!best || s.name.length > best.name.length)) best = s;
    }
    if (best) slots.subject = best.id;
    else {
      // Partial: at least two significant words, or one distinctive long word.
      let partial = null;
      for (const s of subjects) {
        const words = s.name.toLowerCase().split(/\s+/).filter((w) => w.length > 4);
        const hits = words.filter((w) => t.includes(w));
        if (hits.length >= 2 || (hits.length === 1 && hits[0].length > 7)) {
          if (!partial || hits.length > partial.hits) partial = { s, hits: hits.length };
        }
      }
      if (partial) slots.subject = partial.s.id;
    }
  }
  return slots;
}

export async function classify(text, scope) {
  const slots = await extractSlots(text);
  const personal = PERSONAL.test(text);
  const policy = POLICY.test(text);

  let best = null;
  for (const intent of INTENTS) {
    const matched = intent.patterns.filter((p) => p.test(text)).length;
    if (!matched) continue;
    let confidence = 0.45 + matched * 0.12;
    if (personal) confidence += 0.22;
    if (policy) confidence -= 0.40;   // policy framing pushes toward document search
    if (slots.semester || slots.subject) confidence += 0.10;
    if (!best || confidence > best.confidence) best = { name: intent.name, confidence, slots: intent.slots };
  }

  // 'faculty' and 'announcements' are lookups even when phrased impersonally —
  // "who teaches DBMS" is never a policy question.
  if (best && (best.name === 'faculty' || best.name === 'announcements') && policy && !personal) {
    best.confidence += 0.30;
  }

  if (!best || best.confidence < 0.55) {
    return { kind: 'document', intent: null, slots, confidence: best?.confidence ?? 0 };
  }

  // Missing-slot detection. A student's token carries branch and semester, so
  // those slots are already filled; a faculty or admin asking the same question
  // genuinely needs to be asked which cohort they mean.
  const filled = { ...slots };
  if (scope.role === 'student') {
    filled.semester ??= scope.semester;
    filled.branch ??= scope.branch;
  }
  const missing = best.slots.filter((s) => {
    if (s === 'semester') return filled.semester == null;
    if (s === 'branch') return filled.branch == null;
    return false;   // subject/day/examType are optional refinements, not blockers
  });

  if (missing.length) {
    return { kind: 'clarify', intent: best.name, slots: filled, missing, confidence: best.confidence };
  }
  return { kind: 'structured', intent: best.name, slots: filled, confidence: Number(best.confidence.toFixed(2)) };
}
