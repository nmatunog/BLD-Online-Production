#!/bin/bash
# Simple fix: Update frontend with backend URL and redeploy
# This uses the new runtime detection approach
# Usage: ./scripts/fix-frontend-simple.sh

set -e

echo "🔧 Fixing Frontend with Runtime Detection"
echo "=========================================="
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

# The new approach uses runtime detection, but we can still set env vars
# for the meta tag approach. Let's redeploy with the backend URL in env vars
# The runtime detection will also work by detecting the Cloud Run domain

echo "📦 Redeploying frontend..."
echo "   The frontend will now auto-detect the backend URL based on hostname"
echo "   We'll also set env vars for the meta tag fallback"
echo ""

cd frontend

gcloud run deploy bld-portal-frontend \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 20 \
  --set-env-vars "NEXT_PUBLIC_API_BASE_URL=$BACKEND_URL,NEXT_PUBLIC_API_URL=$BACKEND_URL/api/v1,NODE_ENV=production"

cd ..

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="value(status.url)")

echo ""
echo "✅ ========================================"
echo "✅ Frontend redeployed!"
echo "✅ ========================================"
echo ""
echo "📍 URLs:"
echo "   Backend:  $BACKEND_URL"
echo "   Frontend: $FRONTEND_URL"
echo ""
echo "🔄 The frontend will now:"
echo "   1. Auto-detect backend URL from hostname (Cloud Run domain)"
echo "   2. Use meta tag if available"
echo "   3. Fall back to environment variables"
echo ""
echo "⏳ Wait 1-2 minutes for deployment, then refresh your browser"
echo ""
