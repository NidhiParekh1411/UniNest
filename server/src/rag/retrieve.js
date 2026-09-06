// Scoped retrieval: BM25 relevance, then the guarantees the product actually
// depends on — access scoping, version recency, and honest abstention.
//
// CLAUDE.md rule 5 and the deck's core promise: a low-confidence result must
// abstain rather than answer. Do not lower MIN_SCORE to make a demo look better.
import db from '../lib/db.js';
import { tokenize } from './tokenize.js';
import { score, rowAt, idfOf, hasTerm, refresh } from './index.js';

export const MIN_SCORE = 2.2;
// A BM25 score alone is a poor confidence signal: a question about the campus
// wifi password scores respectably against a hostel circular purely because
// "campus" is a common word. So confidence also requires that the *distinctive*
// words of the question were actually found. Coverage is IDF-weighted, and a
// term missing from the corpus entirely is charged the maximum IDF — which is
// exactly what should sink a question the documents cannot answer.
export const MIN_COVERAGE = 0.42;
export const MIN_PEAK = 0.62;
const DAY = 24 * 60 * 60 * 1000;

// A chunk is visible to a caller only if the scope filter says so. This runs
// BEFORE ranking, never after — a student must not be able to phrase a query
// that ranks another branch's material into view.
export function visibleTo(row, scope, { includeSuperseded = false } = {}) {
  // Retrieval must never surface a retired circular. Browsing is different:
  // staff need to see the old version to understand what replaced what, and the
  // library labels it as superseded. So the exclusion is opt-out, and only the
  // library opts out.
  if (row.superseded && !includeSuperseded) return false;
  if (row.status && row.status !== 'published') {
    // Drafts and scheduled items are visible only to their owner and to admins.
    if (scope.role === 'admin') return true;
    return row.uploadedBy === scope.userId;
  }
  const aud = row.audience ?? 'all';
  if (aud === 'faculty' && scope.role === 'student') return false;
  if (aud === 'admin' && scope.role !== 'admin') return false;

  if (scope.role === 'student') {
    if (row.branch && row.branch !== 'ALL' && row.branch !== scope.branch) return false;
    if (row.semester && row.semester !== 0 && row.semester !== scope.semester) return false;
  }
  return true;
}

function recencyBoost(uploadedAt) {
  if (!uploadedAt) return 1;
  const ageDays = (Date.now() - new Date(uploadedAt).getTime()) / DAY;
  // Gentle decay: a document a year old keeps ~78% of its weight, so an old but
  // exact match still beats a fresh but weak one. Version supersession — not
  // this curve — is what retires an outdated circular.
  return 1 / (1 + Math.log1p(Math.max(0, ageDays) / 180) * 0.25);
}

// How much of the question the winning passage actually accounts for.
//
// Two signals, because either alone misfires:
//   coverage  — the share of the question's IDF mass present in the passage. A
//               question whose distinctive words are absent scores low.
//   peak      — the rarest question term the passage does contain, relative to
//               the rarest a term could be. One precise, unusual match ("unfair
//               means") is strong evidence even when the rest of the sentence is
//               filler the corpus never uses ("what happens if I am caught").
// A peak match only counts when a second term corroborates it, so a lone
// coincidental rare word ("price", in a question about canteen prices) cannot
// carry an answer on its own.
function confidenceSignals(terms, topRow) {
  const distinct = [...new Set(terms)];
  if (!distinct.length || !topRow) return { coverage: 0, peak: 0, matched: 0 };
  const present = new Set(tokenize(`${topRow.section ?? ''} ${topRow.title ?? ''} ${topRow.text}`));
  const maxIdf = idfOf('\u0000__absent__');
  let matchedIdf = 0;
  let totalIdf = 0;
  let peak = 0;
  let matched = 0;
  for (const t of distinct) {
    const idf = idfOf(t);
    totalIdf += idf;
    if (present.has(t)) {
      matchedIdf += idf;
      matched += 1;
      if (idf > peak) peak = idf;
    } else if (hasTerm(t)) {
      matchedIdf += idf * 0.35;
    }
  }
  return {
    coverage: totalIdf ? matchedIdf / totalIdf : 0,
    peak: maxIdf ? peak / maxIdf : 0,
    matched,
  };
}

export async function retrieve(query, scope, { k = 5, minScore = MIN_SCORE } = {}) {
  // One await here; everything downstream scores against the in-memory index.
  await refresh();
  const terms = tokenize(query);
  if (!terms.length) return { hits: [], top: 0, terms };

  const raw = score(terms);
  const scored = [];

  for (const [i, s] of raw) {
    const row = rowAt(i);
    if (!row || !visibleTo(row, scope)) continue;

    let final = s * recencyBoost(row.uploadedAt);
    // A passage from a document explicitly targeted at the caller's own
    // semester is more likely to be the intended answer than a general one.
    if (scope.semester && row.semester === scope.semester) final *= 1.12;
    if (scope.branch && row.branch === scope.branch) final *= 1.08;

    scored.push({ row, score: final });
  }

  scored.sort((a, b) => b.score - a.score);

  // At most two passages from any one document, so three chunks of the same
  // circular cannot crowd out a second, corroborating source.
  const perDoc = new Map();
  const hits = [];
  for (const s of scored) {
    const n = perDoc.get(s.row.docId) ?? 0;
    if (n >= 2) continue;
    perDoc.set(s.row.docId, n + 1);
    hits.push(s);
    if (hits.length >= k) break;
  }

  const top = hits.length ? hits[0].score : 0;
  const { coverage, peak, matched } = confidenceSignals(terms, hits[0]?.row);
  const strongPeak = peak >= MIN_PEAK && matched >= 2;
  return {
    terms,
    top,
    coverage,
    peak,
    confident: top >= minScore && (coverage >= MIN_COVERAGE || strongPeak),
    hits: hits.map((h) => ({
      score: Number(h.score.toFixed(3)),
      text: h.row.text,
      citation: {
        docId: h.row.docId,
        title: h.row.title,
        section: h.row.section ?? null,
        page: h.row.page ?? null,
        uploadedAt: h.row.uploadedAt,
        category: h.row.category ?? null,
      },
    })),
  };
}

// Documents the caller is allowed to see — used by the library screens so the
// same scoping logic backs both retrieval and browsing. Staff additionally see
// superseded versions, flagged as such, since version history is part of what
// the library is for.
export async function visibleDocuments(scope) {
  const includeSuperseded = scope.role !== 'student';
  return (await db.documents.all()).filter((d) => visibleTo({ ...d, docId: d.id }, scope, { includeSuperseded }));
}
