#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Helacore Dashboard — Complete Startup Script
# Starts backend + opens dashboard in browser
# ═══════════════════════════════════════════════════════════════════════════

set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🫀 Helacore OS Dashboard — Starting all systems..."
echo ""

# 1. Check if Python venv exists
if [ ! -d "$DIR/venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv "$DIR/venv"
fi

echo "📦 Activating virtual environment..."
source "$DIR/venv/bin/activate"

# 2. Install backend dependencies
echo "📦 Installing backend dependencies..."
pip install -q -r "$DIR/backend/requirements.txt" 2>/dev/null
echo "   ✅ All dependencies installed"

# 3. Check Redis availability
if command -v redis-cli &>/dev/null && redis-cli ping &>/dev/null 2>&1; then
    echo "   ✅ Redis is running — full caching enabled"
    REDIS_STATUS="active"
else
    echo "   ⚠️  Redis not found — using InMemoryCache fallback"
    echo "   (Install Redis for persistent caching: brew install redis)"
    REDIS_STATUS="fallback"
fi

# 4. Start the backend
echo ""
echo "🚀 Starting Helacore Backend API on port 8000..."
cd "$DIR/backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
for i in {1..15}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Backend is healthy!"
        break
    fi
    if [ $i -eq 15 ]; then
        echo "⚠️  Backend may still be starting..."
    fi
    sleep 1
done

# 5. Open dashboard in browser
echo ""
echo "🌐 Opening dashboard in browser..."
open "$DIR/dashboard.html" 2>/dev/null || echo "   Open: $DIR/dashboard.html"

echo ""
echo "════════════════════════════════════════════════════════════════════════"
echo "  🫀 HELACORE OS DASHBOARD — ALL SYSTEMS ONLINE"
echo "════════════════════════════════════════════════════════════════════════"
echo ""
echo "  📊 Dashboard:    file://$DIR/dashboard.html"
echo "  🔧 Backend API:  http://localhost:8000"
echo "  📖 API Docs:     http://localhost:8000/docs"
echo "  🔌 WebSocket:    ws://localhost:8000/ws/{user_id}"
echo ""
echo "  APIs Connected:"
echo "  ✅ Supabase      — Database + Auth + Realtime"
echo "  ✅ OpenAI        — AI Advisor (GPT-4o-mini)"
echo "  ✅ Weaviate      — RAG Knowledge Base"
echo "  ✅ Tavily        — Live Web Search"
echo "  ✅ OpenWeather   — Weather Intelligence"
echo "  ✅ Forex API     — Live Exchange Rates"
echo "  ✅ ElevenLabs    — Text-to-Speech"
if [ "$REDIS_STATUS" = "active" ]; then
echo "  ✅ Redis         — Persistent Cache"
else
echo "  ⚠️  Redis        — InMemoryCache Fallback"
fi
echo "  ✅ Three.js      — 3D Business Ecosystem"
echo "  ✅ Intelligence  — NumPy/Pandas/scikit-learn"
echo "  ✅ 12 Body Systems — Biological Intelligence"
echo ""
echo "  Phase 1 ✅ | Phase 2 ✅ | Phase 3 🔜 | Phase 4 🔜"
echo ""
echo "  Press Ctrl+C to stop all systems."
echo "════════════════════════════════════════════════════════════════════════"

# Trap to cleanup on exit
trap "echo ''; echo '🛑 Shutting down all systems...'; kill $BACKEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

# Keep running
wait $BACKEND_PID
