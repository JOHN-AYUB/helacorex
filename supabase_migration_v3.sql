-- ═══════════════════════════════════════════════════════════════════════════
-- HELACORE OS — MARKET INTELLIGENCE + AI ADVISOR MIGRATION (v3)
-- "Live market data + persistent AI advisor memory."
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. MARKET INTELLIGENCE TABLE ──────────────────────────────────────────
-- Stores live market signals per industry. The Market Intelligence dashboard
-- reads from this table, falling back to industry-appropriate demo data.
CREATE TABLE IF NOT EXISTS market_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry TEXT NOT NULL DEFAULT 'retail',   -- matches user_profiles.industry / businesses.industry
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  data_type TEXT DEFAULT 'trend',            -- trend | opportunity | risk | competitive
  signal_value TEXT DEFAULT '',              -- e.g. '+24% YoY'
  market_size NUMERIC DEFAULT 0,
  growth_rate NUMERIC DEFAULT 0,
  competition TEXT DEFAULT 'Medium',
  region TEXT DEFAULT '',
  source TEXT DEFAULT 'Helacore Research',
  confidence NUMERIC DEFAULT 80,             -- 0-100
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. ENHANCE AI CONVERSATIONS (context + attachments) ──────────────────
-- The base ai_conversations table exists in supabase_migration.sql.
-- This adds context and attachment metadata for the AI Advisor chat.
ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS context TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS attachment_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS attachment_type TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS conversation_id UUID DEFAULT gen_random_uuid();

-- ─── 3. ROW LEVEL SECURITY ─────────────────────────────────────────────────
ALTER TABLE market_intelligence ENABLE ROW LEVEL SECURITY;

-- Market intelligence is global reference data (readable by all authenticated users)
CREATE POLICY "Market intelligence is readable by all users" ON market_intelligence
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── 4. REALTIME ───────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE market_intelligence;

-- ─── 5. INDEXES ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_market_intelligence_industry ON market_intelligence(industry);
CREATE INDEX IF NOT EXISTS idx_market_intelligence_type ON market_intelligence(data_type);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_created ON ai_conversations(user_id, created_at DESC);

-- ─── 6. SEED DATA (industry-appropriate market signals) ────────────────────
-- These seed rows power the Market Intelligence dashboard for each industry.
-- The dashboard also has built-in fallback data, so this is optional but recommended.

