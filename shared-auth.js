/* ═══════════════════════════════════════════════════════════════════════
   HELACORE — SHARED AUTH + USER DATA MODULE
   ========================================================================
   Single source of truth for authentication, user profile loading, avatar,
   and logout across every Helacore dashboard page.

   Include this file BEFORE your page's own <script> block:
       <script src="shared-auth.js"></script>

   It exposes a global `HelacoreAuth` object with:
     - HelacoreAuth.init(onReady)           → auth gate + load user + workspace, then calls onReady(user, meta, workspace)
     - HelacoreAuth.getVal(key, wsKey)      → read a value from metadata or workspace
     - HelacoreAuth.mapVal(key, raw)        → map signup codes to display names
     - HelacoreAuth.fullName()              → formatted full name
     - HelacoreAuth.initials()              → initials for avatar fallback
     - HelacoreAuth.getAvatarUrl()          → returns avatar data URL or null
     - HelacoreAuth.applyAvatar(elementId)  → applies avatar to an element (img or div)
     - HelacoreAuth.applyAvatarToAll()      → applies avatar to all known avatar elements
     - HelacoreAuth.handleLogout()          → signOut + redirect to signin.html
     - HelacoreAuth.currentUser / currentMeta / currentWorkspace
     - HelacoreAuth.VALUE_MAP
   ════════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const SUPABASE_URL = 'https://megtqhibcdlbpuisvtgo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1lZ3RxaGliY2RsYnB1aXN2dGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1OTA0NDYsImV4cCI6MjA5OTE2NjQ0Nn0.p1eTEJ1spI19Y2qcXbDimO6CPsTnGaenpYSlHuBqHUM';

  const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const VALUE_MAP = {
    industry: { agriculture:'Agriculture', retail:'Retail', manufacturing:'Manufacturing', tech:'Technology', finance:'Finance', healthcare:'Healthcare', education:'Education', hospitality:'Hospitality', logistics:'Transport', construction:'Construction', media:'Media', professional:'Other', food:'Other', other:'Other' },
    business_size: { solo:'Solo', micro:'Small', small:'Small', medium:'Medium', large:'Large' },
    business_stage: { idea:'Idea', startup:'Startup', growing:'Growth', established:'Established', scaling:'Mature' },
    country: { KE:'Kenya', TZ:'Tanzania', UG:'Uganda', RW:'Rwanda', BI:'Other', ET:'Ethiopia', NG:'Nigeria', GH:'Ghana', ZA:'South Africa', OTHER:'Other' }
  };

  // Known avatar element IDs across all dashboards
  const AVATAR_ELEMENTS = [
    'sidebarAvatar', 'topbarAvatar', 'topbarAvatarInner', 'profileAvatarImg',
    'rightAvatarImg', 'profileAvatarInitials', 'rightAvatarInitials'
  ];

  const HelacoreAuth = {
    sb: sb,
    currentUser: null,
    currentMeta: {},
    currentWorkspace: {},
    avatarUrl: null,
    VALUE_MAP: VALUE_MAP,

    mapVal: function (key, raw) {
      if (!raw) return '';
      const map = VALUE_MAP[key];
      if (map && map[raw]) return map[raw];
      return raw;
    },

    getVal: function (key, wsKey) {
      return this.currentMeta[key] || (this.currentWorkspace ? this.currentWorkspace[wsKey || key] : '') || '';
    },

    /* Full name helper */
    fullName: function () {
      const fn = this.getVal('first_name');
      const ln = this.getVal('last_name');
      return (fn + ' ' + ln).trim() || (this.currentUser ? this.currentUser.email : 'User');
    },

    /* Initials helper (for avatars) */
    initials: function () {
      const fn = this.getVal('first_name');
      const ln = this.getVal('last_name');
      const i = ((fn || '')[0] || '') + ((ln || '')[0] || '');
      if (i) return i.toUpperCase();
      if (this.currentUser && this.currentUser.email) return this.currentUser.email[0].toUpperCase();
      return '?';
    },

    /* Get avatar URL from localStorage or Supabase metadata */
    getAvatarUrl: function () {
      if (this.avatarUrl) return this.avatarUrl;
      // Check localStorage first (fastest)
      const local = localStorage.getItem('helacore-business-logo');
      if (local) {
        this.avatarUrl = local;
        return local;
      }
      // Check Supabase user metadata
      if (this.currentMeta && this.currentMeta.business_logo) {
        this.avatarUrl = this.currentMeta.business_logo;
        return this.avatarUrl;
      }
      // Check workspace
      if (this.currentWorkspace && this.currentWorkspace.business_logo) {
        this.avatarUrl = this.currentWorkspace.business_logo;
        return this.avatarUrl;
      }
      return null;
    },

    /* Apply avatar to a specific element */
    applyAvatar: function (elementId) {
      const el = document.getElementById(elementId);
      if (!el) return;
      const url = this.getAvatarUrl();
      const initials = this.initials();
      if (url) {
        if (el.tagName === 'IMG') {
          el.src = url;
          el.style.display = 'block';
        } else {
          el.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;">';
        }
        // Hide initials sibling if exists
        const initialsEl = document.getElementById(elementId.replace('Img', 'Initials').replace('Avatar', 'AvatarInitials'));
        if (initialsEl) initialsEl.style.display = 'none';
      } else {
        if (el.tagName === 'IMG') {
          el.style.display = 'none';
        } else {
          el.textContent = initials;
        }
        const initialsEl = document.getElementById(elementId.replace('Img', 'Initials').replace('Avatar', 'AvatarInitials'));
        if (initialsEl) initialsEl.textContent = initials;
      }
    },

    /* Apply avatar to all known avatar elements */
    applyAvatarToAll: function () {
      AVATAR_ELEMENTS.forEach(id => this.applyAvatar(id));
      // Also handle any element with data-avatar="true"
      document.querySelectorAll('[data-avatar="true"]').forEach(el => {
        const url = this.getAvatarUrl();
        const initials = this.initials();
        if (url) {
          if (el.tagName === 'IMG') {
            el.src = url;
            el.style.display = 'block';
          } else {
            el.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover;">';
          }
        } else {
          if (el.tagName === 'IMG') el.style.display = 'none';
          else el.textContent = initials;
        }
      });
    },

    /* Load workspace from businesses then workspaces table.
       Uses a localStorage cache for near-instant first paint, then
       refreshes from the network in the background.
       If no row exists (e.g. signup upsert failed due to RLS),
       self-heals by creating one from user_metadata. */
    loadWorkspace: async function () {
      const cacheKey = 'helacore-workspace-cache';
      // 1. Serve cached workspace instantly (if any)
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.id === this.currentUser.id) {
            this.currentWorkspace = parsed;
            if (!localStorage.getItem('helacore-business-logo') && parsed.business_logo) {
              this.avatarUrl = parsed.business_logo;
            }
          }
        }
      } catch (e) { /* ignore cache errors */ }

      // 2. Refresh from network in the background
      try {
        let { data: ws } = await sb.from('businesses').select('*').eq('id', this.currentUser.id).maybeSingle();
        if (!ws) {
          const { data: ws2 } = await sb.from('workspaces').select('*').eq('id', this.currentUser.id).maybeSingle();
          ws = ws2;
        }
        if (ws) {
          this.currentWorkspace = ws;
          try { localStorage.setItem(cacheKey, JSON.stringify(ws)); } catch (e) {}
          if (!localStorage.getItem('helacore-business-logo') && ws.business_logo) {
            this.avatarUrl = ws.business_logo;
          }
        } else {
          // SELF-HEAL: workspace row missing (signup upsert failed — likely RLS
          // blocked anon write before email verification). Create one now from
          // the user_metadata that was stored during signup.
          await this._createWorkspaceFromMeta();
        }
      } catch (e) {
        console.warn('Workspace load error:', e);
      }
    },

    /* Self-heal: create a workspace row from user_metadata so the
       dashboard has data even if the signup-time upsert was blocked by RLS. */
    _createWorkspaceFromMeta: async function () {
      const meta = this.currentMeta;
      if (!meta || !meta.first_name) return; // nothing to create from
      const row = {
        id: this.currentUser.id,
        owner_email: this.currentUser.email || '',
        first_name: meta.first_name || '',
        last_name: meta.last_name || '',
        business_name: meta.business_name || '',
        phone: meta.phone || '',
        country: meta.country || '',
        city: meta.city || '',
        currency: meta.currency || '',
        timezone: meta.timezone || '',
        language: meta.language || '',
        industry: meta.industry || '',
        business_size: meta.business_size || '',
        business_stage: meta.business_stage || '',
        website: meta.website || '',
        business_desc: meta.business_desc || '',
        ai_personality: meta.ai_personality || '',
        plan: meta.plan || '',
        business_challenge: meta.business_challenge || '',
        background_challenge: meta.background_challenge || '',
        revenue_target: meta.revenue_target || '',
        current_revenue: meta.current_revenue || '',
        priorities: meta.priorities || '',
        preferred_modules: meta.preferred_modules || '',
        business_logo: meta.business_logo || ''
      };
      try {
        const { error } = await sb.from('workspaces').upsert(row);
        if (!error) {
          this.currentWorkspace = row;
          try { localStorage.setItem('helacore-workspace-cache', JSON.stringify(row)); } catch (e) {}
          console.log('Self-healed workspace from user_metadata');
        } else {
          console.warn('Workspace self-heal upsert failed:', error.message);
        }
      } catch (e) {
        console.warn('Workspace self-heal error:', e);
      }
    },

    /* Auth gate + load. Calls onReady(user, meta, workspace) when done.
       Fast path: session + metadata come from the cached Supabase session
       (no network round-trip), and workspace serves from localStorage cache
       while refreshing in the background. */
    init: async function (onReady) {
      // If URL has hash tokens (post email-verification), supabase-js v2
      // recovers them automatically in its internal _initialize().
      // getSession() awaits that, so the session will be present.
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        // Double-check: if there's a hash fragment with tokens, give
        // the client a moment to process them (race-safe fallback)
        if (window.location.hash && window.location.hash.includes('access_token')) {
          await new Promise(r => setTimeout(r, 1000));
          const retry = await sb.auth.getSession();
          if (!retry.data.session) {
            window.location.href = 'signin.html';
            return;
          }
          // Use the retried session
          return this._hydrate(retry.data.session, onReady);
        }
        window.location.href = 'signin.html';
        return;
      }
      return this._hydrate(session, onReady);
    },

    /* Internal: set user data, fire onReady, load workspace, self-heal */
    _hydrate: async function (session, onReady) {
      this.currentUser = session.user;
      this.currentMeta = session.user.user_metadata || {};
      // Load avatar from metadata (localStorage-first for instant paint)
      if (this.currentMeta.business_logo) {
        this.avatarUrl = this.currentMeta.business_logo;
        localStorage.setItem('helacore-business-logo', this.avatarUrl);
      } else {
        const local = localStorage.getItem('helacore-business-logo');
        if (local) this.avatarUrl = local;
      }
      // Fire onReady immediately with cached data, then refresh workspace async
      if (typeof onReady === 'function') {
        onReady(this.currentUser, this.currentMeta, this.currentWorkspace);
      }
      // Background refresh + self-heal (does not block first paint)
      this.loadWorkspace().then(() => {
        if (typeof onReady === 'function') {
          onReady(this.currentUser, this.currentMeta, this.currentWorkspace);
        }
      });
    },

    /* Logout — full Supabase signOut + redirect */
    handleLogout: async function () {
      try {
        await sb.auth.signOut();
        localStorage.removeItem('supabase_session');
        localStorage.removeItem('helacore-business-logo');
        window.location.href = 'signin.html';
      } catch (e) {
        window.location.href = 'signin.html';
      }
    }
  };

  /* Expose globally */
  window.HelacoreAuth = HelacoreAuth;
})();