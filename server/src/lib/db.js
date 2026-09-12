// MongoDB persistence. This module is the ONLY place that touches the database
// — see CLAUDE.md rule 3. Routes and the RAG layer speak to the `db` object and
// know nothing about the driver.
//
// The surface (all/find/findOne/byId/count/insert/insertMany/update/updateWhere/
// remove/removeWhere/replaceAll) is unchanged from the JSON-file implementation
// it replaces, with one deliberate difference: every method is now async and
// must be awaited. The driver has no synchronous mode, so that cost is real and
// is paid at the call sites rather than hidden behind a cache that would
// reintroduce the memory ceiling this migration exists to remove.
//
// Identity: rows keep their own string `id` field (`usr_…`, `sub_…`). Mongo's
// `_id` is never exposed — it is projected away on every read — so ids stay
// stable across a reseed and nothing downstream had to learn about ObjectId.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '../../data');
// UPLOAD_DIR is overridable because on a hosted container the code directory is
// wiped on every redeploy. Pointing this at a mounted disk is then a settings
// change rather than a code change. Unset, it behaves exactly as it always has.
export const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(DATA_DIR, 'uploads');

// Uploaded binaries stay on disk; Mongo stores the metadata row that points at
// them. Keeping files out of the database is what lets a 25 MB PDF upload stay
// a streamed write instead of a document-size-limit problem.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const COLLECTIONS = [
  'users', 'subjects', 'timetable', 'attendance', 'results', 'documents',
  'chunks', 'assignments', 'submissions', 'announcements', 'questionbanks',
  'conversations',
];

// Indexes chosen from the actual query shapes in routes/ and rag/ — every
// non-`id` lookup that runs on a request path is covered here.
const INDEXES = {
  users: [
    [{ email: 1 }, { unique: true }],
    [{ role: 1, branch: 1, semester: 1 }, {}],
  ],
  subjects: [
    [{ branch: 1, semester: 1 }, {}],
    [{ facultyId: 1 }, {}],
  ],
  timetable: [
    [{ branch: 1, semester: 1 }, {}],
    [{ facultyId: 1 }, {}],
  ],
  attendance: [
    [{ studentId: 1 }, {}],
    [{ subjectId: 1 }, {}],
  ],
  results: [
    [{ studentId: 1 }, {}],
    [{ subjectId: 1 }, {}],
  ],
  documents: [[{ branch: 1, semester: 1 }, {}], [{ supersededBy: 1 }, {}]],
  chunks: [[{ documentId: 1 }, {}]],
  assignments: [[{ subjectId: 1 }, {}], [{ facultyId: 1 }, {}]],
  submissions: [[{ assignmentId: 1 }, {}], [{ studentId: 1 }, {}]],
  announcements: [[{ publishAt: 1 }, {}]],
  questionbanks: [[{ facultyId: 1 }, {}]],
  conversations: [[{ userId: 1 }, {}]],
};

const PROJECTION = { _id: 0 };

let client = null;
let database = null;
let connecting = null;
let driver = null;   // 'mongo' | 'file' — set once by connect()

