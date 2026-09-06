// Format-aware text extraction. The deck calls for "the right extractor per file
// type"; this is that dispatcher.
//
// pdf-parse is imported from its lib entry point on purpose: the package's
// index.js contains a debug branch that reads a bundled test PDF when
// `module.parent` is falsy, which is always the case under ESM.
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

export const SUPPORTED = {
  '.pdf': 'pdf',
  '.docx': 'word',
  '.doc': 'word',
  '.xlsx': 'excel',
  '.xls': 'excel',
  '.csv': 'excel',
  '.pptx': 'slides',
  '.txt': 'text',
  '.md': 'text',
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.webp': 'image',
  '.heic': 'image',
};

export function kindOf(filename) {
  return SUPPORTED[path.extname(filename).toLowerCase()] ?? null;
}

async function parsePdf(filePath) {
  const { default: pdf } = await import('pdf-parse/lib/pdf-parse.js');
  const buf = await fs.readFile(filePath);
  const out = await pdf(buf);
  return { text: out.text, pages: out.numpages || 1 };
}

async function parseWord(filePath) {
  const { default: mammoth } = await import('mammoth');
  const { value } = await mammoth.extractRawText({ path: filePath });
  return { text: value, pages: 1 };
}

async function parseExcel(filePath) {
  const XLSX = (await import('xlsx')).default ?? (await import('xlsx'));
  const wb = XLSX.readFile(filePath);
  const parts = [];
  const tables = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (!rows.length) continue;
    tables.push({ sheet: sheetName, columns: Object.keys(rows[0]), rows });
    // Flatten to prose so tabular content is also retrievable by the text engine.
    parts.push(`Sheet: ${sheetName}`);
    for (const row of rows) {
      parts.push(Object.entries(row).map(([k, v]) => `${k}: ${v}`).join('; '));
    }
  }
  return { text: parts.join('\n'), pages: wb.SheetNames.length, tables };
}

// PPTX is a zip of XML parts. Rather than pull in a dependency for one format we
// read the slide XML directly — the text lives in <a:t> nodes.
async function parseSlides(filePath) {
  const buf = await fs.readFile(filePath);
  const slides = unzipEntries(buf).filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.name));
  slides.sort((a, b) => Number(a.name.match(/(\d+)/)[1]) - Number(b.name.match(/(\d+)/)[1]));
  const parts = [];
  for (const [i, entry] of slides.entries()) {
    const xml = entry.data.toString('utf8');
    const paragraphs = xml.split('</a:p>').map((p) => {
      const text = [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join('');
      return decodeXml(text).trim();
    }).filter(Boolean);
    if (!paragraphs.length) continue;
    // The first paragraph of a slide is its title. Emitting it on its own line
    // lets the chunker detect it as a heading, so citations and generated
    // questions carry the real slide title rather than "Slide 7".
    const [heading, ...rest] = paragraphs;
    parts.push(rest.length ? `${heading}\n${rest.join('\n')}` : heading);
  }
  return { text: parts.join('\n\n'), pages: slides.length || 1 };
}

// Handwritten notes and photographed notices. Real OCR is a Phase 2 item
// (see docs/PROJECT_STATE.md); today the file is stored, previewable, and
// attached to submissions, but its pixels are not searchable.
async function parseImage(filePath, originalName) {
  return {
    text: '',
    pages: 1,
    needsOcr: true,
    note: `${originalName} is an image. It is stored and viewable, but its contents are not yet text-searchable — OCR is scheduled for Phase 2.`,
  };
}

export async function extract(filePath, originalName) {
  const kind = kindOf(originalName);
  switch (kind) {
    case 'pdf': return { kind, ...(await parsePdf(filePath)) };
    case 'word': return { kind, ...(await parseWord(filePath)) };
    case 'excel': return { kind, ...(await parseExcel(filePath)) };
    case 'slides': return { kind, ...(await parseSlides(filePath)) };
    case 'image': return { kind, ...(await parseImage(filePath, originalName)) };
    case 'text': return { kind, text: await fs.readFile(filePath, 'utf8'), pages: 1 };
    default: throw new Error(`Unsupported file type: ${path.extname(originalName)}`);
  }
}

function decodeXml(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(d));
}

// Minimal zip reader for the PPTX case — central-directory walk + inflateRaw.
function unzipEntries(buf) {
  const entries = [];
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) return entries;
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) break;
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.slice(ptr + 46, ptr + 46 + nameLen).toString('utf8');
    const lNameLen = buf.readUInt16LE(localOffset + 26);
    const lExtraLen = buf.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(start, start + compSize);
    try {
      entries.push({ name, data: method === 0 ? raw : zlib.inflateRawSync(raw) });
    } catch { /* skip entries we cannot inflate */ }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}
