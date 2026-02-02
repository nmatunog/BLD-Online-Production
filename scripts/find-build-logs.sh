#!/bin/bash
# Find and display Cloud Build logs
# Usage: ./scripts/find-build-logs.sh

set -e

echo "🔍 Finding Cloud Build Logs"
echo "=========================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

echo "Method 1: List all recent builds"
echo "--------------------------------"
gcloud builds list \
  --project=bldcebu-portal \
  --limit=5 \
  --format="table(id,status,createTime,logUrl)" \
  --sort-by=~createTime

echo ""
echo "Method 2: Check build triggers"
echo "------------------------------"
gcloud builds triggers list \
  --project=bldcebu-portal 2>/dev/null || echo "No triggers found"

echo ""
echo "Method 3: Search for failed builds"
echo "----------------------------------"
FAILED_BUILDS=$(gcloud builds list \
  --project=bldcebu-portal \
  --filter="status=FAILURE" \
  --limit=3 \
  --format="value(id)" \
  --sort-by=~createTime)

if [ -n "$FAILED_BUILDS" ]; then
  echo "Found failed builds:"
  for build_id in $FAILED_BUILDS; do
    echo ""
    echo "Build ID: $build_id"
    echo "Logs:"
    gcloud builds log "$build_id" \
      --project=bldcebu-portal 2>&1 | tail -50
    echo ""
    echo "---"
  done
else
  echo "No failed builds found in recent history"
  echo ""
  echo "💡 The build might be happening in Cloud Run's internal build system"
  echo "   Check the deployment output or Cloud Run service logs"
fi

echo ""
echo "💡 Alternative: Check Cloud Run service logs for build errors"
echo "   gcloud run services describe bld-portal-backend --region=asia-southeast1 --project=bldcebu-portal"
