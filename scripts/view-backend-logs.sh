#!/bin/bash
# View Cloud Run backend logs
# Usage: ./scripts/view-backend-logs.sh

set -e

echo "📋 Viewing backend logs..."
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

# View recent logs
echo "Recent logs (last 50 entries):"
echo ""
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-backend" \
  --limit 50 \
  --project=bldcebu-portal \
  --format="table(timestamp,textPayload,jsonPayload.message)" \
  --freshness=1h

echo ""
echo "💡 For more detailed logs, visit:"
echo "   https://console.cloud.google.com/logs/viewer?project=bldcebu-portal&resource=cloud_run_revision"
