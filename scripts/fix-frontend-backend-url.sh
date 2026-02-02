#!/bin/bash
# Fix frontend to point to production backend
# Usage: ./scripts/fix-frontend-backend-url.sh

set -e

echo "🔧 Fixing Frontend Backend URL Configuration"
echo "============================================="
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

# Update frontend with correct backend URL
echo "📌 Updating frontend service with backend URL..."
echo "   Setting NEXT_PUBLIC_API_BASE_URL=$BACKEND_URL"
echo "   Setting NEXT_PUBLIC_API_URL=$BACKEND_URL/api/v1"
echo ""

gcloud run services update bld-portal-frontend \
  --region asia-southeast1 \
  --update-env-vars "NEXT_PUBLIC_API_BASE_URL=$BACKEND_URL,NEXT_PUBLIC_API_URL=$BACKEND_URL/api/v1,NODE_ENV=production"

echo ""
echo "✅ Frontend updated!"
echo ""
echo "⏳ Waiting 30 seconds for service to update..."
sleep 30

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="value(status.url)")

echo ""
echo "✅ ========================================"
echo "✅ Frontend configuration updated!"
echo "✅ ========================================"
echo ""
echo "📍 URLs:"
echo "   Backend:  $BACKEND_URL"
echo "   Frontend: $FRONTEND_URL"
echo ""
echo "🔄 Please refresh your browser to see the changes"
echo "   The frontend should now connect to the production backend"
echo ""
