#!/bin/bash
# Test Docker builds locally before deploying
# Usage: ./scripts/test-docker-builds.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🐳 Testing Docker Builds"
echo "========================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker daemon is not running"
  echo ""
  echo "Please start Docker Desktop and try again."
  echo "Or skip Docker tests and use: ./scripts/deploy-prod-simple.sh"
  echo ""
  exit 1
fi

# Test Backend Docker Build
echo "1️⃣  Testing Backend Docker Build..."
echo "-----------------------------------"
cd backend

if docker build -t test-backend .; then
  echo "✅ Backend Docker build SUCCESS"
else
  echo "❌ Backend Docker build FAILED"
  exit 1
fi

cd ..

# Test Frontend Docker Build
echo ""
echo "2️⃣  Testing Frontend Docker Build..."
echo "------------------------------------"
cd frontend

if docker build -t test-frontend .; then
  echo "✅ Frontend Docker build SUCCESS"
else
  echo "❌ Frontend Docker build FAILED"
  exit 1
fi

cd ..

echo ""
echo "✅ ========================================"
echo "✅ All Docker builds passed!"
echo "✅ ========================================"
echo ""
echo "You can now deploy using:"
echo "  ./scripts/deploy-prod-simple.sh (uses --source, simpler)"
echo ""
echo "Or use pre-built images approach:"
echo "  ./scripts/deploy-with-prebuilt-images.sh (uses Docker images)"
echo ""
