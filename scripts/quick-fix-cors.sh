#!/bin/bash
# Quick fix: Update backend CORS without full redeploy
# This updates the environment variable and forces a new revision
# Usage: ./scripts/quick-fix-cors.sh

set -e

echo "⚡ Quick CORS Fix"
echo "==============="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

# Get frontend URL
echo "📌 Getting frontend URL..."
FRONTEND_URL=$(gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="value(status.url)")

if [ -z "$FRONTEND_URL" ]; then
  echo "❌ Could not get frontend URL"
  exit 1
fi

echo "✅ Frontend URL: $FRONTEND_URL"
echo ""

# Update environment variable (this will create a new revision)
echo "⚡ Updating backend FRONTEND_URL environment variable..."
echo "   This will create a new revision and restart the service"
echo ""

gcloud run services update bld-portal-backend \
  --region asia-southeast1 \
  --update-env-vars "FRONTEND_URL=$FRONTEND_URL" \
  --no-traffic

# Wait a moment
sleep 5

# Route all traffic to the new revision
echo "🔄 Routing traffic to new revision..."
gcloud run services update-traffic bld-portal-backend \
  --region asia-southeast1 \
  --to-latest

echo ""
echo "✅ Backend updated!"
echo ""
echo "⏳ Wait 30-60 seconds for the service to restart"
echo "   Then refresh your browser and try again"
echo ""
echo "💡 Note: If this doesn't work, we may need to redeploy"
echo "   with the updated CORS code. Run:"
echo "   ./scripts/redeploy-backend-with-cors-fix.sh"
echo ""
