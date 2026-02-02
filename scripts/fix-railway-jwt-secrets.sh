#!/bin/bash
# Fix Railway JWT secrets - sets missing JWT_SECRET and JWT_REFRESH_SECRET
# Usage: ./scripts/fix-railway-jwt-secrets.sh

set -e

echo "🔐 Setting JWT Secrets in Railway"
echo "================================="
echo ""

# Generate JWT secrets
echo "📝 Generating JWT secrets..."

JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null)
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null)

if [ -z "$JWT_SECRET" ] || [ -z "$JWT_REFRESH_SECRET" ]; then
  echo "❌ Failed to generate secrets"
  echo "   Please generate manually:"
  echo "   node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  exit 1
fi

echo "✅ Secrets generated"
echo ""

# Set in Railway
echo "🚂 Setting secrets in Railway..."
echo ""

cd backend

# Set JWT_SECRET
echo "   Setting JWT_SECRET..."
npx @railway/cli variables set JWT_SECRET="$JWT_SECRET" 2>/dev/null && {
  echo "   ✅ JWT_SECRET set"
} || {
  echo "   ⚠️  Could not set via CLI"
  echo "   Please set manually in Railway dashboard:"
  echo "   JWT_SECRET = $JWT_SECRET"
}

# Set JWT_REFRESH_SECRET
echo "   Setting JWT_REFRESH_SECRET..."
npx @railway/cli variables set JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" 2>/dev/null && {
  echo "   ✅ JWT_REFRESH_SECRET set"
} || {
  echo "   ⚠️  Could not set via CLI"
  echo "   Please set manually in Railway dashboard:"
  echo "   JWT_REFRESH_SECRET = $JWT_REFRESH_SECRET"
}

# Set other required variables
echo ""
echo "   Setting other required variables..."

npx @railway/cli variables set NODE_ENV=production 2>/dev/null || echo "   ⚠️  NODE_ENV may already be set"
npx @railway/cli variables set API_PREFIX=api/v1 2>/dev/null || echo "   ⚠️  API_PREFIX may already be set"

cd ..

echo ""
echo "✅ Variables set!"
echo ""
echo "📋 Generated Secrets (save these):"
echo "   JWT_SECRET: $JWT_SECRET"
echo "   JWT_REFRESH_SECRET: $JWT_REFRESH_SECRET"
echo ""
echo "🔄 Next Steps:"
echo "   1. Restart the service in Railway dashboard"
echo "   2. Or run: npx @railway/cli restart"
echo "   3. Check logs to verify it's working"
echo ""
