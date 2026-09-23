-- ==============================================================================
-- HELACORE OS v4.5.0 — SUPABASE MIGRATION V4: AI STUDIO & SYSTEM FACTORY
-- ==============================================================================
-- Enables extreme capability system generation, autonomous multi-agent teams,
-- recursive system decomposition, data schema generation, API contracts,
-- self-testing testbeds, pre-deployment simulations, and marketplace templates.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Enable vector extension for semantic search over system blueprints and code
CREATE EXTENSION IF NOT EXISTS "vector";

-- ==============================================================================
-- 2. CORE STUDIO SYSTEMS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS studio_systems (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    workspace_id UUID,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    industry TEXT NOT NULL DEFAULT 'general',
    architecture_type TEXT NOT NULL DEFAULT 'modular_monolith' 
        CHECK (architecture_type IN ('monolith', 'modular_monolith', 'microservices', 'event_driven', 'serverless', 'edge_hybrid')),
    tech_stack JSONB NOT NULL DEFAULT '{
        "frontend": "react_nextjs",
        "backend": "fastapi_python",
        "database": "postgresql_supabase",
        "cache": "redis",
        "event_broker": "internal_event_bus"
    }'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'architecting', 'building', 'testing', 'simulating', 'deployed', 'active', 'archived', 'failed')),
    version TEXT NOT NULL DEFAULT '1.0.0',
    blueprint JSONB NOT NULL DEFAULT '{}'::jsonb,
    system_graph JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
    health_score INTEGER NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
    confidence_score NUMERIC(5,2) DEFAULT 95.0,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    embedding vector(1536), -- Vector representation of the system specification
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. RECURSIVE SUBSYSTEMS & MODULES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS studio_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES studio_systems(id) ON DELETE CASCADE,
    parent_module_id UUID REFERENCES studio_modules(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    module_key TEXT NOT NULL,
    description TEXT,
    layer TEXT NOT NULL DEFAULT 'business'
        CHECK (layer IN ('core', 'presentation', 'business', 'data', 'integration', 'agentic', 'infrastructure')),
    complexity TEXT NOT NULL DEFAULT 'standard'
        CHECK (complexity IN ('atomic', 'standard', 'composite', 'recursive')),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. GENERATED DATA SCHEMAS & ENTITY MODELS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS studio_data_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES studio_systems(id) ON DELETE CASCADE,
    module_id UUID REFERENCES studio_modules(id) ON DELETE SET NULL,
    entity_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    description TEXT,
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    indexes JSONB NOT NULL DEFAULT '[]'::jsonb,
    foreign_keys JSONB NOT NULL DEFAULT '[]'::jsonb,
    rls_policies JSONB NOT NULL DEFAULT '[]'::jsonb,
    migration_sql TEXT,
    is_synced BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. GENERATED API CONTRACTS & INTERFACES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS studio_api_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES studio_systems(id) ON DELETE CASCADE,
    module_id UUID REFERENCES studio_modules(id) ON DELETE SET NULL,
    endpoint_path TEXT NOT NULL,
    http_method TEXT NOT NULL CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'WS')),
    operation_id TEXT NOT NULL,
    summary TEXT,
    request_schema JSONB DEFAULT '{}'::jsonb,
    response_schema JSONB DEFAULT '{}'::jsonb,
    auth_required BOOLEAN NOT NULL DEFAULT TRUE,
    required_permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
    rate_limit_rpm INTEGER DEFAULT 600,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. GENERATED AGENT TEAMS & CAPABILITIES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS studio_agent_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES studio_systems(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    agent_role TEXT NOT NULL, -- e.g. CEO, CFO, InventoryManager, ProcurementSpecialist
    persona TEXT,
    voice_id TEXT DEFAULT 'EXAVITQu4vr4xnSDxMaL', -- Default Bella
    capabilities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    tools_assigned JSONB NOT NULL DEFAULT '[]'::jsonb,
    autonomy_level INTEGER NOT NULL DEFAULT 3 CHECK (autonomy_level BETWEEN 0 AND 5),
    budget_limit_usd NUMERIC(10,2) DEFAULT 50.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. EVENT-DRIVEN WORKFLOWS & AUTOMATIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS studio_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES studio_systems(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL, -- e.g. event, cron, webhook, state_change, manual
    trigger_event TEXT,        -- e.g. order.created, inventory.low
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    compensation_steps JSONB DEFAULT '[]'::jsonb, -- Rollback / undo handling
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
    execution_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. SYSTEM FACTORY PIPELINE RUNS (10-STAGE RUNTIME)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS studio_build_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES studio_systems(id) ON DELETE CASCADE,
    run_id TEXT NOT NULL UNIQUE,
    trigger_source TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_source IN ('manual', 'voice', 'api', 'evolution_loop')),
    requested_intent TEXT NOT NULL,
    current_stage TEXT NOT NULL DEFAULT 'intent',
    stages_log JSONB NOT NULL DEFAULT '[]'::jsonb,
    artifacts_generated JSONB NOT NULL DEFAULT '{}'::jsonb,
    passed_all_gates BOOLEAN NOT NULL DEFAULT FALSE,
    error_log TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- ==============================================================================
-- 9. SELF-TESTING & QA TEST SUITES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS studio_test_suites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES studio_systems(id) ON DELETE CASCADE,
    build_run_id UUID REFERENCES studio_build_runs(id) ON DELETE CASCADE,
    test_type TEXT NOT NULL CHECK (test_type IN ('unit', 'integration', 'api', 'security', 'regression', 'simulation')),
    total_tests INTEGER NOT NULL DEFAULT 0,
    passed_tests INTEGER NOT NULL DEFAULT 0,
    failed_tests INTEGER NOT NULL DEFAULT 0,
    test_results JSONB NOT NULL DEFAULT '[]'::jsonb,
    failure_classification JSONB DEFAULT '{}'::jsonb,
    suggested_repairs JSONB DEFAULT '[]'::jsonb,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 10. DEPLOYMENTS & RELEASES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS studio_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES studio_systems(id) ON DELETE CASCADE,
    environment TEXT NOT NULL DEFAULT 'development' CHECK (environment IN ('development', 'testing', 'staging', 'production')),
    version TEXT NOT NULL,
    deployment_adapter TEXT NOT NULL DEFAULT 'docker' CHECK (deployment_adapter IN ('local', 'docker', 'cloud', 'serverless')),
    endpoint_url TEXT,
    health_status TEXT NOT NULL DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'degraded', 'offline', 'recovering')),
    metrics JSONB DEFAULT '{"latency_ms": 15, "uptime_pct": 99.99}'::jsonb,
    rollback_target_id UUID REFERENCES studio_deployments(id),
    deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 11. PRE-DEPLOYMENT DIGITAL TWIN SIMULATIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS studio_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    system_id UUID NOT NULL REFERENCES studio_systems(id) ON DELETE CASCADE,
    scenario_name TEXT NOT NULL,
    synthetic_user_count INTEGER NOT NULL DEFAULT 100,
    simulated_days INTEGER NOT NULL DEFAULT 30,
    stress_factors JSONB DEFAULT '{"price_elasticity": -0.4, "supply_delay_days": 3}'::jsonb,
    outcomes JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence_rating TEXT NOT NULL DEFAULT 'high' CHECK (confidence_rating IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 12. TEMPLATES & SYSTEM MARKETPLACE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS studio_marketplace (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- Retail, Agribusiness, Logistics, Healthcare, Education, Financial
    description TEXT NOT NULL,
    blueprint JSONB NOT NULL,
    preview_url TEXT,
    install_count INTEGER NOT NULL DEFAULT 0,
    rating NUMERIC(3,2) DEFAULT 5.00,
    author TEXT NOT NULL DEFAULT 'HelaCore Official',
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 13. INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_studio_systems_business ON studio_systems(business_id);
CREATE INDEX IF NOT EXISTS idx_studio_systems_slug ON studio_systems(slug);
CREATE INDEX IF NOT EXISTS idx_studio_systems_status ON studio_systems(status);
CREATE INDEX IF NOT EXISTS idx_studio_modules_system ON studio_modules(system_id);
CREATE INDEX IF NOT EXISTS idx_studio_data_schemas_system ON studio_data_schemas(system_id);
CREATE INDEX IF NOT EXISTS idx_studio_api_contracts_system ON studio_api_contracts(system_id);
CREATE INDEX IF NOT EXISTS idx_studio_agent_teams_system ON studio_agent_teams(system_id);
CREATE INDEX IF NOT EXISTS idx_studio_workflows_system ON studio_workflows(system_id);
CREATE INDEX IF NOT EXISTS idx_studio_build_runs_system ON studio_build_runs(system_id);
CREATE INDEX IF NOT EXISTS idx_studio_deployments_system ON studio_deployments(system_id);
CREATE INDEX IF NOT EXISTS idx_studio_marketplace_cat ON studio_marketplace(category);

-- GIN index for JSONB deep search
CREATE INDEX IF NOT EXISTS idx_studio_systems_blueprint ON studio_systems USING GIN (blueprint);
CREATE INDEX IF NOT EXISTS idx_studio_systems_graph ON studio_systems USING GIN (system_graph);

-- ==============================================================================
-- 14. ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE studio_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_data_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_api_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_agent_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_build_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_marketplace ENABLE ROW LEVEL SECURITY;

-- Allow users to view & manage systems within their business
CREATE POLICY "Users can manage their business systems" ON studio_systems
    FOR ALL USING (business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
    ));

-- Public marketplace templates are viewable by all authenticated users
CREATE POLICY "Marketplace templates are publicly readable" ON studio_marketplace
    FOR SELECT TO authenticated USING (true);

-- ==============================================================================
-- 15. SEED INITIAL HIGH-VALUE SYSTEM MARKETPLACE TEMPLATES
-- ==============================================================================
INSERT INTO studio_marketplace (title, slug, category, description, blueprint) VALUES
(
    'AgriMarket — Farmers & Offtaker Marketplace',
    'agrimarket-farmers-offtaker',
    'Agribusiness',
    'End-to-end platform connecting farmers, agricultural cooperatives, urban restaurants, and commodity exporters with M-Pesa escrow.',
    '{
        "modules": ["FarmerRegistry", "ProduceCatalog", "OrderEscrow", "LogisticsTracking", "MpesaSettlement", "CropAdvisory"],
        "agents": ["AgriAdvisor", "ProcurementCoordinator", "LogisticsDispatcher"],
        "architecture": "modular_monolith"
    }'::jsonb
),
(
    'FleetLogix — SME Logistics & Fleet OS',
    'fleetlogix-logistics-os',
    'Logistics',
    'Complete fleet management, vehicle telemetry, driver scheduling, fuel expense audits, and client delivery tracking.',
    '{
        "modules": ["FleetRegistry", "DriverDirectory", "DeliveryOrders", "RouteOptimization", "FuelAudits", "ClientPortal"],
        "agents": ["DispatchAgent", "FleetAuditor", "FuelAnalyst"],
        "architecture": "event_driven"
    }'::jsonb
),
(
    'EduCore — Multi-Campus School ERP',
    'educore-school-erp',
    'Education',
    'Student admissions, timetable scheduling, fee payment tracking with M-Pesa paybill, parent communication, and grading reports.',
    '{
        "modules": ["StudentRegistry", "FeeLedger", "AttendanceTracker", "Gradebook", "ParentSMS", "TimetableGenerator"],
        "agents": ["AdmissionsAgent", "FeeReconciler", "AcademicAdvisor"],
        "architecture": "modular_monolith"
    }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON TABLE studio_systems IS 'HelaCore AI Studio: Autonomous System Factory & Multi-Tenant Architecture Fabric';
