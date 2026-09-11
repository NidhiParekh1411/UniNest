// Runs the API and the web dev server together with prefixed, colourised output.
// Deliberately dependency-free — see CLAUDE.md ("do not add a dependency without asking").
import { spawn } from 'node:child_process';

const targets = [
  { name: 'api', color: '\x1b[38;5;209m', args: ['run', 'dev', '-w', 'server'] },
  { name: 'web', color: '\x1b[38;5;204m', args: ['run', 'dev', '-w', 'web'] },
];
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';
const children = [];
// On Windows `npm` is `npm.cmd`, a batch file: spawning it without a shell fails
// with ENOENT, and Node ≥18.20/20.12 refuses `.cmd` files outside a shell anyway.
// The args are fixed literals, so running through the shell is safe here.
const useShell = process.platform === 'win32';

for (const t of targets) {
  const child = spawn('npm', t.args, { stdio: ['ignore', 'pipe', 'pipe'], shell: useShell });
  children.push(child);
  const tag = `${t.color}${t.name.padEnd(3)}${RESET} ${DIM}│${RESET} `;
  child.on('error', (err) => {
    process.stdout.write(`${tag}failed to start: ${err.message}\n`);
  });
  const pipe = (stream) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) process.stdout.write(tag + line + '\n');
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => {
    if (code) process.stdout.write(`${tag}exited with code ${code}\n`);
  });
}

const shutdown = () => { for (const c of children) c.kill('SIGINT'); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
