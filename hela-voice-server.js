#!/usr/bin/env node
/* ============================================================================
 * HelaCore Hela Voice — Backend API Server
 * ----------------------------------------------------------------------------
 * Fully functional HTTP/HTTPS API layer between the HelaCore dashboards
 * (frontend) and the AI backend (Qwen model). Provides:
 *
 *   • POST /api/voice/chat      — Qwen-powered chat: reply + executable actions
 *   • GET  /api/voice/memory    — conversation memory for a session (SQLite)
 *   • POST /api/voice/memory    — persist a conversation message
 *   • DELETE /api/voice/memory  — clear a session's memory
 *   • GET  /api/voice/sessions  — list stored sessions
 *   • GET  /api/voice/config    — server-side voice customization (persisted)
 *   • POST /api/voice/config    — save voice customization
 *   • GET  /api/voice/audit     — audit trail
 *   • GET  /api/voice/health    — health / model / provider status
 *
 * Storage: SQLite (node:sqlite) at hela-voice-data/hela-voice.db
 *          (falls back to JSON files if SQLite is unavailable)
 *
 * Qwen:    OpenAI-compatible endpoint (DashScope by default, or any
 *          OpenAI-compatible provider / local Ollama).
 *
 * Run:     node hela-voice-server.js
 * Env:     PORT (default 8787)
 *          QWEN_API_KEY, QWEN_BASE_URL, QWEN_MODEL
 *          HELA_HTTPS=1, HELA_CERT=/path/cert.pem, HELA_KEY=/path/key.pem
 * ========================================================================== */
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ── Config ─────────────────────────────────────────────────────────────── */
const PORT = parseInt(process.env.PORT || '8787', 10);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.HELA_DATA_DIR || path.join(__dirname, 'hela-voice-data');
const DB_PATH = path.join(DATA_DIR, 'hela-voice.db');

/* DMG download (for the dashboard "Download Desktop App" popup) */
const DMG_PATH = process.env.HELA_DMG_PATH || (function () {
  const candidates = [
    path.join(__dirname, '..', 'helacore-desktop', 'dist', 'HelaCore-1.0.0-arm64.dmg'),
    path.join(__dirname, '..', 'helacore-desktop', 'dist', 'HelaCore-1.0.0.dmg'),
    path.join(__dirname, 'helacore-desktop', 'dist', 'HelaCore-1.0.0-arm64.dmg'),
    path.join(__dirname, 'helacore-desktop', 'dist', 'HelaCore-1.0.0.dmg'),
    path.join(__dirname, 'dist', 'HelaCore-1.0.0-arm64.dmg'),
    path.join(__dirname, 'dist', 'HelaCore-1.0.0.dmg')
  ];
  for (const c of candidates) { if (fs.existsSync(c)) return c; }
  return candidates[0];
})();

const QWEN = {
  apiKey: process.env.QWEN_API_KEY || '',
  baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: process.env.QWEN_MODEL || 'qwen-plus'
};

const HTTPS_ENABLED = process.env.HELA_HTTPS === '1';
const CERT_PATH = process.env.HELA_CERT || '';
const KEY_PATH = process.env.HELA_KEY || '';

/* ── Storage (SQLite via node:sqlite, JSON fallback) ───────────────────── */
let db = null;
let useSqlite = false;

