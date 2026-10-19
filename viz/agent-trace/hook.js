#!/usr/bin/env node
// Agent Trace hook. Claude Code and Codex run this on each event and pass the event as JSON on stdin.
// It forwards the event to the local server (starting it if needed) and always exits 0 with no output,
// so it never changes what the agent does.
'use strict';

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const agent = process.argv[2] === 'codex' ? 'codex' : 'claude';
const PORT = Number(process.env.AGENT_TRACE_PORT || 4877);
const done = () => process.exit(0);
setTimeout(done, 3000).unref(); // hard stop, whatever happens

function send(body) {
  return new Promise(resolve => {
    const req = http.request({
      host: '127.0.0.1', port: PORT, path: '/ingest', method: 'POST', timeout: 800,
      headers: { 'Content-Type': 'application/json', 'X-Agent-Trace': '1', 'Content-Length': Buffer.byteLength(body) },
    }, res => { res.resume(); resolve(true); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end(body);
  });
}

function startServer() {
  try {
    const child = spawn(process.execPath, [path.join(__dirname, 'server.js')], { detached: true, stdio: 'ignore' });
    child.unref();
  } catch (_) {}
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', async () => {
  let raw;
  try { raw = JSON.parse(input); } catch (_) { raw = { text: input }; }
  const body = JSON.stringify({ agent, raw });
  if (await send(body)) return done();
  startServer();
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 200));
    if (await send(body)) return done();
  }
  done();
});
process.stdin.on('error', done);
