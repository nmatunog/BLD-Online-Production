#!/bin/bash
# Get the actual container error logs
# Usage: ./scripts/get-container-error.sh

set -e

echo "📋 Getting container error logs..."
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

# Get the latest revision
LATEST_REVISION=$(gcloud run revisions list \
  --service=bld-portal-backend \
  --region=asia-southeast1 \
  --limit=1 \
  --format="value(name)" \
  --project=bldcebu-portal)

if [ -z "$LATEST_REVISION" ]; then
  echo "❌ No revisions found"
  exit 1
fi

echo "Latest revision: $LATEST_REVISION"
echo ""

# Get container logs (stdout/stderr)
echo "📋 Container logs (stdout/stderr):"
echo ""
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-backend AND resource.labels.revision_name=$LATEST_REVISION" \
  --limit 100 \
  --project=bldcebu-portal \
  --format="value(textPayload,jsonPayload.message)" \
  --freshness=1h \
  | head -50

echo ""
echo ""
echo "📋 Error messages only:"
echo ""
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-backend AND resource.labels.revision_name=$LATEST_REVISION AND severity>=ERROR" \
  --limit 50 \
  --project=bldcebu-portal \
  --format="table(timestamp,textPayload,jsonPayload.message)" \
  --freshness=1h

echo ""
echo "💡 For full logs, visit:"
echo "   https://console.cloud.google.com/logs/viewer?project=bldcebu-portal&resource=cloud_run_revision"
