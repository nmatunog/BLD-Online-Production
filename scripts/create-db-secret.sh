#!/bin/bash
# Create database URL secret directly
# Usage: ./scripts/create-db-secret.sh

set -e

DATABASE_URL="postgresql://postgres:XOb6Ce2V1Pe9xAOXoQFImyUsMbIG1LCB@/bld_portal_prod?host=/cloudsql/bldcebu-portal:asia-southeast1:bld-portal-db"

echo "🔐 Creating prod-database-url secret..."
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

# Check if secret exists
if gcloud secrets describe prod-database-url >/dev/null 2>&1; then
  echo "⚠️  Secret already exists. Adding new version..."
  echo "$DATABASE_URL" | gcloud secrets versions add prod-database-url --data-file=-
  echo "✅ Updated prod-database-url"
else
  echo "Creating new secret..."
  echo "$DATABASE_URL" | gcloud secrets create prod-database-url \
    --data-file=- \
    --replication-policy="automatic" \
    --quiet
  echo "✅ Created prod-database-url"
fi

echo ""
echo "✅ Database URL secret is ready!"
echo ""
echo "📝 Next steps:"
echo "   1. Run: ./scripts/check-secrets.sh (to verify all secrets)"
echo "   2. Run: ./scripts/deploy-prod.sh (to deploy)"
