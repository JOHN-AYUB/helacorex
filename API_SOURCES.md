# Helacore OS v4.0.0 — User Intelligence Platform
## "Train the system to understand the goals and optimize for the user."

---

## Core Philosophy

Every file, every function, every endpoint in this system exists for ONE reason: **to understand and serve the user's business**. The system learns from sign-in, understands through profiling, tracks through goals, and optimizes through intelligence.

### How User Intelligence Works

1. **Sign In** → System loads identity (Supabase auth)
2. **Onboarding** → User teaches the system their business (2-min setup)
3. **Profile** → System builds understanding (industry, goals, challenges, targets)
4. **Goals** → User commits to targets → System tracks progress
5. **Snapshots** → System takes periodic health snapshots → Learns trends
6. **Recommendations** → AI generates personalized, goal-aware suggestions
7. **AI Chat** → Every conversation is context-aware (profile + goals + data)
8. **Optimization** → System continuously improves recommendations based on outcomes

---

## All Connected APIs (Already Configured in .env)

Your project already has API keys for ALL of these services. No additional signup needed.

### 🤖 AI & Intelligence

| Service | Purpose | API Key Location | Free Tier |
|---------|---------|-----------------|-----------|
| **OpenAI** (GPT-4o-mini) | AI Advisor chat, recommendations, analysis | `OPENAI_API_KEY` | Pay-per-use (very cheap) |
| **Weaviate Cloud** | Vector database for RAG knowledge base | `WEAVIATE_API_KEY` | 1M objects free |
| **Pinecone** | Alternative vector DB for embeddings | `PINECONE_API_KEY` | 100K vectors free |
| **Tavily** | Live web search for RAG + opportunity scanning | `TAVILY_API_KEY` | 1K searches/month free |
| **ElevenLabs** | Text-to-Speech for voice AI advisor | `ELEVENLABS_API_KEY` | 10K chars/month free |

### 📊 Data & Database

| Service | Purpose | API Key Location |
|---------|---------|-----------------|
| **Supabase** | Primary database, auth, realtime subscriptions | `SUPABASE_URL`, `SUPABASE_KEY` |
| **Neo4j Aura** | Graph database for business relationship mapping | `NEO4J_URI`, `NEO4J_PASSWORD` |
| **PostgreSQL** | Local fallback database | `POSTGRES_*` |

### 💰 Payments & Finance

| Service | Purpose | API Key Location |
|---------|---------|-----------------|
| **M-Pesa (Safaricom Daraja)** | Mobile money payments, STK push, C2B, B2C | `MPESA_API_KEY`, `MPESA_API_SECRET` |
| **Stripe** | Card payments, subscriptions, invoicing | `STRIPE_API_KEY` |
| **Open Exchange Rates** | Live forex rates (KES, USD, EUR, GBP) | Free API (no key needed) |

### 🌍 External Data Feeds

| Service | Purpose | API Key Location |
|---------|---------|-----------------|
| **OpenWeatherMap** | Weather data for agricultural planning | `OPENWEATHER_API_KEY` |
| **HubSpot CRM** | Customer relationship management | `HUBSPOT_API_KEY` |
| **Google APIs** | Analytics, Sheets, Calendar integration | `GOOGLE_API_KEY` |
| **Safaricom IoT** | IoT device integration | `SAFARICOM_IOT_X_API_KEY` |

### 📧 Communication

| Service | Purpose | API Key Location |
|---------|---------|-----------------|
| **SMTP (Gmail)** | Email notifications, reports | `SMTP_*` |

---

## Backend API Endpoints (Port 8000)

### AI Advisor
- `POST /api/ai/chat` — Real OpenAI chat with full business context
- `POST /api/tts` — Text-to-speech via ElevenLabs

### RAG (Retrieval-Augmented Generation)
- `POST /api/rag/search` — Combined Tavily (web) + Weaviate (knowledge) search

### Market Intelligence
- `GET /api/market/live` — Live forex, weather, commodities
- `GET /api/market/commodities` — Weather data for agriculture
- `GET /api/market/forex` — Exchange rates

### Business Data
- `GET /api/transactions/{user_id}` — User's transactions
- `POST /api/transactions/{user_id}` — Create new transaction
- `GET /api/analytics/{user_id}` — Computed business analytics

### Notifications & Risk
- `GET /api/notifications/{user_id}` — Real-time risk alerts (low stock, expense anomalies, cash flow warnings, weather alerts, FX alerts)

### Opportunities
- `GET /api/opportunities/{user_id}` — Live scanning for grants, funding, events

### Body Systems
- `GET /api/body-systems/status` — Status of all 12 biological metaphor systems

