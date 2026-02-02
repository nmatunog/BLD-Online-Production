#!/bin/bash
# Resume Production Deployment - Continues from where it left off
# Usage: ./scripts/resume-prod-deployment.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🔄 ========================================"
echo "🔄 Resuming PRODUCTION Deployment"
echo "🔄 ========================================"
echo ""
echo "Project: bldcebu-portal"
echo ""

# Check disk space
echo "📊 Checking disk space..."
AVAILABLE_SPACE=$(df -h . | tail -1 | awk '{print $4}')
echo "Available space: $AVAILABLE_SPACE"
echo ""

# Clean up temporary files
echo "🧹 Cleaning up temporary build files..."
find . -name ".next" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name ".turbo" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.log" -type f -size +10M -delete 2>/dev/null || true
echo "✅ Cleanup complete"
echo ""

# Set Firebase project
echo "📌 Setting Firebase project to prod..."
firebase use prod || {
  echo "⚠️  Firebase project not set. Please run: firebase use prod"
  exit 1
}

# Set Google Cloud project
echo "📌 Setting Google Cloud project to prod..."
gcloud config set project bldcebu-portal

# Check current deployment status
echo ""
echo "🔍 Checking current deployment status..."
echo ""

BACKEND_EXISTS=$(gcloud run services describe bld-portal-backend \
  --region=asia-southeast1 \
  --format="value(metadata.name)" 2>/dev/null || echo "")

FRONTEND_EXISTS=$(gcloud run services describe bld-portal-frontend \
  --region=asia-southeast1 \
  --format="value(metadata.name)" 2>/dev/null || echo "")

if [ -n "$BACKEND_EXISTS" ]; then
  BACKEND_URL=$(gcloud run services describe bld-portal-backend \
    --region=asia-southeast1 \
    --format="value(status.url)")
  echo "✅ Backend service exists: $BACKEND_URL"
else
  echo "⚠️  Backend service not found - will deploy new"
fi

if [ -n "$FRONTEND_EXISTS" ]; then
  FRONTEND_URL=$(gcloud run services describe bld-portal-frontend \
    --region=asia-southeast1 \
    --format="value(status.url)")
  echo "✅ Frontend service exists: $FRONTEND_URL"
else
  echo "⚠️  Frontend service not found - will deploy new"
fi

echo ""
read -p "Continue with deployment? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

# Deploy backend
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

# Deploy frontend
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
# Ensure hosting site exists, create if needed
firebase hosting:sites:list 2>/dev/null || true
# Deploy hosting
firebase deploy --only hosting --project bldcebu-portal

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
