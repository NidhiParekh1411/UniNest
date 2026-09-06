// In-memory BM25 index over db.chunks, rebuilt lazily whenever the chunk count
// or the newest chunk changes. At MVP scale (thousands of passages) a full
// rebuild is single-digit milliseconds, so there is no incremental path to get
// wrong. When this moves to Mongo + a real vector store, only this file and
// retrieve.js need to change.
import db from '../lib/db.js';
import { tokenize } from './tokenize.js';

const K1 = 1.5;
const B = 0.75;

let state = null;
let signature = '';

async function currentSignature() {
  const rows = await db.chunks.all();
  const last = rows.length ? rows[rows.length - 1].id : 'none';
  return `${rows.length}:${last}`;
}

async function build() {
  const rows = await db.chunks.all();
  const postings = new Map();      // term -> Map(chunkIndex -> termFrequency)
  const lengths = new Float64Array(rows.length);
  let totalLength = 0;

  rows.forEach((row, i) => {
    // The section heading is indexed alongside the body and weighted by
    // repetition — a passage under "Attendance Policy" should win the query
    // "attendance policy" even if the body never repeats the phrase.
    const terms = tokenize(`${row.section ?? ''} ${row.section ?? ''} ${row.title ?? ''} ${row.text}`);
    lengths[i] = terms.length;
    totalLength += terms.length;
    for (const t of terms) {
      let p = postings.get(t);
      if (!p) { p = new Map(); postings.set(t, p); }
      p.set(i, (p.get(i) ?? 0) + 1);
    }
  });

  state = {
    rows,
    postings,
    lengths,
    avgLength: rows.length ? totalLength / rows.length : 1,
    n: rows.length,
  };
  return state;
}

// Reading the chunk table is the only asynchronous part of this module, so it
// is hoisted into one explicit call made once at the start of a query. Every
// scoring function below then stays synchronous, which keeps the BM25 loop a
// tight in-memory pass rather than hundreds of awaited round trips.
export async function refresh() {
  const sig = await currentSignature();
  if (!state || sig !== signature) { signature = sig; await build(); }
  return state;
}

// Synchronous read of whatever refresh() last built. Callers that need current
// data must await refresh() first; an empty index is a valid answer here and
// makes abstention the natural outcome before anything has been ingested.
export function getIndex() {
  return state ?? { rows: [], postings: new Map(), lengths: new Float64Array(0), avgLength: 1, n: 0 };
}

export function invalidate() { state = null; signature = ''; }

// Returns Map(chunkIndex -> bm25 score) for the query terms.
export function score(queryTerms) {
  const idx = getIndex();
  const scores = new Map();
  if (!idx.n) return scores;

  for (const term of new Set(queryTerms)) {
    const p = idx.postings.get(term);
    if (!p) continue;
    const df = p.size;
    // Standard BM25 IDF, floored so a term present in most documents still
    // contributes a little rather than going negative.
    const idf = Math.max(0.05, Math.log(1 + (idx.n - df + 0.5) / (df + 0.5)));
    for (const [i, tf] of p) {
      const norm = tf * (K1 + 1) / (tf + K1 * (1 - B + B * (idx.lengths[i] / idx.avgLength)));
      scores.set(i, (scores.get(i) ?? 0) + idf * norm);
    }
  }
  return scores;
}

export function rowAt(i) { return getIndex().rows[i]; }

// IDF of a single term. A term absent from the corpus returns the maximum
// possible IDF — that is the point: retrieval needs to know that a query's most
// distinctive word was found nowhere at all.
export function idfOf(term) {
  const idx = getIndex();
  if (!idx.n) return 0;
  const df = idx.postings.get(term)?.size ?? 0;
  if (df === 0) return Math.log(1 + (idx.n + 0.5) / 0.5);
  return Math.max(0.05, Math.log(1 + (idx.n - df + 0.5) / (df + 0.5)));
}

export function hasTerm(term) { return getIndex().postings.has(term); }
export function stats() {
  const idx = getIndex();
  return { chunks: idx.n, terms: idx.postings.size, avgChunkTerms: Math.round(idx.avgLength) };
}
