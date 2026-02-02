#!/bin/bash
# Compare dev and prod configurations to find differences
# Usage: ./scripts/compare-dev-prod.sh

set -e

echo "🔍 Comparing Dev vs Prod Configuration"
echo ""

# Check dev database URL
echo "📋 DEV Database URL (from Secret Manager):"
echo ""
gcloud secrets versions access latest --secret=dev-database-url --project=bld-cebu-portal-dev 2>/dev/null || echo "  ⚠️  Secret not found or not accessible"
echo ""

# Check prod database URL
echo "📋 PROD Database URL (from Secret Manager):"
echo ""
gcloud secrets versions access latest --secret=prod-database-url --project=bldcebu-portal 2>/dev/null || echo "  ⚠️  Secret not found or not accessible"
echo ""

# Check dev service configuration
echo "📋 DEV Service Configuration:"
gcloud run services describe bld-portal-backend-dev \
  --region=asia-southeast1 \
  --project=bld-cebu-portal-dev \
  --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null | head -20 || echo "  ⚠️  Service not found"
echo ""

# Check prod service configuration
echo "📋 PROD Service Configuration:"
gcloud run services describe bld-portal-backend \
  --region=asia-southeast1 \
  --project=bldcebu-portal \
  --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null | head -20 || echo "  ⚠️  Service not found"
echo ""

echo "💡 Key things to check:"
echo "   1. Database URL format (should match dev exactly)"
echo "   2. Database name (dev uses bld_portal_dev, prod should use bld_portal_prod)"
echo "   3. Connection name format"
echo "   4. Environment variables"
