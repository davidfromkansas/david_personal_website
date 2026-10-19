#!/usr/bin/env node
// Agent Trace local server.
// Receives hook events from Claude Code and Codex, follows each session's log file,
// and streams everything to the viewer page. Listens on 127.0.0.1 only.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = Number(process.env.AGENT_TRACE_PORT || 4877);
const HOME = os.homedir();
const DIR = path.join(HOME, '.agent-trace');
const LOG_DIR = path.join(DIR, 'logs');
const VIEWER = path.join(__dirname, 'viewer.html');
const BACKLOG = 2000;             // records kept in memory for new viewers
const MAX_STRING = 50000;         // longer strings are cut, with a note saying how much
const IDLE_EXIT_MS = 2 * 60 * 60 * 1000; // stop after 2 hours with no activity and no viewers
const URL = `http://127.0.0.1:${PORT}/`;

fs.mkdirSync(LOG_DIR, { recursive: true });

// ---------- records ----------
let nextId = 1;
const records = [];
const clients = new Set();
let lastActivity = Date.now();

const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[private key hidden]'],
  [/sk-ant-[A-Za-z0-9_-]{10,}/g, 'sk-ant-•••'],
  [/sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g, 'sk-•••'],
  [/gh[pousr]_[A-Za-z0-9]{20,}/g, 'gh_•••'],
  [/github_pat_[A-Za-z0-9_]{20,}/g, 'github_pat_•••'],
  [/AKIA[0-9A-Z]{16}/g, 'AKIA•••'],
  [/xox[abposr]-[A-Za-z0-9-]{10,}/g, 'xox•••'],
  [/AIza[0-9A-Za-z_-]{30,}/g, 'AIza•••'],
  [/(Bearer\s+)[A-Za-z0-9._~+/-]{16,}=*/g, '$1•••'],
  [/((?:api[_-]?key|secret|access[_-]?token|auth[_-]?token|password|passwd)["']?\s*[:=]\s*["']?)([^\s"',]{8,})/gi, '$1•••'],
];

function clean(value) {
  if (typeof value === 'string') {
    let s = value;
    for (const [re, rep] of SECRET_PATTERNS) s = s.replace(re, rep);
    if (s.length > MAX_STRING) s = s.slice(0, MAX_STRING) + `… [${(s.length - MAX_STRING).toLocaleString('en-US')} more characters not shown]`;
    return s;
  }
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = clean(value[k]);
    return out;
  }
  return value;
}

function logFile() {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return path.join(LOG_DIR, `${day}.jsonl`);
}

function publish({ agent, source, session, raw, file }) {
  const rec = { id: nextId++, time: new Date().toISOString(), agent, source, session: session || null, raw: clean(raw) };
  if (file) rec.file = file;
  records.push(rec);
  if (records.length > BACKLOG) records.shift();
  lastActivity = Date.now();
  const line = JSON.stringify(rec);
  fs.appendFile(logFile(), line + '\n', () => {});
  for (const res of clients) res.write(`id: ${rec.id}\ndata: ${line}\n\n`);
}

// ---------- following session logs ----------
const tails = new Map(); // file path -> tail

function followFile(file, agent, session) {
  if (!file || tails.has(file)) return;
  let fd;
  try { fd = fs.openSync(file, 'r'); } catch (_) { return; }
  const size = fs.fstatSync(fd).size;
  const tail = { file, agent, session, fd, offset: 0, buf: '', skipFirst: false, lastGrowth: Date.now(), timer: null };
  // Read the whole session so far, unless it is very large; then start from the last 1 MB.
  if (size > 2 * 1024 * 1024) { tail.offset = size - 1024 * 1024; tail.skipFirst = true; }
  tails.set(file, tail);
  readTail(tail);
  tail.timer = setInterval(() => readTail(tail), 400);
}

function readTail(t) {
  let size;
  try { size = fs.fstatSync(t.fd).size; } catch (_) { return stopTail(t.file); }
  if (size < t.offset) { t.offset = 0; t.buf = ''; } // file was replaced
  if (size === t.offset) {
    if (Date.now() - t.lastGrowth > IDLE_EXIT_MS) stopTail(t.file);
    return;
  }
  const len = Math.min(size - t.offset, 4 * 1024 * 1024);
  const chunk = Buffer.alloc(len);
  fs.readSync(t.fd, chunk, 0, len, t.offset);
  t.offset += len;
  t.lastGrowth = Date.now();
  t.buf += chunk.toString('utf8');
  const lines = t.buf.split('\n');
  t.buf = lines.pop();
  for (const line of lines) {
    if (t.skipFirst) { t.skipFirst = false; continue; }
    if (!line.trim()) continue;
    let raw;
    try { raw = JSON.parse(line); } catch (_) { raw = { text: line }; }
    publish({ agent: t.agent, source: 'log', session: t.session, raw, file: t.file });
  }
}

