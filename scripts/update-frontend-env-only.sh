#!/bin/bash
# Faster approach: Just update environment variables without rebuilding
# This works because we now use runtime detection
# Usage: ./scripts/update-frontend-env-only.sh

set -e

echo "⚡ Quick Fix: Update Frontend Environment Variables"
echo "==================================================="
echo ""
echo "This updates env vars without rebuilding (much faster!)"
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

# Get backend URL
echo "📌 Getting backend URL..."
BACKEND_URL=$(gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --format="value(status.url)")

if [ -z "$BACKEND_URL" ]; then
  echo "❌ Could not get backend URL. Is the backend deployed?"
  exit 1
fi

echo "✅ Backend URL: $BACKEND_URL"
echo ""

# Update environment variables only (no rebuild)
echo "⚡ Updating environment variables (no rebuild needed)..."
echo "   This should complete in 30-60 seconds"
echo ""

gcloud run services update bld-portal-frontend \
  --region asia-southeast1 \
  --update-env-vars "NEXT_PUBLIC_API_BASE_URL=$BACKEND_URL,NEXT_PUBLIC_API_URL=$BACKEND_URL/api/v1,NODE_ENV=production"

echo ""
echo "✅ Environment variables updated!"
echo ""
echo "🔄 Since we're using runtime detection, the frontend should:"
echo "   1. Auto-detect backend from hostname (primary method)"
echo "   2. Use the updated env vars as fallback"
echo ""
echo "⏳ Wait 30 seconds for the update to propagate"
echo "   Then refresh your browser (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)"
echo ""
