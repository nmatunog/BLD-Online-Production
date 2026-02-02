#!/bin/bash
# Check the progress of the frontend deployment
# Usage: ./scripts/check-deployment-progress.sh

set -e

echo "🔍 Checking Frontend Deployment Progress"
echo "========================================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

echo "📦 Checking Cloud Run service status..."
gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="table(status.conditions.type,status.conditions.status,status.conditions.message)" 2>/dev/null || {
  echo "⚠️  Service not found or not accessible"
}

echo ""
echo "🔨 Checking recent Cloud Build jobs..."
echo ""

# Get the latest build
LATEST_BUILD=$(gcloud builds list \
  --limit 1 \
  --format="value(id)" \
  --filter="source.storageSource.bucket:cloudbuild" 2>/dev/null || echo "")

if [ -n "$LATEST_BUILD" ]; then
  echo "Latest build ID: $LATEST_BUILD"
  echo ""
  echo "Build status:"
  gcloud builds describe "$LATEST_BUILD" \
    --format="table(status,createTime,logUrl)" 2>/dev/null || echo "Could not get build details"
  
  echo ""
  echo "📋 Recent build logs (last 20 lines):"
  gcloud builds log "$LATEST_BUILD" --stream=false 2>/dev/null | tail -20 || echo "Could not fetch logs"
else
  echo "No recent builds found"
fi

echo ""
echo "💡 To view full logs in browser:"
echo "   https://console.cloud.google.com/cloud-build/builds?project=bldcebu-portal"
echo ""
