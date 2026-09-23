# Helacore Workspace — File-by-File Functional Map

Scope: `/Users/johnshalom/Downloads/helacore final document copy 3 17.02.21/helacore (3)`
Analysis: read-only. Secrets redacted — locations flagged, values never reproduced.
Stats: **1,515 Python files** across 18 top-level directories + root scripts/HTML/docs. No venv/node_modules counted.

---

## 1. Workspace Overview

| Component | What it is | Entry point |
|---|---|---|
| Root Dashboards | Static single-page HTML UIs backed by `shared-auth.js` (localStorage) | `dashboard.html`, `index.html`, etc. |
| Backend API | FastAPI ("Helacore OS Intelligence Platform" v4.0.0) — user profiles, goals, AI chat, RAG, market live | `backend/main.py` |
| AI Advisor | Packaged FastAPI microservice + CLI; OpenAI→local LoRA fallback | `ai_advisor/api/server.py`, `ai_advisor/main.py` |
| Living OS | Microservices describing a "business body" (ABISAS) | `helacore_living_os/main.py` |
| Autonomous Evolution Engine | HAEE — 12 engines (observe→evolve→deploy) | `helacore_autonomous_evolution_engine/main.py` |
| Genesis Engine | HGE — company/opportunity creation logic | `helacore_genesis_engine/main.py` |
| Digital Twin of Reality | HDTR — 20-layer in-memory twin CRUD | `helacore_digital_twin_of_reality/main.py` |
| Digital Workforce | Agents/workers lifecycle | `helacore_digital_workforce_system/main.py` |
| Industry OS | HIOS — 20-router industry platform | `helacore_industry_os/main.py` |
| LOS | "Living Operating System" — biological metaphor microservices (615 py) | `helacore_los/<subsystem>/main.py` (many empty) |
| Dashboard Engine | 17 sub-projects of dashboard machinery (298 py) | e.g. `helacore-proxime/backend/app/main.py` |
| PMAP | Product-Manufacturing-AI platform + API gateway | `helacore_pmap/backend/fastapi/main.py` |
| Bridged | Industry pipeline agents (oil&gas, manufacturing, agri) | `helacore_bridged/main.py`, `helacore_bridged/app.py` |
| Web App | Next.js 16 / React 19 frontend | `helacore-web/src/app/page.tsx` |
| Shared lib | Cross-subsystem DB clients + models | `shared/` |
| Supabase→Weaviate sync | ETL scripts | `sync/`, `rag/`, `helacore 123/` |

---

## 2. Root Files

### 2.1 Backend API (`backend/`)

- **`backend/main.py`** (1658 lines) — main REST API.
  - App `FastAPI(title="Helacore OS Intelligence Platform", version="4.0.0")`.
  - Lazy clients: `get_supabase()`, `get_weaviate()`, `get_redis()` + `InMemoryCache` fallback (so app runs without Redis).
  - Pydantic models: `ChatMessage`, `RAGQuery`, `TransactionCreate`, `SimulationParams`, `UserProfileCreate`, `GoalCreate`, `GoalUpdate`.
  - Classes: `UserIntelligence` (load/save profile, `goal_aware_chat`, `get_personalized_dashboard`, `generate_recommendations`), `IntelligenceEngine`, `ConnectionManager` (WebSockets).
  - Endpoints: `/health`, `/ws/{user_id}`, `/api/profile/{user_id}` GET/POST, `/api/goals/{user_id}` GET/POST, `/api/goals/{goal_id}` PUT, `/api/snapshots/{user_id}` POST/GET, `/api/recommendations/{user_id}`, `/api/dashboard/{user_id}`, `/api/ai/chat` (OpenAI; cache key = md5 of message only — ignores user context), `/api/rag/search`, `/api/market/live`, `/api/notifications/{user_id}`, `/api/simulate`.
  - Env: `OPENAI_API_KEY`, `OPENAI_MODEL=gpt-4o-mini`, `SUPABASE_URL` (hardcoded default), `SUPABASE_KEY`, `TAVILY_API_KEY`, `OPENWEATHER_API_KEY`, `ELEVENLABS_API_KEY`, `WEAVIATE_URL/KEY`, `REDIS_URL`.
  - CORS `allow_origins=["*"]`. **No auth on any user-scoped endpoint.**

