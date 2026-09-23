/* ============================================================================
 * HelaCore Hela Voice — Hello Hela Panel Bridge
 * ----------------------------------------------------------------------------
 * Turns the existing "Hello Hela" chat panel into the real voice command
 * system:
 *   • Mic button  → real click-to-talk (V.startListening / V.stopListening)
 *   • Text input  → V.processCommand (intents → Hela Voice AI backend)
 *   • Responses   → rendered as chat bubbles in the panel conversation
 *   • Status line → live engine state (Listening / Thinking / Done)
 * No model downloads — uses the Hela Voice engine + backend already in the
 * system (Qwen via the voice server when configured).
 * ========================================================================== */
(function () {
  'use strict';

  function $id(id) { return document.getElementById(id); }

  var panel, convo, input, micBtn, statusEl, sendBtn;
  var listening = false;
  var waveform = null;
  var V = null; // set to window.HelaVoice once the engine is ready

  /* ── Bubble helpers (mirror the page's own chat-bubble markup) ────────── */
  function addBubble(text, who) {
    if (!convo) return;
    var b = document.createElement('div');
    b.className = 'chat-bubble ' + who;
    b.innerHTML = text +
      '<div class="cb-meta"><span>' + (who === 'ai' ? 'Hela' : 'You') + '</span><span>•</span><span>just now</span></div>';
    convo.appendChild(b);
    convo.scrollTop = convo.scrollHeight;
    return b;
  }

  function showTyping() {
    if (!convo || $id('helaBridgeTyping')) return;
    var t = document.createElement('div');
    t.className = 'chat-bubble ai';
    t.id = 'helaBridgeTyping';
    t.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
    convo.appendChild(t);
    convo.scrollTop = convo.scrollHeight;
  }

  function removeTyping() {
    var t = $id('helaBridgeTyping');
    if (t) t.remove();
  }

  /* ── Waveform (visual listening indicator in the input row) ───────────── */
  function showWaveform() {
    if (!input || waveform) return;
    waveform = document.createElement('div');
    waveform.className = 'waveform';
    waveform.id = 'helaBridgeWaveform';
    for (var i = 0; i < 10; i++) waveform.appendChild(document.createElement('span'));
    input.parentNode.insertBefore(waveform, input);
    input.style.display = 'none';
  }

  function hideWaveform() {
    if (waveform) { waveform.remove(); waveform = null; }
    if (input) input.style.display = '';
  }

  /* ── Status line ──────────────────────────────────────────────────────── */
  function setStatus(text, cls) {
    if (!statusEl) return;
    statusEl.innerHTML = '<span class="live-dot" style="display:inline-block;margin-right:5px;vertical-align:middle;"></span>' + text;
    statusEl.className = 'hp-status' + (cls ? ' hp-status-' + cls : '');
  }

  /* ── Mic button state ─────────────────────────────────────────────────── */
  function setMicActive(active) {
    if (!micBtn) return;
    if (active) {
      micBtn.style.background = 'linear-gradient(135deg,#f59e0b,#10b981)';
      micBtn.style.border = 'none';
      micBtn.style.color = '#fff';
      micBtn.title = 'Stop listening';
    } else {
      micBtn.style.background = '';
      micBtn.style.border = '';
      micBtn.style.color = '';
      micBtn.title = 'Voice input';
    }
  }

  /* ── Send a message through the real engine ───────────────────────────── */
  function bridgeSend(text) {
    var raw = (text || (input ? input.value : '')).trim();
    if (!raw) return;
    if (input) input.value = '';
    addBubble(escapeHtml(raw), 'user');
    showTyping();
    V.processCommand(raw);
  }

  /* ── Click-to-talk (no holding) ───────────────────────────────────────── */
  function bridgeToggleVoice() {
    if (!window.HelaVoice) return;
    if (!V.config.enabled) {
      V.respond('Voice is disabled. Enable it in Settings.');
      return;
    }
    if (V.isListening()) {
      V.stopListening();
    } else {
      V.startListening();
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Wire everything up ───────────────────────────────────────────────── */
  function init() {
    if (!window.HelaVoice) return false;
    V = window.HelaVoice;
    panel = $id('helaPanel');
    if (!panel) return false;
    convo = $id('helaConvo');
    input = $id('helaInput');
    micBtn = $id('helaMicBtn');
    statusEl = panel.querySelector('.hp-status');
    sendBtn = panel.querySelector('.hi-btn.send');
    if (!convo || !input || !micBtn) return false;

    // Override the page's own handlers so every entry point uses the engine
    window.sendHelaMessage = bridgeSend;
    window.toggleHelaVoice = bridgeToggleVoice;

    // Input: Enter submits through the engine
    input.onkeydown = function (e) { if (e.key === 'Enter') bridgeSend(); };
    if (sendBtn) sendBtn.onclick = function () { bridgeSend(); };
    micBtn.onclick = bridgeToggleVoice;

    // Engine events → panel
    V.on('listening:started', function () {
      listening = true;
      setMicActive(true);
      showWaveform();
      setStatus('Listening… speak now', 'listening');
      if (input) input.placeholder = 'Listening… speak now';
    });
    V.on('listening:stopped', function () {
      listening = false;
      setMicActive(false);
      hideWaveform();
      setStatus('Listening for your business', '');
      if (input) input.placeholder = 'Ask Hela anything about your business...';
    });
    V.on('listening:error', function (d) {
      setMicActive(false);
      hideWaveform();
      setStatus('Mic error: ' + (d && d.error ? d.error : 'unknown'), 'error');
    });
    V.on('transcript:partial', function (d) {
      if (input && d && d.text) input.placeholder = d.text + '…';
    });
    V.on('command:received', function (d) {
      removeTyping();
      if (d && d.text && !listening) addBubble(escapeHtml(d.text), 'user');
    });
    V.on('ai:thinking', function () {
      setStatus('Asking Hela AI…', 'thinking');
      showTyping();
    });
    V.on('response', function (e) {
      removeTyping();
      if (e && e.text) {
        addBubble(e.text, 'ai');
        setStatus('Listening for your business', '');
      }
    });
    V.on('ai:response', function () {
      removeTyping();
      setStatus('Listening for your business', '');
    });
    V.on('state:changed', function (s) {
      if (s && s.state === 'failed') {
        removeTyping();
        setStatus('Something went wrong — try again', 'error');
      }
    });

    return true;
  }

  // Retry until the engine and panel are both available
  var tries = 0;
  function tryInit() {
    if (init()) return;
    tries++;
    if (tries < 40) setTimeout(tryInit, 250);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryInit);
  } else {
    tryInit();
  }
})();