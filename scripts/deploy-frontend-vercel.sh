#!/bin/bash
# Deploy frontend to Vercel
# Usage: ./scripts/deploy-frontend-vercel.sh

set -e

echo "🚀 Deploying Frontend to Vercel"
echo "================================"
echo ""

cd "$(dirname "$0")/../frontend"

echo "Step 1: Checking Vercel CLI..."
if ! command -v vercel &> /dev/null; then
    echo "Vercel CLI not found. Using npx..."
    VERCEL_CMD="npx vercel"
else
    VERCEL_CMD="vercel"
fi

echo ""
echo "Step 2: Deploying to Vercel..."
echo ""
echo "You'll be prompted to:"
echo "  - Login to Vercel (if not already logged in)"
echo "  - Link to existing project or create new one"
echo "  - Confirm deployment settings"
echo ""

$VERCEL_CMD --prod

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "Step 3: Set Environment Variables in Vercel Dashboard"
echo "======================================================"
echo ""
echo "After deployment, go to Vercel Dashboard and set these environment variables:"
echo ""
echo "  NEXT_PUBLIC_API_BASE_URL=https://bld-online-production-production.up.railway.app"
echo "  NEXT_PUBLIC_API_URL=https://bld-online-production-production.up.railway.app/api/v1"
echo "  NODE_ENV=production"
echo ""
echo "Then redeploy from Vercel Dashboard or run:"
echo "  $VERCEL_CMD --prod"
echo ""
