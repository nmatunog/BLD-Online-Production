#!/bin/bash
# Deploy to Development Environment
# Usage: ./scripts/deploy-dev.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🔵 ========================================"
echo "🔵 Deploying to DEVELOPMENT Environment"
echo "🔵 ========================================"
echo ""
echo "Project: bld-cebu-portal-dev"
echo ""

# Verify we're in the right project
read -p "Continue with DEV deployment? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

# Set Firebase project
echo "📌 Setting Firebase project to dev..."
firebase use dev

# Set Google Cloud project
echo "📌 Setting Google Cloud project to dev..."
gcloud config set project bld-cebu-portal-dev

# Deploy backend
echo ""
echo "📦 Deploying backend (bld-portal-backend-dev)..."
cd backend
gcloud run deploy bld-portal-backend-dev \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 4000 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "API_PREFIX=api/v1,FRONTEND_URL=https://dev.yourdomain.com,NODE_ENV=production" \
  --set-secrets "JWT_SECRET=dev-jwt-secret:latest,JWT_REFRESH_SECRET=dev-jwt-refresh-secret:latest,DATABASE_URL=dev-database-url:latest" \
  --add-cloudsql-instances bld-cebu-portal-dev:asia-southeast1:bld-portal-db-dev

# Get backend URL
BACKEND_URL=$(gcloud run services describe bld-portal-backend-dev \
  --region asia-southeast1 \
  --format="value(status.url)")

echo "✅ Backend deployed: $BACKEND_URL"
cd ..

# Deploy frontend
echo ""
echo "🌐 Deploying frontend (bld-portal-frontend-dev)..."
cd frontend
gcloud run deploy bld-portal-frontend-dev \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "NEXT_PUBLIC_API_BASE_URL=$BACKEND_URL,NEXT_PUBLIC_API_URL=$BACKEND_URL/api/v1,NODE_ENV=production"

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe bld-portal-frontend-dev \
  --region asia-southeast1 \
  --format="value(status.url)")

echo "✅ Frontend deployed: $FRONTEND_URL"
cd ..

# Update firebase.json with dev service names (temporary)
echo ""
echo "🔥 Deploying Firebase Hosting (dev)..."
# Note: You may need to update firebase.json service names for dev
firebase deploy --only hosting

echo ""
echo "✅ ========================================"
echo "✅ Development deployment complete!"
echo "✅ ========================================"
echo ""
echo "📍 URLs:"
echo "   Backend:  $BACKEND_URL"
echo "   Frontend: $FRONTEND_URL"
echo "   Hosting:  https://bld-cebu-portal-dev.web.app"
echo ""
