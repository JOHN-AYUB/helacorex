/* ============================================================================
 * HelaCore Hela Voice — Hello Hela Hero Voice Layer
 * ----------------------------------------------------------------------------
 * No floating bars. The advanced voice command system lives inside the
 * "Hello Hela" hero section at the top of each dashboard:
 *   • Click-to-talk mic (no holding) — click to start, click to stop
 *   • Live status + transcript + last AI response
 *   • Inline text input (type commands / questions)
 *   • Server status indicator (Hela Voice backend / Qwen)
 *   • Language badge + settings access + open-chat shortcut
 * Also registers page-specific voice commands per dashboard.
 * Depends on: hela-voice-engine.js (window.HelaVoice)
 * ========================================================================== */
(function () {
  'use strict';

  if (window.HelaVoiceWidget) return;
  var W = window.HelaVoiceWidget = {};
  var V = window.HelaVoice;

  /* ── Hero voice layer DOM ──────────────────────────────────────────────── */
  var box = null;
  var micBtn = null;
  var statusEl = null;
  var transcriptEl = null;
  var responseEl = null;
  var inputEl = null;
  var sendBtn = null;
  var serverDot = null;
  var langEl = null;

  /* ── Find the Hello Hela hero section ─────────────────────────────────── */
  function findHero() {
    var hero = document.querySelector('.hela-hero, [class*="hela-hero"]');
    if (hero) return hero;
    var title = document.querySelector('.hh-title');
    if (title) {
      var sec = title.closest('section, .liquid-glass, [class*="hero"]');
      if (sec) return sec;
    }
    return null;
  }

  /* ── Build the voice layer inside the hero ────────────────────────────── */
  function buildHeroVoice() {
    var hero = findHero();
    if (!hero) return false;
    var old = document.getElementById('hh-voice');
    if (old) old.remove();

    box = document.createElement('div');
    box.id = 'hh-voice';
    box.className = 'hh-voice';
    box.innerHTML =
      '<div class="hh-voice-row">' +
      '  <button class="hh-voice-mic" id="hh-voice-mic" title="Click to talk — click again to stop">' +
      '    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>' +
      '    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>' +
      '    </svg><span class="hh-voice-mic-label">Talk</span>' +
      '  </button>' +
      '  <div class="hh-voice-status" id="hh-voice-status">' +
      '    <span class="hh-voice-dot"></span>' +
      '    <span class="hh-voice-status-text">Idle — click the mic or say "Hello Hela"</span>' +
      '  </div>' +
      '  <div class="hh-voice-transcript" id="hh-voice-transcript" aria-live="polite"></div>' +
      '  <div class="hh-voice-response" id="hh-voice-response" aria-live="polite"></div>' +
      '  <div class="hh-voice-input-row">' +
      '    <input type="text" id="hh-voice-input" placeholder="Ask Hela anything…" autocomplete="off">' +
      '    <button class="hh-voice-send" id="hh-voice-send" title="Send">➤</button>' +
      '  </div>' +
      '  <div class="hh-voice-actions">' +
      '    <span class="hh-voice-server-dot" id="hh-voice-server-dot" title="AI server status"></span>' +
      '    <span class="hh-voice-lang" id="hh-voice-lang">AUTO</span>' +
      '    <button class="hh-voice-icon" id="hh-voice-settings" title="Voice settings">⚙</button>' +
      '    <button class="hh-voice-icon" id="hh-voice-chat" title="Open chat">💬</button>' +
      '  </div>' +
      '</div>';

    // Stop hero click (openHelloHela) from firing when using the controls
    box.addEventListener('click', function (e) { e.stopPropagation(); });

    hero.appendChild(box);

    micBtn = document.getElementById('hh-voice-mic');
    statusEl = document.getElementById('hh-voice-status');
    transcriptEl = document.getElementById('hh-voice-transcript');
    responseEl = document.getElementById('hh-voice-response');
    inputEl = document.getElementById('hh-voice-input');
    sendBtn = document.getElementById('hh-voice-send');
    serverDot = document.getElementById('hh-voice-server-dot');
    langEl = document.getElementById('hh-voice-lang');

    bindEvents();
    updateFromConfig();
    return true;
  }

  /* ── Events ────────────────────────────────────────────────────────────── */
  function bindEvents() {
    // Click-to-talk: click to start, click to stop (no holding)
    micBtn.addEventListener('click', function () {
      if (!V.config.enabled) { V.respond('Voice is disabled. Enable it in settings.'); return; }
      if (V.isListening()) {
        V.stopListening();
        micBtn.classList.remove('active');
        setMicLabel('Talk');
      } else {
        V.startListening();
        micBtn.classList.add('active');
        setMicLabel('Stop');
      }
    });

    // Text input: Enter submits
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submitText();
    });
    sendBtn.addEventListener('click', submitText);

    // Settings
    document.getElementById('hh-voice-settings').addEventListener('click', openSettings);

    // Open the full chat panel
    document.getElementById('hh-voice-chat').addEventListener('click', function () {
      if (typeof openHelloHela === 'function') openHelloHela();
      else if (typeof window.openHelloHela === 'function') window.openHelloHela();
    });

    // Engine events
    V.on('state:changed', onStateChanged);
    V.on('transcript:partial', onTranscript);
    V.on('response', onResponse);
    V.on('config:changed', updateFromConfig);
    V.on('listening:started', function () { setStatus('Listening… speak now', 'listening'); setMicLabel('Stop'); micBtn.classList.add('active'); });
    V.on('listening:stopped', function () { setStatus('Idle — click the mic or say "Hello Hela"', 'idle'); setMicLabel('Talk'); micBtn.classList.remove('active'); });
    V.on('listening:error', function (d) {
      setStatus('Mic error: ' + d.error, 'error');
      micBtn.classList.remove('active');
      setMicLabel('Talk');
    });
    V.on('wake:detected', function () { setStatus('Wake word detected', 'wake'); });
    V.on('translation:applied', function (d) {
      if (d.lang !== 'en' && d.original !== d.translated) {
        appendTranscript('(' + d.lang + ') ' + d.original + ' → ' + d.translated, 'translation');
      }
    });
    V.on('server:status', function (d) {
      if (serverDot) {
        serverDot.classList.toggle('online', !!d.online);
        serverDot.title = d.online ? 'AI server online' : 'AI server offline';
      }
    });
    V.on('ai:thinking', function () { setStatus('Asking Hela AI…', 'thinking'); });
    V.on('ai:response', function () { setStatus('Done', 'completed'); });
  }

  function setMicLabel(t) {
    var l = micBtn.querySelector('.hh-voice-mic-label');
    if (l) l.textContent = t;
  }

  function submitText() {
    var text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    appendTranscript(text, 'user');
    V.processCommand(text);
  }

  /* ── Status / transcript / response ───────────────────────────────────── */
  function setStatus(text, cls) {
    if (!statusEl) return;
    statusEl.className = 'hh-voice-status ' + (cls || 'idle');
    var t = statusEl.querySelector('.hh-voice-status-text');
    if (t) t.textContent = text;
  }

  function appendTranscript(text, cls) {
    if (!transcriptEl || !V.config.showTranscript) return;
    var line = document.createElement('div');
    line.className = 'hh-voice-transcript-line ' + (cls || '');
    line.textContent = text;
    transcriptEl.appendChild(line);
    while (transcriptEl.children.length > 5) transcriptEl.removeChild(transcriptEl.firstChild);
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  function onTranscript(d) {
    if (!V.config.showTranscript) return;
    var text = d.final || d.text;
    if (!text) return;
    if (!d.final) {
      var lines = transcriptEl.querySelectorAll('.hh-voice-transcript-line.interim');
      if (lines.length) lines[lines.length - 1].textContent = text;
      else appendTranscript(text, 'interim');
    } else {
      var interim = transcriptEl.querySelectorAll('.hh-voice-transcript-line.interim');
      interim.forEach(function (el) { el.remove(); });
      appendTranscript(text, 'user');
    }
  }

  function onResponse(d) {
    if (!responseEl) return;
    responseEl.textContent = d.text;
    responseEl.classList.add('visible');
    if (V.config.showSubtitles) appendTranscript('Hela: ' + d.text, 'hela');
  }

  function onStateChanged(d) {
    var map = {
      IDLE: ['Idle', 'idle'], LISTENING: ['Listening…', 'listening'],
      THINKING: ['Thinking…', 'thinking'], ASKING: ['Need clarification', 'asking'],
      EXECUTING: ['Executing…', 'executing'], SPEAKING: ['Speaking…', 'speaking'],
      COMPLETED: ['Done', 'completed'], FAILED: ['Failed', 'error'],
      WAITING_EXTERNAL: ['Contacting AI…', 'waiting'], AWAITING_APPROVAL: ['Awaiting approval', 'approval'],
      HANDOFF: ['Handing off…', 'handoff'], CANCELLED: ['Cancelled', 'idle']
    };
    var m = map[d.state];
    if (m) setStatus(m[0], m[1]);
  }

  /* ── Settings navigation ──────────────────────────────────────────────── */
  function openSettings() {
    var here = window.location.href;
    if (here.indexOf('settings') !== -1) {
      if (typeof switchSettingsTab === 'function') {
        switchSettingsTab('voice', document.querySelector('[data-tab="voice"]'));
        return;
      }
    }
    window.location.href = 'settings dashboard.html#voice';
  }

  /* ── Config sync ──────────────────────────────────────────────────────── */
  function updateFromConfig() {
    if (!V.config) return;
    if (langEl) {
      var names = { auto: 'AUTO', en: 'EN', sw: 'SW', sheng: 'SHENG' };
      langEl.textContent = names[V.config.language] || V.config.language.toUpperCase();
    }
    if (!V.config.enabled) {
      setStatus('Voice disabled', 'idle');
      micBtn.classList.add('disabled');
    } else {
      micBtn.classList.remove('disabled');
    }
  }

  /* ── Page-specific commands (registered per dashboard) ────────────────── */
  function registerPageCommands() {
    var page = '';
    try { page = decodeURIComponent(window.location.pathname.split('/').pop() || '').toLowerCase(); }
    catch (e) { page = (window.location.pathname.split('/').pop() || '').toLowerCase(); }

    // ── AI Agents dashboard ──
    if (page.indexOf('ai agents') !== -1) {
      V.registerCommand({
        id: 'agents-count', category: 'agents', risk: 0,
        keywords: ['how many agents', 'agent count', 'number of agents', 'total agents', 'count agents', 'how many agents do i have', 'agents do i have', 'wakala wangapi', 'wangapi'],
        minScore: 2,
        handler: function () {
          var count = V.readText('#registryCount, #agentCount, #totalAgents, .agent-count, [data-agent-count]');
          if (count) { V.respond('There are ' + count + ' agents in the registry.'); return true; }
          var cards = V.$$('.agent-card, .agent-item, [class*="agent-card"]').length;
          if (cards) { V.respond('There are ' + cards + ' agents on this page.'); return true; }
          return false;
        }
      });
      V.registerCommand({
        id: 'agents-filter-category', category: 'agents', risk: 0,
        keywords: ['show agents in', 'filter by category', 'agents in the', 'show category', 'filter agents', 'show the agents in', 'filter the agents'],
        minScore: 2,
        handler: function (text) {
          var m = text.match(/(?:show agents in|show the agents in|filter by category|filter the agents|agents in the|show category|filter agents)\s+(.+)/i);
          if (m) {
            var cat = m[1].replace(/\b(category|please|now)\b/gi, '').replace(/^(the|a|an)\s+/i, '').trim();
            var sel = document.getElementById('filterCategory') || document.querySelector('[data-category-filter], #categoryFilter, .category-filter');
            if (sel) {
              var matched = false;
              for (var i = 0; i < sel.options.length; i++) {
                if (sel.options[i].text.toLowerCase().indexOf(cat.toLowerCase()) !== -1) {
                  sel.selectedIndex = i;
                  matched = true;
                  break;
                }
              }
              if (!matched) sel.value = cat;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              if (typeof window.renderRegistry === 'function') window.renderRegistry();
              V.respond('Showing agents in ' + cat + '.');
              return true;
            }
          }
          return false;
        }
      });
      V.registerCommand({
        id: 'agents-search', category: 'agents', risk: 0,
        keywords: ['find agent', 'search agent', 'agent named', 'look for agent', 'find the agent', 'search for agent'],
        minScore: 2,
        handler: function (text) {
          var m = text.match(/(?:find agent|find the agent|search agent|search for agent|agent named|look for agent)\s+(.+)/i);
          if (m) {
            var name = m[1].replace(/\b(please|now)\b/gi, '').trim();
            var input = document.getElementById('agentSearch') || V.$('#searchInput, input[placeholder*="search" i]');
            if (input) {
              input.value = name;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              if (typeof window.renderRegistry === 'function') window.renderRegistry();
              V.respond('Searching for agent ' + name + '.');
              return true;
            }
          }
          return false;
        }
      });
      V.registerCommand({
        id: 'agents-hierarchy', category: 'agents', risk: 0,
        keywords: ['show hierarchy', 'show the hierarchy', 'hierarchy view', 'show org chart', 'org chart', 'show structure', 'show the structure', 'hierarchy'],
        minScore: 2,
        handler: function (text) {
          var layer = null;
          if (/executive/.test(text)) layer = 'executive';
          else if (/departmental|department/.test(text)) layer = 'departmental';
          else if (/control/.test(text)) layer = 'control';
          else if (/specialist/.test(text)) layer = 'specialist';
          if (typeof window.setRegistryView === 'function') window.setRegistryView('hierarchy');
          if (layer && typeof window.hierarchyFilter === 'function') window.hierarchyFilter(layer);
          else if (typeof window.hierarchyFilter === 'function') window.hierarchyFilter('all');
          V.respond('Showing the agent hierarchy' + (layer ? ' — ' + layer + ' layer' : '') + '.');
          return true;
        }
      });
      V.registerCommand({
        id: 'agents-grid', category: 'agents', risk: 0,
        keywords: ['show grid', 'grid view', 'show the grid', 'show list', 'list view', 'show the list'],
        minScore: 2,
        handler: function (text) {
          var view = /list/.test(text) ? 'list' : 'grid';
          if (typeof window.setRegistryView === 'function') window.setRegistryView(view);
          V.respond('Showing the ' + view + ' view.');
          return true;
        }
      });
      V.registerCommand({
        id: 'agents-clear-filter', category: 'agents', risk: 0,
        keywords: ['clear filter', 'show all agents', 'reset filter', 'show everything', 'all agents'],
        minScore: 2,
        handler: function () {
          var sel = document.getElementById('filterCategory');
          if (sel) { sel.selectedIndex = 0; sel.dispatchEvent(new Event('change', { bubbles: true })); }
          var input = document.getElementById('agentSearch');
          if (input) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
          if (typeof window.renderRegistry === 'function') window.renderRegistry();
          V.respond('Showing all agents.');
          return true;
        }
      });
    }

    // ── Financial overview ──
    if (page.indexOf('financial') !== -1 || page.indexOf('overview') !== -1) {
      V.registerCommand({
        id: 'fin-revenue', category: 'finance', risk: 0,
        keywords: ['what is revenue', 'show revenue', 'total revenue', 'revenue'],
        minScore: 2,
        handler: function () {
          var el = V.findValue(['revenue']);
          if (el) { V.respond('Revenue is ' + el.textContent.trim() + '.'); return true; }
          return false;
        }
      });
      V.registerCommand({
        id: 'fin-expenses', category: 'finance', risk: 0,
        keywords: ['what are expenses', 'show expenses', 'total expenses', 'expenses'],
        minScore: 2,
        handler: function () {
          var el = V.findValue(['expense', 'expenses', 'spending']);
          if (el) { V.respond('Expenses are ' + el.textContent.trim() + '.'); return true; }
          return false;
        }
      });
      V.registerCommand({
        id: 'fin-profit', category: 'finance', risk: 0,
        keywords: ['what is profit', 'show profit', 'net profit', 'profit'],
        minScore: 2,
        handler: function () {
          var el = V.findValue(['profit', 'net-profit']);
          if (el) { V.respond('Profit is ' + el.textContent.trim() + '.'); return true; }
          return false;
        }
      });
      V.registerCommand({
        id: 'fin-balance', category: 'finance', risk: 0,
        keywords: ['what is my balance', 'show balance', 'account balance', 'balance', 'salio'],
        minScore: 2,
        handler: function () {
          var el = V.findValue(['balance', 'salio']);
          if (el) { V.respond('Your balance is ' + el.textContent.trim() + '.'); return true; }
          return false;
        }
      });
    }

    // ── Money dashboard ──
    if (page.indexOf('money') !== -1) {
      V.registerCommand({
        id: 'money-balance', category: 'finance', risk: 0,
        keywords: ['what is my balance', 'show balance', 'account balance', 'balance', 'salio', 'pesa zangu', 'salio langu'],
        minScore: 2,
        handler: function () {
          var el = V.findValue(['balance', 'salio', 'kpiBalance']);
          if (el) { V.respond('Your balance is ' + el.textContent.trim() + '.'); return true; }
          return false;
        }
      });
      V.registerCommand({
        id: 'money-send', category: 'finance', risk: 1,
        keywords: ['send money', 'tuma pesa', 'transfer money', 'send to'],
        minScore: 2,
        handler: function (text) {
          var m = text.match(/(?:send|transfer)\s+(?:money\s+)?(?:to\s+)?(.+)/i);
          if (m) {
            var target = m[1].replace(/\b(please|now)\b/gi, '').trim();
            var input = V.$('input[placeholder*="phone" i], input[placeholder*="number" i], #recipient, #sendTo');
            if (input) {
              input.value = target;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              V.respond('Recipient set to ' + target + '. Please confirm the amount.');
              return true;
            }
          }
          return false;
        }
      });
    }

    // ── Inventory ──
    if (page.indexOf('inventory') !== -1) {
      V.registerCommand({
        id: 'inv-low-stock', category: 'inventory', risk: 0,
        keywords: ['low stock', 'low inventory', 'out of stock', 'stock levels', 'show stock'],
        minScore: 2,
        handler: function () {
          var rows = V.$$('tr, .stock-item, .inventory-row');
          var low = [];
          rows.forEach(function (r) {
            var t = (r.textContent || '').toLowerCase();
            if (/low|out of stock|reorder|critical/.test(t) && r.textContent.length < 300) low.push(r.textContent.trim().slice(0, 80));
          });
          if (low.length) {
            V.respond('Found ' + low.length + ' low stock items. ' + low.slice(0, 3).join('. '));
            return true;
          }
          return false;
        }
      });
    }

    // ── Customers ──
    if (page.indexOf('customer') !== -1) {
      V.registerCommand({
        id: 'cust-count', category: 'customers', risk: 0,
        keywords: ['how many customers', 'customer count', 'total customers', 'number of customers'],
        minScore: 2,
        handler: function () {
          var el = V.$('[data-customers], #customerCount, .customer-count, [class*="customer-count"]');
          if (el) { V.respond('You have ' + el.textContent.trim() + ' customers.'); return true; }
          var rows = V.$$('tr, .customer-row, .customer-card').length;
          if (rows) { V.respond('There are ' + rows + ' customers listed.'); return true; }
          return false;
        }
      });
    }

    // ── Transactions ──
    if (page.indexOf('transaction') !== -1) {
      V.registerCommand({
        id: 'txn-recent', category: 'finance', risk: 0,
        keywords: ['recent transactions', 'show transactions', 'latest transactions', 'transactions'],
        minScore: 2,
        handler: function () {
          var rows = V.$$('tr, .transaction-row, .txn-item');
          if (rows.length) {
            var first = rows.slice(0, 3).map(function (r) { return r.textContent.trim().replace(/\s+/g, ' ').slice(0, 60); });
            V.respond('Recent transactions: ' + first.join('. '));
            return true;
          }
          return false;
        }
      });
    }

    // ── Reports ──
    if (page.indexOf('report') !== -1) {
      V.registerCommand({
        id: 'report-generate', category: 'reports', risk: 1,
        keywords: ['generate report', 'create report', 'make report', 'run report', 'produce report'],
        minScore: 2,
        handler: function () {
          if (V.click('#generateReportBtn') || V.click('[data-action="generate-report"]') || V.clickByText('Generate Report')) {
            V.respond('Generating the report.');
            return true;
          }
          return false;
        }
      });
    }

    // ── AI Studio ──
    if (page.indexOf('ai studio') !== -1) {
      V.registerCommand({
        id: 'studio-create', category: 'ai', risk: 1,
        keywords: ['create agent', 'new agent', 'build agent', 'make an agent'],
        minScore: 2,
        handler: function () {
          if (V.click('#createAgentBtn') || V.click('[data-action="create-agent"]') || V.clickByText('Create Agent')) {
            V.respond('Opening the agent creator.');
            return true;
          }
          return false;
        }
      });
    }

    // ── Ask Hela ──
    if (page.indexOf('ask hela') !== -1) {
      V.registerCommand({
        id: 'ask-question', category: 'ai', risk: 0,
        keywords: ['ask hela', 'question', 'i want to ask'],
        minScore: 2,
        handler: function (text) {
          var m = text.match(/(?:ask hela|question)\s+(.+)/i);
          if (m) {
            var q = m[1].trim();
            var input = V.$('#helaQuestion, #questionInput, textarea, input[type="text"]');
            if (input) {
              input.value = q;
              input.dispatchEvent(new Event('input', { bubbles: true }));
              if (V.click('#askBtn') || V.click('[data-action="ask"]') || V.clickByText('Ask')) {
                V.respond('Asking Hela: ' + q);
                return true;
              }
              V.respond('Question set: ' + q);
              return true;
            }
          }
          return false;
        }
      });
    }

    // ── AI Simulations ──
    if (page.indexOf('simulation') !== -1) {
      V.registerCommand({
        id: 'sim-run', category: 'ai', risk: 1,
        keywords: ['run simulation', 'start simulation', 'simulate', 'what if'],
        minScore: 2,
        handler: function () {
          if (V.click('#runSimBtn') || V.click('[data-action="run-simulation"]') || V.clickByText('Run Simulation')) {
            V.respond('Running the simulation.');
            return true;
          }
          return false;
        }
      });
    }

    // ── Market intelligence ──
    if (page.indexOf('market') !== -1) {
      V.registerCommand({
        id: 'market-trends', category: 'market', risk: 0,
        keywords: ['market trends', 'show trends', 'market intelligence', 'trends'],
        minScore: 2,
        handler: function () {
          var el = V.findValue(['trend']);
          if (el) { V.respond('Market trend: ' + el.textContent.trim() + '.'); return true; }
          return false;
        }
      });
    }

    // ── Projects ──
    if (page.indexOf('project') !== -1) {
      V.registerCommand({
        id: 'proj-status', category: 'projects', risk: 0,
        keywords: ['project status', 'show projects', 'project progress', 'projects'],
        minScore: 2,
        handler: function () {
          var rows = V.$$('.project-card, .project-row, tr');
          if (rows.length) {
            var first = rows.slice(0, 3).map(function (r) { return r.textContent.trim().replace(/\s+/g, ' ').slice(0, 60); });
            V.respond('Projects: ' + first.join('. '));
            return true;
          }
          return false;
        }
      });
    }

    // ── Suppliers ──
    if (page.indexOf('supplier') !== -1) {
      V.registerCommand({
        id: 'supp-count', category: 'suppliers', risk: 0,
        keywords: ['how many suppliers', 'supplier count', 'total suppliers'],
        minScore: 2,
        handler: function () {
          var el = V.$('[data-suppliers], #supplierCount, .supplier-count');
          if (el) { V.respond('You have ' + el.textContent.trim() + ' suppliers.'); return true; }
          var rows = V.$$('tr, .supplier-row, .supplier-card').length;
          if (rows) { V.respond('There are ' + rows + ' suppliers listed.'); return true; }
          return false;
        }
      });
    }

    // ── HelaBank ──
    if (page.indexOf('helabank') !== -1) {
      V.registerCommand({
        id: 'bank-balance', category: 'finance', risk: 0,
        keywords: ['bank balance', 'account balance', 'helabank balance', 'salio', 'what is my balance', 'show balance'],
        minScore: 2,
        handler: function () {
          var el = V.findValue(['balance', 'salio', 'kpiBalance']);
          if (el) { V.respond('Your HelaBank balance is ' + el.textContent.trim() + '.'); return true; }
          return false;
        }
      });
      V.registerCommand({
        id: 'bank-loan', category: 'finance', risk: 1,
        keywords: ['apply for loan', 'loan application', 'request loan', 'mkopo'],
        minScore: 2,
        handler: function () {
          if (V.click('#applyLoanBtn') || V.click('[data-action="apply-loan"]') || V.clickByText('Apply for Loan')) {
            V.respond('Opening the loan application.');
            return true;
          }
          return false;
        }
      });
    }

    // ── Loan & Financing ──
    if (page.indexOf('loan') !== -1) {
      V.registerCommand({
        id: 'loan-eligibility', category: 'finance', risk: 0,
        keywords: ['loan eligibility', 'am i eligible', 'check eligibility', 'loan limit'],
        minScore: 2,
        handler: function () {
          var el = V.findValue(['eligibility']);
          if (el) { V.respond('Your loan eligibility: ' + el.textContent.trim() + '.'); return true; }
          return false;
        }
      });
    }

    // ── Opportunities ──
    if (page.indexOf('opportunit') !== -1) {
      V.registerCommand({
        id: 'opp-count', category: 'opportunities', risk: 0,
        keywords: ['how many opportunities', 'opportunity count', 'total opportunities', 'opportunities'],
        minScore: 2,
        handler: function () {
          var el = V.$('[data-opportunities], #opportunityCount, .opportunity-count');
          if (el) { V.respond('You have ' + el.textContent.trim() + ' opportunities.'); return true; }
          var rows = V.$$('.opportunity-card, .opportunity-row, tr').length;
          if (rows) { V.respond('There are ' + rows + ' opportunities listed.'); return true; }
          return false;
        }
      });
    }

    // ── AI Advisor ──
    if (page.indexOf('advisor') !== -1) {
      V.registerCommand({
        id: 'advisor-advice', category: 'ai', risk: 0,
        keywords: ['advice', 'recommendation', 'what should i do', 'advisor'],
        minScore: 2,
        handler: function () {
          var el = V.findValue(['advice']);
          if (el) { V.respond('Advice: ' + el.textContent.trim().slice(0, 200)); return true; }
          return false;
        }
      });
    }

    // ── HelaOne ──
    if (page.indexOf('helaone') !== -1) {
      V.registerCommand({
        id: 'one-overview', category: 'system', risk: 0,
        keywords: ['helaone overview', 'show helaone', 'helaone summary', 'overview'],
        minScore: 2,
        handler: function () {
          var el = V.findValue(['overview']);
          if (el) { V.respond('HelaOne overview: ' + el.textContent.trim().slice(0, 200)); return true; }
          return false;
        }
      });
    }

    // ── Dashboard (home) ──
    if (page === 'dashboard.html' || page === 'index.html' || page === '') {
      V.registerCommand({
        id: 'home-summary', category: 'system', risk: 0,
        keywords: ['dashboard summary', 'show summary', 'overview', 'what is happening', 'summary'],
        minScore: 2,
        handler: function () {
          var stats = V.$$('[class*="stat"], [class*="metric"], .card .value, .stat-value');
          if (stats.length) {
            var parts = stats.slice(0, 5).map(function (el) { return el.textContent.trim().replace(/\s+/g, ' ').slice(0, 40); });
            V.respond('Dashboard summary: ' + parts.join('. '));
            return true;
          }
          return false;
        }
      });
    }
  }

  /* ── Public API ───────────────────────────────────────────────────────── */
  W.setStatus = setStatus;
  W.submitText = submitText;
  W.isMounted = function () { return !!box; };

  /* ── Init ─────────────────────────────────────────────────────────────── */
  function init() {
    if (!V) { console.error('Hela Voice engine not loaded before widget.'); return; }
    buildHeroVoice();
    registerPageCommands();
    V.emit('widget:ready');
    V.log('Hela Voice hero layer ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();