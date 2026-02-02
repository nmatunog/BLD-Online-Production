#!/bin/bash
# Verify Railway environment variables are set correctly
# Usage: ./scripts/verify-railway-variables.sh

set -e

echo "🔍 Verifying Railway Environment Variables"
echo "=========================================="
echo ""

cd backend

echo "📋 Checking current variables..."
echo ""

# Check variables
VARS=$(npx @railway/cli variables 2>/dev/null || echo "")

if [ -z "$VARS" ]; then
  echo "⚠️  Could not retrieve variables via CLI"
  echo "   Please check in Railway dashboard:"
  echo "   https://railway.app/dashboard"
  echo ""
  echo "   Required variables:"
  echo "   - JWT_SECRET"
  echo "   - JWT_REFRESH_SECRET"
  echo "   - NODE_ENV=production"
  echo "   - API_PREFIX=api/v1"
  echo "   - DATABASE_URL (auto-set by Railway)"
  exit 1
fi

echo "$VARS" | grep -q "JWT_SECRET" && {
  JWT_SECRET_VALUE=$(echo "$VARS" | grep "JWT_SECRET" | cut -d'=' -f2- | tr -d ' ')
  if [ -n "$JWT_SECRET_VALUE" ] && [ "$JWT_SECRET_VALUE" != "" ]; then
    echo "✅ JWT_SECRET is set (length: ${#JWT_SECRET_VALUE} chars)"
  else
    echo "❌ JWT_SECRET is empty or not set"
  fi
} || {
  echo "❌ JWT_SECRET is missing"
}

echo "$VARS" | grep -q "JWT_REFRESH_SECRET" && {
  JWT_REFRESH_VALUE=$(echo "$VARS" | grep "JWT_REFRESH_SECRET" | cut -d'=' -f2- | tr -d ' ')
  if [ -n "$JWT_REFRESH_VALUE" ] && [ "$JWT_REFRESH_VALUE" != "" ]; then
    echo "✅ JWT_REFRESH_SECRET is set (length: ${#JWT_REFRESH_VALUE} chars)"
  else
    echo "❌ JWT_REFRESH_SECRET is empty or not set"
  fi
} || {
  echo "❌ JWT_REFRESH_SECRET is missing"
}

echo "$VARS" | grep -q "DATABASE_URL" && {
  echo "✅ DATABASE_URL is set"
} || {
  echo "❌ DATABASE_URL is missing (add PostgreSQL database)"
}

echo "$VARS" | grep -q "NODE_ENV" && {
  echo "✅ NODE_ENV is set"
} || {
  echo "⚠️  NODE_ENV is not set (should be 'production')"
}

echo "$VARS" | grep -q "API_PREFIX" && {
  echo "✅ API_PREFIX is set"
} || {
  echo "⚠️  API_PREFIX is not set (should be 'api/v1')"
}

echo ""
echo "📝 All Variables:"
echo "$VARS"
echo ""

cd ..
