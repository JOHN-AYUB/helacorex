/* ============================================================================
 * HelaCore Hela Voice — Settings Panel Controller
 * ----------------------------------------------------------------------------
 * Populates and wires the "Voice" tab in settings dashboard.html.
 * Depends on: hela-voice-engine.js (window.HelaVoice)
 * ========================================================================== */
(function () {
  'use strict';

  if (window.HelaVoiceSettings) return;
  var S = window.HelaVoiceSettings = {};
  var V = window.HelaVoice;

  /* ── Build the Voice tab content ──────────────────────────────────────── */
  function buildVoiceTab() {
    var tab = document.getElementById('tab-voice');
    if (!tab) return false;
    if (tab.getAttribute('data-voice-built') === 'true') return true;

    tab.setAttribute('data-voice-built', 'true');
    tab.innerHTML =
      '<div class="voice-settings-wrap">' +
      '  <div class="voice-settings-header">' +
      '    <div class="voice-settings-logo">H</div>' +
      '    <div>' +
      '      <h3>Hela Voice</h3>' +
      '      <p>Real-Time Language Fabric — control HelaCore with your voice in English, Swahili, Sheng and 70+ languages.</p>' +
      '    </div>' +
      '  </div>' +

      '  <div class="voice-settings-section">' +
      '    <h4>General</h4>' +
      '    <label class="voice-toggle-row">' +
      '      <span><strong>Enable Hela Voice</strong><small>Master switch for the voice assistant</small></span>' +
      '      <input type="checkbox" id="vs-enabled" class="voice-toggle">' +
      '    </label>' +
      '    <label class="voice-toggle-row">' +
      '      <span><strong>Wake word</strong><small>Activate by saying "Hello Hela" or "Hela"</small></span>' +
      '      <input type="checkbox" id="vs-wake" class="voice-toggle">' +
      '    </label>' +
      '    <label class="voice-toggle-row">' +
      '      <span><strong>Continuous listening</strong><small>Keep listening after each command</small></span>' +
      '      <input type="checkbox" id="vs-continuous" class="voice-toggle">' +
      '    </label>' +
      '    <label class="voice-toggle-row">' +
      '      <span><strong>Speak responses aloud</strong><small>Voice replies with text-to-speech</small></span>' +
      '      <input type="checkbox" id="vs-autospeak" class="voice-toggle">' +
      '    </label>' +
      '    <label class="voice-toggle-row">' +
      '      <span><strong>Show transcript</strong><small>Display speech transcript in the widget</small></span>' +
      '      <input type="checkbox" id="vs-transcript" class="voice-toggle">' +
      '    </label>' +
      '    <label class="voice-toggle-row">' +
      '      <span><strong>Translation</strong><small>Translate Swahili / Sheng commands to English</small></span>' +
      '      <input type="checkbox" id="vs-translation" class="voice-toggle">' +
      '    </label>' +
      '  </div>' +

      '  <div class="voice-settings-section">' +
      '    <h4>Language</h4>' +
      '    <div class="voice-field-row">' +
      '      <label for="vs-language">Recognition language</label>' +
      '      <select id="vs-language">' +
      '        <option value="auto">Auto-detect (recommended)</option>' +
      '        <option value="en">English</option>' +
      '        <option value="sw">Swahili (Kiswahili)</option>' +
      '        <option value="sheng">Sheng (Kenyan slang)</option>' +
      '        <option value="fr">French</option>' +
      '        <option value="es">Spanish</option>' +
      '        <option value="de">German</option>' +
      '        <option value="ar">Arabic</option>' +
      '        <option value="hi">Hindi</option>' +
      '        <option value="zh">Chinese</option>' +
      '        <option value="am">Amharic</option>' +
      '        <option value="so">Somali</option>' +
      '        <option value="rw">Kinyarwanda</option>' +
      '        <option value="lg">Luganda</option>' +
      '        <option value="swa">Swahili (East Africa)</option>' +
      '      </select>' +
      '    </div>' +
      '    <div class="voice-field-row">' +
      '      <label for="vs-response-lang">Response language</label>' +
      '      <select id="vs-response-lang">' +
      '        <option value="auto">Same as input</option>' +
      '        <option value="en">English</option>' +
      '        <option value="sw">Swahili</option>' +
      '        <option value="sheng">Sheng</option>' +
      '      </select>' +
      '    </div>' +
      '  </div>' +

      '  <div class="voice-settings-section">' +
      '    <h4>Voice &amp; Speech</h4>' +
      '    <div class="voice-field-row">' +
      '      <label for="vs-voice">Voice</label>' +
      '      <select id="vs-voice"><option value="">System default</option></select>' +
      '    </div>' +
      '    <div class="voice-field-row">' +
      '      <label for="vs-pitch">Pitch <span id="vs-pitch-val">1.0</span></label>' +
      '      <input type="range" id="vs-pitch" min="0.5" max="2" step="0.1" value="1">' +
      '    </div>' +
      '    <div class="voice-field-row">' +
      '      <label for="vs-rate">Speed <span id="vs-rate-val">1.0</span></label>' +
      '      <input type="range" id="vs-rate" min="0.5" max="2" step="0.1" value="1">' +
      '    </div>' +
      '    <div class="voice-field-row">' +
      '      <label for="vs-volume">Volume <span id="vs-volume-val">1.0</span></label>' +
      '      <input type="range" id="vs-volume" min="0" max="1" step="0.1" value="1">' +
      '    </div>' +
      '    <div class="voice-settings-actions">' +
      '      <button class="voice-test-btn" id="vs-test-voice">Test voice</button>' +
      '      <button class="voice-test-btn" id="vs-save-server">Save voice to server</button>' +
      '    </div>' +
      '    <p class="voice-note" id="vs-save-status"></p>' +
      '  </div>' +

      '  <div class="voice-settings-section">' +
      '    <h4>AI Backend (Qwen)</h4>' +
      '    <div class="voice-field-row">' +
      '      <label for="vs-server-url">Voice server URL</label>' +
      '      <input type="text" id="vs-server-url" placeholder="http://127.0.0.1:8787" class="voice-text-input">' +
      '    </div>' +
      '    <div class="voice-field-row">' +
      '      <label for="vs-model">Qwen model</label>' +
      '      <select id="vs-model">' +
      '        <option value="qwen-plus">qwen-plus (recommended)</option>' +
      '        <option value="qwen-max">qwen-max (best quality)</option>' +
      '        <option value="qwen-turbo">qwen-turbo (fastest)</option>' +
      '        <option value="qwen2.5-72b-instruct">qwen2.5-72b-instruct</option>' +
      '        <option value="qwen2.5-7b-instruct">qwen2.5-7b-instruct</option>' +
      '      </select>' +
      '    </div>' +
      '    <div class="voice-field-row">' +
      '      <label for="vs-qwen-key">Qwen API key (server-side, optional here)</label>' +
      '      <input type="password" id="vs-qwen-key" placeholder="sk-…" class="voice-text-input">' +
      '    </div>' +
      '    <p class="voice-note" id="vs-server-status">Checking server…</p>' +
      '  </div>' +

      '  <div class="voice-settings-section">' +
      '    <h4>API Integration</h4>' +
      '    <div class="voice-field-row">' +
      '      <label for="vs-api-url">API base URL (optional)</label>' +
      '      <input type="text" id="vs-api-url" placeholder="https://api.yourbackend.com" class="voice-text-input">' +
      '    </div>' +
      '    <div class="voice-field-row">' +
      '      <label for="vs-api-key">API key (optional, stored locally)</label>' +
      '      <input type="password" id="vs-api-key" placeholder="••••••••" class="voice-text-input">' +
      '    </div>' +
      '    <p class="voice-note">Used for advanced HTTP/HTTPS integration. Keys are stored only in your browser (localStorage).</p>' +
      '  </div>' +

      '  <div class="voice-settings-section">' +
      '    <h4>Command history &amp; audit</h4>' +
      '    <div class="voice-history" id="vs-history">' +
      '      <p class="voice-note">No commands yet. Say "Hello Hela" and try a command.</p>' +
      '    </div>' +
      '    <div class="voice-settings-actions">' +
      '      <button class="voice-clear-btn" id="vs-clear-history">Clear history</button>' +
      '      <button class="voice-clear-btn" id="vs-clear-memory">Clear memory</button>' +
      '      <button class="voice-reset-btn" id="vs-reset">Reset all settings</button>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    wireEvents();
    loadValues();
    return true;
  }

  /* ── Wire events ──────────────────────────────────────────────────────── */
  function wireEvents() {
    var $ = function (id) { return document.getElementById(id); };

    $('vs-enabled').addEventListener('change', function () { V.updateConfig({ enabled: this.checked }); });
    $('vs-wake').addEventListener('change', function () { V.updateConfig({ wakeWordEnabled: this.checked }); });
    $('vs-continuous').addEventListener('change', function () { V.updateConfig({ continuous: this.checked }); });
    $('vs-autospeak').addEventListener('change', function () { V.updateConfig({ autoSpeak: this.checked }); });
    $('vs-transcript').addEventListener('change', function () { V.updateConfig({ showTranscript: this.checked }); });
    $('vs-translation').addEventListener('change', function () { V.updateConfig({ translationEnabled: this.checked }); });

    $('vs-language').addEventListener('change', function () { V.updateConfig({ language: this.value }); });
    $('vs-response-lang').addEventListener('change', function () { V.updateConfig({ responseLanguage: this.value }); });

    $('vs-voice').addEventListener('change', function () { V.updateConfig({ voiceURI: this.value }); });

    $('vs-pitch').addEventListener('input', function () {
      $('vs-pitch-val').textContent = this.value;
      V.updateConfig({ pitch: parseFloat(this.value) });
    });
    $('vs-rate').addEventListener('input', function () {
      $('vs-rate-val').textContent = this.value;
      V.updateConfig({ rate: parseFloat(this.value) });
    });
    $('vs-volume').addEventListener('input', function () {
      $('vs-volume-val').textContent = this.value;
      V.updateConfig({ volume: parseFloat(this.value) });
    });

    $('vs-test-voice').addEventListener('click', function () {
      V.speak('Habari! Hello! This is Hela Voice. I can speak English, Swahili and Sheng.');
    });

    // Save voice customization to the server (persisted across browsers)
    $('vs-save-server').addEventListener('click', function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Saving…';
      V.saveConfigToServer().then(function (res) {
        btn.disabled = false;
        btn.textContent = 'Save voice to server';
        var st = document.getElementById('vs-save-status');
        if (st) {
          st.textContent = res && res.ok ? '✓ Voice saved to server. It will be used on every device.' : '✗ Could not reach the server. Is hela-voice-server.js running?';
          st.style.color = res && res.ok ? '#22c55e' : '#f87171';
        }
      });
    });

    // Server URL
    $('vs-server-url').addEventListener('change', function () {
      V.updateConfig({ serverUrl: this.value.trim() || 'http://127.0.0.1:8787' });
      checkServerStatus();
    });

    // Qwen model (stored locally; server uses QWEN_MODEL env by default)
    $('vs-model').addEventListener('change', function () {
      V.updateConfig({ model: this.value });
    });

    // Qwen key (stored locally only as a convenience hint)
    $('vs-qwen-key').addEventListener('change', function () {
      V.updateConfig({ qwenKey: this.value.trim() });
    });

    $('vs-api-url').addEventListener('change', function () { V.updateConfig({ apiBaseUrl: this.value.trim() }); });
    $('vs-api-key').addEventListener('change', function () { V.updateConfig({ apiKey: this.value.trim() }); });

    $('vs-clear-history').addEventListener('click', function () {
      try { localStorage.removeItem('helacore-voice-audit'); } catch (e) {}
      renderHistory();
      V.respond('Command history cleared.', { speak: false });
    });
    $('vs-clear-memory').addEventListener('click', function () {
      V.clearMemory();
      V.clearServerMemory();
      V.respond('Memory cleared.', { speak: false });
    });
    $('vs-reset').addEventListener('click', function () {
      if (confirm('Reset all Hela Voice settings to defaults?')) {
        V.resetConfig();
        loadValues();
        V.respond('Voice settings reset to defaults.', { speak: false });
      }
    });

    // Refresh history when audit changes
    V.on('audit:changed', renderHistory);
  }

  /* ── Server status check ──────────────────────────────────────────────── */
  function checkServerStatus() {
    var el = document.getElementById('vs-server-status');
    if (!el) return;
    el.textContent = 'Checking server…';
    el.style.color = '';
    fetch((V.config.serverUrl || 'http://127.0.0.1:8787') + '/api/voice/health', { method: 'GET' })
      .then(function (res) { return res.json(); })
      .then(function (d) {
        if (d && d.status === 'ok') {
          el.textContent = '✓ Server online — model: ' + d.model + ' | storage: ' + d.storage + (d.qwenConfigured ? ' | Qwen key: configured' : ' | Qwen key: NOT SET (set QWEN_API_KEY on the server)');
          el.style.color = '#22c55e';
        } else {
          el.textContent = '✗ Server responded but is unhealthy.';
          el.style.color = '#f87171';
        }
      })
      .catch(function () {
        el.textContent = '✗ Server offline. Start it with: node hela-voice-server.js';
        el.style.color = '#f87171';
      });
  }

  /* ── Load values from config ──────────────────────────────────────────── */
  function loadValues() {
    if (!V.config) return;
    var $ = function (id) { return document.getElementById(id); };
    var c = V.config;

    $('vs-enabled').checked = c.enabled;
    $('vs-wake').checked = c.wakeWordEnabled;
    $('vs-continuous').checked = c.continuous;
    $('vs-autospeak').checked = c.autoSpeak;
    $('vs-transcript').checked = c.showTranscript;
    $('vs-translation').checked = c.translationEnabled;

    $('vs-language').value = c.language || 'auto';
    $('vs-response-lang').value = c.responseLanguage || 'auto';

    $('vs-pitch').value = c.pitch;
    $('vs-pitch-val').textContent = c.pitch;
    $('vs-rate').value = c.rate;
    $('vs-rate-val').textContent = c.rate;
    $('vs-volume').value = c.volume;
    $('vs-volume-val').textContent = c.volume;

    $('vs-server-url').value = c.serverUrl || 'http://127.0.0.1:8787';
    $('vs-model').value = c.model || 'qwen-plus';
    $('vs-qwen-key').value = c.qwenKey || '';

    $('vs-api-url').value = c.apiBaseUrl || '';
    $('vs-api-key').value = c.apiKey || '';

    populateVoices();
    renderHistory();
    checkServerStatus();
  }

  /* ── Voices ───────────────────────────────────────────────────────────── */
  function populateVoices() {
    var sel = document.getElementById('vs-voice');
    if (!sel) return;
    var voices = V.getVoices();
    var current = sel.value;
    sel.innerHTML = '<option value="">System default</option>';
    voices.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = v.name + ' (' + v.lang + ')';
      sel.appendChild(opt);
    });
    if (current) sel.value = current;
    else if (V.config.voiceURI) sel.value = V.config.voiceURI;
  }

  /* ── History ──────────────────────────────────────────────────────────── */
  function renderHistory() {
    var el = document.getElementById('vs-history');
    if (!el) return;
    var audit = V.getAudit();
    var commands = audit.filter(function (a) { return a.action === 'command'; }).slice(0, 15);
    if (!commands.length) {
      el.innerHTML = '<p class="voice-note">No commands yet. Say "Hello Hela" and try a command.</p>';
      return;
    }
    el.innerHTML = commands.map(function (a) {
      var time = new Date(a.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      var status = a.status === 'matched' ? '✓' : '?';
      return '<div class="voice-history-item"><span class="voice-history-time">' + time + '</span>' +
        '<span class="voice-history-text">' + escapeHtml(a.detail || a.target || '') + '</span>' +
        '<span class="voice-history-status">' + status + '</span></div>';
    }).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Public ───────────────────────────────────────────────────────────── */
  S.build = buildVoiceTab;
  S.refresh = loadValues;

  /* ── Auto-build when the voice tab is opened ──────────────────────────── */
  // Hook into switchSettingsTab if it exists (settings dashboard)
  if (typeof switchSettingsTab === 'function') {
    var origSwitch = window.switchSettingsTab;
    window.switchSettingsTab = function (tab, el) {
      if (tab === 'voice') buildVoiceTab();
      return origSwitch.apply(this, arguments);
    };
  }

  // Also build on DOM ready if the tab exists
  function tryBuild() {
    if (document.getElementById('tab-voice')) buildVoiceTab();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryBuild);
  } else {
    tryBuild();
  }
})();