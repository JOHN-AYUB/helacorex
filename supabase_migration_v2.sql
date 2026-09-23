-- ═══════════════════════════════════════════════════════════════════════════
-- HELACORE OS — USER INTELLIGENCE MIGRATION
-- "Train the system to understand the goals and optimize for the user."
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. USER BUSINESS PROFILE (the soul of the system) ─────────────────────
-- This table holds everything the system needs to understand the user's business.
-- Every insight, recommendation, and forecast flows through this profile.
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- WHO they are
  business_name TEXT NOT NULL DEFAULT '',
  industry TEXT DEFAULT '',
  business_stage TEXT DEFAULT 'Idea',
  business_size TEXT DEFAULT '1-5 employees',
  founded_year NUMERIC DEFAULT 0,
  business_model TEXT DEFAULT '',           -- e.g. 'B2C Retail', 'B2B SaaS', 'Marketplace'
  value_proposition TEXT DEFAULT '',        -- what makes them unique

  -- WHERE they operate
  country TEXT DEFAULT 'Kenya',
  city TEXT DEFAULT '',
  region TEXT DEFAULT '',                   -- e.g. 'East Africa', 'Nairobi Metro'
  currency TEXT DEFAULT 'KES',
  target_market TEXT DEFAULT '',            -- e.g. 'Urban youth', 'SMEs', 'Farmers'

  -- WHAT they sell
  products_count NUMERIC DEFAULT 0,
  avg_order_value NUMERIC DEFAULT 0,
  primary_revenue_stream TEXT DEFAULT '',   -- e.g. 'Product Sales', 'Subscriptions', 'Services'
  secondary_revenue_streams TEXT DEFAULT '[]'::jsonb,

  -- HOW they grow
  monthly_revenue_target NUMERIC DEFAULT 0,
  yearly_revenue_target NUMERIC DEFAULT 0,
  growth_rate_target NUMERIC DEFAULT 0,     -- % monthly growth target
  break_even_date DATE,
  next_milestone TEXT DEFAULT '',           -- e.g. 'Reach 100 customers', 'Launch new product'

  -- WHAT challenges them
  biggest_challenge TEXT DEFAULT '',        -- free text: what keeps them up at night
  top_priorities TEXT DEFAULT '[]'::jsonb,  -- ordered list: ["Reduce costs", "Get more customers"]
  pain_points TEXT DEFAULT '[]'::jsonb,     -- specific problems: [{"area": "Marketing", "desc": "Low visibility"}]

  -- HOW they want to grow
  funding_status TEXT DEFAULT 'Bootstrapped', -- Bootstrapped, Seeking, Funded, Grant
  funding_needed NUMERIC DEFAULT 0,
  investor_readiness TEXT DEFAULT 'Not Ready', -- Not Ready, Preparing, Investor Ready

  -- SYSTEM LEARNING (updated by the intelligence engine)
  health_score_history JSONB DEFAULT '[]'::jsonb,  -- [{date, score}]
  revenue_history JSONB DEFAULT '[]'::jsonb,       -- [{date, amount}]
  goal_progress_history JSONB DEFAULT '[]'::jsonb,  -- [{date, goal_id, progress}]
  ai_insights_generated NUMERIC DEFAULT 0,
  last_ai_analysis TIMESTAMPTZ,
  system_confidence NUMERIC DEFAULT 0,  -- how well the system understands this business (0-100)

  -- PREFERENCES
  ai_personality TEXT DEFAULT 'Professional',
  notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb,
  dashboard_layout TEXT DEFAULT 'default',
  theme TEXT DEFAULT 'dark',
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'Africa/Nairobi',

  -- METADATA
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step NUMERIC DEFAULT 0,
  last_active TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. USER GOALS (targets the system works toward) ──────────────────────
