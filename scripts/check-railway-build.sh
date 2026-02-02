#!/bin/bash
# Check Railway build configuration
# Usage: ./scripts/check-railway-build.sh

set -e

echo "🔍 Checking Railway Build Configuration"
echo "========================================"
echo ""

cd backend

echo "📦 Checking package.json..."
echo ""

# Check for build script
if grep -q '"build"' package.json; then
  BUILD_SCRIPT=$(grep -A 1 '"build"' package.json | tail -1 | sed 's/.*"build": "\(.*\)".*/\1/' | tr -d '",')
  echo "✅ Build script found: $BUILD_SCRIPT"
else
  echo "❌ Build script missing!"
fi

# Check for start script
if grep -q '"start"' package.json; then
  START_SCRIPT=$(grep -A 1 '"start"' package.json | tail -1 | sed 's/.*"start": "\(.*\)".*/\1/' | tr -d '",')
  echo "✅ Start script found: $START_SCRIPT"
  
  # Check if start script is production-ready
  if [[ "$START_SCRIPT" == *"node dist"* ]] || [[ "$START_SCRIPT" == *"dist/main"* ]]; then
    echo "   ✅ Start script is production-ready"
  elif [[ "$START_SCRIPT" == *"nest start"* ]]; then
    echo "   ⚠️  Start script uses 'nest start' (development mode)"
    echo "   Should be: 'node dist/main.js'"
  fi
else
  echo "❌ Start script missing!"
fi

# Check for postinstall
if grep -q '"postinstall"' package.json; then
  echo "✅ Postinstall script found (for Prisma)"
else
  echo "⚠️  Postinstall script missing (needed for Prisma)"
fi

# Check for Prisma in build
if grep -q '"build"' package.json && grep -A 1 '"build"' package.json | grep -q "prisma generate"; then
  echo "✅ Prisma generate included in build"
else
  echo "⚠️  Prisma generate may not be in build script"
fi

echo ""
echo "🗄️  Checking Prisma..."
echo ""

if [ -f "prisma/schema.prisma" ]; then
  echo "✅ Prisma schema found"
else
  echo "❌ Prisma schema not found!"
fi

echo ""
echo "📝 Checking Railway configuration..."
echo ""

if [ -f "railway.json" ]; then
  echo "✅ railway.json found"
  cat railway.json
else
  echo "⚠️  railway.json not found (optional but recommended)"
fi

echo ""
echo "🧪 Testing local build..."
echo ""

if [ -d "node_modules" ]; then
  echo "✅ node_modules exists"
else
  echo "⚠️  node_modules not found - installing..."
  npm install
fi

echo ""
echo "Running build test..."
if npm run build 2>&1 | tee /tmp/railway-build-test.log; then
  echo ""
  echo "✅ Local build successful!"
else
  echo ""
  echo "❌ Local build failed!"
  echo "   Check errors above"
  echo "   This is likely the same error Railway is seeing"
fi

echo ""
echo "📋 Summary:"
echo "   - Check the errors above"
echo "   - If local build fails, fix those errors first"
echo "   - Railway build logs: https://railway.com/project/[your-project]/service/[your-service]"
echo ""

cd ..