- **`backend/business_intelligence.py`** (1831 lines) — knowledge base for the advisor.
  - `BUSINESS_PROFILES`: **50 business types** (Poultry/Dairy/Greenhouse/Fruit/Vegetable/Fish Farm, Restaurant, Bakery, Salon, DigitalAgency … Online Store).
  - `LOCATION_PROFILES`: **39 Kenyan locations** (Nairobi, Mombasa, Kisumu, Nakuru, Eldoret, Thika, Nyeri, Meru, Embu, Kiambu, Machakos, Narok, Kajiado, Naivasha, Kakamega, Kitale, Malindi, ...).
  - `MODULE_INDUSTRY_RELEVANCE`, `PRIORITY_LEVELS`, `GOAL_TEMPLATES`.
  - Helpers: `get_business_profile`, `get_location_profile`, `get_industry_modules`, `get_priority_config`, `generate_industry_prompt_context`, `generate_goal_recommendations`, `calculate_health_score`.

- **`backend/challenge_intelligence.py`** (955 lines).
  - `BUSINESS_CHALLENGES` (line 13, ~44 entries), `BACKGROUND_CHALLENGES` (line 498).
  - Helpers: `get_combined_challenge_profile` (838), `get_challenge_context_for_prompt` (878), `generate_challenge_specific_recommendations` (911).

- **`backend/requirements.txt`** — fastapi, uvicorn, starlette, python-dotenv, supabase, redis, openai, weaviate-client, httpx, numpy, pandas, scikit-learn, websockets.

### 2.2 Root scripts & client libs

- **`customers_db.py`** — `CustomersDB` (SQLite `helacore_customers.db`): add/update/delete/get customers, paginated `get_customers`, `get_stats`, `get_growth_data`, `get_segmentation_data`, `get_locations(_simple)`, `get_churn_analysis`, `get_clv_data`, `export_customers`, `get_quick_actions_data`.
- **`import_synthetic_users.py`** — `generate_financial_profile`, `map_priority`, `import_users_from_csv`, `generate_supabase_sql`, `generate_json_export`, `generate_training_data`.
- **`download_model.py`** — `get_hf_token`, `download_model`, `main` (HuggingFace download).
- **`start-dashboard.sh`** — venv bootstrap → `pip install -r backend/requirements.txt` → Redis check → `uvicorn main:app` on `0.0.0.0:8000 --reload` → opens `dashboard.html`.
- **`shared-auth.js`** — IIFE exposing `window.HelacoreAuth`:
  - Supabase client (URL + anon key hardcoded — **security**).
  - `VALUE_MAP` (industry/country) → `mapVal`/`getVal`, identity helpers `fullName`/`initials`/`getAvatarUrl`/`applyAvatar`.
  - `loadWorkspace` (localStorage cache `helacore-workspace-cache`, queries `workspaces` table), `init`, `handleLogout`.
- **`theme.js`** — shared theme engine: localStorage `helacore-theme` on `<html data-theme>`, injects light-theme CSS overrides, auto-inserts sun/moon toggle into `.topbar-right`. Used by every HTML dashboard.
- **`.env.example`** — **SECURITY: contains real Supabase URL + anon key, Weaviate API key, OpenAI API key, JWT secret.** Redact before any share.
- **`.env.hns`** — key names only (values redacted): `SUPABASE_URL/KEY`, `OPENAI_API_KEY`, `REDIS_URL`, `KAFKA_BOOTSTRAP_SERVERS`, `WEAVIATE_URL/API_KEY`, `TAVILY_API_KEY`, `ELEVENLABS_API_KEY`, SMTP creds, `NEO*`.
- **`.gitignore`** — standard; ignores `supabase/`.

### 2.3 HTML dashboards (root) — static render-only UIs

All are client-side templates: they render user/workspace data from `localStorage` via `shared-auth.js`; **no direct fetch/API calls** found.

