#!/usr/bin/env node
// Agent Trace command line.
//   node ~/.agent-trace/agent-trace.js install claude|codex|all
//   node ~/.agent-trace/agent-trace.js uninstall
//   node ~/.agent-trace/agent-trace.js open | status | stop
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn, exec } = require('child_process');

const HOME = os.homedir();
const DIR = __dirname;
const PORT = Number(process.env.AGENT_TRACE_PORT || 4877);
const URL = `http://127.0.0.1:${PORT}/`;
const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(HOME, '.claude');
const CODEX_DIR = process.env.CODEX_HOME || path.join(HOME, '.codex');


const q = s => (/[\s"'$`\\]/.test(s) ? `"${s.replace(/(["\\$`])/g, '\\$1')}"` : s);
// The install folder is ~/.agent-trace, so every command we add contains "agent-trace/hook.js".
const hookCommand = agent => `${q(process.execPath)} ${q(path.join(DIR, 'hook.js'))} ${agent}`;
const isOurs = h => h && typeof h.command === 'string' && /agent-trace[\\/]+hook\.js/.test(h.command);

function readJson(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return {};
  try { return JSON.parse(text); }
  catch (e) { throw new Error(`${file} is not valid JSON, so it was left unchanged. Fix it and run the installer again. (${e.message})`); }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    const backup = `${file}.before-agent-trace`;
    if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

// Remove our hooks from a { hooks: { Event: [ { matcher?, hooks: [...] } ] } } object.
function stripOurs(config) {
  const hooks = config.hooks || {};
  for (const ev of Object.keys(hooks)) {
    if (!Array.isArray(hooks[ev])) continue;
    hooks[ev] = hooks[ev]
      .map(g => ({ ...g, hooks: (g.hooks || []).filter(h => !isOurs(h)) }))
      .filter(g => g.hooks.length > 0);
    if (hooks[ev].length === 0) delete hooks[ev];
  }
  if (config.hooks && Object.keys(config.hooks).length === 0) delete config.hooks;
  return config;
}

function addOurs(config, events, handler) {
  stripOurs(config);
  config.hooks = config.hooks || {};
  for (const [ev, matcher] of events) {
    const group = { hooks: [handler] };
    if (matcher) group.matcher = matcher;
    (config.hooks[ev] = config.hooks[ev] || []).push(group);
  }
  return config;
}

// ---------- Claude Code ----------
const CLAUDE_EVENTS = [
  ['SessionStart', null], ['UserPromptSubmit', null], ['PreToolUse', '*'], ['PostToolUse', '*'],
  ['Notification', null], ['SubagentStop', null], ['PreCompact', null], ['Stop', null], ['SessionEnd', null],
];

const SKILL = `---
name: agent-trace
description: Open or check the Agent Trace viewer, a local page that shows every hook event and session-log line from this session live. Use when the user asks to see, open, or check the trace or viewer.
---

# Agent Trace

Agent Trace records this session's hook events and session log, and shows them live in a browser page.

- Open the viewer: run \`${q(process.execPath)} ${q(path.join(DIR, 'agent-trace.js'))} open\`
- Check it is running: run \`${q(process.execPath)} ${q(path.join(DIR, 'agent-trace.js'))} status\`
- Stop the background server: run \`${q(process.execPath)} ${q(path.join(DIR, 'agent-trace.js'))} stop\`

The viewer address is ${URL}. Everything stays on this computer.
`;

function installClaude() {
  const file = path.join(CLAUDE_DIR, 'settings.json');
  const config = addOurs(readJson(file), CLAUDE_EVENTS, { type: 'command', command: hookCommand('claude'), async: true, timeout: 5 });
  writeJson(file, config);
  const skillDir = path.join(CLAUDE_DIR, 'skills', 'agent-trace');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), SKILL);
  return [`Claude Code: added hooks to ${file}`, `Claude Code: added the agent-trace skill to ${skillDir}`];
}

function uninstallClaude() {
  const out = [];
  const file = path.join(CLAUDE_DIR, 'settings.json');
  if (fs.existsSync(file)) { writeJson(file, stripOurs(readJson(file))); out.push(`Claude Code: removed hooks from ${file}`); }
  const skillDir = path.join(CLAUDE_DIR, 'skills', 'agent-trace');
  if (fs.existsSync(skillDir)) { fs.rmSync(skillDir, { recursive: true, force: true }); out.push('Claude Code: removed the agent-trace skill'); }
  return out;
}

// ---------- Codex ----------
const CODEX_EVENTS = [['SessionStart', null], ['UserPromptSubmit', null], ['PreToolUse', '*'], ['PostToolUse', '*'], ['Stop', null]];

// Make sure hooks are switched on in ~/.codex/config.toml (older Codex versions need this).
function enableCodexHooks() {
  const file = path.join(CODEX_DIR, 'config.toml');
  let text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (/^\s*features\.(?:codex_)?hooks\s*=/m.test(text)) {
    text = text.replace(/^(\s*features\.(?:codex_)?hooks\s*=\s*).*$/m, '$1true');
  } else {
    const m = text.match(/^\[features\][^\n]*\n/m);
    if (m) {
      const start = m.index + m[0].length;
      const rest = text.slice(start);
      const nextTable = rest.search(/^\[/m);
      const section = nextTable === -1 ? rest : rest.slice(0, nextTable);
      if (/^\s*(?:codex_)?hooks\s*=/m.test(section)) {
        const fixed = section.replace(/^(\s*(?:codex_)?hooks\s*=\s*).*$/m, '$1true');
        text = text.slice(0, start) + fixed + (nextTable === -1 ? '' : rest.slice(nextTable));
      } else {
        text = text.slice(0, start) + 'hooks = true\n' + rest;
      }
    } else {
      text = text.replace(/\s*$/, '') + (text.trim() ? '\n\n' : '') + '[features]\nhooks = true\n';
    }
  }
  fs.mkdirSync(CODEX_DIR, { recursive: true });
  if (fs.existsSync(file) && !fs.existsSync(`${file}.before-agent-trace`)) fs.copyFileSync(file, `${file}.before-agent-trace`);
  fs.writeFileSync(file, text);
  return file;
}

function installCodex() {
  const file = path.join(CODEX_DIR, 'hooks.json');
  writeJson(file, addOurs(readJson(file), CODEX_EVENTS, { type: 'command', command: hookCommand('codex'), timeout: 5 }));
  const toml = enableCodexHooks();
  return [`Codex: added hooks to ${file}`, `Codex: turned on hooks in ${toml}`, 'Codex: restart Codex, then type /hooks and trust the agent-trace hooks (Codex asks you to approve new hooks).'];
}

function uninstallCodex() {
  const file = path.join(CODEX_DIR, 'hooks.json');
  if (!fs.existsSync(file)) return [];
  writeJson(file, stripOurs(readJson(file)));
  return [`Codex: removed hooks from ${file}`];
}

// ---------- server control ----------
function request(method, p) {
  return new Promise(resolve => {
    const req = http.request({ host: '127.0.0.1', port: PORT, path: p, method, timeout: 800, headers: { 'X-Agent-Trace': '1' } }, res => {
      let body = ''; res.on('data', c => { body += c; }); res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function running() {
  const r = await request('GET', '/health');
  if (!r || r.status !== 200) return null;
  try { const j = JSON.parse(r.body); return j.app === 'agent-trace' ? j : null; } catch (_) { return null; }
}

function openBrowser() {
  const cmd = process.platform === 'darwin' ? `open "${URL}"` : process.platform === 'win32' ? `start "" "${URL}"` : `xdg-open "${URL}"`;
  exec(cmd, () => {});
}

async function open() {
  if (!(await running())) {
    spawn(process.execPath, [path.join(DIR, 'server.js')], { detached: true, stdio: 'ignore', env: { ...process.env, AGENT_TRACE_NO_OPEN: '1' } }).unref();
    for (let i = 0; i < 15 && !(await running()); i++) await new Promise(r => setTimeout(r, 200));
  }
  openBrowser();
  console.log(`Agent Trace viewer: ${URL}`);
}

async function main() {
  const [cmd, target] = process.argv.slice(2);
  try {
    if (cmd === 'install') {
      const which = target || 'all';
      if (!['claude', 'codex', 'all'].includes(which)) throw new Error('Choose what to install: claude, codex, or all.');
      const lines = [];
      if (which !== 'codex') lines.push(...installClaude());
      if (which !== 'claude') lines.push(...installCodex());
      console.log(['Agent Trace is installed.', ...lines.map(l => `  • ${l}`),
        `  • The viewer opens at ${URL} the first time a session starts.`,
        `  • To remove it later: ${q(process.execPath)} ${q(path.join(DIR, 'agent-trace.js'))} uninstall`].join('\n'));
    } else if (cmd === 'uninstall') {
      await request('POST', '/shutdown');
      const lines = [...uninstallClaude(), ...uninstallCodex()];
      console.log(['Agent Trace hooks removed.', ...lines.map(l => `  • ${l}`), `  • Saved logs are still in ${path.join(HOME, '.agent-trace', 'logs')}. Delete the ~/.agent-trace folder to remove everything.`].join('\n'));
    } else if (cmd === 'open') {
      await open();
    } else if (cmd === 'status') {
      const s = await running();
      console.log(s ? `Running at ${URL} · ${s.records} records · ${s.viewers} viewer(s) open · following ${s.following.length} session file(s)` : 'Not running. It starts on its own when a session starts, or run: open');
    } else if (cmd === 'stop') {
      const r = await request('POST', '/shutdown');
      console.log(r ? 'Stopped.' : 'It was not running.');
    } else {
      console.log('Usage: agent-trace.js install claude|codex|all · uninstall · open · status · stop');
    }
  } catch (e) {
    console.error(`Agent Trace: ${e.message}`);
    process.exit(1);
  }
}

main();
