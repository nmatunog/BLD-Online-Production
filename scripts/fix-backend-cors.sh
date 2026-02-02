#!/bin/bash
# Fix backend CORS to allow frontend Cloud Run URL
# Usage: ./scripts/fix-backend-cors.sh

set -e

echo "🔧 Fixing Backend CORS Configuration"
echo "====================================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

# Get frontend URL
echo "📌 Getting frontend Cloud Run URL..."
FRONTEND_URL=$(gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="value(status.url)")

if [ -z "$FRONTEND_URL" ]; then
  echo "❌ Could not get frontend URL. Is the frontend deployed?"
  exit 1
fi

echo "✅ Frontend URL: $FRONTEND_URL"
echo ""

# Update backend with correct frontend URL for CORS
echo "📦 Updating backend CORS configuration..."
echo "   Setting FRONTEND_URL=$FRONTEND_URL"
echo ""

gcloud run services update bld-portal-backend \
  --region asia-southeast1 \
  --update-env-vars "FRONTEND_URL=$FRONTEND_URL"

echo ""
echo "✅ Backend CORS updated!"
echo ""
echo "⏳ Wait 30 seconds for the update to propagate"
echo "   Then refresh your browser and try logging in again"
echo ""
echo "📍 The backend will now allow requests from:"
echo "   $FRONTEND_URL"
echo ""
