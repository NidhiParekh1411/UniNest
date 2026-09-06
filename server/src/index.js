import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';

import { connect, close, driverLabel, driverName } from './lib/db.js';
import { forwardAsyncErrors } from './lib/async-routes.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import academicsRoutes from './routes/academics.js';
import documentRoutes from './routes/documents.js';
import assignmentRoutes from './routes/assignments.js';
import announcementRoutes from './routes/announcements.js';
import questionBankRoutes from './routes/questionbank.js';
import userRoutes from './routes/users.js';
import overviewRoutes from './routes/overview.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/academics', academicsRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/question-banks', questionBankRoutes);
app.use('/api/users', userRoutes);
app.use('/api/overview', overviewRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'No such endpoint' }));

// Errors are returned as a sentence a user can act on, never a stack trace.
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'That file is larger than the 25 MB limit.'
      : 'The upload could not be processed.';
    return res.status(400).json({ error: message });
  }
  if (/Unsupported file type|Accepted formats/i.test(err.message ?? '')) {
    return res.status(400).json({ error: err.message });
  }
  console.error('[api]', err);
  return res.status(500).json({ error: 'Something went wrong on the server.' });
});

// Async handlers must be wrapped after every route is mounted but before the
// server accepts traffic — see lib/async-routes.js.
forwardAsyncErrors(app);

const PORT = Number(process.env.PORT) || 4000;

// The database connection is established before the port opens. Serving a
// request that cannot reach Mongo would surface as a confusing 500 per route;
// failing here says exactly what is wrong, once.
try {
  await connect();
} catch (err) {
  console.error(`\n${err.message}\n`);
  console.error('Set MONGODB_URI in server/.env — see server/.env.example,');
  console.error('or unset DB_DRIVER to fall back to the local JSON files.\n');
  process.exit(1);
}

const server = app.listen(PORT, () => {
  const provider = process.env.GEMINI_API_KEY ? 'Gemini' : 'offline extractive';
  console.log(`API listening on http://localhost:${PORT}  ·  answer engine: ${provider}  ·  store: ${driverLabel()}`);
  if (driverName() === 'file') {
    console.log('Running on local files — no database needed. Sign in with the one-tap demo accounts.');
  }
});

// Shutdown has two ways to stall: an in-flight request that never finishes, so
// server.close()'s callback never fires, and a db close() that hangs on a
// half-open connection. (Idle keep-alive sockets are not a problem — Node 19+
// drops those itself.) So arm a deadline that covers *both* phases and only
// disarm it once the process is genuinely on its way out.
let shuttingDown = false;

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (shuttingDown) return;   // a second Ctrl+C should not re-enter this
    shuttingDown = true;

    const forced = setTimeout(() => {
      console.error('[api] shutdown stalled for 5s — forcing exit.');
      server.closeAllConnections?.();
      process.exit(1);
    }, 5000);

    server.close(async () => {
      try {
        await close();          // the timer stays armed across this await
      } finally {
        clearTimeout(forced);
        process.exit(0);
      }
    });

    server.closeIdleConnections?.();
  });
}