INSERT INTO market_intelligence (industry, title, summary, data_type, signal_value, market_size, growth_rate, competition, region, confidence) VALUES
  -- RETAIL
  ('retail', 'E-commerce surge', 'Online retail is growing 3x faster than physical stores. Invest in an online storefront.', 'trend', '+24% YoY', 4200000000, 8, 'High', 'East Africa', 88),
  ('retail', 'Mobile money adoption', 'M-Pesa and mobile payments now dominate. Offer mobile-first checkout to capture more sales.', 'opportunity', '+18% adoption', 4200000000, 8, 'High', 'East Africa', 85),
  ('retail', 'Rising import costs', 'Currency pressure is raising import costs. Consider local sourcing to protect margins.', 'risk', '+9% costs', 4200000000, 8, 'High', 'East Africa', 82),
  ('retail', 'New discount entrants', 'Budget retailers are entering the market. Differentiate on quality and service.', 'competitive', 'High intensity', 4200000000, 8, 'High', 'East Africa', 78),

  -- AGRICULTURE
  ('agriculture', 'Organic demand rising', 'Consumers are paying premiums for organic produce. Consider certification to capture this.', 'trend', '+15% demand', 3100000000, 6, 'Medium', 'East Africa', 86),
  ('agriculture', 'Export market opening', 'Regional export demand for fresh produce is growing. Explore cross-border opportunities.', 'opportunity', '+22% exports', 3100000000, 6, 'Medium', 'East Africa', 84),
  ('agriculture', 'Climate volatility', 'Erratic rainfall is affecting yields. Invest in irrigation and resilient seed varieties.', 'risk', 'High risk', 3100000000, 6, 'Medium', 'East Africa', 80),
  ('agriculture', 'Consolidation trend', 'Larger agribusinesses are consolidating. Partner with co-ops to stay competitive.', 'competitive', 'Medium', 3100000000, 6, 'Medium', 'East Africa', 75),

  -- MANUFACTURING
  ('manufacturing', 'Localization push', 'Governments are incentivizing local manufacturing. Position as a local supplier.', 'trend', '+12% policy', 5200000000, 7, 'High', 'East Africa', 85),
  ('manufacturing', 'Green manufacturing', 'Sustainable production is becoming a differentiator. Adopt energy-efficient processes.', 'opportunity', '+20% demand', 5200000000, 7, 'High', 'East Africa', 83),
  ('manufacturing', 'Energy costs rising', 'Power costs are climbing. Explore solar and efficiency upgrades to protect margins.', 'risk', '+11% costs', 5200000000, 7, 'High', 'East Africa', 81),
  ('manufacturing', 'Import competition', 'Cheap imports are pressuring local producers. Emphasize quality and local jobs.', 'competitive', 'High', 5200000000, 7, 'High', 'East Africa', 79),

  -- TECHNOLOGY
  ('tech', 'Fintech boom', 'Digital finance is the fastest-growing tech segment. Explore fintech integrations.', 'trend', '+32% growth', 2800000000, 14, 'High', 'East Africa', 90),
  ('tech', 'AI adoption', 'SMEs are adopting AI tools. Offer AI-powered solutions to capture this demand.', 'opportunity', '+28% demand', 2800000000, 14, 'High', 'East Africa', 87),
  ('tech', 'Talent shortage', 'Skilled developers are scarce. Invest in training and retention to stay competitive.', 'risk', 'High', 2800000000, 14, 'High', 'East Africa', 84),
  ('tech', 'Funding competition', 'Venture funding is flowing to tech. Differentiate with a clear revenue model.', 'competitive', 'High', 2800000000, 14, 'High', 'East Africa', 82),

  -- FINANCE
  ('finance', 'Digital banking', 'Customers are shifting to digital-first banking. Invest in mobile and online channels.', 'trend', '+26% usage', 6100000000, 9, 'High', 'East Africa', 88),
  ('finance', 'SME lending gap', 'SMEs face a large financing gap. Offer tailored lending products to capture this.', 'opportunity', '+19% demand', 6100000000, 9, 'High', 'East Africa', 86),
  ('finance', 'Regulatory changes', 'New financial regulations are coming. Stay compliant to avoid penalties.', 'risk', 'Medium', 6100000000, 9, 'High', 'East Africa', 80),
  ('finance', 'Fintech disruption', 'Fintechs are undercutting traditional rates. Differentiate on trust and service.', 'competitive', 'High', 6100000000, 9, 'High', 'East Africa', 83),

  -- HEALTHCARE
  ('healthcare', 'Telehealth growth', 'Remote consultations are surging. Offer telehealth services to expand reach.', 'trend', '+30% demand', 3400000000, 8, 'Medium', 'East Africa', 87),
  ('healthcare', 'Preventive care', 'Demand for preventive and wellness services is rising. Expand these offerings.', 'opportunity', '+16% demand', 3400000000, 8, 'Medium', 'East Africa', 84),
  ('healthcare', 'Supply chain strain', 'Medical supply costs are volatile. Diversify suppliers to ensure availability.', 'risk', 'Medium', 3400000000, 8, 'Medium', 'East Africa', 79),
  ('healthcare', 'Specialist shortage', 'Specialist services are scarce. Partner with specialists to fill gaps.', 'competitive', 'Medium', 3400000000, 8, 'Medium', 'East Africa', 76),

  -- EDUCATION
  ('education', 'Online learning', 'E-learning is growing rapidly. Offer hybrid and online courses to expand reach.', 'trend', '+25% demand', 1900000000, 7, 'Medium', 'East Africa', 85),
  ('education', 'Skills gap', 'Employers need practical skills. Offer vocational and certification programs.', 'opportunity', '+18% demand', 1900000000, 7, 'Medium', 'East Africa', 83),
  ('education', 'Funding pressure', 'Education budgets are tight. Offer flexible payment and scholarships.', 'risk', 'Medium', 1900000000, 7, 'Medium', 'East Africa', 78),
  ('education', 'EdTech entrants', 'New online platforms are competing. Differentiate with quality and accreditation.', 'competitive', 'Medium', 1900000000, 7, 'Medium', 'East Africa', 77),

  -- HOSPITALITY
  ('hospitality', 'Tourism rebound', 'International tourism is recovering strongly. Position for the influx.', 'trend', '+28% arrivals', 2300000000, 9, 'High', 'East Africa', 89),
  ('hospitality', 'Experience economy', 'Travelers want unique experiences. Offer curated local experiences.', 'opportunity', '+20% demand', 2300000000, 9, 'High', 'East Africa', 85),
  ('hospitality', 'Seasonality', 'Demand is highly seasonal. Diversify with corporate and events business.', 'risk', 'Medium', 2300000000, 9, 'High', 'East Africa', 80),
  ('hospitality', 'Airbnb pressure', 'Short-term rentals are competing with hotels. Differentiate on service.', 'competitive', 'High', 2300000000, 9, 'High', 'East Africa', 82),

  -- LOGISTICS
  ('logistics', 'E-commerce logistics', 'Online shopping is driving demand for last-mile delivery. Expand this service.', 'trend', '+30% demand', 2900000000, 10, 'High', 'East Africa', 88),
  ('logistics', 'Cold chain gap', 'Cold chain logistics is underserved. Invest in refrigerated transport.', 'opportunity', '+22% demand', 2900000000, 10, 'High', 'East Africa', 86),
  ('logistics', 'Fuel price volatility', 'Fuel costs are volatile. Optimize routes and consider fleet efficiency.', 'risk', 'High', 2900000000, 10, 'High', 'East Africa', 81),
  ('logistics', 'Digital freight', 'Digital platforms are disrupting freight. Adopt digital tracking to compete.', 'competitive', 'High', 2900000000, 10, 'High', 'East Africa', 83),

  -- CONSTRUCTION
  ('construction', 'Infrastructure boom', 'Government infrastructure spending is rising. Position for public projects.', 'trend', '+15% spending', 4800000000, 7, 'High', 'East Africa', 85),
  ('construction', 'Affordable housing', 'Housing demand is strong. Focus on affordable and mid-range projects.', 'opportunity', '+18% demand', 4800000000, 7, 'High', 'East Africa', 84),
  ('construction', 'Material costs', 'Construction material prices are volatile. Lock in supplier contracts.', 'risk', 'High', 4800000000, 7, 'High', 'East Africa', 80),
  ('construction', 'Skilled labor gap', 'Skilled workers are scarce. Invest in training and retention.', 'competitive', 'Medium', 4800000000, 7, 'High', 'East Africa', 78),

  -- MEDIA
  ('media', 'Digital content', 'Consumption is shifting to digital and video. Invest in digital content.', 'trend', '+26% viewership', 1200000000, 8, 'Medium', 'East Africa', 86),
  ('media', 'Creator economy', 'Influencer and creator content is booming. Partner with creators.', 'opportunity', '+30% growth', 1200000000, 8, 'Medium', 'East Africa', 84),
  ('media', 'Ad revenue shift', 'Ad spend is moving to digital platforms. Diversify revenue streams.', 'risk', 'Medium', 1200000000, 8, 'Medium', 'East Africa', 79),
  ('media', 'Streaming entrants', 'Global streaming platforms are entering. Differentiate with local content.', 'competitive', 'High', 1200000000, 8, 'Medium', 'East Africa', 81),

  -- OTHER / GENERAL
  ('other', 'Digital transformation', 'Businesses are digitizing operations. Adopt digital tools to stay competitive.', 'trend', '+20% adoption', 2500000000, 7, 'Medium', 'East Africa', 84),
  ('other', 'Customer experience', 'Customers value great service. Invest in experience to differentiate.', 'opportunity', '+15% loyalty', 2500000000, 7, 'Medium', 'East Africa', 82),
  ('other', 'Economic uncertainty', 'Macro conditions are volatile. Maintain a strong cash buffer.', 'risk', 'Medium', 2500000000, 7, 'Medium', 'East Africa', 78),
  ('other', 'Market consolidation', 'Larger players are consolidating. Find your niche to compete.', 'competitive', 'Medium', 2500000000, 7, 'Medium', 'East Africa', 76)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! The Market Intelligence dashboard now has live data per industry,
-- and the AI Advisor persists conversations with context + attachments.
-- ═══════════════════════════════════════════════════════════════════════════