export function id(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function mongoUri() {
  return process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
}

export function dbName() {
  return process.env.MONGODB_DB || 'college_rag';
}

// Which store is actually serving reads and writes: 'mongo' or 'file'.
export function driverName() {
  return driver;
}

export function driverLabel() {
  if (driver === 'file') return `local files (${path.relative(process.cwd(), DATA_DIR)})`;
  return `MongoDB · ${dbName()}`;
}

const safeUri = () => mongoUri().replace(/\/\/[^@]*@/, '//<credentials>@');

// Idempotent and safe to call concurrently: the first caller creates the
// connection promise, everyone else awaits the same one.
//
// Store selection, in order:
//   DB_DRIVER=file   — use the JSON files, never touch Mongo
//   DB_DRIVER=mongo  — require Mongo; fail loudly if it is unreachable
//   unset (default)  — try Mongo, fall back to the JSON files
//
// The default is what makes a fresh clone runnable with no setup. Anything
// deploying for real should set DB_DRIVER=mongo so a misconfigured connection
// string fails at startup instead of silently serving stale local data.
// A failed connection has three very different causes and only one of them is
// "unreachable". This used to report all of them as unreachable, which sent a
// debugging session chasing the network while Atlas had in fact answered and
// rejected the password. Name the cases apart.
function explainMongoError(err) {
  const msg = String(err?.message || err);
  if (err?.code === 8000 || /bad auth|authentication failed/i.test(msg)) {
    return 'the cluster answered but rejected the credentials (bad auth). Check the '
      + 'username and password in MONGODB_URI against Atlas > Database Access. '
      + 'A password containing @ : / ? # % must be percent-encoded.';
  }
  if (/querySrv|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) {
    return `DNS could not resolve the cluster hostname - ${msg}`;
  }
  if (err?.name === 'MongoServerSelectionError') {
    return 'no server answered in time. Usually this machine\'s IP address is not in '
      + 'Atlas > Network Access, or the cluster is paused.';
  }
  return msg;
}

export async function connect() {
  if (driver) return database ?? store;
  if (connecting) return connecting;

  const requested = (process.env.DB_DRIVER || '').trim().toLowerCase();

  if (requested === 'file') {
    loadFiles();
    driver = 'file';
    return store;
  }

  connecting = (async () => {
    client = new MongoClient(mongoUri(), {
      // Short by design. This timeout is how long a fresh clone waits before
      // falling back, so it has to be a pause, not a hang.
      serverSelectionTimeoutMS: requested === 'mongo' ? 10000 : 3000,
      retryWrites: true,
    });
    await client.connect();
    database = client.db(dbName());
    await ensureIndexes();
    driver = 'mongo';
    return database;
  })();

  try {
    return await connecting;
  } catch (err) {
    connecting = null;
    client = null;
    database = null;

    const why = explainMongoError(err);

    if (requested === 'mongo') {
      throw new Error(`Could not connect to MongoDB at ${safeUri()} — ${why}`);
    }

    console.warn(`\n[db] MongoDB at ${safeUri()} did not connect.`);
    console.warn(`[db] Reason: ${why}`);
    console.warn('[db] Falling back to the local JSON files in server/data/.');
    console.warn('[db] This is fine for development and demos. See docs/DATABASE_SETUP.html');
    console.warn('[db] to move to a real database, or set DB_DRIVER=mongo to require one.\n');

    loadFiles();
    driver = 'file';
    return store;
  }
}

async function ensureIndexes() {
  await Promise.all(
    Object.entries(INDEXES).flatMap(([name, specs]) =>
      specs.map(([keys, opts]) =>
        database.collection(name).createIndex(keys, opts).catch(() => {}),
      ),
    ),
  );
}

export async function close() {
  // Any writes still sitting in the debounce window are persisted before we go.
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (driver === 'file') flushFiles();
  if (client) await client.close();
  client = null;
  database = null;
  connecting = null;
  driver = null;
  store.clear();
}

function raw(name) {
  if (!database) {
    throw new Error('Database not connected — call connect() before using db.');
  }
  return database.collection(name);
}

// Translates the query dialect the codebase already speaks into Mongo's.
// Plain values are equality; an array means "one of" ($in); a function is
// evaluated in memory, because that cannot be pushed into the server.
function toFilter(query = {}) {
  const filter = {};
  const predicates = [];
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) filter[k] = { $in: v };
    else if (typeof v === 'function') predicates.push([k, v]);
    else filter[k] = v;
  }
  return { filter, predicates };
}

function applyPredicates(rows, predicates) {
  if (!predicates.length) return rows;
  return rows.filter((row) => predicates.every(([k, fn]) => fn(row[k], row)));
}

/* ===========================================================================
   File-backed store — the zero-setup fallback.

   MongoDB is the intended store, but the app must be runnable by someone who
   has just cloned it and has no database. This driver keeps every collection
   in memory, loaded from and persisted back to server/data/<collection>.json,
   and implements exactly the same surface as the Mongo driver below.

   It is chosen automatically when Mongo is unreachable. That means:
     - a fresh clone runs with `npm run dev` and nothing else
     - a demo cannot be broken by wifi
     - `npm run seed` works either way, writing to whichever store is active

   Its limits are real and worth knowing: everything is held in memory, so it
   is bounded by the dataset fitting in RAM, and concurrent writes from two
   processes would clobber each other. Neither matters for one dev server or a
   demo; both are why Atlas is still the right answer for anything real.
   =========================================================================== */

const store = new Map();          // collection name -> array of rows
const dirty = new Set();          // collections with unpersisted writes
const mtimes = new Map();         // last mtime we ourselves observed or wrote
let flushTimer = null;

const fileFor = (name) => path.join(DATA_DIR, `${name}.json`);

function recordMtime(name) {
  try { mtimes.set(name, fs.statSync(fileFor(name)).mtimeMs); } catch { mtimes.delete(name); }
}

// True when the file has been written by somebody other than us since we last
// read or wrote it — in practice, `npm run seed` run while `npm run dev` is up.
function changedExternally(name) {
  if (!mtimes.has(name)) return false;
  try { return fs.statSync(fileFor(name)).mtimeMs !== mtimes.get(name); } catch { return false; }
}

// Rows are cloned on the way out. Mongo hands back a fresh object on every
// read; without this, a caller mutating a result would silently corrupt the
// store, and that bug would only appear in file mode.
const clone = (row) => (row == null ? row : structuredClone(row));
const cloneAll = (rows) => rows.map(clone);

