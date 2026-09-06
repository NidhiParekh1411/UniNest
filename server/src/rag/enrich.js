// Document enrichment — the second, optional pass over an upload.
//
// Ingestion in routes/documents.js stays exactly as it was: parse locally,
// chunk, index, respond. That path is synchronous, needs no key, and is what
// the offline demo runs on. This module is what happens *afterwards*, in the
// background, when a language model is configured:
//
//   1. Transcription. A scanned PDF or a photographed notice yields no text to
//      pdf-parse, so it used to land in the library as a document with zero
//      passages — invisible to search, unquotable by the assistant, and absent
//      from the question-bank generator's source list. Gemini reads the file
//      itself and the result is chunked and indexed like any other text.
//
//   2. Analysis. A short summary, the topics it covers, the dates it commits
//      to, and a handful of tags. This is what fills the right-hand panel of
//      the document viewer, beside the document itself.
//
// Both steps are best-effort. Every failure leaves the document exactly as the
// local pass left it and records why on `analysis.status`, because a document
// that is merely un-analysed must still be readable, downloadable and listed.
import fs from 'node:fs/promises';
import path from 'node:path';
import db, { UPLOAD_DIR } from '../lib/db.js';
import { chunkText } from './chunk.js';
import { generate, modelName, providerName, readFile, READABLE_MIME } from './llm.js';

// Below this, a "successful" local parse is really an empty one: a scanned page
// still yields stray ligatures and page numbers, which is not text a student
// could ever get an answer out of.
const MIN_USEFUL_TEXT = 220;

const TRANSCRIBE = `Transcribe this document to plain text, completely and verbatim.

Rules:
- Output only the document's own text. No preamble, no commentary, no markdown fences.
- Preserve the reading order, headings and list structure. Put each heading on its own line.
- Keep tables readable as lines of "column: value" pairs.
- Transcribe handwriting as accurately as you can. Mark a genuinely illegible word as [?].
- If the file contains no readable text at all, output exactly: NO_TEXT`;

const ANALYSE_SYSTEM = `You summarise documents for an Indian engineering college's knowledge base.

Return ONLY a JSON object with these keys:
  "summary"  — 2 to 3 sentences, plain and specific, describing what this document actually says. No preamble.
  "topics"   — 3 to 6 short topic phrases (2-4 words each).
  "tags"     — 3 to 8 single lowercase keywords for filtering.
  "dates"    — every date or deadline the document commits to, as objects {"label": "...", "value": "..."}. Empty array if none.
  "docType"  — one of: circular, policy, syllabus, notes, timetable, question paper, form, report, other.
  "audience" — one of: students, faculty, administration, everyone.

Rules:
- Use ONLY what is in the document. Never infer a date, a percentage or a rule that is not written there.
- Copy dates in the document's own wording. Do not convert or normalise them.
- Indian academic English.`;

// One enrichment per document at a time. Two uploads racing on the same id
// would both transcribe and both write chunks, doubling the index.
const running = new Set();

function mimeFor(fileName) {
  return READABLE_MIME[path.extname(fileName || '').slice(1).toLowerCase()] ?? null;
}

/** The text the assistant already holds for a document, rebuilt from its
 *  passages — so re-analysing costs nothing extra for a document that parsed
 *  fine locally. */
async function indexedText(docId) {
  const chunks = await db.chunks.find({ docId });
  return chunks
    .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
    .map((c) => c.text)
    .join('\n\n');
}

async function transcribe(doc) {
  const mime = mimeFor(doc.fileName);
  if (!doc.storedName || !mime) return null;
  const filePath = path.join(UPLOAD_DIR, doc.storedName);
  let bytes;
  try {
    bytes = await fs.readFile(filePath);
  } catch {
    return null; // the record outlived its file; nothing to transcribe
  }
  const text = await readFile(bytes, mime, TRANSCRIBE);
  if (!text || /^NO_TEXT/i.test(text.trim())) return null;
  return text.trim();
}

/** Replace a document's passages with a freshly transcribed set. */
async function reindex(doc, text) {
  const chunks = chunkText(text, { pages: doc.pages }).map((c) => ({
    docId: doc.id,
    title: doc.title,
    section: c.section,
    page: c.page,
    ordinal: c.ordinal,
    text: c.text,
    category: doc.category,
    audience: doc.audience,
    branch: doc.branch,
    semester: doc.semester,
    uploadedAt: doc.uploadedAt,
    uploadedBy: doc.uploadedBy,
    status: 'published',
    superseded: Boolean(doc.superseded),
  }));
  if (!chunks.length) return 0;
  await db.chunks.removeWhere({ docId: doc.id });
  await db.chunks.insertMany(chunks);
  return chunks.length;
}

