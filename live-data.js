/* ═══════════════════════════════════════════════════════════════════════
   HELACORE — LIVE DATA MODULE
   ========================================================================
   Single source for deriving LIVE business data across every Helacore
   dashboard page. Reads the exact same source as dashboard.html:
   HelacoreAuth.currentWorkspace (loaded by shared-auth.js).

   Include AFTER shared-auth.js:
       <script src="shared-auth.js"></script>
       <script src="live-data.js"></script>

   Exposes a global `HelacoreLive` object with:
     - HelacoreLive.financials()      → { revenue, expenses, cash, customers, profit, margin }
     - HelacoreLive.series()          → 6-month revenue/expense/profit series ending at live values
     - HelacoreLive.expenseSplit()    → expense category donut scaled to live expenses
     - HelacoreLive.paymentSplit()    → payment-method donut scaled to live cash
     - HelacoreLive.biz()             → business profile fields (name, industry, country, plan, …)
     - HelacoreLive.fmt(n)            → 'KES 12,345' formatting
     - HelacoreLive.pct(n)            → '43.9%' formatting
     - HelacoreLive.txnScale()        → { income, expense } scale factors for transaction tables
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const MONTHS = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

  const HelacoreLive = {

    /* Core financials — identical keys to dashboard.html */
    financials: function () {
      const ws = (window.HelacoreAuth && HelacoreAuth.currentWorkspace) || {};
      const revenue = Number(ws.monthly_revenue || ws.revenue || 0);
      const expenses = Number(ws.monthly_expenses || ws.expenses || 0);
      const cash = Number(ws.cash_balance || ws.cash || 0);
      const customers = Number(ws.active_customers || ws.customers || 0);
      const profit = revenue - expenses;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return { revenue: revenue, expenses: expenses, cash: cash, customers: customers, profit: profit, margin: margin };
    },

    /* 6-month series that ends at the live values (backcast with growth) */
    series: function () {
      const f = this.financials();
      const mk = function (end, growth) {
        const out = [];
        for (let i = 5; i >= 0; i--) {
          const factor = 1 - (growth * i / 5);
          out.push(Math.max(0, Math.round(end * factor)));
        }
        return out;
      };
      return {
        labels: MONTHS.slice(),
        revenue: mk(f.revenue, 0.25),
        expenses: mk(f.expenses, 0.12),
        profit: mk(f.profit, 0.35)
      };
    },

    /* Expense category donut scaled to live expenses */
    expenseSplit: function () {
      const f = this.financials();
      const weights = [
        { label: 'Inventory', w: 0.35 },
        { label: 'Operations', w: 0.25 },
        { label: 'Rent', w: 0.20 },
        { label: 'Payroll', w: 0.15 },
        { label: 'Utilities & Other', w: 0.05 }
      ];
      return weights.map(function (x) { return { label: x.label, value: Math.round(f.expenses * x.w) }; });
    },

    /* Payment-method donut scaled to live cash */
    paymentSplit: function () {
      const f = this.financials();
      const weights = [
        { label: 'Cash', w: 0.55 },
        { label: 'M-Pesa', w: 0.30 },
        { label: 'Bank Transfer', w: 0.15 }
      ];
      return weights.map(function (x) { return { label: x.label, value: Math.round(f.cash * x.w) }; });
    },

    /* Business profile fields */
    biz: function () {
      const A = window.HelacoreAuth;
      const ws = (A && A.currentWorkspace) || {};
      const meta = (A && A.currentMeta) || {};
      const get = function (k, wk) { return meta[k] || ws[wk || k] || ''; };
      return {
        firstName: get('first_name') || 'there',
        lastName: get('last_name'),
        name: A ? A.fullName() : '',
        businessName: get('business_name', 'business_name') || get('company_name', 'company_name') || 'your business',
        industry: get('industry'),
        country: get('country'),
        city: get('city'),
        currency: get('currency') || 'KES',
        timezone: get('timezone'),
        language: get('language'),
        plan: get('plan') || 'Free',
        stage: get('business_stage'),
        size: get('business_size'),
        website: get('website'),
        desc: get('business_desc'),
        revenueTarget: get('revenue_target'),
        currentRevenue: get('current_revenue'),
        priorities: get('priorities'),
        modules: get('preferred_modules'),
        challenge: get('business_challenge'),
        phone: get('phone'),
        email: (A && A.currentUser && A.currentUser.email) || ''
      };
    },

    /* Formatting helpers */
    fmt: function (n) {
      return 'KES ' + Number(n || 0).toLocaleString();
    },
    pct: function (n, d) {
      return Number(n || 0).toFixed(d === undefined ? 1 : d) + '%';
    },

    /* Scale factors to map a static transaction table onto live totals */
    txnScale: function () {
      const f = this.financials();
      return { income: f.revenue, expense: f.expenses };
    }
  };

  window.HelacoreLive = HelacoreLive;
})();