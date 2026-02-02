#!/bin/bash
# Check current costs and identify what's being charged
# Usage: ./scripts/check-costs.sh

set -e

echo "💰 Checking Cloud Costs"
echo "======================="
echo ""

gcloud config set project bldcebu-portal --quiet

echo "📊 Current Service Usage:"
echo "------------------------"

# Check Cloud Run services
echo "Cloud Run Services:"
gcloud run services list \
  --region asia-southeast1 \
  --format="table(metadata.name,spec.template.spec.containers[0].resources.limits.memory,spec.template.spec.containers[0].resources.limits.cpu,status.url)" \
  2>/dev/null || echo "Could not list services"

echo ""
echo "Cloud SQL Instances:"
gcloud sql instances list \
  --format="table(name,databaseVersion,tier,settings.ipConfiguration.ipv4Enabled,state)" \
  2>/dev/null || echo "Could not list SQL instances"

echo ""
echo "💡 Cost Breakdown (Estimated):"
echo "------------------------------"
echo ""
echo "Cloud Run:"
echo "  - Backend:  ~\$0.40 per million requests + compute"
echo "  - Frontend: ~\$0.40 per million requests + compute"
echo "  - Memory: 512Mi per service = ~\$0.0000025 per second"
echo ""
echo "Cloud SQL:"
echo "  - db-n1-standard-1: ~\$25-50/month (~\$0.83-1.67/day)"
echo "  - If using larger instance, costs increase significantly"
echo ""
echo "Cloud Build:"
echo "  - ~\$0.003 per build-minute"
echo "  - Each deployment builds Docker images"
echo ""
echo "⚠️  \$201 for 3 days is HIGH!"
echo "   Possible causes:"
echo "   1. Very high traffic/requests"
echo "   2. Large Cloud SQL instance"
echo "   3. Many Cloud Build jobs"
echo "   4. Services running 24/7 with high resource usage"
echo ""
echo "🔍 To see detailed costs:"
echo "   https://console.cloud.google.com/billing/01B333-636762-33580F/reports?project=bldcebu-portal"
echo ""
