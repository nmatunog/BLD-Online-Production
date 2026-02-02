#!/bin/bash
# Check Cloud Run deployment status and logs
# Usage: ./scripts/check-deployment-status.sh

set -e

echo "🔍 Checking Cloud Run Deployment Status"
echo "======================================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

echo "1. Service Status"
echo "----------------"
gcloud run services describe bld-portal-backend \
  --region=asia-southeast1 \
  --project=bldcebu-portal \
  --format="table(status.conditions.type,status.conditions.status,status.conditions.message)" 2>/dev/null || echo "Service not found"

echo ""
echo "2. Latest Revision"
echo "------------------"
LATEST_REVISION=$(gcloud run revisions list \
  --service=bld-portal-backend \
  --region=asia-southeast1 \
  --limit=1 \
  --format="value(name)" \
  --project=bldcebu-portal 2>/dev/null)

if [ -n "$LATEST_REVISION" ]; then
  echo "Latest revision: $LATEST_REVISION"
  echo ""
  echo "Revision status:"
  gcloud run revisions describe "$LATEST_REVISION" \
    --region=asia-southeast1 \
    --project=bldcebu-portal \
    --format="table(status.conditions.type,status.conditions.status,status.conditions.message)" 2>/dev/null
else
  echo "❌ No revisions found"
fi

echo ""
echo "3. Recent Logs (last 30 minutes)"
echo "---------------------------------"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-backend" \
  --limit 50 \
  --project=bldcebu-portal \
  --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
  --freshness=30m 2>/dev/null | head -30 || echo "No logs found"

echo ""
echo "4. Error Logs Only"
echo "------------------"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-backend AND severity>=ERROR" \
  --limit 20 \
  --project=bldcebu-portal \
  --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
  --freshness=1h 2>/dev/null || echo "No errors found"

echo ""
echo "💡 For full logs in browser:"
echo "   https://console.cloud.google.com/run/detail/asia-southeast1/bld-portal-backend/logs?project=bldcebu-portal"
echo ""
echo "💡 To check Cloud Build logs:"
echo "   https://console.cloud.google.com/cloud-build/builds?project=bldcebu-portal"