| File | Purpose |
|---|---|
| `index.html` | Landing (marketing) page |
| `signin.html` / `signup.html` | Auth (Supabase-backed) |
| `flow.html` | AI Identity Onboarding wizard |
| `dashboard.html` | Global dashboard hub — populates module grid, greeting, bots (per-page modules list) |
| `financial overview dashboard.html` | Finance KPIs |
| `transactions dashboard.html` | Transactions/reconciliation |
| `inventory dashboard.html` | Stock/reorder |
| `customers dashboard.html` | CRM/retention |
| `suppliers dashboard.html` | Supplier risk/diversification |
| `loan and financing dashboard.html` | Debt/financing |
| `ai advisor dashboard.html` | Advice UI |
| `ai simulations dashboard.html` | What-if scenario UI |
| `opportunities dashboard.html` | Opportunity scoring |
| `reports dashboard.html` | Analytics/export UI |
| `settings dashboard.html` | Settings |
| `help center dashboard.html` | Help/FAQ |
| Marketing/content: `about us.html`, `impact.html`, `health check (= heee.html 1236 lines "Ecosystem: How AI Features Integrate")`, `api access.html`, `careers.html`, `community.html`, `documentation.html`, `features design.html`, `patner program.html`, `privacy policy.html`, `terms of service.html` | Site pages |

### 2.4 Root docs (`.md`) — planning/meta only

`START_HERE.md`, `API_SOURCES.md` (v4.0.0 platform notes), `CHECKLIST.md`, `FINAL_SUMMARY.md`, `FINISHED_WORK_SUMMARY.md`, `MASTER_WORKFLOW.md`, `NEXT_STEPS.md`, `IMPLEMENTATION_COMPLETE.md`, `MODEL_DOWNLOAD_STATUS.md`, `MODEL_RETRAINING_GUIDE.md`, `RETRAINING_SUMMARY.md` — all relate to the AI Advisor model training/retraining effort.

---

## 3. `ai_advisor/` — Packaged AI Advisor (79 py)

- **`__init__.py`** — v1.0.0; exports `HelacoreReasoningEngine`, `ProblemClassifier`, `ResponseBuilder`, `BusinessProfile`, `DerivedMetrics`, `BusinessContext`, `FinancialState`, `Conversation` models, `Diagnosis`/`Action`/`Caution`/`FullAdvisorResponse`/`ToolCall`.
- **`__main__.py` / `main.py`** — CLI subcommands: `serve`, `advise`, `analyze`, `simulate`, `systems`, `train`, `evaluate`, `stats`.
- **`config.py`** — pydantic-settings: `Environment`, `WeaviateSettings` (class `HelacoreBusinessKnowledge`, cosine, localhost:8080), `SupabaseSettings` (anon + service_role + database_url).
- **`core/engine.py`** — `_detect_language`, `_build_system_prompt` (strict JSON-format response contract: diagnosis/actions/cautions/confidence), `_retrieve_rag_context`, `_infer_industry`, `_infer_country`, `HelacoreReasoningEngine.analyze` (OpenAI `json_object` → **fallback to local LoRA model**).
- **`core/local_model.py`** — `LocalModel(base_model="HuggingFaceTB/SmolLM2-135M-Instruct", adapter_path="checkpoints/local_model", max_new_tokens=300, temperature=0.3, top_p=0.9, device="cpu")`; lazy-load, `.available` via `adapter_config.json`; singleton `get_local_model()`.
- **`core/classifier.py`** — two-stage classification (`_KEYWORD_MAP` regex → optional `_llm_classify`); `ClassificationResult`; urgency detection.
- **`core/response.py`** — `ResponseBuilder`: `_extract_json_block`, `_build_diagnosis`, `_build_actions`, `_apply_safety_checks`, `from_llm_output`, `_from_json_payload`, `format_response` (detailed/summary/conversational).
- **`core/deterministic.py`** — `DeterministicResponseBuilder` (offline/rule-based path).
- **`core/finance.py`** — `FinancialCalculator`.
- **`api/server.py`** — FastAPI, lifespan lazy-init (engine/scenario/body-system/feedback/outcome/training/evaluator) in `app.state`; middleware: `log_requests`, `rate_limit_middleware`.
  - Schemas: `AdviserRequestSchema`, `FinancialAnalysisRequest`, `CashFlowRequest`, `SimulationRequest`, `ScenarioConfig`, `SimulationCompareRequest`, `FeedbackRequest`, `ConversationStartRequest`, `TrainingImportRequest`, `HealthResponse`.
  - Endpoints: `GET /api/v1/health` (subsystem status map), `POST /api/v1/advise` (sync + SSE streaming), `/api/v1/financial/analyze`, `/api/v1/financial/cashflow`, `/api/v1/simulate`, `/api/v1/simulate/compare`, `GET /api/v1/systems/status`, `/api/v1/systems/{name}/metrics`, `GET /api/v1/benchmarks` (**STUB — all `None`**, "populated once RAG knowledge base loaded"), `POST /api/v1/feedback`, `GET /api/v1/analytics/feedback`, conversations + training-import endpoints.
