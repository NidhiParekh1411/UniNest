// Splits extracted document text into retrievable passages.
//
// Design notes:
//  - Passages are built from whole sentences so a citation never begins or ends
//    mid-clause when it is shown to a student.
//  - Consecutive passages overlap by one sentence, so a fact spanning a boundary
//    is still retrievable as a unit.
//  - Headings are detected and carried down onto following passages as `section`,
//    which is what the deck means by "names the exact document and section".

const TARGET_CHARS = 700;
const OVERLAP_SENTENCES = 1;

function looksLikeHeading(line) {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (/[.!?]$/.test(t)) return false;
  const isNumbered = /^(\d+(\.\d+)*|[IVXLC]+\.|[A-Z]\.)\s+\S/.test(t);
  const isUpper = t === t.toUpperCase() && /[A-Z]{3}/.test(t);
  const isTitleish = /^[A-Z]/.test(t) && t.split(/\s+/).length <= 10;
  return isNumbered || isUpper || (isTitleish && !/,/.test(t));
}

function splitSentences(block) {
  return block
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function chunkText(text, meta = {}) {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let section = meta.defaultSection ?? null;
  let buffer = [];

  const flush = () => {
    if (buffer.length) { blocks.push({ section, body: buffer.join('\n') }); buffer = []; }
  };

  for (const line of lines) {
    if (!line.trim()) { continue; }
    if (looksLikeHeading(line)) { flush(); section = line.trim(); continue; }
    buffer.push(line.trim());
  }
  flush();

  const chunks = [];
  // Rough page attribution: documents rarely carry per-line page markers after
  // extraction, so we distribute passages evenly across the known page count.
  const pages = Math.max(1, meta.pages ?? 1);

  for (const block of blocks) {
    const sentences = splitSentences(block.body);
    let current = [];
    let size = 0;
    const emit = () => {
      if (!current.length) return;
      chunks.push({ section: block.section, text: current.join(' ').trim() });
      current = current.slice(-OVERLAP_SENTENCES);
      size = current.reduce((n, s) => n + s.length, 0);
    };
    for (const s of sentences) {
      current.push(s);
      size += s.length;
      if (size >= TARGET_CHARS) emit();
    }
    if (current.length && size > 0) {
      const last = current.join(' ').trim();
      if (!chunks.length || chunks[chunks.length - 1].text !== last) {
        chunks.push({ section: block.section, text: last });
      }
    }
  }

  const total = chunks.length || 1;
  return chunks
    .filter((c) => c.text.length > 40)
    .map((c, i) => ({
      ...c,
      ordinal: i,
      page: Math.min(pages, Math.floor((i / total) * pages) + 1),
    }));
}
