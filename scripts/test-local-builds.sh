#!/bin/bash
# Test local builds before deploying
# Usage: ./scripts/test-local-builds.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🧪 Testing Local Builds"
echo "======================="
echo ""

# Test Frontend Build
echo "1️⃣  Testing Frontend Build..."
echo "----------------------------"
cd frontend

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf .next node_modules 2>/dev/null || true

# Install dependencies
echo "Installing dependencies..."
npm ci

# Build
echo "Building frontend..."
if npm run build; then
  echo "✅ Frontend build SUCCESS"
else
  echo "❌ Frontend build FAILED"
  exit 1
fi

cd ..

# Test Backend Build
echo ""
echo "2️⃣  Testing Backend Build..."
echo "----------------------------"
cd backend

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf dist node_modules 2>/dev/null || true

# Install dependencies
echo "Installing dependencies..."
npm ci

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Build
echo "Building backend..."
if npm run build; then
  echo "✅ Backend build SUCCESS"
else
  echo "❌ Backend build FAILED"
  exit 1
fi

cd ..

echo ""
echo "✅ ========================================"
echo "✅ All local builds passed!"
echo "✅ ========================================"
echo ""
echo "Next steps:"
echo "  1. Test Docker builds: ./scripts/test-docker-builds.sh"
echo "  2. Deploy: ./scripts/deploy-prod-simple.sh"
echo ""