- **`helacore_integration/body_systems.py`** — `SystemName` + `HelacoreBodySystemClient`; port map: CIRCULATORY 11001, IMMUNE 10002, LYMPHATIC 8013, ENDOCRINE 10050, NERVOUS 9000, SKELETAL 8000, RESPIRATORY 8080.
- **`helacore_integration/circulatory.py`** — `Packet`, `PacketMetrics`, `DeliveryResult`, `NetworkHealth`, `CirculatoryClient`.
- **`rag/`** — `DocumentChunker`, `EmbeddingService`, `HybridRetriever`, `VectorStoreBackend` (ABC) + `InMemoryBackend` + `WeaviateBackend` + `WeaviateVectorStore`.
- **`indexing/`** — `EmbeddingPipeline`, `IndexMonitor` (health/drift), `IndexingReport`.

---

## 4. Sync & RAG ETL

- **`sync/`** — `sync_service.py` (+ `.backup`), `setup_weaviate.py`, `test_weaviate.py`, `sync_service_health.py`, `requirements.txt`. Purpose: stream Supabase changes into Weaviate for RAG.
- **`rag/`** — `pipeline.py`, `evaluator.py` (`RAGEvaluator` — token-overlap relevance, latency metrics), `__init__.py`.
- **`helacore 123/`** — duplicate/older copies: `rag/evaluator.py` (same), `rag/pipeline.py_`, `rag/test_rag.py_`, `rag/prompts.py_`, `sync/*.py_` (renamed to `_` = disabled), plus a `.env` (**contains secrets — redact if shared**).
- **`models/`** — excluded (model binaries).

---

## 5. Core Microservices (auto-engines)

### `helacore_living_os/` — "ABISAS" (88 py)
- `main.py`: 20+ routers — enterprise_understanding, customer_intelligence, financial_intelligence, product, market, opportunity, risk, goal_alignment, strategic_recommendation, daily_executive_advisor, weekly_strategy_review, monthly_strategic_assessment, decision_intelligence, organizational_learning, etc.
- `core/config.py`: `POSTGRES_DSN`, `REDIS_DSN`, `OPENAI_API_KEY`, `WEAVIATE_URI`, MINIO, `KAFKA_BOOTSTRAP_SERVERS`, `EMBEDDING_MODEL=text-embedding-ada-002`, `OPENAI_MODEL=gpt-4`.
- ⚠️ **Services are in-memory** (e.g. `customer_intelligence/services.py` uses plain dicts) — declared DBs/Redis/Kafka are not actually used to persist.

### `helacore_autonomous_evolution_engine/` — "HAEE" (43 py)
- 12 engines: observation_network, event_intelligence, organizational_state, organizational_physics, evolution_intelligence, candidate_generator, simulation_universe, decision_evaluation, governance_engine, deployment_engine, learning_engine, digital_dna_evolution.

### `helacore_genesis_engine/` — "HGE" (18 py)
- 5 engines: vision_intelligence, opportunity_intelligence, business_architecture, business_genome, organizational_design.

### `helacore_digital_twin_of_reality/` — "HDTR" (70 py)
- 20 layers; **in-memory CRUD** services (e.g. `customer_twin`: add_customer, add_interaction, get_customer_metrics, get_customer_journey).

### `helacore_digital_workforce_system/` (55 py)
- Modules: collaboration, core, governance, integrations, knowledge, lifecycle (training/planning/deployment), memory, performance, workers.