function coerceAnalysis(raw) {
  let parsed;
  try {
    // responseMimeType is application/json, but a model can still wrap it.
    parsed = JSON.parse(String(raw).replace(/^```(?:json)?|```$/g, '').trim());
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const list = (v, n) => (Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, n) : []);
  const summary = str(parsed.summary);
  if (!summary) return null;
  return {
    summary,
    topics: list(parsed.topics, 6),
    tags: list(parsed.tags, 8).map((t) => t.toLowerCase()),
    dates: (Array.isArray(parsed.dates) ? parsed.dates : [])
      .filter((d) => d && typeof d === 'object')
      .map((d) => ({ label: str(d.label), value: str(d.value) }))
      .filter((d) => d.label && d.value)
      .slice(0, 10),
    docType: str(parsed.docType) || null,
    audience: str(parsed.audience) || null,
  };
}

async function analyse(doc, text) {
  const body = text.slice(0, 60000);
  const raw = await generate(
    ANALYSE_SYSTEM,
    `Document title: ${doc.title}\nFile: ${doc.fileName}\n\n---\n${body}`,
    { temperature: 0.2, maxOutputTokens: 4096 },
  );
  return raw ? coerceAnalysis(raw) : null;
}

/**
 * Bring a document up to date: transcribe it if the local parse found nothing,
 * then describe it. Safe to call on anything — it returns a status rather than
 * throwing, and never leaves the document worse than it found it.
 *
 * @param {string} docId
 * @param {{ force?: boolean }} [opts] force re-runs analysis that already exists
 */
export async function enrichDocument(docId, { force = false } = {}) {
  if (running.has(docId)) return { status: 'running' };
  running.add(docId);
  try {
    const doc = await db.documents.byId(docId);
    if (!doc) return { status: 'missing' };

    if (providerName() !== 'gemini') {
      const analysis = { status: 'unavailable', reason: 'No language model is configured. Set GEMINI_API_KEY to enable transcription and summaries.' };
      await db.documents.update(doc.id, { analysis });
      return analysis;
    }
    if (doc.analysis?.status === 'ready' && !force) return doc.analysis;

    await db.documents.update(doc.id, { analysis: { status: 'running', startedAt: new Date().toISOString() } });

    let text = await indexedText(doc.id);
    let transcribed = false;

    if (text.length < MIN_USEFUL_TEXT) {
      const read = await transcribe(doc);
      if (read && read.length >= MIN_USEFUL_TEXT) {
        const count = await reindex(doc, read);
        await db.documents.update(doc.id, {
          chunkCount: count,
          needsOcr: false,
          note: `Text was read from the file by ${modelName()} — the document itself carries no selectable text.`,
        });
        text = read;
        transcribed = true;
      }
    }

    if (text.length < MIN_USEFUL_TEXT) {
      const analysis = {
        status: 'empty',
        reason: 'No readable text could be taken from this file, by parsing or by reading it.',
        at: new Date().toISOString(),
      };
      await db.documents.update(doc.id, { analysis });
      return analysis;
    }

    const described = await analyse(doc, text);
    const analysis = described
      ? { status: 'ready', transcribed, engine: modelName(), at: new Date().toISOString(), ...described }
      : { status: 'failed', reason: 'The model did not return a usable summary.', transcribed, at: new Date().toISOString() };
    await db.documents.update(doc.id, { analysis });
    return analysis;
  } catch (err) {
    console.warn(`[enrich] ${docId} failed:`, err.message);
    const analysis = { status: 'failed', reason: err.message, at: new Date().toISOString() };
    try { await db.documents.update(docId, { analysis }); } catch { /* the document may be gone */ }
    return analysis;
  } finally {
    running.delete(docId);
  }
}

/** Fire-and-forget wrapper for the upload path: enrichment must never delay or
 *  fail the response that tells the uploader their file arrived. */
export function enrichInBackground(docId, opts) {
  Promise.resolve()
    .then(() => enrichDocument(docId, opts))
    .catch((err) => console.warn(`[enrich] ${docId} background failure:`, err.message));
}
