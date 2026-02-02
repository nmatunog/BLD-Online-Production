#!/bin/bash
# Manually trigger Railway deployment
# Usage: ./scripts/trigger-railway-deploy.sh

set -e

echo "🚂 Triggering Railway Deployment"
echo "================================="
echo ""

cd backend

echo "📋 Checking Railway connection..."
npx @railway/cli status || {
  echo "⚠️  Not connected to Railway project"
  echo "   Run: npx @railway/cli link"
  exit 1
}

echo ""
echo "🔄 Triggering deployment..."
echo ""

# Option 1: Redeploy via CLI
echo "   Attempting to redeploy..."
npx @railway/cli up || {
  echo ""
  echo "⚠️  CLI redeploy failed or not available"
  echo ""
  echo "💡 Manual options:"
  echo ""
  echo "   1. Railway Dashboard:"
  echo "      - Go to https://railway.app/dashboard"
  echo "      - Select your service"
  echo "      - Go to 'Deployments' tab"
  echo "      - Click 'Redeploy' on latest deployment"
  echo ""
  echo "   2. Push empty commit to trigger:"
  echo "      git commit --allow-empty -m 'Trigger Railway deploy'"
  echo "      git push"
  echo ""
  echo "   3. Check GitHub connection:"
  echo "      - Railway dashboard → Service → Settings"
  echo "      - Verify GitHub repo is connected"
  echo ""
}

cd ..
