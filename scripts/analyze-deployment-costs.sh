#!/bin/bash
# Analyze deployment costs and frequency
# Usage: ./scripts/analyze-deployment-costs.sh

set -e

echo "💰 Deployment Cost Analysis"
echo "==========================="
echo ""

gcloud config set project bldcebu-portal --quiet

echo "📊 Cloud Build Jobs (Last 7 Days):"
echo "---------------------------------"
BUILDS=$(gcloud builds list \
  --limit 1000 \
  --format="table(id,status,createTime,duration,source.storageSource.bucket)" \
  --filter="createTime>=-P7D" \
  2>/dev/null)

if [ -z "$BUILDS" ] || [ "$BUILDS" = "" ]; then
  echo "No builds found in last 7 days"
else
  echo "$BUILDS" | head -30
fi

echo ""
echo "📈 Build Statistics:"
echo "-------------------"

# Count total builds
TOTAL_BUILDS=$(gcloud builds list \
  --limit 1000 \
  --format="value(id)" \
  --filter="createTime>=-P7D" \
  2>/dev/null | wc -l | tr -d ' ')

# Count builds in last 3 days
BUILDS_3D=$(gcloud builds list \
  --limit 1000 \
  --format="value(id)" \
  --filter="createTime>=-P3D" \
  2>/dev/null | wc -l | tr -d ' ')

echo "   Total builds (last 7 days): $TOTAL_BUILDS"
echo "   Builds (last 3 days): $BUILDS_3D"

# Estimate costs
# Average build time: ~5-10 minutes for Cloud Run deployments
AVG_BUILD_TIME=7
ESTIMATED_MINUTES=$((BUILDS_3D * AVG_BUILD_TIME))
ESTIMATED_COST=$(echo "scale=2; $ESTIMATED_MINUTES * 0.003" | bc 2>/dev/null || echo "N/A")

echo ""
echo "💰 Estimated Cloud Build Costs (last 3 days):"
echo "   Builds: $BUILDS_3D"
echo "   Estimated minutes: ~$ESTIMATED_MINUTES"
echo "   Estimated cost: ~\$$ESTIMATED_COST"
echo ""

if [ "$BUILDS_3D" -gt 20 ]; then
  echo "⚠️  HIGH number of builds! ($BUILDS_3D builds in 3 days)"
  echo "   This could be a significant cost driver if you've been deploying frequently"
  echo ""
  echo "💡 To reduce Cloud Build costs:"
  echo "   1. Deploy less frequently"
  echo "   2. Use pre-built Docker images instead of building each time"
  echo "   3. Test locally before deploying"
fi

echo ""
echo "📋 Cost Breakdown:"
echo "-----------------"
echo "   Cloud Build: ~\$0.003 per build-minute"
echo "   Average build: ~5-10 minutes = ~\$0.015-0.03 per deployment"
echo "   $BUILDS_3D builds × ~\$0.02 = ~\$$ESTIMATED_COST"
echo ""
echo "💡 If Cloud Build is \$201, you'd need:"
echo "   ~6,700 build-minutes = ~1,340 builds (10 min each)"
echo "   This is VERY unlikely - Cloud Build is probably NOT the main cost"
echo ""
echo "🔍 The main cost is likely:"
echo "   1. Cloud SQL instance (if large tier)"
echo "   2. Cloud Run services running 24/7 (if min-instances > 0)"
echo "   3. High traffic/requests"
echo ""
echo "💡 Check detailed costs:"
echo "   https://console.cloud.google.com/billing/01B333-636762-33580F/reports?project=bldcebu-portal"
echo ""
