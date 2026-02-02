#!/bin/bash
# Check the latest backend logs for errors
# Usage: ./scripts/check-latest-logs.sh

set -e

echo "📋 Checking latest backend logs for errors..."
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

# View logs for the latest revision
echo "📋 Recent logs (last 30 entries, showing errors and important messages):"
echo ""
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-backend AND resource.labels.revision_name=$LATEST_REVISION" \
  --limit 30 \
  --project=bldcebu-portal \
  --format="table(timestamp,textPayload,jsonPayload.message)" \
  --freshness=1h \
  | grep -E "(ERROR|error|Error|FAILED|Failed|failed|Prisma|database|Database|DATABASE|OpenSSL|openssl|libssl|PORT|port|listen|Listen)" || \
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-backend AND resource.labels.revision_name=$LATEST_REVISION" \
  --limit 30 \
  --project=bldcebu-portal \
  --format="table(timestamp,textPayload,jsonPayload.message)" \
  --freshness=1h

echo ""
echo "💡 For full logs, visit:"
echo "   https://console.cloud.google.com/logs/viewer?project=bldcebu-portal&resource=cloud_run_revision"