### `helacore_industry_os/` — "HIOS" (74 py)
- 20 routers: industry_registry, digital_identity, knowledge_graph, digital_twin, collaboration_network, workflow_engine, marketplace, resource_exchange, intelligence_network, simulation_universe, innovation/compliance/sustainability platforms, workforce_network, risk_observatory, investment_platform, digital_workforce, governance_engine, evolution_engine, command_center.

---

## 6. `helacore_los/` — Living Operating System (615 py)

Biological metaphor. Per-subsystem `main.py` is a stub **0 bytes** in most subsystems; real logic lives in per-layer modules + orchestrators.

**Functional orchestrators:**
- `helacore_respiratory_system/main.py` (154 lines) — `LAYERS` mapped to `localhost:8001–8023+` (cloud orchestrator, multi_cloud_api, k8s/gpu/edge cluster, inference scheduler, service_mesh, autoscaler, …).
- `digital_cellular_architecture/main.py` (168 lines) — cell orchestrator, WebSocket, works with `shared/respiratory_system_integration.py`.
- `cell_signalling_layer/main.py` (147 lines) — signal bus/orchestration.

**Sample subsystem — circulatory (42 py):** layers 1–11 (enterprise_heart, digital_blood, enterprise_arteries/veins, digital_capillaries, red/white blood cells, metabolism, flow optimization…) each with `main.py` (**0 bytes**) + functional modules (e.g. `layer1_enterprise_heart/distribution_engine.py` 337 lines — real FastAPI + Postgres table DDL via top-level `shared/`; `heartbeat_manager.py` 121 lines). `circulatory_orchestrator/orchestrator.py` imports `from shared.databases.postgres_db import postgres_db` (top-level package).

**`helacore_ckr/` (Cloud-Knowledge-Repository):** 16 knowledge modules, each with a real `api.py` (e.g. `knowledge_acquisition/api.py` — sources CRUD; also knowledge_graph, knowledge_retrieval, knowledge_validation, multimodal_repository, semantic_understanding, knowledge_recommendation, historical_preservation, organizational_wisdom, …) + `core/` + `knowledge_api/`. **`helacore_ckr/main.py` = 0 bytes** — modules never mounted on a root app.

**`hns/` (nervous system):** `system.py` wires `SensoryRouter` → `SynapseNetwork` → `AIOrchestrator`/`HybridMemoryManager` → `ActionRouter` → `AutonomicManager` → plasticity (feedback/knowledge_expansion/autonomous_optimizer); `SignalBus` + `BodyDashboardInterface`; subsystems include docker files (`Dockerfile.hns`, `docker-compose.hns.yml`).

⚠️ **Pattern:** most `helacore_los/<subsystem>/.../main.py` (and top-level `main.py`) are **0 bytes** — skeletons only; functional code is the per-layer engines + top-level `shared/` package.

---

## 7. `helacore_dashboard_engine/` — 17 sub-projects (298 py)

| Component | Purpose |
|---|---|
| `helacore-proxime/` | "Ultimate Adaptive Business Intelligence" API (`backend/app/main.py` — FastAPI v1.0.0, CORS from settings, routers dashboard/business/knowledge/intelligence/security/automation/user/command; static mount) |
| `helacore-universal-promise-engine/` | `api/app.py`: `/api/dashboard`, `/api/decision`, `/api/events`, `/api/simulation`, `/api/rag`, `/api/memory`; core = adaptive_brain, business_dna, dashboard_compiler, digital_twin, memory_system, rag_engine |
| `helacore-wizard/` | `api/app.py`: OAuth login `/api/token`, companies, dashboards, decisions, simulations, meetings; core = company_creator, anomaly_detection, prediction_engine, meeting_intelligence, security_engine; workers/event+prediction+simulation |
| `helacore-customer-router/` | `backend/apps/core/` engines: market (segmentation, competitor_analysis), intelligence_fabric, automation (event_bus, workflow, integration_hub), business (financial/operations/business_model), social (communities/meetings/teams/messages/customers), idea_engine, customer_router (pipeline, optimization, market_connection), dashboard_engine/generator |
| `helacore-render-system/` | `backend/core/`: business_dna, automation_engine, knowledge_graph, dashboard_engine, decision_engine, event_bus, simulation_engine, widget_registry + api/{widget,dashboard,business,websocket} |
| `helacore-today-engine/` | backend + frontend, docker-compose |
| `helacore-dashboard-engine/` | backend + frontend + k8s |
| `helacore-snapdragon/`, `helacore-prime/`, `helacore-wizard/`, `HELACORE_ADAPTIVE_DASHBOARD_OS/` | dashboard variants |
| `helacore_ai_advisor/`, `helacore_behavioral_system/`, `helacore_command_center/`, `helacore_dashboard_memory/`, `helacore_greeting_engine/`, `helacore_self_revolving/`, `user_identity_layer/` | supporting services |