function stopTail(file) {
  const t = tails.get(file);
  if (!t) return;
  clearInterval(t.timer);
  try { fs.closeSync(t.fd); } catch (_) {}
  tails.delete(file);
}

// Codex sometimes sends no transcript_path. Its session files live in
// ~/.codex/sessions/YYYY/MM/DD/rollout-...-<session id>.jsonl
function findCodexRollout(sessionId) {
  if (!sessionId) return null;
  const base = path.join(process.env.CODEX_HOME || path.join(HOME, '.codex'), 'sessions');
  const days = [0, 1].map(n => new Date(Date.now() - n * 864e5));
  for (const d of days) {
    const dir = path.join(base, String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0'));
    let names = [];
    try { names = fs.readdirSync(dir); } catch (_) { continue; }
    const hit = names.find(n => n.includes(sessionId) && n.endsWith('.jsonl'));
    if (hit) return path.join(dir, hit);
  }
  return null;
}

function onHook(agent, raw) {
  const session = raw && raw.session_id;
  publish({ agent, source: 'hook', session, raw });
  if (!raw) return;
  let file = raw.transcript_path || null;
  if (!file && agent === 'codex') file = findCodexRollout(session);
  if (file && file.startsWith('~')) file = path.join(HOME, file.slice(1));
  followFile(file, agent, session);
  if (raw.agent_transcript_path) followFile(raw.agent_transcript_path, agent, session);
  if (raw.hook_event_name === 'SessionEnd' && file) setTimeout(() => { const t = tails.get(file); if (t) { readTail(t); stopTail(file); } }, 3000);
}

// ---------- http ----------
function okHost(req) {
  const host = String(req.headers.host || '');
  return host === `127.0.0.1:${PORT}` || host === `localhost:${PORT}`;
}

function readBody(req, limit = 20 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const parts = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else parts.push(c); });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (!okHost(req)) { res.writeHead(403); return res.end(); }
  const url = new globalThis.URL(req.url, URL);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    fs.readFile(VIEWER, (err, buf) => {
      if (err) { res.writeHead(500); return res.end('Viewer file missing. Reinstall Agent Trace.'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write('retry: 2000\n\n');
    const last = Number(req.headers['last-event-id'] || 0);
    const maxId = nextId - 1;
    const from = last && last <= maxId ? last : 0;
    for (const r of records) if (r.id > from) res.write(`id: ${r.id}\ndata: ${JSON.stringify(r)}\n\n`);
    clients.add(res);
    const beat = setInterval(() => res.write(': keep-alive\n\n'), 20000);
    req.on('close', () => { clearInterval(beat); clients.delete(res); });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, app: 'agent-trace', records: records.length, viewers: clients.size, following: [...tails.keys()] }));
  }

  // Writes need this header, which a web page on another site cannot send without our permission.
  if (req.method === 'POST' && req.headers['x-agent-trace'] !== '1') { res.writeHead(403); return res.end(); }

  if (req.method === 'POST' && url.pathname === '/ingest') {
    try {
      const body = JSON.parse(await readBody(req));
      const agent = body.agent === 'codex' ? 'codex' : 'claude';
      onHook(agent, body.raw);
      res.writeHead(204); res.end();
    } catch (_) { res.writeHead(400); res.end(); }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/shutdown') {
    res.writeHead(204); res.end();
    setTimeout(() => process.exit(0), 50);
    return;
  }

  res.writeHead(404); res.end();
});

function openBrowser(target) {
  const cmd = process.platform === 'darwin' ? `open "${target}"`
    : process.platform === 'win32' ? `start "" "${target}"`
    : `xdg-open "${target}"`;
  exec(cmd, () => {});
}

server.on('error', err => {
  if (err.code === 'EADDRINUSE') process.exit(0); // already running
  console.error(err.message);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  fs.writeFileSync(path.join(DIR, 'server.pid'), String(process.pid));
  if (process.env.AGENT_TRACE_NO_OPEN !== '1') openBrowser(URL);
});

setInterval(() => {
  if (clients.size === 0 && Date.now() - lastActivity > IDLE_EXIT_MS) process.exit(0);
}, 60 * 1000).unref();
