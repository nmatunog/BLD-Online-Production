#!/bin/bash
# Simplified Production Deployment - Mirrors Dev Setup
# Usage: ./scripts/deploy-prod-simple.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🔴 ========================================"
echo "🔴 Deploying to PRODUCTION (Simple - Mirrors Dev)"
echo "🔴 ========================================"
echo ""
echo "Project: bldcebu-portal"
echo ""

# Double confirmation for production
echo "⚠️  WARNING: This will deploy to PRODUCTION!"
read -p "Type 'DEPLOY PRODUCTION' to continue: " confirm
if [ "$confirm" != "DEPLOY PRODUCTION" ]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

# Set Firebase project
echo "📌 Setting Firebase project to prod..."
firebase use prod

# Set Google Cloud project
echo "📌 Setting Google Cloud project to prod..."
gcloud config set project bldcebu-portal

# Deploy backend (exactly like dev, just different names)
echo ""
echo "📦 Deploying backend (bld-portal-backend)..."
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
  --set-env-vars "API_PREFIX=api/v1,FRONTEND_URL=https://bldcebu-portal.web.app,NODE_ENV=production" \
  --set-secrets "JWT_SECRET=prod-jwt-secret:latest,JWT_REFRESH_SECRET=prod-jwt-refresh-secret:latest,DATABASE_URL=prod-database-url:latest" \
  --add-cloudsql-instances bldcebu-portal:asia-southeast1:bld-portal-db

# Get backend URL
BACKEND_URL=$(gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --format="value(status.url)")

echo "✅ Backend deployed: $BACKEND_URL"
cd ..

# Deploy frontend (exactly like dev, just different names)
echo ""
echo "🌐 Deploying frontend (bld-portal-frontend)..."
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

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="value(status.url)")

echo "✅ Frontend deployed: $FRONTEND_URL"
cd ..

# Deploy Firebase Hosting
echo ""
echo "🔥 Deploying Firebase Hosting (prod)..."
# Check if site exists, create if needed
SITE_EXISTS=$(firebase hosting:sites:list --project bldcebu-portal 2>/dev/null | grep -q "bldcebu-portal" && echo "yes" || echo "no")

if [ "$SITE_EXISTS" != "yes" ]; then
  echo "📌 Creating Firebase Hosting site: bldcebu-portal"
  echo "bldcebu-portal" | firebase hosting:sites:create bldcebu-portal --project bldcebu-portal 2>/dev/null || {
    echo "⚠️  Site creation may have failed or site already exists"
  }
fi

# Deploy hosting
firebase deploy --only hosting:bldcebu-portal

echo ""
echo "✅ ========================================"
echo "✅ Production deployment complete!"
echo "✅ ========================================"
echo ""
echo "📍 URLs:"
echo "   Backend:  $BACKEND_URL"
echo "   Frontend: $FRONTEND_URL"
echo "   Hosting:  https://bldcebu-portal.web.app"
echo ""
