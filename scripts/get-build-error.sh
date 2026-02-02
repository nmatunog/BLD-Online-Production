#!/bin/bash
# Get the latest build error
# Usage: ./scripts/get-build-error.sh

set -e

echo "🔍 Getting Latest Build Error"
echo "=============================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

# Get latest build
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

echo "Build status and errors:"
echo "-----------------------"
gcloud builds describe "$LATEST_BUILD" \
  --project=bldcebu-portal \
  --format="value(status,statusDetail)" 2>/dev/null || echo "Could not get build status"

echo ""
echo "Build logs (last 100 lines with errors):"
echo "----------------------------------------"
gcloud builds log "$LATEST_BUILD" \
  --project=bldcebu-portal 2>&1 | tail -100

echo ""
echo "💡 For full logs:"
echo "   https://console.cloud.google.com/cloud-build/builds?project=bldcebu-portal"
