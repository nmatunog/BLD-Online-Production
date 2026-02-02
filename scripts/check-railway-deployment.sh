#!/bin/bash
# Check Railway deployment status and verify it's working
# Usage: ./scripts/check-railway-deployment.sh

set -e

echo "🔍 Checking Railway Deployment Status"
echo "======================================"
echo ""

cd backend

echo "📊 Step 1: Deployment Status"
echo "   ------------------------"
echo ""

# Check status
npx @railway/cli status 2>/dev/null || {
  echo "⚠️  Could not get status via CLI"
  echo "   Check Railway dashboard: https://railway.app/dashboard"
}

echo ""
echo "🌐 Step 2: Get Backend URL"
echo "   ----------------------"
echo ""

BACKEND_URL=$(npx @railway/cli domain 2>/dev/null || echo "")

if [ -n "$BACKEND_URL" ]; then
  echo "   ✅ Backend URL: https://$BACKEND_URL"
  echo ""
  echo "   Test endpoints:"
  echo "   - API Docs: https://$BACKEND_URL/api/docs"
  echo "   - Health: https://$BACKEND_URL/api/v1/health"
else
  echo "   ⚠️  Could not get URL automatically"
  echo "   Check Railway dashboard for your backend URL"
fi

echo ""
echo "📋 Step 3: Recent Logs"
echo "   ------------------"
echo ""

echo "   Fetching last 20 lines of logs..."
npx @railway/cli logs --tail 20 2>/dev/null | tail -20 || {
  echo "   ⚠️  Could not fetch logs via CLI"
  echo "   Check logs in Railway dashboard"
}

echo ""
echo "✅ Verification Steps:"
echo ""
echo "   1. Check Railway Dashboard:"
echo "      - Go to: https://railway.app/dashboard"
echo "      - Select your service"
echo "      - Check 'Deployments' tab - should be 'Active'"
echo "      - Check 'Logs' tab - should show 'Backend server running'"
echo ""
echo "   2. Test Backend:"
if [ -n "$BACKEND_URL" ]; then
  echo "      - Visit: https://$BACKEND_URL/api/docs"
  echo "      - Should see Swagger API documentation"
else
  echo "      - Get URL from Railway dashboard"
  echo "      - Visit: https://[your-url]/api/docs"
fi
echo ""
echo "   3. Check for Errors:"
echo "      - No OpenSSL errors ✅"
echo "      - No Prisma errors ✅"
echo "      - No JWT errors ✅"
echo "      - Backend running ✅"
echo ""

cd ..
