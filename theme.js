/* ═══════════════════════════════════════════════════════════════════════════
   HELACORE OS — SHARED THEME SYSTEM (theme.js)
   "One theme engine for every dashboard page."
   - Applies saved theme (localStorage 'helacore-theme') to <html data-theme>
   - Injects the exact index.html light-theme CSS overrides
   - Auto-inserts the sun/moon toggle button into .topbar-right
   - Persists choice, respects system preference when nothing saved
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    /* ── 1. Light theme CSS overrides (exact match to index.html) ────────── */
    var LIGHT_CSS = [
        '[data-theme="light"]{',
        '--bg-primary:#fafaf9;--bg-secondary:#f5f5f4;--bg-tertiary:#e7e5e4;',
        '--text-primary:#1c1917;--text-secondary:#57534e;--text-muted:#a8a29e;--text-inverse:#ffffff;',
        '--glass-bg:rgba(255,255,255,0.65);--glass-bg-hover:rgba(255,255,255,0.85);',
        '--glass-border:rgba(0,0,0,0.08);--glass-border-hover:rgba(0,0,0,0.15);',
        '--glass-shadow:0 8px 32px rgba(0,0,0,0.08),0 2px 8px rgba(0,0,0,0.04);',
        '--glass-inset-top:inset 0 1px 1px rgba(255,255,255,0.8);',
        '--glass-inset-bottom:inset 0 -1px 1px rgba(0,0,0,0.03);',
        '--glass-shine:rgba(255,255,255,0.5);',
        '--dark-glass-bg:rgba(255,255,255,0.5);--dark-glass-border:rgba(0,0,0,0.08);',
        '--dark-glass-shadow:0 4px 20px rgba(0,0,0,0.06);',
        '--input-bg:rgba(255,255,255,0.8);--input-border:rgba(0,0,0,0.12);',
        '--input-focus-border:rgba(245,158,11,0.6);--input-focus-shadow:0 0 20px rgba(245,158,11,0.15);',
        '--input-text:#1c1917;--input-placeholder:#a8a29e;',
        '--border-subtle:rgba(0,0,0,0.08);--border-footer:rgba(0,0,0,0.08);',
        '--footer-bg:rgba(245,245,244,0.8);--scrollbar-track:#f5f5f4;--scrollbar-thumb:#d97706;',
        '--canvas-opacity:0.15;',
        '--gradient-text:linear-gradient(135deg,#d97706 0%,#059669 50%,#0891b2 100%);',
        '--btn-gradient:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(16,185,129,0.15));',
        '--btn-gradient-hover:linear-gradient(135deg,rgba(245,158,11,0.25),rgba(16,185,129,0.25));',
        '--chart-grid:rgba(0,0,0,0.06);--chart-line:rgba(217,119,6,0.7);--chart-fill:rgba(217,119,6,0.08);',
        '--mobile-menu-bg:rgba(250,250,249,0.98);',
        '--social-bg:rgba(0,0,0,0.05);--social-bg-hover:rgba(0,0,0,0.08);',
        '--social-icon:#78716c;--social-icon-hover:#1c1917;',
        '--nav-hover-bg:rgba(0,0,0,0.06);--stats-bg:rgba(255,255,255,0.6);',
        '--tag-bg:rgba(0,0,0,0.06);',
        '}',
        /* Dashboard-specific light refinements */
        '[data-theme="light"] .sidebar{background:rgba(250,250,249,0.92);border-right:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .topbar{background:rgba(250,250,249,0.85);border-bottom:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .chart-card,[data-theme="light"] .stat-card,[data-theme="light"] .card{background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .nav-item:hover{background:rgba(0,0,0,0.06);}',
        '[data-theme="light"] .nav-item.active{background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(16,185,129,0.15));border:1px solid rgba(217,119,6,0.3);}',
        '[data-theme="light"] .btn-primary{background:linear-gradient(135deg,#d97706,#059669);color:#fff;}',
        '[data-theme="light"] .btn-ghost{background:rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.1);color:#1c1917;}',
        '[data-theme="light"] .toast-item{background:rgba(255,255,255,0.95);border:1px solid rgba(0,0,0,0.1);color:#1c1917;}',
        '[data-theme="light"] .insight-item{background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .ai-badge{background:rgba(245,158,11,0.12);color:#92400e;}',
        '[data-theme="light"] .filter-chip{background:rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.1);color:#57534e;}',
        '[data-theme="light"] .filter-chip.active{background:linear-gradient(135deg,rgba(245,158,11,0.2),rgba(16,185,129,0.2));color:#1c1917;border-color:rgba(217,119,6,0.4);}',
        '[data-theme="light"] .notif-panel{background:rgba(250,250,249,0.98);border-left:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .alert-item:hover{background:rgba(0,0,0,0.04);}',
        '[data-theme="light"] .sidebar-user{background:rgba(0,0,0,0.04);}',
        '[data-theme="light"] .nav-badge.new{background:linear-gradient(135deg,#d97706,#059669);color:#fff;}',
        '[data-theme="light"] .nav-badge.count{background:rgba(217,119,6,0.15);color:#92400e;}',
        '[data-theme="light"] .stat-change.up{color:#059669;}',
        '[data-theme="light"] .stat-change.down{color:#dc2626;}',
        '[data-theme="light"] .table-row:hover{background:rgba(0,0,0,0.04);}',
        '[data-theme="light"] .modal-content{background:rgba(250,250,249,0.98);border:1px solid rgba(0,0,0,0.1);}',
        '[data-theme="light"] .chat-bubble.user{background:linear-gradient(135deg,#d97706,#059669);color:#fff;}',
        '[data-theme="light"] .chat-bubble.ai{background:rgba(0,0,0,0.05);color:#1c1917;border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .suggestion-chip{background:rgba(0,0,0,0.05);border:1px solid rgba(0,0,0,0.1);color:#57534e;}',
        '[data-theme="light"] .suggestion-chip:hover{background:rgba(245,158,11,0.1);border-color:rgba(217,119,6,0.4);color:#1c1917;}',
        '[data-theme="light"] .capability-card{background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .recommendation-card{background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .market-signal{background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .competitor-item{background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .region-item{background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .help-card{background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .faq-item{background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .report-card{background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .report-section{background:rgba(255,255,255,0.6);border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .kpi-tile{background:rgba(255,255,255,0.7);border:1px solid rgba(0,0,0,0.08);}',
        '[data-theme="light"] .search-kbd{background:rgba(0,0,0,0.06);color:#57534e;border:1px solid rgba(0,0,0,0.1);}',
        '[data-theme="light"] .topbar-search input{background:rgba(255,255,255,0.8);border:1px solid rgba(0,0,0,0.1);color:#1c1917;}',
        '[data-theme="light"] .topbar-search input::placeholder{color:#a8a29e;}',
        '[data-theme="light"] .progress-track{background:rgba(0,0,0,0.08);}',
        '[data-theme="light"] .empty-state{background:rgba(255,255,255,0.5);border:1px dashed rgba(0,0,0,0.15);}',
        '[data-theme="light"] .divider{background:rgba(0,0,0,0.08);}',
        '[data-theme="light"] .tag{background:rgba(0,0,0,0.06);color:#57534e;}',
        '[data-theme="light"] .status-pill{background:rgba(0,0,0,0.06);}',
        '[data-theme="light"] .sidebar-logo .logo-icon{background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(16,185,129,0.15));}',
        '[data-theme="light"] .topbar-btn{background:rgba(255,255,255,0.8);border:1px solid rgba(0,0,0,0.1);color:#57534e;}',
        '[data-theme="light"] .topbar-btn:hover{background:rgba(0,0,0,0.06);color:#1c1917;}',
        '[data-theme="light"] .notif-dot{border-color:#fafaf9;}',
        '[data-theme="light"] .theme-toggle{background:rgba(255,255,255,0.8);border:1px solid rgba(0,0,0,0.1);color:#1c1917;}',
        '[data-theme="light"] .theme-toggle:hover{background:rgba(0,0,0,0.06);}',
        '[data-theme="light"] ::-webkit-scrollbar-track{background:#f5f5f4;}',
        '[data-theme="light"] ::-webkit-scrollbar-thumb{background:#d97706;}',
        '[data-theme="light"] body{background:#fafaf9;}',
        '[data-theme="light"] .main-content{background:#fafaf9;}'
    ].join('\n');

    /* ── 2. Theme toggle button styles ───────────────────────────────────── */
    var TOGGLE_CSS = [
        '.theme-toggle{position:relative;width:40px;height:40px;border-radius:12px;background:var(--input-bg);border:1px solid var(--input-border);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .25s;color:var(--text-secondary);flex-shrink:0;}',
        '.theme-toggle:hover{background:var(--glass-bg-hover);border-color:var(--glass-border-hover);color:var(--text-primary);transform:scale(1.05);}',
        '.theme-toggle svg{width:18px;height:18px;transition:transform .5s cubic-bezier(.4,0,.2,1);}',
        '.theme-toggle:hover svg{transform:rotate(15deg);}',
        '[data-theme="light"] .theme-toggle .moon-icon{display:none;}',
        '[data-theme="light"] .theme-toggle .sun-icon{display:block;}',
        '[data-theme="dark"] .theme-toggle .sun-icon,:root:not([data-theme]) .theme-toggle .sun-icon{display:none;}',
        '[data-theme="dark"] .theme-toggle .moon-icon,:root:not([data-theme]) .theme-toggle .moon-icon{display:block;}'
    ].join('\n');

    /* ── 3. Inject CSS ───────────────────────────────────────────────────── */
    function injectCSS(css) {
        var style = document.createElement('style');
        style.id = 'helacore-theme-css';
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* ── 4. Build toggle button ──────────────────────────────────────────── */
    function buildToggle() {
        var btn = document.createElement('button');
        btn.className = 'theme-toggle';
        btn.id = 'theme-toggle';
        btn.setAttribute('aria-label', 'Toggle theme');
        btn.title = 'Toggle light / dark mode';
        btn.innerHTML =
            '<svg class="moon-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>' +
            '<svg class="sun-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>';
        return btn;
    }

    /* ── 5. Insert toggle into topbar ───────────────────────────────────── */
    function insertToggle() {
        if (document.getElementById('theme-toggle')) return;
        var topbarRight = document.querySelector('.topbar-right');
        if (!topbarRight) return;
        var btn = buildToggle();
        // Insert before the first topbar-btn (message/notif/settings) so it
        // appears right after the search bar, before notifications.
        var firstBtn = topbarRight.querySelector('.topbar-btn');
        if (firstBtn) {
            topbarRight.insertBefore(btn, firstBtn);
        } else {
            topbarRight.appendChild(btn);
        }
    }

    /* ── 6. Theme application + toggle logic ────────────────────────────── */
    var html = document.documentElement;
    var savedTheme = null;
    try { savedTheme = localStorage.getItem('helacore-theme'); } catch (e) {}

    function applyTheme(theme) {
        html.setAttribute('data-theme', theme);
        try { localStorage.setItem('helacore-theme', theme); } catch (e) {}
        // Notify any page scripts that care (e.g. Chart.js re-render)
        window.dispatchEvent(new CustomEvent('helacore-theme-changed', { detail: { theme: theme } }));
    }

    function toggleTheme() {
        var current = html.getAttribute('data-theme') || 'dark';
        applyTheme(current === 'light' ? 'dark' : 'light');
    }

    /* ── 7. Init ────────────────────────────────────────────────────────── */
    function init() {
        injectCSS(TOGGLE_CSS);
        injectCSS(LIGHT_CSS);

        var systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme) {
            html.setAttribute('data-theme', savedTheme);
        } else {
            html.setAttribute('data-theme', systemPrefersDark ? 'dark' : 'dark');
        }

        insertToggle();
        var toggle = document.getElementById('theme-toggle');
        if (toggle) toggle.addEventListener('click', toggleTheme);

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
            if (!localStorage.getItem('helacore-theme')) {
                html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();