---

## How to Run

### Option 1: One-Click Start
```bash
./start-dashboard.sh
```

### Option 2: Manual Start
```bash
# Terminal 1: Start backend
cd backend
pip install fastapi uvicorn supabase weaviate-client openai httpx
uvicorn main:app --reload --port 8000

# Terminal 2: Open dashboard
open dashboard.html
```

### Option 3: Just the Dashboard (No Backend)
```bash
open dashboard.html
# The dashboard works standalone with Supabase direct connection
# Backend adds: AI advisor, RAG search, live notifications, market data
```

---

## Database Setup

### Step 1: Run SQL Migration
1. Go to [Supabase Dashboard → SQL Editor](https://supabase.com/dashboard/project/megtqhibcdlbpuisvtgo/sql/new)
2. Paste contents of `supabase_migration.sql`
3. Click "Run"

### Tables Created
- `businesses` — Business identity & settings
- `transactions` — Financial records (Income/Expense/Transfer)
- `inventory` — Stock management
- `customers` — CRM data
- `employees` — Staff records
- `suppliers` — Supply chain
- `workspaces` — Dashboard identity
- `ai_conversations` — AI advisor memory
- `body_systems` — Biological system status

### Realtime Enabled
- `transactions` — Live transaction updates
- `inventory` — Live stock changes
- `customers` — Live customer updates
- `ai_conversations` — Live AI chat history

---

## Dashboard Features (Now Live)

| Feature | Status | Source |
|---------|--------|--------|
| AI Advisor Chat | ✅ Live | OpenAI GPT-4o-mini via backend |
| RAG Search | ✅ Live | Tavily + Weaviate |
| Notifications | ✅ Auto-refresh | Backend risk detection engine |
| Market Intelligence | ✅ Live | Forex API + OpenWeatherMap |
| Body Systems Status | ✅ Live | Backend 12-system monitor |
| Opportunity Scanning | ✅ Live | Tavily web search |
| Transaction Management | ✅ Live | Supabase CRUD |
| Real-time Data | ✅ Live | Supabase Realtime + WebSocket |
| Voice AI | ✅ Live | ElevenLabs TTS |
| Expense Anomaly Detection | ✅ Live | NumPy IQR Statistical Analysis |
| Cash Flow Forecasting | ✅ Live | Exponential Smoothing (NumPy/scikit-learn) |
| Health Score | ✅ Live | Multi-factor calculation |
| Pricing Optimization | ✅ Live | Elasticity analysis engine |
| What-if Simulation | ✅ Live | Business scenario modeling |
| Redis Caching | ✅ Live | Persistent cache (InMemoryCache fallback) |
| WebSocket Streaming | ✅ Live | Real-time push to dashboard |
| 3D Ecosystem | ✅ Live | Three.js node visualization |

---

## Tech Stack (Per Architecture Spec)

### Phase 1 — Foundation (✅ Implemented)
| Layer | Technology | Status |
|-------|-----------|--------|
| Frontend | Single-file HTML + Tailwind CSS | ✅ Current |
| Backend API | Python FastAPI | ✅ v3.0.0 |
| Cache | Redis (InMemoryCache fallback) | ✅ Active |
| Database | Supabase (PostgreSQL) | ✅ Connected |
| Vector DB | Weaviate Cloud | ✅ Connected |
| AI Models | OpenAI GPT-4o-mini | ✅ Connected |
| Real-time | Supabase Realtime + WebSocket | ✅ Active |

### Phase 2 — Immersive Visualization (✅ Implemented)
| Layer | Technology | Status |
|-------|-----------|--------|
| 3D Scenes | Three.js (Business Ecosystem) | ✅ Active |
| Charts | Chart.js + custom Canvas | ✅ Active |
| Animations | CSS + requestAnimationFrame | ✅ Active |
| Intelligence | NumPy/Pandas/scikit-learn | ✅ Active |
| WebSocket | Real-time streaming to UI | ✅ Active |

### Phase 3 — Performance (🔜 Next)
| Layer | Technology | Status |
|-------|-----------|--------|
| Hot Paths | Rust/WASM (compiled to browser) | 🔜 Planned |
| Analytics DB | ClickHouse (OLAP) | 🔜 Planned |
| Event Bus | Apache Kafka | 🔜 Planned |
| Streaming | Apache Flink | 🔜 Planned |

### Phase 4 — Intelligence (🔜 Future)
| Layer | Technology | Status |
|-------|-----------|--------|
| API Gateway | Go (high-concurrency proxy) | 🔜 Planned |
| Graph DB | Neo4j (relationship intelligence) | 🔜 Planned |
| NLP | OpenAI + custom embeddings | 🔜 Planned |
| Workflow | Apache Airflow (data pipelines) | 🔜 Planned |

---

## Backend Endpoints (22 Total)

### User Intelligence (NEW in v4.0.0)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/profile/{uid}` | Load user business profile |
| POST | `/api/profile/{uid}` | Save/update business profile |
| GET | `/api/goals/{uid}` | Load all user goals with progress |
| POST | `/api/goals/{uid}` | Create a new goal |
| PUT | `/api/goals/{goal_id}` | Update goal progress |
| POST | `/api/snapshots/{uid}` | Take a health snapshot |
| GET | `/api/snapshots/{uid}` | Get health snapshot history |
| GET | `/api/recommendations/{uid}` | Get personalized AI recommendations |
| GET | `/api/dashboard/{uid}` | Full personalized dashboard data |

### Core Platform
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Health check + system status |
| WS | `/ws/{user_id}` | Real-time WebSocket streaming |
| POST | `/api/ai/chat` | Goal-aware AI chat (OpenAI) |
| POST | `/api/rag/search` | Tavily web + Weaviate knowledge search |
| GET | `/api/market/live` | Forex rates + weather data |
| GET | `/api/notifications/{uid}` | Risk alerts + anomaly notifications |
| POST | `/api/simulate` | What-if business scenario engine |
| GET | `/api/analytics/{uid}` | Forecast + anomalies + pricing optimization |
| GET | `/api/transactions/{uid}` | Fetch transactions |
| POST | `/api/transactions/{uid}` | Create transaction (invalidates cache) |
| GET | `/api/opportunities/{uid}` | Scan grants, funding, events |
| GET | `/api/body-systems/status` | 12 body system health |
| POST | `/api/tts` | ElevenLabs text-to-speech |

---

## Intelligence Engines

| Engine | Algorithm | Library | Description |
|--------|-----------|---------|-------------|
| Revenue Forecast | Exponential Smoothing | NumPy | 6-month revenue projection |
| Anomaly Detection | IQR (Interquartile Range) | NumPy | Statistical outlier detection |
| Pricing Optimization | Elasticity Analysis | NumPy/Pandas | Price-demand curve optimization |
| Business Simulation | Scenario Modeling | NumPy | What-if analysis with sliders |
| Health Score | Weighted Multi-factor | Python | Composite business health rating |

---

## Frontend Modules

| Module | Purpose | Phase |
|--------|---------|-------|
| `OrgDNA` | User identity + profile + goals + recommendations + snapshots | 1 |
| `Onboarding` | 3-step business profiling for new users | 1 |
| `Store` | Zustand-like reactive state management | 1 |
| `QueryClient` | TanStack Query-like cached data fetching | 1 |
| `WSEngine` | WebSocket real-time connection + auto-reconnect | 1 |
| `LiveDataSource` | Supabase Realtime subscriptions | 1 |
| `BusinessEcosystem3D` | Three.js 3D business visualization | 2 |
| `IntelligenceEngine` | Revenue decomposition + forecasting | 1 |
| `BackendAPI` | FastAPI backend connector (goal-aware AI) | 1 |
| `NotificationEngine` | Auto-refresh risk alerts | 1 |
| `BodySystemsPanel` | 12 biological system health bars | 1 |
| `MarketIntelPanel` | Live forex + weather | 1 |
| `RAGSearchPanel` | Web + knowledge base search | 1 |
| `renderGoalsTracker` | Goal progress visualization | 1 |
| `renderRecommendations` | Personalized AI recommendations display | 1 |
| `renderBusinessSnapshot` | System confidence + health trends | 1 |
| `updatePersonalizedGreeting` | Goal-aware, challenge-aware greeting | 1 |

---

## Environment Variables (.env)

All keys are already configured. Key ones:

```
SUPABASE_URL=https://megtqhibcdlbpuisvtgo.supabase.co
SUPABASE_KEY=<service_role key>
SUPABASE_ANON_KEY=<anon key>
OPENAI_API_KEY=sk-proj-...
TAVILY_API_KEY=tvly-dev-...
WEAVIATE_URL=https://vlmkwxwfrls92rhdlbi1sg.c0.eu-central-1.aws.weaviate.cloud
WEAVIATE_API_KEY=aEdXVi9z...
OPENWEATHER_API_KEY=f0bf9d...
ELEVENLABS_API_KEY=dd6b2a...
MPESA_API_KEY=vKbNNw...
STRIPE_API_KEY=sk_test_...
HUBSPOT_API_KEY=pat-eu1-...
```

⚠️ **SECURITY**: Rotate these keys if they've been exposed in any public repo.
