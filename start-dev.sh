#!/usr/bin/env bash
# VidyaSathi Development Starter
# Usage: ./start-dev.sh

set -e

echo "🌟 Starting VidyaSathi Development Environment"
echo "================================================"

# Check .env
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please fill in your API keys in .env before continuing."
    echo "   Required: GEMINI_API_KEY, GROQ_API_KEY"
    echo ""
fi

# Start Redis (optional - skip if not installed)
echo "🔴 Starting Redis..."
if command -v redis-server &>/dev/null; then
    redis-server --daemonize yes --loglevel warning
    echo "✅ Redis started"
else
    echo "⚠️  Redis not found. Install it for semantic caching (optional)."
fi

# Backend
echo ""
echo "🐍 Starting FastAPI backend..."
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi
source venv/bin/activate || source venv/Scripts/activate 2>/dev/null
pip install -r requirements.txt -q
cp .env.example .env 2>/dev/null || true

# Copy root .env values
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
fi

uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
echo "✅ Backend running at http://localhost:8000"
echo "   API docs: http://localhost:8000/docs"
cd ..

# Frontend
echo ""
echo "⚛️  Starting React frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies (first time, takes ~2 minutes)..."
    npm install
fi
npm run dev &
FRONTEND_PID=$!
echo "✅ Frontend running at http://localhost:5173"
cd ..

echo ""
echo "🚀 VidyaSathi is ready!"
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:8000"
echo "   API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services."

# Wait and cleanup
trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; pkill redis-server 2>/dev/null; exit 0" INT TERM
wait
