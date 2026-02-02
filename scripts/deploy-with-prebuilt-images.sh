#!/bin/bash
# Deploy using pre-built Docker images (more reliable than --source)
# Usage: ./scripts/deploy-with-prebuilt-images.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🔴 ========================================"
echo "🔴 Deploying to PRODUCTION (Pre-built Images)"
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

# Set Google Cloud project
echo "📌 Setting Google Cloud project to prod..."
gcloud config set project bldcebu-portal

# Enable Container Registry API if needed
echo "📌 Enabling Container Registry API..."
gcloud services enable containerregistry.googleapis.com --quiet 2>/dev/null || echo "  Already enabled"

# Configure Docker for gcloud
echo "📌 Configuring Docker for gcloud..."
gcloud auth configure-docker --quiet

# Build and push backend image
echo ""
echo "📦 Building and pushing backend image..."
cd backend
BACKEND_IMAGE="gcr.io/bldcebu-portal/bld-portal-backend:latest"

echo "Building backend Docker image..."
docker build -t "$BACKEND_IMAGE" .

echo "Pushing backend image to Container Registry..."
docker push "$BACKEND_IMAGE"

cd ..

# Build and push frontend image
echo ""
echo "🌐 Building and pushing frontend image..."
cd frontend
FRONTEND_IMAGE="gcr.io/bldcebu-portal/bld-portal-frontend:latest"

echo "Building frontend Docker image..."
docker build -t "$FRONTEND_IMAGE" .

echo "Pushing frontend image to Container Registry..."
docker push "$FRONTEND_IMAGE"

cd ..

# Deploy backend from image
echo ""
echo "📦 Deploying backend from image..."
gcloud run deploy bld-portal-backend \
  --image "$BACKEND_IMAGE" \
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

# Deploy frontend from image
echo ""
echo "🌐 Deploying frontend from image..."
gcloud run deploy bld-portal-frontend \
  --image "$FRONTEND_IMAGE" \
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

# Deploy Firebase Hosting
echo ""
echo "🔥 Deploying Firebase Hosting (prod)..."
firebase use prod
firebase deploy --only hosting

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
