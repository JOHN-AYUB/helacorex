/* ============================================================================
 * HelaCore Real-Time Language Fabric (RTLF) — Hela Voice Engine
 * ----------------------------------------------------------------------------
 * Core voice command engine for the HelaCore operating system.
 * Implements: wake word, STT, language detection + code-switching,
 * intent parsing, TTS, command execution, API/HTTP integration,
 * session state machine, memory, audit trail, offline fallback.
 *
 * Load order: hela-voice-engine.js → hela-voice-widget.js → hela-voice.css
 * Exposes: window.HelaVoice (engine), window.HelaVoiceWidget (UI)
 * ========================================================================== */
(function () {
  'use strict';

  /* ── Namespace ─────────────────────────────────────────────────────────── */
  if (window.HelaVoice) return; // prevent double init
  var V = window.HelaVoice = {};

  /* ── Version ───────────────────────────────────────────────────────────── */
  V.VERSION = '1.0.0';
  V.NAME = 'Hela Voice';

  /* ── Config (persisted in localStorage) ─────────────────────────────────── */
  var LS_KEY = 'helacore-voice-config';
  var MEM_KEY = 'helacore-voice-memory';
  var AUDIT_KEY = 'helacore-voice-audit';
  var SESSION_KEY = 'helacore-voice-session';

  var DEFAULT_CONFIG = {
    enabled: true,                 // master switch
    wakeWordEnabled: true,         // "Hello Hela" / "Hela"
    wakeWords: ['hello hela', 'hela', 'hey hela', 'ok hela'],
    pushToTalkKey: 'Space',        // hold-to-talk key
    continuous: true,              // keep listening after a command
    language: 'auto',              // auto | en | sw | sheng | <bcp47>
    responseLanguage: 'auto',      // language for replies
    voiceURI: '',                  // preferred TTS voice
    pitch: 1.0,
    rate: 1.0,
    volume: 1.0,
    autoSpeak: true,               // speak responses aloud
    showTranscript: true,
    showSubtitles: true,
    translationEnabled: true,      // translate Swahili/Sheng → English
    translateTo: 'en',             // target language for translation
    terminology: {},               // custom business terms (term → canonical)
    apiBaseUrl: '',                // optional backend API base
    apiKey: '',                    // optional API key (never persisted to repo)
    apiEndpoints: {},              // named endpoints
    serverUrl: 'http://127.0.0.1:8787', // Hela Voice backend server
    aiEnabled: true,               // route unmatched commands to the AI backend
    offlineMode: false,
    quietHours: { enabled: false, start: '22:00', end: '07:00' },
    proactiveAlerts: false,
    historyLimit: 50,
    debug: false
  };

  function loadConfig() {
    var cfg = {};
    try { cfg = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) {}
    V.config = Object.assign({}, DEFAULT_CONFIG, cfg);
  }
  function saveConfig() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(V.config)); } catch (e) {}
  }
  V.getConfig = function () { return V.config; };
  V.updateConfig = function (patch) {
    Object.assign(V.config, patch || {});
    saveConfig();
    V.emit('config:changed', V.config);
    return V.config;
  };
  V.resetConfig = function () {
    V.config = Object.assign({}, DEFAULT_CONFIG);
    saveConfig();
    V.emit('config:changed', V.config);
  };

  /* ── Event bus ─────────────────────────────────────────────────────────── */
  var listeners = {};
  V.on = function (evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return V; };
  V.off = function (evt, fn) {
    if (!listeners[evt]) return V;
    listeners[evt] = listeners[evt].filter(function (f) { return f !== fn; });
    return V;
  };
  V.emit = function (evt, data) {
    (listeners[evt] || []).forEach(function (fn) { try { fn(data); } catch (e) { V.log('event error ' + evt, e); } });
    return V;
  };

  /* ── Logging ───────────────────────────────────────────────────────────── */
  V.log = function () {
    if (V.config && V.config.debug) {
      var args = Array.prototype.slice.call(arguments);
      args.unshift('[HelaVoice]');
      (window.console && console.log).apply(console, args);
    }
  };
  V.error = function () {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[HelaVoice]');
    (window.console && console.error).apply(console, args);
  };

  /* ── Session state machine ─────────────────────────────────────────────── */
  var STATES = {
    IDLE: 'IDLE', LISTENING: 'LISTENING', THINKING: 'THINKING',
    ASKING: 'ASKING', AWAITING_APPROVAL: 'AWAITING_APPROVAL',
    EXECUTING: 'EXECUTING', WAITING_EXTERNAL: 'WAITING_EXTERNAL',
    SPEAKING: 'SPEAKING', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED',
    FAILED: 'FAILED', HANDOFF: 'HANDOFF'
  };
  V.STATES = STATES;
  V.state = STATES.IDLE;

  var session = {
    id: null, tenantId: 'helacore', userId: 'local-user', deviceId: 'browser',
    startedAt: null, turns: [], currentGoal: null, activeTask: null,
    resolvedEntities: {}, pendingApproval: null, language: 'en',
    lastTranscript: '', lastIntent: null, lastResponse: ''
  };

  function newSessionId() {
    return 'vs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  V.setState = function (s, meta) {
    V.state = s;
    V.emit('state:changed', { state: s, meta: meta || {} });
    V.log('state →', s);
    return V;
  };

  V.getSession = function () { return session; };

  function startSession() {
    session.id = newSessionId();
    session.startedAt = new Date().toISOString();
    session.turns = [];
    session.currentGoal = null;
    session.activeTask = null;
    session.resolvedEntities = {};
    session.pendingApproval = null;
    V.setState(STATES.IDLE);
    V.emit('session:started', session);
    V.log('session started', session.id);
  }

  /* ── Memory (localStorage) ─────────────────────────────────────────────── */
  var memory = { short: [], long: [], decisions: [] };
  function loadMemory() {
    try { memory = JSON.parse(localStorage.getItem(MEM_KEY) || 'null') || memory; } catch (e) {}
  }
  function saveMemory() {
    try { localStorage.setItem(MEM_KEY, JSON.stringify(memory)); } catch (e) {}
  }
  V.getMemory = function () { return memory; };
  V.remember = function (type, text, meta) {
    var item = { text: text, ts: new Date().toISOString(), source: meta && meta.source || 'voice', confidence: (meta && meta.confidence) || 1 };
    if (type === 'short') { memory.short.unshift(item); memory.short = memory.short.slice(0, 20); }
    else if (type === 'long') { memory.long.unshift(item); memory.long = memory.long.slice(0, 50); }
    else { memory.decisions.unshift(item); memory.decisions = memory.decisions.slice(0, 30); }
    saveMemory();
    V.emit('memory:changed', memory);
    return item;
  };
  V.forget = function (type, index) {
    if (memory[type]) memory[type].splice(index, 1);
    saveMemory();
    V.emit('memory:changed', memory);
  };
  V.clearMemory = function () {
    memory = { short: [], long: [], decisions: [] };
    saveMemory();
    V.emit('memory:changed', memory);
  };

  /* ── Audit trail ───────────────────────────────────────────────────────── */
  var audit = [];
  function loadAudit() {
    try { audit = JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]'); } catch (e) {}
  }
  function saveAudit() {
    try { localStorage.setItem(AUDIT_KEY, JSON.stringify(audit.slice(0, 200))); } catch (e) {}
  }
  V.getAudit = function () { return audit; };
  V.audit = function (entry) {
    var e = Object.assign({
      ts: new Date().toISOString(),
      sessionId: session.id,
      actor: 'user',
      action: 'unknown',
      target: null,
      status: 'recorded',
      detail: ''
    }, entry || {});
    audit.unshift(e);
    saveAudit();
    V.emit('audit:changed', e);
    return e;
  };

  /* ── Language intelligence ─────────────────────────────────────────────── */
  // Swahili / Sheng lexicon for detection + translation
  var SWAHILI_LEXICON = {
    'habari': 'hello/how are you', 'jambo': 'hello', 'mambo': 'how are things', 'vipi': 'how are you',
    'sasa': 'now', 'nzuri': 'good', 'safi': 'clean/fine', 'poa': 'cool/fine', 'sawa': 'okay',
    'asante': 'thank you', 'tafadhali': 'please', 'ndio': 'yes', 'ndiyo': 'yes', 'hapana': 'no',
    'sijui': 'i do not know', 'nimeelewa': 'i understand', 'sielewi': 'i do not understand',
    'niambie': 'tell me', 'nionyeshe': 'show me', 'tafuta': 'search', 'fungua': 'open',
    'fungua': 'open', 'nenda': 'go', 'rudi': 'return', 'acha': 'stop', 'simama': 'stop',
    'endelea': 'continue', 'subiri': 'wait', 'haraka': 'quickly', 'polepole': 'slowly',
    'sasa hivi': 'right now', 'kesho': 'tomorrow', 'jana': 'yesterday', 'leo': 'today',
    'wiki': 'week', 'mwezi': 'month', 'mwaka': 'year', 'saa': 'hour/time', 'dakika': 'minute',
    'pesa': 'money', 'fedha': 'money', 'bei': 'price', 'gharama': 'cost', 'mapato': 'income',
    'matumizi': 'expenses', 'faida': 'profit', 'hasara': 'loss', 'deni': 'debt', 'mkopo': 'loan',
    'akaunti': 'account', 'salio': 'balance', 'malipo': 'payment', 'lipa': 'pay', 'tuma': 'send',
    'pokea': 'receive', 'nunua': 'buy', 'uza': 'sell', 'bidhaa': 'goods/products', 'hifadhi': 'store/save',
    'orodha': 'list', 'ripoti': 'report', 'taarifa': 'information/report', 'hesabu': 'calculate/count',
    'jumla': 'total', 'idadi': 'quantity/count', 'kiasi': 'amount', 'wateja': 'customers',
    'mteja': 'customer', 'muuzaji': 'supplier', 'mfanyakazi': 'employee', 'wafanyakazi': 'employees',
    'kampuni': 'company', 'biashara': 'business', 'duka': 'shop', 'soko': 'market',
    'mauzo': 'sales', 'agizo': 'order', 'oda': 'order', 'usafirishaji': 'delivery/shipping',
    'ghala': 'warehouse', 'inventory': 'inventory', 'hisia': 'feelings', 'fikiria': 'think',
    'chambua': 'analyze', 'linganisha': 'compare', 'hesabu': 'calculate', 'panga': 'plan/arrange',
    'ratiba': 'schedule', 'kazi': 'work', 'mradi': 'project', 'timu': 'team', 'mkutano': 'meeting',
    'barua': 'letter/email', 'ujumbe': 'message', 'simu': 'phone', 'namba': 'number',
    'anwani': 'address', 'jina': 'name', 'majina': 'names', 'mahali': 'place', 'nchi': 'country',
    'mji': 'city', 'kaunti': 'county', 'kaskazini': 'north', 'kusini': 'south', 'mashariki': 'east',
    'magharibi': 'west', 'hali ya hewa': 'weather', 'mvua': 'rain', 'jua': 'sun',
    'baridi': 'cold', 'joto': 'hot', 'moto': 'fire/hot', 'maji': 'water', 'chakula': 'food',
    'mahindi': 'maize', 'ngombe': 'cattle', 'mbuzi': 'goat', 'kuku': 'chicken', 'mazao': 'crops/produce',
    'shamba': 'farm', 'kilimo': 'agriculture', 'mbegu': 'seeds', 'mbolea': 'fertilizer',
    'afya': 'health', 'elimu': 'education', 'shule': 'school', 'mwalimu': 'teacher',
    'mwanafunzi': 'student', 'wanafunzi': 'students', 'daktari': 'doctor', 'hospitali': 'hospital',
    'usalama': 'security/safety', 'hatari': 'danger', 'tatizo': 'problem', 'suluhisho': 'solution',
    'changamoto': 'challenge', 'fursa': 'opportunity', 'mpango': 'plan', 'malengo': 'goals',
    'lengo': 'goal', 'mafanikio': 'success', 'kushindwa': 'failure', 'jaribu': 'try',
    'weka': 'put/set', 'ondoa': 'remove', 'ongeza': 'add', 'punguza': 'reduce', 'badilisha': 'change',
    'sasisha': 'update', 'futa': 'delete', 'hifadhi': 'save', 'chapisha': 'print', 'pakua': 'download',
    'pakia': 'upload', 'tuma': 'send', 'pokea': 'receive', 'itikio': 'response', 'swali': 'question',
    'jibu': 'answer', 'maelezo': 'explanation', 'maoni': 'feedback/opinion', 'pendekezo': 'suggestion',
    'ushauri': 'advice', 'mwelekeo': 'direction/trend', 'takwimu': 'statistics', 'data': 'data',
    'grafu': 'graph', 'chati': 'chart', 'meza': 'table', 'ramani': 'map', 'picha': 'picture',
    'video': 'video', 'sauti': 'voice/audio', 'muziki': 'music', 'kumbukumbu': 'memory/record',
    'rekodi': 'record', 'faili': 'file', 'hati': 'document', 'makala': 'article', 'kitabu': 'book',
    'gazeti': 'newspaper', 'habari': 'news', 'matangazo': 'announcements', 'tahadhari': 'warning',
    'onyo': 'warning', 'kosa': 'error/mistake', 'hitilafu': 'error', 'imefanya kazi': 'working',
    'imekamilika': 'completed', 'imeshindwa': 'failed', 'inasubiri': 'pending', 'imeidhinishwa': 'approved',
    'imekataliwa': 'rejected', 'imefutwa': 'cancelled', 'imeanza': 'started', 'imeisha': 'finished/ended'
  };

  // Sheng slang (Kenyan urban slang)
  var SHENG_LEXICON = {
    'niko': 'i am', 'uko': 'you are', 'yuko': 'he/she is', 'tuko': 'we are', 'mko': 'you all are',
    'wako': 'they are', 'nime': 'i have', 'ume': 'you have', 'ame': 'he/she has', 'tume': 'we have',
    'mme': 'you all have', 'wame': 'they have', 'na': 'and/with', 'lakini': 'but', 'kwa': 'for/to',
    'ya': 'of', 'za': 'of (plural)', 'la': 'of', 'cha': 'of', 'vya': 'of', 'mimi': 'me/i',
    'wewe': 'you', 'yeye': 'he/she', 'sisi': 'we', 'nyinyi': 'you all', 'wao': 'they',
    'kitu': 'thing', 'vitu': 'things', 'mtu': 'person', 'watu': 'people', 'msee': 'person (slang)',
    'wasee': 'people (slang)', 'dame': 'girl/woman', 'msee wa': 'guy from', 'poa': 'cool',
    'safi': 'fine', 'freshi': 'fresh/cool', 'kubwa': 'big', 'ndogo': 'small', 'kali': 'fierce/good',
    'ngumu': 'hard/difficult', 'rahisi': 'easy', 'haraka': 'fast', 'pole': 'sorry/slow',
    'kumbe': 'so it turns out', 'bado': 'not yet', 'tayari': 'ready/already', 'karibu': 'welcome',
    'kwaheri': 'goodbye', 'sema': 'speak/say', 'ongea': 'talk', 'zungumza': 'converse',
    'skiza': 'listen', 'angalia': 'look/watch', 'ona': 'see', 'jua': 'know', 'fahamu': 'understand',
    'elewa': 'understand', 'kumbuka': 'remember', 'sahau': 'forget', 'fikiri': 'think',
    'amini': 'believe', 'taka': 'want', 'hitaji': 'need', 'penda': 'like/love', 'chuki': 'hate',
    'ogopa': 'fear', 'furahi': 'be happy', 'huzuni': 'sad', 'hasira': 'angry', 'furaha': 'joy',
    'pesa': 'money', 'doe': 'money (slang)', 'mkwanja': 'money (slang)', 'ngiri': 'money (slang)',
    'kasheshe': 'trouble/drama', 'mtaa': 'neighborhood/street', 'ghetto': 'neighborhood',
    'kibanda': 'small shop/stall', 'mama mboga': 'vegetable vendor', 'boda boda': 'motorcycle taxi',
    'matatu': 'minibus taxi', 'nduthi': 'motorcycle', 'jua kali': 'informal sector',
    'kazi ya jua kali': 'informal work', 'mbao': 'money (slang)', 'makanga': 'matatu conductor',
    'manamba': 'touts', 'kitu kidogo': 'bribe', 'chai': 'tea/bribe', 'mchicha': 'money (slang)',
    'kibao': 'a lot', 'mengi': 'many', 'kadhaa': 'several', 'chache': 'few', 'zote': 'all',
    'kila': 'every', 'moja': 'one', 'mbili': 'two', 'tatu': 'three', 'nne': 'four', 'tano': 'five',
    'sita': 'six', 'saba': 'seven', 'nane': 'eight', 'tisa': 'nine', 'kumi': 'ten',
    'ishirini': 'twenty', 'thelathini': 'thirty', 'arobaini': 'forty', 'hamsini': 'fifty',
    'mia': 'hundred', 'elfu': 'thousand', 'milioni': 'million', 'bilioni': 'billion',
    'ngapi': 'how many', 'ngumu': 'how much', 'gani': 'which/what kind', 'nini': 'what',
    'nani': 'who', 'lini': 'when', 'wapi': 'where', 'kwanini': 'why', 'kwa nini': 'why',
    'vipi': 'how', 'jinsi': 'how', 'kama': 'if/like', 'ikiwa': 'if', 'au': 'or', 'wala': 'nor',
    'pia': 'also', 'tena': 'again', 'zaidi': 'more', 'kidogo': 'a little', 'sana': 'very',
    'kabisa': 'completely', 'hapa': 'here', 'huko': 'there', 'kule': 'over there', 'nyumbani': 'at home',
    'kazini': 'at work', 'shambani': 'at the farm', 'sokoni': 'at the market', 'dukani': 'at the shop',
    'benki': 'bank', 'benki ya': 'bank of', 'mpesa': 'mobile money', 'm-pesa': 'mobile money',
    'lipa na mpesa': 'pay with mpesa', 'tuma pesa': 'send money', 'kopa': 'borrow',
    'rejesha': 'return/pay back', 'weka akiba': 'save', 'toa': 'withdraw', 'angalia salio': 'check balance',
    'salio': 'balance', 'stakabadhi': 'receipt', 'risiti': 'receipt', 'invoice': 'invoice',
    'ankara': 'invoice', 'bei ya': 'price of', 'gharama ya': 'cost of', 'faida ya': 'profit of',
    'hasara ya': 'loss of', 'mauzo ya': 'sales of', 'mapato ya': 'income of', 'matumizi ya': 'expenses of'
  };

  // Merge into one lexicon
  var LEXICON = {};
  Object.keys(SWAHILI_LEXICON).forEach(function (k) { LEXICON[k] = SWAHILI_LEXICON[k]; });
  Object.keys(SHENG_LEXICON).forEach(function (k) { LEXICON[k] = SHENG_LEXICON[k]; });

  // Common English stopwords (for intent matching)
  var STOPWORDS = new Set(('a an the and or but if then so for with without of in on at to from by about as is are was were be been being have has had do does did will would can could should shall may might must not no yes ok okay please thank thanks hello hi hey good morning afternoon evening night today tomorrow yesterday now later soon right now just want need like would could can please tell show open go navigate search find look check see view display list create add update delete remove edit save cancel stop start run execute send pay buy sell order review analyze compare calculate generate report draft message email call').split(' '));

  // Language detection: returns {lang, confidence, codeSwitched}
  V.detectLanguage = function (text) {
    if (!text) return { lang: 'en', confidence: 0, codeSwitched: false };
    var lower = text.toLowerCase();
    var words = lower.split(/[^a-zà-ÿ0-9']+/).filter(Boolean);
    if (!words.length) return { lang: 'en', confidence: 0, codeSwitched: false };

    var swCount = 0, shengCount = 0, enCount = 0;
    words.forEach(function (w) {
      if (SHENG_LEXICON[w]) shengCount++;
      else if (SWAHILI_LEXICON[w]) swCount++;
      else if (!STOPWORDS.has(w)) enCount++;
    });

    var total = words.length || 1;
    var swRatio = (swCount + shengCount) / total;
    var shengRatio = shengCount / total;

    // Code-switching: significant mix of Swahili/Sheng AND English content words
    var codeSwitched = (swCount + shengCount) > 0 && enCount > 0 && swRatio > 0.15 && swRatio < 0.85;

    var lang = 'en';
    if (shengRatio > 0.4) lang = 'sheng';
    else if (swRatio > 0.4) lang = 'sw';
    else if (codeSwitched) lang = 'mixed';

    return {
      lang: lang,
      confidence: Math.min(1, Math.max(swRatio, shengRatio, enCount / total) + 0.1),
      codeSwitched: codeSwitched,
      swahiliWords: swCount, shengWords: shengCount, englishWords: enCount
    };
  };

  // Translate Swahili/Sheng phrase → English (dictionary-based, phrase-aware)
  V.translate = function (text, target) {
    target = target || V.config.translateTo || 'en';
    if (target === 'en') {
      var lower = text.toLowerCase();
      var out = lower;
      // Multi-word phrases first
      var phrases = [
        ['hali ya hewa', 'weather'], ['sasa hivi', 'right now'], ['kwa nini', 'why'],
        ['kazi ya jua kali', 'informal work'], ['boda boda', 'motorcycle taxi'],
        ['mama mboga', 'vegetable vendor'], ['lipa na mpesa', 'pay with mpesa'],
        ['tuma pesa', 'send money'], ['weka akiba', 'save money'], ['angalia salio', 'check balance'],
        ['bei ya', 'price of'], ['gharama ya', 'cost of'], ['faida ya', 'profit of'],
        ['hasara ya', 'loss of'], ['mauzo ya', 'sales of'], ['mapato ya', 'income of'],
        ['matumizi ya', 'expenses of'], ['niko', 'i am'], ['uko', 'you are'], ['yuko', 'he/she is'],
        ['tuko', 'we are'], ['wame', 'they have'], ['nime', 'i have'], ['ume', 'you have'],
        ['ame', 'he/she has'], ['tume', 'we have'], ['mme', 'you all have']
      ];
      phrases.forEach(function (p) {
        out = out.split(p[0]).join(p[1]);
      });
      // Single words
      out = out.split(/\b/).map(function (tok) {
        var t = tok.toLowerCase();
        if (LEXICON[t]) return LEXICON[t].split('/')[0];
        return tok;
      }).join('');
      // Clean up double spaces
      out = out.replace(/\s+/g, ' ').trim();
      return out === lower ? text : out;
    }
    return text;
  };

  // Normalize KES amounts, dates, times, phone numbers
  V.normalizeEntities = function (text) {
    var out = text;
    // KES amounts: "5k", "50k", "1.5m", "KSh 5000", "5000 bob", "5000 shillings"
    out = out.replace(/\b(\d+(?:\.\d+)?)\s*(k|kay)\b/gi, function (m, n) { return (parseFloat(n) * 1000) + ' KES'; });
    out = out.replace(/\b(\d+(?:\.\d+)?)\s*(m|million)\b/gi, function (m, n) { return (parseFloat(n) * 1000000) + ' KES'; });
    out = out.replace(/\b(ksh|kes|k\.?sh\.?)\s*(\d+(?:[.,]\d+)?)\b/gi, '$2 KES');
    out = out.replace(/\b(\d+(?:[.,]\d+)?)\s*(bob|shillings|shilingi)\b/gi, '$1 KES');
    // Phone numbers: 07XX XXX XXX / +254...
    out = out.replace(/(\+?254|0)(7\d{2})[\s-]?(\d{3})[\s-]?(\d{3})/g, '+254$2$3$4');
    // Dates: "jumatatu" etc.
    var days = { jumatatu: 'Monday', jumanne: 'Tuesday', jumatano: 'Wednesday', alhamisi: 'Thursday', ijumaa: 'Friday', jumamosi: 'Saturday', jumapili: 'Sunday' };
    Object.keys(days).forEach(function (d) { out = out.replace(new RegExp('\\b' + d + '\\b', 'gi'), days[d]); });
    return out;
  };

  /* ── Speech Recognition (STT) ──────────────────────────────────────────── */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = null;
  var isListening = false;
  var restartTimer = null;
  var netErrorNotified = false;   // speech network-error one-shot notification
  var speechBlockedUntil = 0;     // backoff timestamp after speech-service errors
  var finalTranscript = '';
  var interimTranscript = '';
  var wakePending = false; // heard wake word, waiting for command

  var LANG_CODES = {
    auto: '', en: 'en-US', sw: 'sw-KE', sheng: 'en-KE', fr: 'fr-FR', es: 'es-ES',
    de: 'de-DE', it: 'it-IT', pt: 'pt-PT', nl: 'nl-NL', ru: 'ru-RU', ar: 'ar-SA',
    hi: 'hi-IN', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', tr: 'tr-TR', pl: 'pl-PL',
    sv: 'sv-SE', da: 'da-DK', no: 'nb-NO', fi: 'fi-FI', cs: 'cs-CZ', el: 'el-GR',
    he: 'he-IL', th: 'th-TH', vi: 'vi-VN', id: 'id-ID', ms: 'ms-MY', tl: 'fil-PH',
    uk: 'uk-UA', ro: 'ro-RO', hu: 'hu-HU', bg: 'bg-BG', hr: 'hr-HR', sk: 'sk-SK',
    sl: 'sl-SI', lt: 'lt-LT', lv: 'lv-LV', et: 'et-EE', sq: 'sq-AL', mk: 'mk-MK',
    sr: 'sr-RS', bs: 'bs-BA', is: 'is-IS', ga: 'ga-IE', cy: 'cy-GB', mt: 'mt-MT',
    swa: 'sw-KE', am: 'am-ET', om: 'om-ET', ti: 'ti-ET', so: 'so-SO', rw: 'rw-RW',
    lg: 'lg-UG', sn: 'sn-ZW', zu: 'zu-ZA', xh: 'xh-ZA', af: 'af-ZA', yo: 'yo-NG',
    ha: 'ha-NG', ig: 'ig-NG', swh: 'sw-KE', ny: 'ny-MW', st: 'st-ZA', tn: 'tn-ZA',
    ur: 'ur-PK', bn: 'bn-BD', ta: 'ta-IN', te: 'te-IN', ml: 'ml-IN', kn: 'kn-IN',
    mr: 'mr-IN', gu: 'gu-IN', pa: 'pa-IN', ne: 'ne-NP', si: 'si-LK', km: 'km-KH',
    lo: 'lo-LA', my: 'my-MM', kk: 'kk-KZ', uz: 'uz-UZ', az: 'az-AZ', ka: 'ka-GE',
    hy: 'hy-AM', fa: 'fa-IR', ps: 'ps-AF', ku: 'ku-TR', sw: 'sw-KE'
  };

  V.getLangCode = function () {
    var lang = V.config.language || 'auto';
    if (lang === 'auto') return '';
    return LANG_CODES[lang] || lang;
  };

  V.isSupported = function () { return !!SR; };

  V.startListening = function (opts) {
    if (!SR) { V.respond('Speech recognition is not supported in this browser. Please use Chrome or Edge.'); return false; }
    if (isListening) return true;
    opts = opts || {};

    try {
      recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      var code = V.getLangCode();
      if (code) recognition.lang = code;

      finalTranscript = '';
      interimTranscript = '';
      wakePending = false;

      recognition.onstart = function () {
        isListening = true;
        V.setState(STATES.LISTENING);
        V.emit('listening:started');
      };

      recognition.onresult = function (event) {
        interimTranscript = '';
        for (var i = event.resultIndex; i < event.results.length; i++) {
          var res = event.results[i];
          var text = res[0].transcript;
          if (res.isFinal) finalTranscript += text + ' ';
          else interimTranscript += text;
        }
        var combined = (finalTranscript + interimTranscript).trim();
        if (combined) {
          V.emit('transcript:partial', { text: combined, final: finalTranscript.trim(), interim: interimTranscript.trim() });
          V.handleSpeech(combined, !!finalTranscript.trim());
        }
      };

      recognition.onerror = function (event) {
        V.log('recognition error', event.error);
        V.emit('listening:error', { error: event.error });
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          V.respond('Microphone permission was denied. Please allow microphone access in your browser settings.');
          V.setState(STATES.FAILED);
        } else if (event.error === 'no-speech') {
          // silent — just keep listening
        } else if (event.error === 'network') {
          // Speech service unreachable — notify once, then back off (avoid
          // flooding the conversation with repeated errors from auto-restart).
          if (!netErrorNotified) {
            netErrorNotified = true;
            V.respond('Speech recognition network error. Check your connection. You can still type commands in the meantime.');
            setTimeout(function () { netErrorNotified = false; }, 60000);
          }
          speechBlockedUntil = Date.now() + 30000;
        }
      };

      recognition.onend = function () {
        isListening = false;
        V.setState(STATES.IDLE);
        V.emit('listening:stopped');
        // Auto-restart for continuous listening (respects speech-error backoff)
        if (V.config.continuous && V.config.enabled && !V._manualStop && Date.now() > speechBlockedUntil) {
          restartTimer = setTimeout(function () {
            if (V.config.enabled && !V._manualStop && Date.now() > speechBlockedUntil) V.startListening();
          }, 300);
        }
      };

      recognition.start();
      return true;
    } catch (e) {
      V.error('startListening', e);
      return false;
    }
  };

  V.stopListening = function () {
    V._manualStop = true;
    if (recognition) { try { recognition.stop(); } catch (e) {} }
    isListening = false;
    if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
    V.setState(STATES.IDLE);
    V.emit('listening:stopped');
    setTimeout(function () { V._manualStop = false; }, 500);
  };

  V.isListening = function () { return isListening; };

  /* ── Wake word detection ──────────────────────────────────────────────── */
  V.isWakeWord = function (text) {
    if (!V.config.wakeWordEnabled) return false;
    var lower = text.toLowerCase().trim();
    var words = V.config.wakeWords || DEFAULT_CONFIG.wakeWords;
    for (var i = 0; i < words.length; i++) {
      var w = words[i].toLowerCase();
      if (lower === w || lower.indexOf(w + ' ') === 0 || lower.indexOf(w + ',') === 0 || lower.indexOf(w + '.') === 0) {
        return true;
      }
    }
    return false;
  };

  V.stripWakeWord = function (text) {
    var lower = text.toLowerCase().trim();
    var words = V.config.wakeWords || DEFAULT_CONFIG.wakeWords;
    for (var i = 0; i < words.length; i++) {
      var w = words[i].toLowerCase();
      if (lower === w) return '';
      if (lower.indexOf(w + ' ') === 0) return text.trim().slice(w.length).trim();
      if (lower.indexOf(w + ',') === 0) return text.trim().slice(w.length + 1).trim();
      if (lower.indexOf(w + '.') === 0) return text.trim().slice(w.length + 1).trim();
    }
    return text;
  };

  /* ── Command handling ─────────────────────────────────────────────────── */
  V.handleSpeech = function (text, isFinal) {
    if (!text || !text.trim()) return;

    // Wake word flow
    if (V.isWakeWord(text)) {
      var rest = V.stripWakeWord(text);
      if (!rest) {
        // Just the wake word — acknowledge and listen for command
        wakePending = true;
        V.respond('Yes? How can I help you?');
        V.emit('wake:detected');
        return;
      }
      // Wake word + command in one utterance
      V.emit('wake:detected');
      V.processCommand(rest);
      return;
    }

    // If wakePending and we get more speech, treat as command
    if (wakePending && isFinal) {
      wakePending = false;
      V.processCommand(text);
      return;
    }

    // If not wake-word gated (push-to-talk / manual), process directly
    if (!V.config.wakeWordEnabled && isFinal) {
      V.processCommand(text);
    }
  };

  /* ── Intent resolution ────────────────────────────────────────────────── */
  // Command registry: each entry has keywords, handler, category, risk
  var COMMANDS = [];

  V.registerCommand = function (def) {
    COMMANDS.push(def);
    return V;
  };

  // Normalize text for matching: lowercase, strip punctuation
  function norm(text) {
    return (text || '').toLowerCase().replace(/[^\w\sà-ÿ]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // Score a command against text
  function scoreCommand(cmd, ntext) {
    var score = 0;
    var kw = cmd.keywords || [];
    for (var i = 0; i < kw.length; i++) {
      var k = kw[i];
      if (typeof k === 'string') {
        if (ntext.indexOf(k) !== -1) score += k.split(' ').length * 2;
      } else if (k instanceof RegExp) {
        if (k.test(ntext)) score += 4;
      }
    }
    return score;
  }

  V.resolveIntent = function (text) {
    var ntext = norm(text);
    var best = null, bestScore = 0;
    COMMANDS.forEach(function (cmd) {
      var s = scoreCommand(cmd, ntext);
      if (s > bestScore) { bestScore = s; best = cmd; }
    });
    return { command: best, score: bestScore, normalized: ntext };
  };

  /* ── Response / TTS ───────────────────────────────────────────────────── */
  var synth = window.speechSynthesis;
  var currentUtterance = null;

  V.getVoices = function () {
    if (!synth) return [];
    return synth.getVoices();
  };

  V.pickVoice = function () {
    if (!synth) return null;
    var voices = synth.getVoices();
    if (!voices.length) return null;
    // Preferred voice
    if (V.config.voiceURI) {
      var match = voices.filter(function (v) { return v.voiceURI === V.config.voiceURI; })[0];
      if (match) return match;
    }
    // Prefer a voice matching response language
    var lang = V.config.responseLanguage;
    if (lang && lang !== 'auto') {
      var code = LANG_CODES[lang] || lang;
      var pref = voices.filter(function (v) { return (v.lang || '').toLowerCase().indexOf(code.split('-')[0].toLowerCase()) === 0; });
      if (pref.length) return pref[0];
    }
    // Default: first English voice, else first
    var en = voices.filter(function (v) { return (v.lang || '').indexOf('en') === 0; });
    return en[0] || voices[0];
  };

  V.speak = function (text, opts) {
    if (!synth || !V.config.autoSpeak) return;
    opts = opts || {};
    try {
      synth.cancel(); // barge-in: stop previous speech
      var u = new SpeechSynthesisUtterance(text);
      var voice = V.pickVoice();
      if (voice) u.voice = voice;
      u.pitch = opts.pitch != null ? opts.pitch : V.config.pitch;
      u.rate = opts.rate != null ? opts.rate : V.config.rate;
      u.volume = opts.volume != null ? opts.volume : V.config.volume;
      u.lang = opts.lang || (voice && voice.lang) || 'en-US';
      currentUtterance = u;
      u.onstart = function () { V.setState(STATES.SPEAKING); V.emit('speaking:started', { text: text }); };
      u.onend = function () { V.setState(STATES.COMPLETED); V.emit('speaking:ended'); currentUtterance = null; };
      u.onerror = function () { V.setState(STATES.COMPLETED); currentUtterance = null; };
      synth.speak(u);
    } catch (e) { V.error('speak', e); }
  };

  V.stopSpeaking = function () {
    if (synth) { try { synth.cancel(); } catch (e) {} }
    currentUtterance = null;
    V.setState(STATES.IDLE);
  };

  V.isSpeaking = function () { return !!(synth && synth.speaking); };

  /* ── Main command processor ───────────────────────────────────────────── */
  V.processCommand = function (rawText) {
    var text = (rawText || '').trim();
    if (!text) return;

    V.setState(STATES.THINKING);
    V.emit('command:received', { text: text });

    // Language detection
    var langInfo = V.detectLanguage(text);
    session.language = langInfo.lang;
    session.lastTranscript = text;

    // Normalize entities (KES, phone, dates)
    var normalized = V.normalizeEntities(text);

    // Translate if needed
    var workingText = normalized;
    if (langInfo.lang !== 'en' && V.config.translationEnabled) {
      workingText = V.translate(normalized, 'en');
      V.emit('translation:applied', { original: normalized, translated: workingText, lang: langInfo.lang });
    }

    // Resolve intent
    var intent = V.resolveIntent(workingText);
    session.lastIntent = intent;

    // Record turn
    session.turns.push({
      ts: new Date().toISOString(),
      input: text, normalized: normalized, working: workingText,
      lang: langInfo.lang, codeSwitched: langInfo.codeSwitched,
      intent: intent.command ? intent.command.id : null, score: intent.score
    });
    if (session.turns.length > 50) session.turns.shift();

    V.audit({
      action: 'command', target: intent.command ? intent.command.id : 'unknown',
      detail: text, status: intent.command ? 'matched' : 'unmatched'
    });

    if (intent.command && intent.score >= (intent.command.minScore || 2)) {
      V.setState(STATES.EXECUTING);
      try {
        var result = intent.command.handler(workingText, intent, { original: text, lang: langInfo });
        V.emit('command:executed', { command: intent.command.id, result: result });
        return result;
      } catch (e) {
        V.error('command handler error', intent.command.id, e);
        V.setState(STATES.FAILED);
        V.respond('Sorry, something went wrong while executing that command.');
        return null;
      }
    }

    // No match — try fallback handlers
    var fb = V.runFallback(workingText, { original: text, lang: langInfo });
    if (fb) return fb;

    // Route to the AI backend (Qwen) for intelligent responses
    if (V.config.aiEnabled && !V.config.offlineMode) {
      V.audit({ action: 'command', target: 'ai-backend', detail: text, status: 'routed' });
      return V.chatWithAI(text, {
        page: (window.location.pathname.split('/').pop() || '').replace(/%20/g, ' '),
        context: V.pageSummary(600)
      });
    }

    V.setState(STATES.ASKING);
    V.respond('I did not understand that. Try saying "open the agents dashboard", "show sales", or "what is my balance?".');
    return null;
  };

  /* ── Fallback handlers (page-specific, registered by widget/pages) ────── */
  var fallbacks = [];
  V.registerFallback = function (fn) { fallbacks.push(fn); return V; };
  V.runFallback = function (text, ctx) {
    for (var i = 0; i < fallbacks.length; i++) {
      try {
        var r = fallbacks[i](text, ctx);
        if (r) return r;
      } catch (e) { V.log('fallback error', e); }
    }
    return null;
  };

  /* ── Respond (speak + emit) ───────────────────────────────────────────── */
  V.respond = function (text, opts) {
    opts = opts || {};
    session.lastResponse = text;
    V.emit('response', { text: text, opts: opts });
    if (opts.speak !== false) V.speak(text, opts);
    return text;
  };

  /* ── Dashboard navigation map ─────────────────────────────────────────── */
  var DASHBOARDS = {
    'dashboard': 'dashboard.html', 'home': 'dashboard.html', 'main': 'dashboard.html',
    'money': 'money dashboard.html', 'helacore money': 'money dashboard.html',
    'ask hela': 'ask hela dashboard.html', 'ask': 'ask hela dashboard.html',
    'helaone': 'helaone dashboard.html', 'one': 'helaone dashboard.html',
    'helabank': 'helabank dashboard.html', 'bank': 'helabank dashboard.html',
    'ai studio': 'ai studio dashboard.html', 'studio': 'ai studio dashboard.html',
    'ai agents': 'ai agents dashboard.html', 'agents': 'ai agents dashboard.html',
    'projects': 'projects dashboard.html', 'project': 'projects dashboard.html',
    'customers': 'customers dashboard.html', 'customer': 'customers dashboard.html',
    'financial overview': 'financial overview dashboard.html', 'financial': 'financial overview dashboard.html',
    'finance': 'financial overview dashboard.html', 'overview': 'financial overview dashboard.html',
    'inventory': 'inventory dashboard.html', 'stock': 'inventory dashboard.html',
    'transactions': 'transactions dashboard.html', 'transaction': 'transactions dashboard.html',
    'reports': 'reports dashboard.html', 'report': 'reports dashboard.html',
    'market intelligence': 'market intelligence dashboard.html', 'market': 'market intelligence dashboard.html',
    'opportunities': 'opportunities dashboard.html', 'opportunity': 'opportunities dashboard.html',
    'loan': 'loan and financing dashboard.html', 'loans': 'loan and financing dashboard.html',
    'financing': 'loan and financing dashboard.html',
    'suppliers': 'suppliers dashboard.html', 'supplier': 'suppliers dashboard.html',
    'ai simulations': 'ai simulations dashboard.html', 'simulations': 'ai simulations dashboard.html',
    'simulation': 'ai simulations dashboard.html', 'sim': 'ai simulations dashboard.html',
    'ai advisor': 'ai advisor dashboard.html', 'advisor': 'ai advisor dashboard.html',
    'help': 'help center dashboard.html', 'help center': 'help center dashboard.html',
    'settings': 'settings dashboard.html', 'setting': 'settings dashboard.html',
    'api access': 'api access dashboard.html', 'api': 'api access dashboard.html',
    'about': 'about us.html', 'careers': 'careers.html', 'community': 'community.html',
    'documentation': 'documentation.html', 'docs': 'documentation.html',
    'features': 'features design.html', 'impact': 'impact.html',
    'privacy': 'privacy policy.html', 'terms': 'terms of service.html',
    'sign in': 'signin.html', 'login': 'signin.html', 'sign up': 'signup.html', 'register': 'signup.html'
  };

  V.navigate = function (target) {
    var key = norm(target);
    var file = DASHBOARDS[key] || DASHBOARDS[key.split(' ')[0]];
    if (!file) {
      // fuzzy: find dashboard whose name contains target
      var matches = Object.keys(DASHBOARDS).filter(function (k) { return k.indexOf(key) !== -1 || key.indexOf(k) !== -1; });
      if (matches.length) file = DASHBOARDS[matches[0]];
    }
    if (file) {
      V.audit({ action: 'navigate', target: file, status: 'executed' });
      V.respond('Opening ' + file.replace('.html', '').replace(' dashboard', '') + '.');
      setTimeout(function () { window.location.href = file; }, 400);
      return true;
    }
    return false;
  };

  /* ── DOM helpers ──────────────────────────────────────────────────────── */
  V.$ = function (sel, root) { return (root || document).querySelector(sel); };
  V.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  V.click = function (sel) {
    var el = V.$(sel);
    if (el) { el.click(); return true; }
    return false;
  };

  V.fill = function (sel, value) {
    var el = V.$(sel);
    if (el) {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  };

  V.setText = function (sel, value) {
    var el = V.$(sel);
    if (el) { el.textContent = value; return true; }
    return false;
  };

  V.scrollTo = function (sel) {
    var el = V.$(sel);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }
    return false;
  };

  V.readText = function (sel) {
    var el = V.$(sel);
    return el ? (el.textContent || el.value || '').trim() : '';
  };

  // Find element by text content (for buttons, tabs, etc.)
  V.findByText = function (text, tag) {
    var els = V.$$(tag || 'button, a, [role="button"], .nav-item, .tab, .chip, .card');
    var lower = text.toLowerCase();
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || '').trim().toLowerCase();
      if (t === lower || t.indexOf(lower) !== -1) return els[i];
    }
    return null;
  };

  V.clickByText = function (text) {
    var el = V.findByText(text);
    if (el) { el.click(); return true; }
    return false;
  };

  // Read visible page text (for "what's on this page" queries)
  V.pageSummary = function (maxLen) {
    maxLen = maxLen || 600;
    var body = document.body ? document.body.innerText : '';
    return body.replace(/\s+/g, ' ').slice(0, maxLen);
  };

  // Find a KPI/value element by semantic hints (id/class/data attrs)
  V.findValue = function (hints) {
    var selectors = [];
    hints.forEach(function (h) {
      selectors.push('[data-' + h + ']', '#' + h, '.' + h + '-value', '[class*="' + h + '"]', '[id*="' + h + '" i]');
    });
    var els = V.$$(selectors.join(', '));
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].textContent || '').trim();
      if (t && t.length < 60 && !/^[A-Za-z\s]{20,}$/.test(t)) return els[i];
    }
    // Fallback: scan ids/classes for the hint
    var all = V.$$('[id], [class]');
    for (var j = 0; j < all.length; j++) {
      var id = (all[j].id || '').toLowerCase();
      var cls = (typeof all[j].className === 'string' ? all[j].className : '').toLowerCase();
      for (var k = 0; k < hints.length; k++) {
        if ((id.indexOf(hints[k]) !== -1 || cls.indexOf(hints[k]) !== -1) && all[j].children.length === 0) {
          var t2 = (all[j].textContent || '').trim();
          if (t2 && t2.length < 60) return all[j];
        }
      }
    }
    return null;
  };

  /* ── API / HTTP integration layer ─────────────────────────────────────── */
  V.api = function (name, params, opts) {
    opts = opts || {};
    var base = V.config.apiBaseUrl || '';
    var endpoints = V.config.apiEndpoints || {};
    var path = endpoints[name] || name;
    var url = /^https?:\/\//.test(path) ? path : base + path;

    var headers = { 'Content-Type': 'application/json' };
    if (V.config.apiKey) headers['Authorization'] = 'Bearer ' + V.config.apiKey;

    var method = opts.method || 'GET';
    var body = null;
    if (params && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      body = JSON.stringify(params);
    } else if (params) {
      var qs = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
      if (qs) url += (url.indexOf('?') === -1 ? '?' : '&') + qs;
    }

    V.setState(STATES.WAITING_EXTERNAL);
    V.audit({ action: 'api:' + name, target: url, status: 'requested' });

    return fetch(url, { method: method, headers: headers, body: body })
      .then(function (res) { return res.json().catch(function () { return { status: res.status }; }); })
      .then(function (data) {
        V.setState(STATES.COMPLETED);
        V.audit({ action: 'api:' + name, target: url, status: 'completed' });
        return data;
      })
      .catch(function (err) {
        V.setState(STATES.FAILED);
        V.audit({ action: 'api:' + name, target: url, status: 'failed', detail: String(err) });
        V.respond('The API request failed. ' + (opts.fallbackText || ''));
        return null;
      });
  };

  /* ── Proactive alerts (simple polling of page data) ───────────────────── */
  var alertTimers = [];
  V.watch = function (name, checkFn, intervalMs) {
    var t = setInterval(function () {
      if (!V.config.proactiveAlerts) return;
      try {
        var result = checkFn();
        if (result && result.trigger) {
          V.respond(result.message);
          clearInterval(t);
        }
      } catch (e) {}
    }, intervalMs || 60000);
    alertTimers.push(t);
    return t;
  };
  V.clearWatches = function () { alertTimers.forEach(clearInterval); alertTimers = []; };

  /* ── Backend API integration (Hela Voice server) ──────────────────────── */
  V.serverUrl = function () {
    return V.config.serverUrl || 'http://127.0.0.1:8787';
  };

  // Server reachable?
  V.serverOnline = false;
  V.checkServer = function () {
    return fetch(V.serverUrl() + '/api/voice/health', { method: 'GET' })
      .then(function (res) { return res.json(); })
      .then(function (d) {
        V.serverOnline = !!(d && d.status === 'ok');
        V.emit('server:status', { online: V.serverOnline, info: d });
        return V.serverOnline;
      })
      .catch(function () {
        V.serverOnline = false;
        V.emit('server:status', { online: false });
        return false;
      });
  };

  // Sync voice config with the server (persisted across browsers)
  V.syncConfigFromServer = function () {
    return fetch(V.serverUrl() + '/api/voice/config', { method: 'GET' })
      .then(function (res) { return res.json(); })
      .then(function (d) {
        if (d && d.config) {
          var merged = Object.assign({}, V.config, d.config);
          V.config = merged;
          saveConfig();
          V.emit('config:changed', V.config);
        }
        return d;
      })
      .catch(function () { return null; });
  };

  V.saveConfigToServer = function () {
    var payload = {
      voiceURI: V.config.voiceURI, pitch: V.config.pitch, rate: V.config.rate,
      volume: V.config.volume, language: V.config.language,
      responseLanguage: V.config.responseLanguage, autoSpeak: V.config.autoSpeak,
      wakeWordEnabled: V.config.wakeWordEnabled, enabled: V.config.enabled,
      continuous: V.config.continuous, translationEnabled: V.config.translationEnabled,
      showTranscript: V.config.showTranscript, showSubtitles: V.config.showSubtitles,
      proactiveAlerts: V.config.proactiveAlerts,
      sessionId: session.id
    };
    return fetch(V.serverUrl() + '/api/voice/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) { return res.json(); }).catch(function () { return null; });
  };

  // Save a message to server memory
  V.saveMemoryToServer = function (role, content, meta) {
    return fetch(V.serverUrl() + '/api/voice/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, role: role, content: content, meta: meta || {} })
    }).then(function (res) { return res.json(); }).catch(function () { return null; });
  };

  // Load conversation history from server
  V.loadMemoryFromServer = function () {
    return fetch(V.serverUrl() + '/api/voice/memory?sessionId=' + encodeURIComponent(session.id) + '&limit=20', { method: 'GET' })
      .then(function (res) { return res.json(); })
      .then(function (d) { return (d && d.messages) || []; })
      .catch(function () { return []; });
  };

  // Clear server memory for this session
  V.clearServerMemory = function () {
    return fetch(V.serverUrl() + '/api/voice/memory?sessionId=' + encodeURIComponent(session.id), { method: 'DELETE' })
      .then(function (res) { return res.json(); }).catch(function () { return null; });
  };

  /* ── Execute actions returned by the AI model ─────────────────────────── */
  V.executeActions = function (actions) {
    if (!Array.isArray(actions)) return [];
    var results = [];
    actions.forEach(function (a) {
      try {
        var r = { type: a.type, ok: false };
        switch (a.type) {
          case 'navigate':
            r.ok = V.navigate(a.target);
            break;
          case 'click':
            if (a.selector && V.$(a.selector)) { V.$(a.selector).click(); r.ok = true; }
            else if (a.selector && V.clickByText(a.selector)) r.ok = true;
            break;
          case 'fill':
            r.ok = V.fill(a.selector, a.value);
            break;
          case 'read':
            var el = V.$(a.selector);
            if (el) {
              var txt = el.textContent.trim();
              r.ok = true;
              r.value = txt;
              if (a.say) V.respond(txt, { speak: true });
            }
            break;
          case 'respond':
            V.respond(a.text || '', { speak: false });
            r.ok = true;
            break;
          case 'scroll':
            if (a.direction === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
            else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            r.ok = true;
            break;
          default:
            r.ok = false;
        }
        results.push(r);
        V.audit({ action: 'ai:' + a.type, target: a.selector || a.target || '', status: r.ok ? 'executed' : 'failed' });
      } catch (e) {
        V.log('action error', a.type, e);
        results.push({ type: a.type, ok: false, error: String(e) });
      }
    });
    return results;
  };

  /* ── Chat with the AI backend (Qwen) ─────────────────────────────────── */
  V.chatWithAI = function (text, ctx) {
    ctx = ctx || {};
    V.setState(STATES.WAITING_EXTERNAL);
    V.emit('ai:thinking', { text: text });

    var history = session.turns.slice(-12).map(function (t) {
      return { role: 'user', content: t.input };
    });

    return fetch(V.serverUrl() + '/api/voice/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: session.id,
        text: text,
        page: ctx.page || (window.location.pathname.split('/').pop() || '').replace(/%20/g, ' '),
        context: ctx.context || V.pageSummary(600),
        history: history
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (d) {
        if (d && d.error) {
          V.setState(STATES.FAILED);
          V.respond(d.error);
          return null;
        }
        V.setState(STATES.COMPLETED);
        if (d.reply) V.respond(d.reply);
        if (d.actions && d.actions.length) V.executeActions(d.actions);
        V.emit('ai:response', d);
        return d;
      })
      .catch(function (err) {
        V.setState(STATES.FAILED);
        V.respond('The AI service is not reachable. ' + (V.serverOnline ? '' : 'Start the Hela Voice server (node hela-voice-server.js).'));
        return null;
      });
  };

  /* ── Init ─────────────────────────────────────────────────────────────── */
  V.init = function () {
    loadConfig();
    loadMemory();
    loadAudit();
    startSession();

    // Load voices (async in some browsers)
    if (synth) {
      synth.onvoiceschanged = function () { V.emit('voices:changed', synth.getVoices()); };
    }

    V.emit('ready', { version: V.VERSION });
    V.log('Hela Voice engine ready', V.VERSION);

    // Connect to the Hela Voice backend (async, non-blocking)
    V.checkServer().then(function (online) {
      if (online) {
        V.syncConfigFromServer().then(function () {
          V.emit('server:ready');
          V.log('synced config from server');
        });
      }
    });

    return V;
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { V.init(); });
  } else {
    V.init();
  }

  /* ── Built-in commands (cross-page) ───────────────────────────────────── */
  V.registerCommand({
    id: 'nav', category: 'navigation', risk: 0,
    keywords: ['open', 'go to', 'navigate', 'take me to', 'show me the', 'switch to', 'go to the', 'open the'],
    minScore: 2,
    handler: function (text) {
      // Extract target after navigation verb
      var m = text.match(/(?:open|go to|navigate to|take me to|switch to|show me the|open the|go to the)\s+(.+)/i);
      var target = m ? m[1] : text;
      // Remove trailing filler
      target = target.replace(/\b(please|now|page|dashboard|screen)\b/gi, '').trim();
      if (V.navigate(target)) return true;
      // Try clicking a nav item
      if (V.clickByText(target)) { V.respond('Opening ' + target + '.'); return true; }
      return false;
    }
  });

  V.registerCommand({
    id: 'help', category: 'system', risk: 0,
    keywords: ['help', 'what can you do', 'what can i say', 'commands', 'capabilities', 'how do i use'],
    minScore: 2,
    handler: function () {
      V.respond('I can navigate dashboards, open sections, filter data, read values aloud, run simulations, and more. Try: "open the agents dashboard", "show financial overview", "what is my balance?", or "help me with inventory".');
      return true;
    }
  });

  V.registerCommand({
    id: 'stop', category: 'system', risk: 0,
    keywords: ['stop', 'cancel', 'never mind', 'forget it', 'quit', 'silence', 'be quiet', 'shut up'],
    minScore: 2,
    handler: function () {
      V.stopListening();
      V.stopSpeaking();
      V.respond('Stopped.', { speak: false });
      return true;
    }
  });

  V.registerCommand({
    id: 'listen', category: 'system', risk: 0,
    keywords: ['start listening', 'listen', 'wake up', 'activate', 'hey hela listen'],
    minScore: 2,
    handler: function () {
      V.startListening();
      V.respond('Listening.');
      return true;
    }
  });

  V.registerCommand({
    id: 'settings', category: 'system', risk: 0,
    keywords: ['open settings', 'go to settings', 'settings page', 'voice settings', 'open voice settings'],
    minScore: 2,
    handler: function (text) {
      if (text.indexOf('voice') !== -1) {
        // Try to open voice tab on settings page
        if (window.location.href.indexOf('settings') !== -1) {
          if (typeof switchSettingsTab === 'function') {
            switchSettingsTab('voice', document.querySelector('[data-tab="voice"]'));
            V.respond('Opening voice settings.');
            return true;
          }
        }
        V.navigate('settings');
        // After navigation, open voice tab
        setTimeout(function () {
          if (typeof switchSettingsTab === 'function') {
            switchSettingsTab('voice', document.querySelector('[data-tab="voice"]'));
          }
        }, 800);
        return true;
      }
      return V.navigate('settings');
    }
  });

  V.registerCommand({
    id: 'read-page', category: 'system', risk: 0,
    keywords: ['what is on this page', 'what does this page show', 'summarize this page', 'what am i looking at', 'what is this page'],
    minScore: 2,
    handler: function () {
      var summary = V.pageSummary(400);
      V.respond('This page shows: ' + summary);
      return true;
    }
  });

  V.registerCommand({
    id: 'translate', category: 'language', risk: 0,
    keywords: ['translate', 'what does', 'mean in english', 'say in swahili', 'say in english'],
    minScore: 2,
    handler: function (text) {
      var m = text.match(/translate\s+(.+)/i) || text.match(/what does\s+(.+?)\s+mean/i);
      if (m) {
        var phrase = m[1].replace(/\b(in english|to english|into english|mean)\b/gi, '').trim();
        var translated = V.translate(phrase, 'en');
        V.respond('"' + phrase + '" means "' + translated + '" in English.');
        return true;
      }
      return false;
    }
  });

  V.registerCommand({
    id: 'time', category: 'system', risk: 0,
    keywords: ['what time is it', 'current time', 'time now', 'what is the time', 'saa ngapi'],
    minScore: 2,
    handler: function () {
      var now = new Date();
      V.respond('The time is ' + now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '.');
      return true;
    }
  });

  V.registerCommand({
    id: 'date', category: 'system', risk: 0,
    keywords: ['what date is it', 'what day is it', 'today date', 'what is today', 'leo ni'],
    minScore: 2,
    handler: function () {
      var now = new Date();
      V.respond('Today is ' + now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.');
      return true;
    }
  });

  V.registerCommand({
    id: 'who-are-you', category: 'system', risk: 0,
    keywords: ['who are you', 'what are you', 'your name', 'introduce yourself', 'about you'],
    minScore: 2,
    handler: function () {
      V.respond('I am Hela Voice, the voice command system for HelaCore. I can navigate your dashboards, answer questions about your business, and execute commands in English, Swahili, Sheng, and many other languages.');
      return true;
    }
  });

  V.registerCommand({
    id: 'refresh', category: 'system', risk: 0,
    keywords: ['refresh', 'reload', 'update page', 'reload page'],
    minScore: 2,
    handler: function () {
      V.respond('Refreshing the page.');
      setTimeout(function () { window.location.reload(); }, 400);
      return true;
    }
  });

  V.registerCommand({
    id: 'scroll-top', category: 'system', risk: 0,
    keywords: ['scroll up', 'go to top', 'top of page', 'back to top'],
    minScore: 2,
    handler: function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      V.respond('Scrolled to top.', { speak: false });
      return true;
    }
  });

  V.registerCommand({
    id: 'scroll-bottom', category: 'system', risk: 0,
    keywords: ['scroll down', 'go to bottom', 'bottom of page'],
    minScore: 2,
    handler: function () {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      V.respond('Scrolled to bottom.', { speak: false });
      return true;
    }
  });

  V.registerCommand({
    id: 'ask-ai', category: 'ai', risk: 0,
    keywords: ['ask hela', 'ask the ai', 'ask ai', 'question for hela', 'hela what', 'hela how', 'hela why', 'hela tell', 'hela explain', 'hela can', 'hela should', 'hela is', 'hela are', 'hela will', 'hela do', 'hela does', 'hela give', 'hela show me how', 'what do you think', 'can you explain', 'tell me about', 'explain to me', 'i want to know', 'i have a question'],
    minScore: 2,
    handler: function (text) {
      // Strip the "ask hela" prefix and route to the AI backend
      var q = text.replace(/^(ask hela|ask the ai|ask ai|question for hela|hela|can you|tell me about|explain to me|i want to know|i have a question)\s*/i, '').trim();
      if (!q) q = text;
      V.audit({ action: 'ask', target: 'ai-backend', detail: q, status: 'routed' });
      return V.chatWithAI(q, {
        page: (window.location.pathname.split('/').pop() || '').replace(/%20/g, ' '),
        context: V.pageSummary(600)
      });
    }
  });

  V.registerCommand({
    id: 'toggle-theme', category: 'system', risk: 0,
    keywords: ['toggle theme', 'switch theme', 'dark mode', 'light mode', 'change theme'],
    minScore: 2,
    handler: function (text) {
      if (typeof window.toggleTheme === 'function') { window.toggleTheme(); V.respond('Theme toggled.'); return true; }
      if (typeof window.setTheme === 'function') {
        var dark = text.indexOf('dark') !== -1;
        window.setTheme(dark ? 'dark' : 'light');
        V.respond('Theme changed.');
        return true;
      }
      return false;
    }
  });

  V.registerCommand({
    id: 'notifications', category: 'system', risk: 0,
    keywords: ['show notifications', 'open notifications', 'check notifications', 'notifications'],
    minScore: 2,
    handler: function () {
      if (V.click('#notifBtn') || V.click('.notif-btn') || V.click('[data-action="notifications"]')) {
        V.respond('Opening notifications.');
        return true;
      }
      return false;
    }
  });

  V.registerCommand({
    id: 'profile', category: 'system', risk: 0,
    keywords: ['open profile', 'my profile', 'profile page', 'account settings'],
    minScore: 2,
    handler: function () {
      if (window.location.href.indexOf('settings') !== -1 && typeof switchSettingsTab === 'function') {
        switchSettingsTab('profile', document.querySelector('[data-tab="profile"]'));
        V.respond('Opening profile.');
        return true;
      }
      return V.navigate('settings');
    }
  });

  V.registerCommand({
    id: 'search', category: 'system', risk: 0,
    keywords: ['search for', 'find', 'look up', 'search'],
    minScore: 2,
    handler: function (text) {
      var m = text.match(/(?:search for|find|look up|search)\s+(.+)/i);
      if (m) {
        var query = m[1].replace(/\b(please|now)\b/gi, '').trim();
        // Try common search inputs
        var inputs = V.$$('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i], #searchInput, #agentSearch, #customerSearch');
        if (inputs.length) {
          var input = inputs[0];
          input.value = query;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          // Try to trigger search function
          if (typeof window.searchTable === 'function') window.searchTable();
          if (typeof window.filterTable === 'function') window.filterTable();
          if (typeof window.renderRegistry === 'function') window.renderRegistry();
          V.respond('Searching for ' + query + '.');
          return true;
        }
      }
      return false;
    }
  });

  V.registerCommand({
    id: 'back', category: 'system', risk: 0,
    keywords: ['go back', 'back', 'previous page', 'back button'],
    minScore: 2,
    handler: function () {
      window.history.back();
      V.respond('Going back.', { speak: false });
      return true;
    }
  });

  V.registerCommand({
    id: 'forward', category: 'system', risk: 0,
    keywords: ['go forward', 'forward', 'next page'],
    minScore: 2,
    handler: function () {
      window.history.forward();
      V.respond('Going forward.', { speak: false });
      return true;
    }
  });

  V.registerCommand({
    id: 'toggle-voice', category: 'system', risk: 0,
    keywords: ['turn off voice', 'disable voice', 'mute', 'turn on voice', 'enable voice', 'unmute'],
    minScore: 2,
    handler: function (text) {
      var off = /off|disable|mute/.test(text);
      V.updateConfig({ autoSpeak: !off });
      V.respond(off ? 'Voice responses muted.' : 'Voice responses enabled.');
      return true;
    }
  });

  V.registerCommand({
    id: 'language-switch', category: 'language', risk: 0,
    keywords: ['speak swahili', 'speak english', 'speak sheng', 'switch to swahili', 'switch to english', 'switch to sheng', 'in swahili', 'in english', 'in sheng', 'kiswahili', 'english please', 'swahili please'],
    minScore: 2,
    handler: function (text) {
      var lang = 'en';
      if (/swahili|kiswahili|sw/i.test(text)) lang = 'sw';
      else if (/sheng/i.test(text)) lang = 'sheng';
      V.updateConfig({ responseLanguage: lang, language: lang === 'en' ? 'en' : lang });
      var names = { en: 'English', sw: 'Swahili', sheng: 'Sheng' };
      V.respond('Switching to ' + names[lang] + '.');
      return true;
    }
  });

  /* ── Page-specific command registration hook ──────────────────────────── */
  // Pages can call HelaVoice.registerCommand / registerFallback after load.
  // The widget file registers UI + page-specific commands.

  V.log('Hela Voice engine loaded');
})();