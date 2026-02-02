#!/bin/bash
# Deploy to Production Environment
# Usage: ./scripts/deploy-prod.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🔴 ========================================"
echo "🔴 Deploying to PRODUCTION Environment"
echo "🔴 ========================================"
echo ""
echo "Project: bldcebu-portal"
echo ""

# Double confirmation for production
echo "⚠️  WARNING: This will deploy to PRODUCTION!"
echo "⚠️  Make sure you have:"
echo "   1. Tested in development"
echo "   2. Reviewed all changes"
echo "   3. Backed up production database"
echo ""
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

# Check billing
echo "📌 Checking billing status..."
BILLING_STATUS=$(gcloud billing projects describe bldcebu-portal --format="value(billingAccountName)" 2>/dev/null || echo "")

if [ -z "$BILLING_STATUS" ]; then
  echo ""
  echo "⚠️  WARNING: Billing is not enabled for this project!"
  echo "   Cloud Run, Cloud Build, and other services require billing."
  echo ""
  echo "   Enable billing:"
  echo "   1. Go to: https://console.cloud.google.com/billing"
  echo "   2. Select project: bldcebu-portal"
  echo "   3. Link a billing account"
  echo ""
  echo "   Or via command line:"
  echo "   gcloud billing projects link bldcebu-portal --billing-account=BILLING_ACCOUNT_ID"
  echo ""
  read -p "Continue anyway? (yes/no): " continue_anyway
  if [ "$continue_anyway" != "yes" ]; then
    echo "❌ Deployment cancelled. Please enable billing first."
    exit 1
  fi
else
  echo "✅ Billing is enabled: $BILLING_STATUS"
fi

# Enable required APIs
echo ""
echo "📌 Enabling required APIs..."
gcloud services enable run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  containerregistry.googleapis.com \
  --quiet 2>/dev/null || echo "  ⚠️  Some APIs may already be enabled or need manual activation"

echo "✅ APIs enabled"

# Wait for Secret Manager API to propagate
echo ""
echo "⏳ Waiting for Secret Manager API to propagate (30 seconds)..."
sleep 30

# Grant Secret Manager permissions to Cloud Run service account
echo ""
echo "📌 Granting Secret Manager permissions to Cloud Run service account..."
PROJECT_NUMBER=$(gcloud projects describe bldcebu-portal --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "  Service account: $SERVICE_ACCOUNT"

# Grant Secret Manager Secret Accessor role
gcloud projects add-iam-policy-binding bldcebu-portal \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet 2>/dev/null && echo "✅ Permissions granted" || echo "  ⚠️  Permissions may already be set"

# Grant Cloud SQL Client role (for database connections)
gcloud projects add-iam-policy-binding bldcebu-portal \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudsql.client" \
  --quiet 2>/dev/null && echo "✅ Cloud SQL permissions granted" || echo "  ⚠️  Cloud SQL permissions may already be set"

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
