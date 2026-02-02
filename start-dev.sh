#!/bin/bash

# Start both backend and frontend servers
# Usage: ./start-dev.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting BLD Cebu Online Portal Development Servers..."
echo ""

# Start Backend in background
echo "📦 Starting Backend (port 4000)..."
cd "$ROOT_DIR/backend"
export PORT=4000
npm run start:dev &
BACKEND_PID=$!
cd "$ROOT_DIR"

# Wait a moment for backend to initialize
sleep 4

# Start Frontend in background
echo "🌐 Starting Frontend (port 3000)..."
cd "$ROOT_DIR/frontend"
export NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
export NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
npm run dev &
FRONTEND_PID=$!
cd "$ROOT_DIR"

echo ""
echo "✅ Both servers are running!"
echo ""
echo "📍 URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:4000"
echo "   API Docs: http://localhost:4000/api/docs"
echo ""
echo "💡 Press Ctrl+C to stop both servers"
echo ""

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Keep script running
wait
