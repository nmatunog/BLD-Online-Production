#!/bin/bash
# Check dev Cloud SQL instance details and costs
# Usage: ./scripts/check-dev-cloud-sql-details.sh

set -e

echo "🔍 Checking Dev Cloud SQL Instance Details"
echo "=========================================="
echo ""

gcloud config set project bld-cebu-portal-dev --quiet

echo "📊 Cloud SQL Instance Details:"
gcloud sql instances describe bld-portal-db \
  --format="yaml(name,databaseVersion,region,settings.tier,settings.dataDiskSizeGb,settings.dataDiskType,settings.availabilityType,createTime)" 2>/dev/null || {
  echo "⚠️  Could not get instance details"
}

echo ""
echo "💰 Cost Analysis:"
echo "   The billing shows 'Enterprise Plus' tier which is VERY expensive"
echo "   This is likely a db-n1-standard-4 or higher tier"
echo ""
echo "💡 Typical Cloud SQL costs:"
echo "   - db-f1-micro: ~\$7/month"
echo "   - db-n1-standard-1: ~\$25/month"
echo "   - db-n1-standard-2: ~\$50/month"
echo "   - db-n1-standard-4: ~\$100/month"
echo "   - Enterprise Plus: \$175+/month"
echo ""
