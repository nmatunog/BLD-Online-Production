#!/bin/bash
# Delete the dev Cloud SQL instance (the expensive one causing charges)
# Usage: ./scripts/delete-dev-cloud-sql.sh

set -e

echo "🛑 DELETING DEV CLOUD SQL INSTANCE"
echo "==================================="
echo ""
echo "⚠️  WARNING: This will DELETE the Cloud SQL instance in the DEV project"
echo "   Project: bld-cebu-portal-dev"
echo "   Instance: bld-portal-db"
echo "   This is the instance causing \$175.31/month charges"
echo ""
echo "⚠️  ALL DATA IN THIS DATABASE WILL BE PERMANENTLY DELETED"
echo ""
read -p "Type 'DELETE DEV DATABASE' to confirm: " confirm
if [ "$confirm" != "DELETE DEV DATABASE" ]; then
  echo "❌ Cancelled"
  exit 1
fi

gcloud config set project bld-cebu-portal-dev --quiet

echo ""
echo "🗑️  Deleting Cloud SQL instance..."
gcloud sql instances delete bld-portal-db \
  --quiet 2>/dev/null && {
  echo "✅ Dev Cloud SQL instance deleted!"
  echo ""
  echo "💰 Charges will stop immediately"
  echo "   This was costing ~\$175.31/month"
} || {
  echo "⚠️  Deletion failed or instance doesn't exist"
  echo "   Check manually: gcloud sql instances list --project bld-cebu-portal-dev"
}

echo ""
echo "✅ ========================================"
echo "✅ Dev database deleted - charges stopped!"
echo "✅ ========================================"
echo ""
