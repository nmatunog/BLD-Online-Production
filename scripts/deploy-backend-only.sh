#!/bin/bash
# Deploy backend only with verbose logging
# Usage: ./scripts/deploy-backend-only.sh

set -e

echo "📦 Deploying Backend with Verbose Logging"
echo "=========================================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

cd backend

echo "Deploying with source build..."
echo "This will show build output in real-time"
echo ""

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
  --add-cloudsql-instances bldcebu-portal:asia-southeast1:bld-portal-db \
  --log-http

cd ..

echo ""
echo "✅ Deployment command completed"
echo ""
echo "💡 If deployment failed, check:"
echo "   1. Cloud Build logs: https://console.cloud.google.com/cloud-build/builds?project=bldcebu-portal"
echo "   2. Service logs: ./scripts/check-deployment-status.sh"
