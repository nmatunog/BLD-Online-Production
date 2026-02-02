#!/bin/bash
# Check frontend Cloud Run service status
# Usage: ./scripts/check-frontend-status.sh

set -e

echo "🔍 Checking Frontend Service Status"
echo "===================================="
echo ""

gcloud config set project bldcebu-portal --quiet

echo "📦 Service Status:"
echo "------------------"
gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="table(status.conditions.type,status.conditions.status,status.conditions.message)" 2>/dev/null || {
  echo "❌ Service not found"
  exit 1
}

echo ""
echo "📋 Latest Revision:"
echo "-------------------"
LATEST_REVISION=$(gcloud run revisions list \
  --service=bld-portal-frontend \
  --region asia-southeast1 \
  --limit 1 \
  --format="value(name)" 2>/dev/null)

if [ -n "$LATEST_REVISION" ]; then
  echo "Revision: $LATEST_REVISION"
  echo ""
  echo "Revision Status:"
  gcloud run revisions describe "$LATEST_REVISION" \
    --region asia-southeast1 \
    --format="table(status.conditions.type,status.conditions.status,status.conditions.message)" 2>/dev/null
else
  echo "❌ No revisions found"
fi

echo ""
echo "📊 Recent Logs (last 20 lines):"
echo "-------------------------------"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-frontend" \
  --limit 20 \
  --project bldcebu-portal \
  --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
  --freshness=10m 2>/dev/null | head -25 || echo "No recent logs found"

echo ""
echo "💡 To view full logs:"
echo "   https://console.cloud.google.com/run/detail/asia-southeast1/bld-portal-frontend/logs?project=bldcebu-portal"
echo ""