function initStorage() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const { DatabaseSync } = require('node:sqlite');
    db = new DatabaseSync(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        meta TEXT DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        ts TEXT NOT NULL,
        meta TEXT DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS voice_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        session_id TEXT,
        action TEXT NOT NULL,
        target TEXT,
        status TEXT,
        detail TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);
    `);
    useSqlite = true;
    console.log('[HelaVoice] SQLite storage ready at', DB_PATH);
  } catch (e) {
    console.warn('[HelaVoice] SQLite unavailable, using JSON file storage:', e.message);
    useSqlite = false;
  }
}

/* JSON fallback store */
const jsonFiles = {
  sessions: path.join(DATA_DIR, 'sessions.json'),
  messages: path.join(DATA_DIR, 'messages.json'),
  config: path.join(DATA_DIR, 'config.json'),
  audit: path.join(DATA_DIR, 'audit.json')
};
function jsonRead(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return def; }
}
function jsonWrite(file, data) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (e) {}
}

/* ── Storage API ───────────────────────────────────────────────────────── */
const store = {
  upsertSession(id, meta) {
    const now = new Date().toISOString();
    if (useSqlite) {
      db.prepare(`INSERT INTO sessions (id, created_at, updated_at, meta) VALUES (?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, meta = excluded.meta`)
        .run(id, now, now, JSON.stringify(meta || {}));
    } else {
      const s = jsonRead(jsonFiles.sessions, {});
      if (!s[id]) s[id] = { id, created_at: now, meta: meta || {} };
      s[id].updated_at = now;
      jsonWrite(jsonFiles.sessions, s);
    }
  },

  addMessage(sessionId, role, content, meta) {
    const now = new Date().toISOString();
    if (useSqlite) {
      db.prepare(`INSERT INTO messages (session_id, role, content, ts, meta) VALUES (?, ?, ?, ?, ?)`)
        .run(sessionId, role, content, now, JSON.stringify(meta || {}));
    } else {
      const m = jsonRead(jsonFiles.messages, []);
      m.push({ session_id: sessionId, role, content, ts: now, meta: meta || {} });
      jsonWrite(jsonFiles.messages, m);
    }
    this.upsertSession(sessionId, meta);
  },

  getMessages(sessionId, limit) {
    limit = limit || 50;
    if (useSqlite) {
      const rows = db.prepare(`SELECT role, content, ts FROM messages WHERE session_id = ? ORDER BY id DESC LIMIT ?`)
        .all(sessionId, limit);
      return rows.reverse();
    }
    const m = jsonRead(jsonFiles.messages, []).filter(x => x.session_id === sessionId).slice(-limit);
    return m;
  },

  clearSession(sessionId) {
    if (useSqlite) {
      db.prepare(`DELETE FROM messages WHERE session_id = ?`).run(sessionId);
      db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sessionId);
    } else {
      const m = jsonRead(jsonFiles.messages, []).filter(x => x.session_id !== sessionId);
      jsonWrite(jsonFiles.messages, m);
      const s = jsonRead(jsonFiles.sessions, {});
      delete s[sessionId];
      jsonWrite(jsonFiles.sessions, s);
    }
  },

  listSessions() {
    if (useSqlite) {
      return db.prepare(`SELECT id, created_at, updated_at, meta FROM sessions ORDER BY updated_at DESC LIMIT 100`).all();
    }
    const s = jsonRead(jsonFiles.sessions, {});
    return Object.values(s).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 100);
  },

  getConfig() {
    if (useSqlite) {
      const rows = db.prepare(`SELECT key, value FROM voice_config`).all();
      const out = {};
      rows.forEach(r => { try { out[r.key] = JSON.parse(r.value); } catch (e) { out[r.key] = r.value; } });
      return out;
    }
    return jsonRead(jsonFiles.config, {});
  },

  setConfig(patch) {
    const now = new Date().toISOString();
    if (useSqlite) {
      const stmt = db.prepare(`INSERT INTO voice_config (key, value, updated_at) VALUES (?, ?, ?)
                               ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`);
      Object.keys(patch).forEach(k => stmt.run(k, JSON.stringify(patch[k]), now));
    } else {
      const c = jsonRead(jsonFiles.config, {});
      Object.assign(c, patch);
      jsonWrite(jsonFiles.config, c);
    }
    return this.getConfig();
  },

  addAudit(entry) {
    const now = new Date().toISOString();
    if (useSqlite) {
      db.prepare(`INSERT INTO audit (ts, session_id, action, target, status, detail) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(now, entry.sessionId || null, entry.action || 'unknown', entry.target || null, entry.status || 'recorded', entry.detail || null);
    } else {
      const a = jsonRead(jsonFiles.audit, []);
      a.unshift(Object.assign({ ts: now }, entry));
      jsonWrite(jsonFiles.audit, a.slice(0, 500));
    }
  },

  getAudit(limit) {
    limit = limit || 100;
    if (useSqlite) {
      return db.prepare(`SELECT ts, session_id, action, target, status, detail FROM audit ORDER BY id DESC LIMIT ?`).all(limit);
    }
    return jsonRead(jsonFiles.audit, []).slice(0, limit);
  }
};

