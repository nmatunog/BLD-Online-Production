#!/bin/bash
# Check what databases exist in the production Cloud SQL instance
# Usage: ./scripts/check-database-name.sh

echo "🔍 Checking Production Databases"
echo "================================="
echo ""

gcloud config set project bldcebu-portal --quiet

echo "📋 Listing databases in bld-portal-db instance..."
echo ""

gcloud sql databases list \
  --instance=bld-portal-db \
  --project=bldcebu-portal

echo ""
echo "💡 Use the database name from the list above"
echo "   Common names: bld_portal, bld_portal_prod, postgres"
echo ""
