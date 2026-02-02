#!/bin/bash
# Start Cloud SQL Proxy on a custom port
# Usage: ./scripts/start-cloud-sql-proxy.sh [port]
# Default port: 5433

PORT="${1:-5433}"

echo "🔌 Starting Cloud SQL Proxy on port $PORT"
echo "=========================================="
echo ""

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  echo "⚠️  Port $PORT is already in use"
  echo "   Please choose a different port or stop the service using it"
  exit 1
fi

echo "📌 Connecting to: bldcebu-portal:asia-southeast1:bld-portal-db"
echo "📌 Listening on: 127.0.0.1:$PORT"
echo ""
echo "💡 In another terminal, use this DATABASE_URL:"
echo "   postgresql://postgres:PASSWORD@127.0.0.1:$PORT/bld_portal"
echo ""
echo "Press Ctrl+C to stop the proxy"
echo ""

cloud-sql-proxy --port $PORT bldcebu-portal:asia-southeast1:bld-portal-db