-- Every goal is a commitment the system tracks, optimizes, and reports on.
CREATE TABLE IF NOT EXISTS user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- WHAT the goal is
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'Revenue',  -- Revenue, Cost, Customer, Growth, Operational, Personal
  priority NUMERIC DEFAULT 1,       -- 1=Highest, 5=Lowest

  -- TARGET
  target_value NUMERIC DEFAULT 0,
  current_value NUMERIC DEFAULT 0,
  unit TEXT DEFAULT '',             -- e.g. 'KES', 'customers', '%', 'months'
  target_date DATE,

  -- PROGRESS
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'achieved', 'paused', 'abandoned', 'overdue')),
  progress_pct NUMERIC DEFAULT 0,   -- computed: (current/target)*100
  milestones JSONB DEFAULT '[]'::jsonb, -- [{name, target, reached, date}]

  -- INTELLIGENCE
  projected_completion DATE,        -- AI prediction
  confidence NUMERIC DEFAULT 50,    -- AI confidence in achievement (0-100)
  recommendations JSONB DEFAULT '[]'::jsonb, -- AI-generated steps to achieve

  -- TRACKING
  last_progress_update TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. USER SNAPSHOTS (periodic health snapshots for progress tracking) ────
-- The system takes a "snapshot" of the business health at regular intervals.
-- This is how it learns if the business is improving or declining.
CREATE TABLE IF NOT EXISTS user_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- SNAPSHOT DATA
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  health_score NUMERIC DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  expenses NUMERIC DEFAULT 0,
  profit NUMERIC DEFAULT 0,
  cash_flow NUMERIC DEFAULT 0,
  customer_count NUMERIC DEFAULT 0,
  inventory_value NUMERIC DEFAULT 0,

  -- GOALS
  goals_achieved NUMERIC DEFAULT 0,
  goals_active NUMERIC DEFAULT 0,
  overall_progress NUMERIC DEFAULT 0,  -- avg progress across all active goals

  -- AI ANALYSIS
  ai_summary TEXT DEFAULT '',
  top_risk TEXT DEFAULT '',
  top_opportunity TEXT DEFAULT '',
  recommendations_count NUMERIC DEFAULT 0,

  -- COMPARISON
  prev_snapshot_id UUID REFERENCES user_snapshots(id),
  revenue_change_pct NUMERIC DEFAULT 0,
  health_change NUMERIC DEFAULT 0,
  trend TEXT DEFAULT 'stable' CHECK (trend IN ('improving', 'stable', 'declining')),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. AI RECOMMENDATIONS LOG (what the system suggested and what happened) ─
-- This is how the system learns: it remembers its suggestions and tracks outcomes.
CREATE TABLE IF NOT EXISTS ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- WHAT was recommended
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  expected_impact TEXT DEFAULT '',   -- e.g. '+15% revenue', '-20% costs'

  -- LINKS to goals
  related_goal_id UUID REFERENCES user_goals(id),
  goal_impact_pct NUMERIC DEFAULT 0, -- estimated impact on goal progress

  -- STATUS
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'acted', 'dismissed', 'expired')),
  user_feedback TEXT DEFAULT '',     -- user's response: 'helpful', 'not_relevant', etc.
  outcome TEXT DEFAULT '',           -- what actually happened after action

  -- CONTEXT
  generated_from TEXT DEFAULT '',    -- what data triggered this recommendation
  data_snapshot JSONB DEFAULT '{}', -- KPIs at time of recommendation

  created_at TIMESTAMPTZ DEFAULT now(),
  viewed_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ
);

-- ─── 5. ROW LEVEL SECURITY ─────────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own profile" ON user_profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can manage their own goals" ON user_goals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own snapshots" ON user_snapshots
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own recommendations" ON ai_recommendations
  FOR ALL USING (auth.uid() = user_id);

-- ─── 6. REALTIME ───────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE user_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_recommendations;

-- ─── 7. INDEXES for performance ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_profiles_industry ON user_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_user_profiles_stage ON user_profiles(business_stage);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_status ON user_goals(status);
CREATE INDEX IF NOT EXISTS idx_user_goals_category ON user_goals(category);
CREATE INDEX IF NOT EXISTS idx_user_snapshots_user_date ON user_snapshots(user_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user ON ai_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_recommendations_status ON ai_recommendations(status);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! The system now has the tables to understand every user.
-- Next: backend endpoints + dashboard onboarding flow.
-- ═══════════════════════════════════════════════════════════════════════════
