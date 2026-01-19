#!/bin/bash
set -euo pipefail

# Start NestJS backend in dev mode
# Usage: ./run-backend.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR/backend"

# Default to port 4000 if PORT not set
export PORT="${PORT:-4000}"
echo "🌐 Starting backend on PORT=$PORT"

npm run start:dev