---

## 8. Other Applications

### `helacore-web/` — Next.js frontend
- Next.js 16.2.9, React 19, Tailwind v4, Zustand (`store/useStore.ts`), Recharts, framer-motion, tanstack-query.
- `src/app/page.tsx`: single view-shell with `Sidebar`/`TopBar`/`AIFeed`, screen switcher (overview/simulate/capital/market/marketplace/history), overlays (CommandPalette, VoiceInterface, ExplainDrawer), theme via `data-theme`.
- Screens: `OverviewScreen`, `SimulateScreen`, `CapitalAllocationScreen`, `MarketScreen`, `MarketplaceScreen`, `HistoryScreen`. Data is **mock only** (`lib/mockData.ts`, `lib/types.ts`).

### `helacore_pmap/` — Product-Manufacturing platform (17 py)
- `backend/fastapi/main.py`: **API gateway** — `POST /{service}/{endpoint}` proxying to `localhost:8001–8006` (lead_generation, quotation_ai, chatbot, cad_generation, material_optimization, ar_preview).
- Layers: design_layer (cad_generation, material_optimization, ar_preview), production_layer (predictive_maintenance, mes, quality_control/vision_ai, production_planning), executive_layer (executive_copilot, analytics financial_ai/oee_dashboard), customer_layer (customer_portal chatbot, sales_intelligence lead_generation), logistics_layer (distribution_ai, warehouse_automation, customer_delivery), cloud_infrastructure (k8s), databases (postgresql connection).

### `helacore_bridged/` (99 py)
- **`app.py`**: `Settings` class with **hardcoded secrets as defaults** (Supabase service-role key, Weaviate key, OpenAI key, JWT secret) — **critical security finding**. Also: `system.py` (re-exports hns wiring of `helacore_los/hns`), plus ~30 agent/API modules: input_router, synapse_network, brain (central_brain/orchestrator/hybrid_manager), memory_manager, action_router, decision_maker, planners (upstream/midstream/downstream agents) for oil&gas (`basin_modelling`, `well_trajectory`, `subsurface_imaging`, `spatial_design`, `rlpf_excavator`, `geosteering`), manufacturing (`mes.py`, `manufacturing_neuron`), agri (`agriculture_neuron`, `inventory_neuron`), neurons (legal/pricing), executors (api/database/email/robotics), infra (docker-compose, k8s, prometheus, neo4j schema.cypher, supabase/weaviate/pinecone adapters, kafka consumer/producer, mqtt).
- ⚠️ Mix of a real industry pipeline (oil&gas + manufacturing) with the shared HNS brain, plus hardcoded credentials.

### `helacore-os/`
- `backend/app/helacore-os/install-poetry.py`; `backend/app/main.py` = **0 bytes** (stub).
- `helacore 123/` — legacy/duplicate script copies (superseded by `rag/` + `sync/`).

---

## 9. `checkpoints/` — Model artifacts

- `local_model/` — LoRA adapter for **SmolLM2-135M-Instruct** (`adapter_model.safetensors`, `checkpoint-200`, `checkpoint-300`, tokenizer + chat_template) → consumed by `ai_advisor/core/local_model.py`.
- `checkpoints/` — run history JSONs: `evaluation_*.json`, `fine_tune_*.json`, `pipeline_result_*.json`, `prepared_data_*.json` (~10 prepared sets) + `finetune_data/`.

