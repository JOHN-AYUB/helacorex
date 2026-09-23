-- ═══════════════════════════════════════════════════════════════════════════
-- HELACORE DASHBOARD — Supabase Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. BUSINESSES TABLE (primary business identity) ──────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT '',
  industry TEXT DEFAULT '',
  business_stage TEXT DEFAULT 'Startup',
  business_size TEXT DEFAULT '',
  currency TEXT DEFAULT 'KES',
  country TEXT DEFAULT '',
  city TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  website TEXT DEFAULT '',
  ai_personality TEXT DEFAULT 'Professional',
  plan TEXT DEFAULT 'starter',
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'Africa/Nairobi',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 2. TRANSACTIONS TABLE (real financial data) ──────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Income', 'Expense', 'Transfer')),
  category TEXT DEFAULT 'General',
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'KES',
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'failed', 'refunded')),
  supplier TEXT DEFAULT '',
  customer TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 3. INVENTORY TABLE (real stock data) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  stock NUMERIC NOT NULL DEFAULT 0,
  min_stock NUMERIC DEFAULT 0,
  price NUMERIC DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  unit TEXT DEFAULT 'units',
  sku TEXT DEFAULT '',
  supplier TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 4. CUSTOMERS TABLE (real customer data) ──────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  total_orders NUMERIC DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  last_purchase TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 5. EMPLOYEES TABLE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'Employee',
  department TEXT DEFAULT '',
  salary NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 6. SUPPLIERS TABLE ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact TEXT DEFAULT '',
  lead_time_days NUMERIC DEFAULT 7,
  reliability_score NUMERIC DEFAULT 85,
  total_orders NUMERIC DEFAULT 0,
  total_spend NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 7. WORKSPACES TABLE (dashboard identity + settings) ─────────────────
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT DEFAULT '',
  industry TEXT DEFAULT '',
  country TEXT DEFAULT '',
  city TEXT DEFAULT '',
  currency TEXT DEFAULT 'KES',
  ai_personality TEXT DEFAULT 'Professional',
  plan TEXT DEFAULT 'starter',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 8. AI CONVERSATIONS TABLE (AI advisor memory) ───────────────────────
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  model TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 9. BODY SYSTEMS STATUS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS body_systems (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  health NUMERIC DEFAULT 90,
  status TEXT DEFAULT 'active',
  last_signal TIMESTAMPTZ DEFAULT now()
);

-- ─── 10. ROW LEVEL SECURITY ───────────────────────────────────────────────
-- Users can only see their own data

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_systems ENABLE ROW LEVEL SECURITY;

-- Business owners can read/write their own businesses
CREATE POLICY "Users can manage their own business" ON businesses
  FOR ALL USING (auth.uid() = id);

-- Transactions: users can see their own
CREATE POLICY "Users can manage their own transactions" ON transactions
  FOR ALL USING (auth.uid() = user_id);

-- Inventory: users can see their own
CREATE POLICY "Users can manage their own inventory" ON inventory
  FOR ALL USING (auth.uid() = user_id);

-- Customers: users can see their own
CREATE POLICY "Users can manage their own customers" ON customers
  FOR ALL USING (auth.uid() = user_id);

-- Employees: users can see their own
CREATE POLICY "Users can manage their own employees" ON employees
  FOR ALL USING (auth.uid() = user_id);

-- Suppliers: users can see their own
CREATE POLICY "Users can manage their own suppliers" ON suppliers
  FOR ALL USING (auth.uid() = user_id);

-- Workspaces: users can see their own
CREATE POLICY "Users can manage their own workspace" ON workspaces
  FOR ALL USING (auth.uid() = id);

-- AI Conversations: users can see their own
CREATE POLICY "Users can manage their own AI conversations" ON ai_conversations
  FOR ALL USING (auth.uid() = user_id);

-- Body Systems: users can see their own
CREATE POLICY "Users can manage their own body systems" ON body_systems
  FOR ALL USING (auth.uid() = user_id);

-- ─── 9. ENABLE REALTIME ──────────────────────────────────────────────────
-- Allow Supabase Realtime to broadcast changes to these tables

ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_conversations;

-- ─── 10. INDEXES for performance ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock ON inventory(stock);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE! Now run dashboard.html in your browser.
-- Tables will populate as businesses sign up and add data.
-- Until then, the dashboard uses industry-appropriate demo data.
-- ═══════════════════════════════════════════════════════════════════════════
