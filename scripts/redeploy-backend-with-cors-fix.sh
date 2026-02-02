#!/bin/bash
# Redeploy backend with improved CORS configuration
# Usage: ./scripts/redeploy-backend-with-cors-fix.sh

set -e

echo "🔧 Redeploying Backend with Improved CORS"
echo "=========================================="
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

# Get backend URL for reference
BACKEND_URL=$(gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --format="value(status.url)")

echo "📌 Backend URL: $BACKEND_URL"
echo ""

echo "📦 Redeploying backend with:"
echo "   - Updated CORS configuration"
echo "   - FRONTEND_URL=$FRONTEND_URL"
echo "   - Support for Cloud Run domains"
echo ""

cd backend

gcloud run deploy bld-portal-backend \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 4000 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 20 \
  --set-env-vars "API_PREFIX=api/v1,FRONTEND_URL=$FRONTEND_URL,NODE_ENV=production" \
  --set-secrets "JWT_SECRET=prod-jwt-secret:latest,JWT_REFRESH_SECRET=prod-jwt-refresh-secret:latest,DATABASE_URL=prod-database-url:latest" \
  --add-cloudsql-instances bldcebu-portal:asia-southeast1:bld-portal-db

cd ..

echo ""
echo "✅ Backend redeployed with improved CORS!"
echo ""
echo "⏳ Wait 3-5 minutes for deployment to complete"
echo "   Then refresh your browser and try logging in again"
echo ""
echo "📍 CORS is now configured to allow:"
echo "   - $FRONTEND_URL"
echo "   - All Cloud Run domains (*.run.app)"
echo "   - Localhost (for development)"
echo ""