---

## 10. `shared/` — Cross-subsystem library

- `databases/` — `postgres_db.py` (+`postgresql.py`), `redis_db.py` (+`redis.py`, `redis_client.py`, `cache_db.py`), `kafka_db.py` (+`kafka_client.py`), `neo4j_db.py`, `timescaledb.py`, `weaviate_db.py`.
- `utils/` — `logger.py` (`get_logger`, JSON logging), `config.py` (`get_config`), `metrics.py`.
- `models/` — `user.py`, `hormone.py`, `signal.py`, `cell.py`, `data_packet.py`, `incident.py`, `resource_allocation.py`, `trust_score.py`, `interface.py`, `organelle.py`, `policy.py`, `receptor.py`, … (biological-domain schemas used by LOS subsystems).
- `respiratory_system_integration.py` — cell↔respiratory-system registration client.
- ⚠️ LOS subsystems import `shared.*` by absolute path — works only if the top-level repo is on `sys.path` (fragile if a subsystem is deployed standalone).

---

## 11. `supabase/`
- Empty directory (referenced by `.gitignore`) — **no migrations/SQL in this workspace**.

---

## 12. Final Summary

**Files reviewed:** 1,515 Python files (79 ai_advisor, 615 los, 298 dashboard_engine, 99 bridged, 88 living_os, 74 industry_os, 70 digital_twin, 55 digital_workforce, 43 evolution_engine, 18 genesis_engine, 17 pmap, 3 backend, 3+ shared/rag/sync) + ~29 HTML dashboards, shared-auth.js, theme.js, env files, scripts.

**Key entry points:**
1. `backend/main.py` — user/advice/market API (port 8000).
2. `ai_advisor/api/server.py` — `/api/v1/*` advisor + benchmarks stub.
3. Per-engines: `helacore_living_os/main.py`, `helacore_industry_os/main.py`, HAEE/HGE/HDTR/DigitalWorkforce `/main.py`.
4. LOS orchestrators: `helacore_respiratory_system/main.py`, `digital_cellular_architecture/main.py`, `hns/system.py` (brain).
5. Frontend: `index.html`/`dashboard.html` (static) + `helacore-web` (Next.js, mock data).
6. CLI: `ai_advisor/main.py` (serve/advise/train/evaluate/stats), `customers_db.py`, `import_synthetic_users.py`.

**External services:** Supabase (auth + `workspaces` table), Weaviate (RAG vector store), OpenAI (gpt-4o-mini / gpt-4), Redis, Postgres (declared), Kafka (declared), MinIO (declared), Tavily, OpenWeather, ElevenLabs, HuggingFace (SmolLM2-135M local LoRA fallback), Redis fallback in-memory cache.

**Notable issues / risks:**
1. **Hardcoded secrets committed** — `.env.example`, `backend/main.py` (Supabase URL default), `shared-auth.js` (URL+anon key), `helacore_bridged/app.py` (service-role key, Weaviate key, OpenAI key, JWT secret), `helacore 123/.env`. **Rotate + remove.**
2. **No auth** on any `backend/main.py` user-scoped endpoint (user_id is a plain path param); `helacore-wizard/api/app.py` has real OAuth flow as the exception.
3. **CORS `allow_origins=["*"]`** across backend + microservices.
4. **Microservices are in-memory only** — Living OS, Digital Twin, Workforce services persist nothing despite configured DBs.
5. **0-byte stubs** — `helacore_ckr/main.py`, `helacore-os/backend/app/main.py`, and most `helacore_los/**/main.py`; the LOS "system" is largely skeleton + per-layer modules that never get mounted.
6. **`/api/v1/benchmarks` is a stub** (all `None`).
7. **Fragile imports** — LOS modules `from shared.* import …` requiring top-level package on sys.path.
8. **Frontend disconnect** — HTML dashboards are static (no API calls); helacore-web uses mock data only.
9. **Duplicate/legacy copies** — `helacore 123/` (`*_` disabled), `sync/sync_service.py.backup`.
10. **`/api/ai/chat` cache key ignores user identity** (md5 of message) and CORS/auth inconsistencies across services make the whole mesh demo-grade.