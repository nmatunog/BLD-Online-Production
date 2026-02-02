#!/bin/bash
set -euo pipefail

# Start both backend and frontend development servers
# Usage: ./run-dev.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "🚀 Starting BLD Cebu Online Portal Development Servers..."
echo ""

# Function to cleanup on exit
cleanup() {
  echo ""
  echo "🛑 Stopping servers..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit
}

trap cleanup SIGINT SIGTERM

# Start Backend
echo "📦 Starting Backend Server (port 4000)..."
cd "$ROOT_DIR/backend"
export PORT="${PORT:-4000}"
npm run start:dev > /tmp/bld-backend.log 2>&1 &
BACKEND_PID=$!
cd "$ROOT_DIR"

# Wait a bit for backend to start
sleep 3

# Start Frontend
echo "🌐 Starting Frontend Server (port 3000)..."
cd "$ROOT_DIR/frontend"
export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:4000}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-${NEXT_PUBLIC_API_BASE_URL}/api/v1}"
npm run dev > /tmp/bld-frontend.log 2>&1 &
FRONTEND_PID=$!
cd "$ROOT_DIR"

echo ""
echo "✅ Both servers are starting!"
echo ""
echo "📊 Server Status:"
echo "   Backend:  http://localhost:4000"
echo "   Frontend: http://localhost:3000"
echo "   API Docs: http://localhost:4000/api/docs"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f /tmp/bld-backend.log"
echo "   Frontend: tail -f /tmp/bld-frontend.log"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
