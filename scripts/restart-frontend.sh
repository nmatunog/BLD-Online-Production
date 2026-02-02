#!/bin/bash
# Restart frontend service by updating to latest revision
# Usage: ./scripts/restart-frontend.sh

set -e

echo "🔄 Restarting Frontend Service"
echo "=============================="
echo ""

gcloud config set project bldcebu-portal --quiet

echo "📦 Getting latest revision..."
LATEST_REVISION=$(gcloud run revisions list \
  --service=bld-portal-frontend \
  --region asia-southeast1 \
  --limit 1 \
  --format="value(name)" 2>/dev/null)

if [ -z "$LATEST_REVISION" ]; then
  echo "❌ No revisions found. Service may not be deployed."
  exit 1
fi

echo "✅ Latest revision: $LATEST_REVISION"
echo ""

echo "🔄 Routing all traffic to latest revision..."
gcloud run services update-traffic bld-portal-frontend \
  --region asia-southeast1 \
  --to-latest

echo ""
echo "✅ Frontend service restarted!"
echo ""
echo "⏳ Wait 30-60 seconds for the service to be ready"
echo "   Then refresh your browser"
echo ""
