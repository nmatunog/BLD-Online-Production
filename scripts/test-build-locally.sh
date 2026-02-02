#!/bin/bash
# Test the build locally before deploying
# Usage: ./scripts/test-build-locally.sh

set -e

echo "🔍 Testing Build Locally"
echo "========================"
echo ""

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/backend"

echo "Step 1: Check Node.js version"
echo "-----------------------------"
node --version
npm --version
echo ""

echo "Step 2: Install dependencies"
echo "----------------------------"
npm ci
echo ""

echo "Step 3: Generate Prisma Client"
echo "-------------------------------"
npx prisma generate
echo ""

echo "Step 4: TypeScript compilation"
echo "-------------------------------"
npm run build
echo ""

echo "Step 5: Verify dist folder"
echo "---------------------------"
if [ -d "dist" ] && [ -f "dist/main.js" ]; then
  echo "✅ Build successful! dist/main.js exists"
  ls -lh dist/main.js
else
  echo "❌ Build failed! dist/main.js not found"
  exit 1
fi

echo ""
echo "✅ Local build test passed!"
echo ""
echo "💡 If local build works but Cloud Build fails, the issue is likely:"
echo "   1. Dockerfile configuration"
echo "   2. Cloud Build environment"
echo "   3. Missing files in deployment"
echo ""
echo "Next step: Test Docker build"
echo "   cd backend && docker build -t test-backend ."
