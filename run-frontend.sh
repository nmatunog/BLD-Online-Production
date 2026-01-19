#!/bin/bash
set -euo pipefail

# Start Next.js frontend in dev mode
# Usage: ./run-frontend.sh [port]
# Default port: 3000

PORT_ARG="${1:-3000}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR/frontend"

# Point frontend to backend (default 4000)
export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://localhost:4000}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-${NEXT_PUBLIC_API_BASE_URL}/api/v1}"

echo "🌐 Starting frontend on port $PORT_ARG (API: $NEXT_PUBLIC_API_BASE_URL)"
# Use local Next binary so the port arg always works, regardless of npm script
NEXT_BIN="$ROOT_DIR/frontend/node_modules/.bin/next"
if [ -x "$NEXT_BIN" ]; then
  "$NEXT_BIN" dev -p "$PORT_ARG"
else
  echo "⚠️  $NEXT_BIN not found (did you run npm install?). Falling back to npx..."
  npx next dev -p "$PORT_ARG"
fi

