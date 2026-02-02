#!/bin/bash
# Check Cloud Build logs for deployment failures
# Usage: ./scripts/check-build-logs.sh

set -e

echo "🔍 Checking Cloud Build Logs"
echo "============================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

echo "Recent Cloud Build operations:"
echo "-----------------------------"
gcloud builds list \
  --limit=5 \
  --project=bldcebu-portal \
  --format="table(id,status,createTime,logUrl)" \
  --sort-by=~createTime

echo ""
echo "Getting latest build logs..."
echo ""

# Get the latest build ID
LATEST_BUILD=$(gcloud builds list \
  --limit=1 \
  --project=bldcebu-portal \
  --format="value(id)" \
  --sort-by=~createTime)

if [ -z "$LATEST_BUILD" ]; then
  echo "❌ No builds found"
  exit 1
fi

echo "Latest build ID: $LATEST_BUILD"
echo ""
echo "Build logs (errors only):"
echo "------------------------"
gcloud builds log "$LATEST_BUILD" \
  --project=bldcebu-portal 2>&1 | grep -i -E "(error|fail|warning|npm|typescript|ts)" | head -50 || \
gcloud builds log "$LATEST_BUILD" \
  --project=bldcebu-portal 2>&1 | tail -100

echo ""
echo "💡 For full logs, visit:"
echo "   https://console.cloud.google.com/cloud-build/builds?project=bldcebu-portal"