/* ── Qwen client (OpenAI-compatible) ───────────────────────────────────── */
function qwenChat(messages, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    const url = QWEN.baseUrl.replace(/\/$/, '') + '/chat/completions';
    const body = {
      model: QWEN.model,
      messages: messages,
      temperature: opts.temperature != null ? opts.temperature : 0.4,
      max_tokens: opts.maxTokens || 800,
      stream: false
    };
    // Structured JSON output where supported
    if (opts.jsonMode) body.response_format = { type: 'json_object' };

    const payload = JSON.stringify(body);
    const u = new URL(url);
    const isHttps = u.protocol === 'https:';
    const lib = isHttps ? https : http;

    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': 'Bearer ' + QWEN.apiKey
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error('Qwen API error ' + res.statusCode + ': ' + (parsed.error && parsed.error.message || data.slice(0, 200))));
            return;
          }
          const content = parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content;
          resolve({ content: content || '', raw: parsed });
        } catch (e) {
          reject(new Error('Qwen response parse error: ' + e.message));
        }
      });
    });
    req.on('timeout', () => { req.destroy(new Error('Qwen request timed out')); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/* ── System prompt for Qwen ────────────────────────────────────────────── */
function buildSystemPrompt(page, context) {
  return `You are Hela Voice, the voice command brain of HelaCore — an AI-powered business operating system for African SMEs (Kenya-focused).

CONTEXT — current page: ${page || 'unknown'}
${context ? 'PAGE CONTENT: ' + context.slice(0, 800) : ''}

You understand and reply in English, Swahili, Sheng (Kenyan slang), and code-switched mixes. Match the user's language. Normalize Kenyan amounts (KES, "bob", "k"), phone numbers (+254/07xx), and dates.

AVAILABLE DASHBOARDS (use exact names): dashboard, money, helaone, helabank, ai studio, ai agents, projects, customers, financial overview, inventory, transactions, reports, market intelligence, opportunities, loan and financing, suppliers, ai simulations, ai advisor, ask hela, settings, api access, help center, documentation.

You can perform tasks by returning a JSON object with this exact shape:
{
  "reply": "your spoken reply to the user (concise, friendly, in their language)",
  "actions": [
    {"type": "navigate", "target": "financial overview"},
    {"type": "click", "selector": "#generateReportBtn"},
    {"type": "fill", "selector": "#agentSearch", "value": "supervisor"},
    {"type": "read", "selector": "#registryCount", "say": true},
    {"type": "respond", "text": "extra text to show"}
  ]
}

ACTION TYPES:
- navigate: open a dashboard (target = dashboard name from the list above)
- click: click an element (selector = CSS selector or button text)
- fill: set an input value (selector + value)
- read: read an element's text and optionally speak it (say: true)
- respond: show extra text without speaking

RULES:
- Always return valid JSON only (no markdown fences).
- "reply" must be spoken aloud, so keep it short and natural.
- For questions about the business, use the page content provided.
- If the user asks something you cannot do, say so honestly and suggest what they can ask.
- For risky actions (sending money, deleting, approving), ask for confirmation in the reply instead of acting.`;
}

/* ── Parse Qwen JSON output (tolerant) ─────────────────────────────────── */
function parseModelOutput(content) {
  if (!content) return { reply: '', actions: [] };
  let text = content.trim();
  // Strip markdown fences if present
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    const obj = JSON.parse(text);
    return {
      reply: typeof obj.reply === 'string' ? obj.reply : '',
      actions: Array.isArray(obj.actions) ? obj.actions : [],
      language: obj.language || 'en'
    };
  } catch (e) {
    // Not JSON — treat whole text as reply
    return { reply: text, actions: [], language: 'en' };
  }
}

/* ── HTTP helpers ──────────────────────────────────────────────────────── */
function sendJson(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

/* ── Request router ────────────────────────────────────────────────────── */
async function handleRequest(req, res) {
  const u = new URL(req.url, 'http://' + HOST + ':' + PORT);
  const p = u.pathname;
  const method = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  try {
    /* Health */
    if (p === '/api/voice/health' && method === 'GET') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'hela-voice-server',
        version: '1.1.0',
        model: QWEN.model,
        provider: QWEN.baseUrl,
        qwenConfigured: !!QWEN.apiKey,
        storage: useSqlite ? 'sqlite' : 'json',
        time: new Date().toISOString()
      });
      return;
    }

    /* Chat */
    if (p === '/api/voice/chat' && method === 'POST') {
      const body = await readBody(req);
      const sessionId = body.sessionId || 'anon';
      const page = body.page || '';
      const context = body.context || '';
      const userText = (body.text || '').trim();
      const history = Array.isArray(body.history) ? body.history : [];

      if (!userText) { sendJson(res, 400, { error: 'text is required' }); return; }

      store.upsertSession(sessionId, { page });
      store.addMessage(sessionId, 'user', userText, { page });

      if (!QWEN.apiKey) {
        store.addAudit({ sessionId, action: 'chat', target: 'qwen', status: 'no-key' });
        sendJson(res, 200, {
          reply: 'The Qwen model is not configured yet. Set QWEN_API_KEY in the server environment (see hela-voice-server.js header) to enable AI responses.',
          actions: [],
          fallback: 'no-key'
        });
        return;
      }

      const messages = [
        { role: 'system', content: buildSystemPrompt(page, context) },
        ...history.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
        { role: 'user', content: userText }
      ];

      try {
        const result = await qwenChat(messages, { jsonMode: true });
        const parsed = parseModelOutput(result.content);
        store.addMessage(sessionId, 'assistant', parsed.reply, { actions: parsed.actions });
        store.addAudit({ sessionId, action: 'chat', target: 'qwen', status: 'ok', detail: userText.slice(0, 120) });
        sendJson(res, 200, {
          reply: parsed.reply,
          actions: parsed.actions,
          language: parsed.language,
          sessionId: sessionId
        });
      } catch (e) {
        store.addAudit({ sessionId, action: 'chat', target: 'qwen', status: 'error', detail: e.message });
        sendJson(res, 502, { error: 'Qwen request failed', detail: e.message });
      }
      return;
    }

    /* Memory */
    if (p === '/api/voice/memory' && method === 'GET') {
      const sessionId = u.searchParams.get('sessionId') || 'anon';
      const limit = parseInt(u.searchParams.get('limit') || '50', 10);
      sendJson(res, 200, { sessionId, messages: store.getMessages(sessionId, limit) });
      return;
    }
    if (p === '/api/voice/memory' && method === 'POST') {
      const body = await readBody(req);
      const sessionId = body.sessionId || 'anon';
      const role = body.role || 'user';
      const content = (body.content || '').trim();
      if (!content) { sendJson(res, 400, { error: 'content is required' }); return; }
      store.addMessage(sessionId, role, content, body.meta || {});
      sendJson(res, 200, { ok: true, sessionId });
      return;
    }
    if (p === '/api/voice/memory' && method === 'DELETE') {
      const sessionId = u.searchParams.get('sessionId') || 'anon';
      store.clearSession(sessionId);
      sendJson(res, 200, { ok: true, cleared: sessionId });
      return;
    }

    /* Sessions */
    if (p === '/api/voice/sessions' && method === 'GET') {
      sendJson(res, 200, { sessions: store.listSessions() });
      return;
    }

    /* Voice config (server-side persistence) */
    if (p === '/api/voice/config' && method === 'GET') {
      sendJson(res, 200, { config: store.getConfig() });
      return;
    }
    if (p === '/api/voice/config' && method === 'POST') {
      const body = await readBody(req);
      const allowed = ['voiceURI', 'pitch', 'rate', 'volume', 'language', 'responseLanguage', 'autoSpeak', 'wakeWordEnabled', 'enabled', 'continuous', 'translationEnabled', 'showTranscript', 'showSubtitles', 'apiBaseUrl', 'model', 'proactiveAlerts'];
      const patch = {};
      allowed.forEach(k => { if (body[k] !== undefined) patch[k] = body[k]; });
      const saved = store.setConfig(patch);
      store.addAudit({ sessionId: body.sessionId || null, action: 'config:save', target: 'voice', status: 'ok' });
      sendJson(res, 200, { ok: true, config: saved });
      return;
    }

    /* Audit */
    if (p === '/api/voice/audit' && method === 'GET') {
      const limit = parseInt(u.searchParams.get('limit') || '100', 10);
      sendJson(res, 200, { audit: store.getAudit(limit) });
      return;
    }

    /* Desktop app download (DMG) */
    if (p === '/download/helacore.dmg' && method === 'GET') {
      if (!fs.existsSync(DMG_PATH)) {
        sendJson(res, 404, { error: 'DMG not built yet', hint: 'Run: cd helacore-desktop && npm run dist' });
        return;
      }
      const stat = fs.statSync(DMG_PATH);
      res.writeHead(200, {
        'Content-Type': 'application/x-apple-diskimage',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="HelaCore-1.0.0.dmg"',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      fs.createReadStream(DMG_PATH).pipe(res);
      return;
    }

    sendJson(res, 404, { error: 'Not found', path: p });
  } catch (e) {
    sendJson(res, 500, { error: 'Server error', detail: e.message });
  }
}

/* ── Start server (HTTP or HTTPS) ──────────────────────────────────────── */
function start() {
  initStorage();

  let server;
  if (HTTPS_ENABLED) {
    if (!CERT_PATH || !KEY_PATH || !fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
      console.error('[HelaVoice] HELA_HTTPS=1 requires HELA_CERT and HELA_KEY pointing to existing files.');
      process.exit(1);
    }
    server = https.createServer({
      cert: fs.readFileSync(CERT_PATH),
      key: fs.readFileSync(KEY_PATH)
    }, handleRequest);
    console.log('[HelaVoice] HTTPS enabled');
  } else {
    server = http.createServer(handleRequest);
  }

  server.listen(PORT, HOST, () => {
    console.log('[HelaVoice] API server listening on ' + (HTTPS_ENABLED ? 'https' : 'http') + '://' + HOST + ':' + PORT);
    console.log('[HelaVoice] Qwen model: ' + QWEN.model + ' | provider: ' + QWEN.baseUrl + ' | key: ' + (QWEN.apiKey ? 'configured' : 'NOT SET'));
    console.log('[HelaVoice] Endpoints: /api/voice/health /chat /memory /sessions /config /audit');
  });

  server.on('error', (e) => {
    console.error('[HelaVoice] Server error:', e.message);
    if (e.code === 'EADDRINUSE') {
      console.error('[HelaVoice] Port ' + PORT + ' in use. Set PORT env to change.');
    }
    if (process.env.HELA_EMBEDDED === '1') {
      // Embedded mode (Electron): do not kill the host process on port conflicts.
      return;
    }
    process.exit(1);
  });
}

if (require.main === module) {
  start();
} else {
  module.exports = { start, PORT, HOST, DATA_DIR, DMG_PATH };
}