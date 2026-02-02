#!/bin/bash
# Check Cloud Build usage and costs
# Usage: ./scripts/check-cloud-build-usage.sh

set -e

echo "🔨 Checking Cloud Build Usage"
echo "============================="
echo ""

gcloud config set project bldcebu-portal --quiet

echo "📊 Recent Cloud Build Jobs (last 20):"
echo "-------------------------------------"
gcloud builds list \
  --limit 20 \
  --format="table(id,status,createTime,duration)" \
  2>/dev/null | head -25 || echo "No builds found"

echo ""
echo "💰 Estimated Cloud Build Costs:"
echo "-------------------------------"

# Count builds in last 3 days
BUILD_COUNT=$(gcloud builds list \
  --limit 1000 \
  --format="value(id)" \
  --filter="createTime>=-P3D" \
  2>/dev/null | wc -l | tr -d ' ')

echo "   Builds in last 3 days: $BUILD_COUNT"

# Estimate total build minutes (rough estimate: 5 minutes per build)
ESTIMATED_MINUTES=$((BUILD_COUNT * 5))
ESTIMATED_COST=$(echo "scale=2; $ESTIMATED_MINUTES * 0.003" | bc 2>/dev/null || echo "N/A")

echo "   Estimated build minutes: ~$ESTIMATED_MINUTES"
echo "   Estimated cost: ~\$$ESTIMATED_COST"
echo ""

if [ "$BUILD_COUNT" -gt 50 ]; then
  echo "⚠️  HIGH number of builds! This could be a major cost driver."
  echo "   Consider:"
  echo "   1. Reducing deployment frequency"
  echo "   2. Using pre-built images instead of building each time"
  echo "   3. Cleaning up old builds"
fi

echo ""
echo "💡 To see all builds:"
echo "   https://console.cloud.google.com/cloud-build/builds?project=bldcebu-portal"
echo ""