function loadOne(name) {
  let rows = [];
  try {
    const parsed = JSON.parse(fs.readFileSync(fileFor(name), 'utf8'));
    if (Array.isArray(parsed)) rows = parsed;
  } catch {
    // A missing or unparseable file is an empty collection, not a crash —
    // questionbanks and conversations start empty on a fresh clone.
    rows = [];
  }
  store.set(name, rows);
  recordMtime(name);
}

function loadFiles() {
  for (const name of COLLECTIONS) loadOne(name);
}

// Writes are batched: a seed run touching twelve collections should not write
// twelve files twelve times. Persisted on the next tick, and on shutdown.
function markDirty(name) {
  dirty.add(name);
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flushFiles(); }, 120);
  flushTimer.unref?.();
}

export function flushFiles() {
  for (const name of dirty) {
    // Somebody else rewrote this file while we held it in memory — almost
    // always `npm run seed` in a second terminal. Writing our copy would
    // resurrect the entire pre-seed dataset and silently orphan every row that
    // referenced it. Reload instead, and say so.
    if (changedExternally(name)) {
      console.warn(`[db] ${name}.json changed on disk — reloading it and discarding this process's in-memory copy.`);
      console.warn('[db] (That is what `npm run seed` while the server is running looks like. Restart the server.)');
      loadOne(name);
      continue;
    }
    try {
      // Written via a temporary file and renamed, so an interrupted write
      // cannot leave a half-serialised JSON file that fails to load next time.
      const target = fileFor(name);
      const tmp = `${target}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(store.get(name) ?? [], null, 2));
      fs.renameSync(tmp, target);
      recordMtime(name);
    } catch (err) {
      console.error(`[db] could not persist ${name}.json — ${err.message}`);
    }
  }
  dirty.clear();
}

function rowsOf(name) {
  const rows = store.get(name);
  if (!rows) throw new Error('Database not connected — call connect() before using db.');
  return rows;
}

// The same query dialect as toFilter(), evaluated in memory: a plain value is
// equality, an array is "one of", a function is a predicate.
function matches(row, query) {
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined) continue;
    if (Array.isArray(v)) { if (!v.includes(row[k])) return false; }
    else if (typeof v === 'function') { if (!v(row[k], row)) return false; }
    else if (row[k] !== v) return false;
  }
  return true;
}

function fileCollection(name) {
  const select = (query) => rowsOf(name).filter((r) => matches(r, query));

  return {
    async all() { return cloneAll(rowsOf(name)); },
    async find(query = {}) { return cloneAll(select(query)); },
    async findOne(query = {}) { return clone(select(query)[0] ?? null); },
    async byId(rowId) {
      if (rowId === undefined || rowId === null) return null;
      return clone(rowsOf(name).find((r) => r.id === rowId) ?? null);
    },
    async count(query = {}) { return select(query).length; },

    async insert(doc) {
      const row = { id: doc.id ?? id(name.slice(0, 3)), ...doc };
      rowsOf(name).push(structuredClone(row));
      markDirty(name);
      return row;
    },

    async insertMany(docs) {
      if (!docs.length) return [];
      const created = docs.map((d) => ({ id: d.id ?? id(name.slice(0, 3)), ...d }));
      rowsOf(name).push(...created.map((d) => structuredClone(d)));
      markDirty(name);
      return created;
    },

    async update(rowId, patch) {
      const rows = rowsOf(name);
      const i = rows.findIndex((r) => r.id === rowId);
      if (i === -1) return null;
      const { id: _ignored, ...safe } = patch ?? {};
      rows[i] = { ...rows[i], ...structuredClone(safe) };
      markDirty(name);
      return clone(rows[i]);
    },

    async updateWhere(query, patch) {
      const { id: _ignored, ...safe } = patch ?? {};
      const rows = rowsOf(name);
      let n = 0;
      for (let i = 0; i < rows.length; i += 1) {
        if (!matches(rows[i], query)) continue;
        rows[i] = { ...rows[i], ...structuredClone(safe) };
        n += 1;
      }
      if (n) markDirty(name);
      return n;
    },

    async remove(rowId) {
      const rows = rowsOf(name);
      const i = rows.findIndex((r) => r.id === rowId);
      if (i === -1) return false;
      rows.splice(i, 1);
      markDirty(name);
      return true;
    },

    async removeWhere(query) {
      const rows = rowsOf(name);
      const keep = rows.filter((r) => !matches(r, query));
      const removed = rows.length - keep.length;
      if (removed) { store.set(name, keep); markDirty(name); }
      return removed;
    },

    async replaceAll(docs) {
      const created = docs.map((d) => ({ id: d.id ?? id(name.slice(0, 3)), ...d }));
      store.set(name, created.map((d) => structuredClone(d)));
      markDirty(name);
      return created;
    },
  };
}

/* ------------------------------------------------------------ mongo driver */

function mongoCollection(name) {
  return {
    async all() {
      return raw(name).find({}, { projection: PROJECTION }).toArray();
    },

    async find(query = {}) {
      const { filter, predicates } = toFilter(query);
      const rows = await raw(name).find(filter, { projection: PROJECTION }).toArray();
      return applyPredicates(rows, predicates);
    },

    async findOne(query = {}) {
      const { filter, predicates } = toFilter(query);
      if (!predicates.length) {
        return raw(name).findOne(filter, { projection: PROJECTION });
      }
      const rows = await raw(name).find(filter, { projection: PROJECTION }).toArray();
      return applyPredicates(rows, predicates)[0] ?? null;
    },

    async byId(rowId) {
      if (rowId === undefined || rowId === null) return null;
      return raw(name).findOne({ id: rowId }, { projection: PROJECTION });
    },

    async count(query = {}) {
      const { filter, predicates } = toFilter(query);
      if (!predicates.length) return raw(name).countDocuments(filter);
      const rows = await raw(name).find(filter, { projection: PROJECTION }).toArray();
      return applyPredicates(rows, predicates).length;
    },

    async insert(doc) {
      const row = { id: doc.id ?? id(name.slice(0, 3)), ...doc };
      await raw(name).insertOne({ ...row });
      return row;
    },

    async insertMany(docs) {
      if (!docs.length) return [];
      const created = docs.map((d) => ({ id: d.id ?? id(name.slice(0, 3)), ...d }));
      await raw(name).insertMany(created.map((d) => ({ ...d })));
      return created;
    },

    async update(rowId, patch) {
      const { id: _ignored, ...safe } = patch ?? {};
      return raw(name).findOneAndUpdate(
        { id: rowId },
        { $set: safe },
        { returnDocument: 'after', projection: PROJECTION },
      );
    },

    async updateWhere(query, patch) {
      const { filter, predicates } = toFilter(query);
      const { id: _ignored, ...safe } = patch ?? {};
      if (!predicates.length) {
        const res = await raw(name).updateMany(filter, { $set: safe });
        return res.modifiedCount;
      }
      const rows = applyPredicates(
        await raw(name).find(filter, { projection: PROJECTION }).toArray(),
        predicates,
      );
      if (!rows.length) return 0;
      const res = await raw(name).updateMany(
        { id: { $in: rows.map((r) => r.id) } },
        { $set: safe },
      );
      return res.modifiedCount;
    },

    async remove(rowId) {
      const res = await raw(name).deleteOne({ id: rowId });
      return res.deletedCount > 0;
    },

    async removeWhere(query) {
      const { filter, predicates } = toFilter(query);
      if (!predicates.length) {
        const res = await raw(name).deleteMany(filter);
        return res.deletedCount;
      }
      const rows = applyPredicates(
        await raw(name).find(filter, { projection: PROJECTION }).toArray(),
        predicates,
      );
      if (!rows.length) return 0;
      const res = await raw(name).deleteMany({ id: { $in: rows.map((r) => r.id) } });
      return res.deletedCount;
    },

    async replaceAll(docs) {
      const created = docs.map((d) => ({ id: d.id ?? id(name.slice(0, 3)), ...d }));
      await raw(name).deleteMany({});
      if (created.length) await raw(name).insertMany(created.map((d) => ({ ...d })));
      return created;
    },
  };
}

// The only entry point routes and the RAG layer use. Which driver is behind it
// is decided once, at connect().
export function collection(name) {
  if (!COLLECTIONS.includes(name)) throw new Error(`Unknown collection: ${name}`);
  return driver === 'file' ? fileCollection(name) : mongoCollection(name);
}

// Batch id lookup. Resolving ids one at a time inside a .map() would issue one
// round trip per row — fine against a local JSON file, an N+1 against Atlas.
// This collapses the whole set into a single $in query and hands back a Map the
// callback can read synchronously.
export async function lookup(name, ids) {
  const unique = [...new Set((ids ?? []).filter((v) => v !== undefined && v !== null))];
  if (!unique.length) return new Map();
  const rows = await collection(name).find({ id: unique });
  return new Map(rows.map((r) => [r.id, r]));
}

const METHODS = [
  'all', 'find', 'findOne', 'byId', 'count',
  'insert', 'insertMany', 'update', 'updateWhere',
  'remove', 'removeWhere', 'replaceAll',
];

// `db` is built when this module loads, which is *before* connect() has chosen
// a driver. So each method resolves the driver at call time rather than
// capturing whichever one happened to be active at import — binding early
// silently pins every route to Mongo and the file fallback never runs.
function lazyCollection(name) {
  return Object.fromEntries(
    METHODS.map((m) => [m, (...args) => collection(name)[m](...args)]),
  );
}

export const db = Object.fromEntries(COLLECTIONS.map((c) => [c, lazyCollection(c)]));
export default db;
