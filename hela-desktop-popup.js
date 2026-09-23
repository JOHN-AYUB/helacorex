/* ============================================================================
 * HelaCore Desktop — Dashboard Download Popup
 * Shows a "Download Desktop App" prompt on the dashboards (web version only).
 * Hidden automatically when running inside the HelaCore Desktop app.
 * ========================================================================== */
(function () {
  'use strict';

  // Running inside the desktop app? Skip entirely.
  if (window.helacoreDesktop && window.helacoreDesktop.isDesktop) return;

  var LS_KEY = 'helacore-desktop-popup-dismissed';
  var SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  try {
    var dismissed = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (dismissed && Date.now() - dismissed < SEVEN_DAYS) return;
  } catch (e) {}

  function serverUrl() {
    try {
      var cfg = JSON.parse(localStorage.getItem('helacore-voice-config') || '{}');
      if (cfg.serverUrl) return cfg.serverUrl.replace(/\/$/, '');
    } catch (e) {}
    return 'http://127.0.0.1:8787';
  }

  var root = document.createElement('div');
  root.id = 'hela-desktop-popup-root';
  root.innerHTML =
    '<style>' +
    '#hela-desktop-popup-root{position:fixed;z-index:2147483100;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}' +
    '#hela-dl-fab{position:fixed;left:18px;bottom:18px;display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:9999px;' +
    'border:1px solid #22c55e;background:linear-gradient(135deg,#0d1117,#161b22);color:#e6edf3;font-size:13px;font-weight:600;cursor:pointer;' +
    'box-shadow:0 6px 24px rgba(0,0,0,.5);transition:transform .15s,box-shadow .15s;}' +
    '#hela-dl-fab:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(34,197,94,.35);}' +
    '#hela-dl-fab .dot{width:9px;height:9px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.8);animation:helaDlPulse 1.6s infinite;}' +
    '@keyframes helaDlPulse{0%,100%{opacity:1}50%{opacity:.4}}' +
    '#hela-dl-modal{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:2147483200;}' +
    '#hela-dl-modal.open{display:flex}' +
    '#hela-dl-card{width:min(480px,92vw);background:linear-gradient(180deg,#161b22,#0d1117);border:1px solid #30363d;border-radius:18px;padding:28px;color:#e6edf3;' +
    'box-shadow:0 24px 60px rgba(0,0,0,.6);max-height:88vh;overflow-y:auto;}' +
    '#hela-dl-card h2{margin:0 0 6px;font-size:20px;color:#fff}' +
    '#hela-dl-card .sub{color:#8b949e;font-size:13px;margin-bottom:16px}' +
    '#hela-dl-feats{list-style:none;margin:0 0 20px;padding:0;display:grid;gap:8px}' +
    '#hela-dl-feats li{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:#c9d1d9}' +
    '#hela-dl-feats li b{color:#22c55e;flex-shrink:0}' +
    '#hela-dl-actions{display:flex;gap:10px;flex-wrap:wrap}' +
    '#hela-dl-btn{flex:1;padding:12px 18px;border-radius:12px;border:none;background:linear-gradient(135deg,#22c55e,#10b981);color:#fff;font-size:14px;font-weight:700;cursor:pointer;}' +
    '#hela-dl-btn:hover{filter:brightness(1.1)}' +
    '#hela-dl-later{padding:12px 16px;border-radius:12px;border:1px solid #30363d;background:transparent;color:#8b949e;font-size:13px;cursor:pointer}' +
    '#hela-dl-later:hover{color:#e6edf3}' +
    '#hela-dl-note{margin-top:14px;font-size:11px;color:#6e7681;line-height:1.5}' +
    '</style>' +
    '<button id="hela-dl-fab" title="Download HelaCore Desktop"><span class="dot"></span>Download Desktop App</button>' +
    '<div id="hela-dl-modal">' +
    '  <div id="hela-dl-card">' +
    '    <h2>HelaCore Desktop</h2>' +
    '    <p class="sub">Take the full HelaCore system to your Mac — one native app, all dashboards, voice AI included.</p>' +
    '    <ul id="hela-dl-feats">' +
    '      <li><b>✓</b><span><b>All dashboards offline</b> — agents, money, HelaBank, inventory, reports and more, no browser needed.</span></li>' +
    '      <li><b>✓</b><span><b>Hela Voice built in</b> — wake word, click-to-talk, Swahili/Sheng/English, Qwen AI answers.</span></li>' +
    '      <li><b>✓</b><span><b>Conversation memory</b> — your voice history and settings persist on-device.</span></li>' +
    '      <li><b>✓</b><span><b>Native window</b> — fast, focused, always one click away.</span></li>' +
    '    </ul>' +
    '    <div id="hela-dl-actions">' +
    '      <button id="hela-dl-btn">⬇ Download .dmg</button>' +
    '      <button id="hela-dl-later">Later</button>' +
    '    </div>' +
    '    <p id="hela-dl-note">macOS only. Requires macOS 12 or newer. The download is served from your HelaCore voice server (port 8787).</p>' +
    '  </div>' +
    '</div>';

  document.body.appendChild(root);

  var fab = document.getElementById('hela-dl-fab');
  var modal = document.getElementById('hela-dl-modal');
  var dlBtn = document.getElementById('hela-dl-btn');
  var laterBtn = document.getElementById('hela-dl-later');

  function openModal() { modal.classList.add('open'); }
  function closeModal() { modal.classList.remove('open'); }

  fab.addEventListener('click', openModal);
  laterBtn.addEventListener('click', function () {
    closeModal();
    try { localStorage.setItem(LS_KEY, JSON.stringify(Date.now())); } catch (e) {}
  });
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });

  // Download the DMG as a blob (works across origins) with live progress.
  function startDownload() {
    var url = serverUrl() + '/download/helacore.dmg';
    dlBtn.textContent = 'Preparing…';
    dlBtn.disabled = true;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'blob';
    xhr.onprogress = function (e) {
      if (e.lengthComputable && e.total) {
        var pct = Math.round((e.loaded / e.total) * 100);
        dlBtn.textContent = 'Downloading… ' + pct + '%';
      } else {
        dlBtn.textContent = 'Downloading…';
      }
    };
    xhr.onload = function () {
      if (xhr.status === 200 && xhr.response) {
        var blobUrl = URL.createObjectURL(xhr.response);
        var a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'HelaCore-1.0.0.dmg';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(blobUrl); a.remove(); }, 4000);
        dlBtn.textContent = '⬇ Download .dmg';
      } else {
        dlBtn.textContent = 'Download failed — try again';
      }
      dlBtn.disabled = false;
    };
    xhr.onerror = function () {
      dlBtn.textContent = 'Download failed — try again';
      dlBtn.disabled = false;
    };
    xhr.send();
  }

  dlBtn.addEventListener('click', startDownload);

  // Show the FAB after a short delay
  fab.style.opacity = '0';
  setTimeout(function () { fab.style.opacity = '1'; fab.style.transition = 'opacity .4s'; }, 2500);

  // Auto-open the popup once per session on every page. The download begins
  // when the user clicks the "Download .dmg" button.
  var autoOpened = false;
  try { autoOpened = sessionStorage.getItem('hela-dl-autoopened') === '1'; } catch (e) {}
  if (!autoOpened) {
    setTimeout(function () {
      openModal();
      try { sessionStorage.setItem('hela-dl-autoopened', '1'); } catch (e) {}
    }, 1500);
  }
})();