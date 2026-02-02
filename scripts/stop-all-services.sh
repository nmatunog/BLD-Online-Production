#!/bin/bash
# Stop all production services to prevent further charges
# Usage: ./scripts/stop-all-services.sh

set -e

echo "🛑 STOPPING ALL PRODUCTION SERVICES"
echo "===================================="
echo ""
echo "⚠️  WARNING: This will:"
echo "   1. Delete Cloud Run services (backend & frontend)"
echo "   2. Optionally delete Cloud SQL instance (WILL DELETE ALL DATA)"
echo ""
echo "This will STOP ALL CHARGES immediately."
echo ""
read -p "Type 'STOP ALL SERVICES' to confirm: " confirm
if [ "$confirm" != "STOP ALL SERVICES" ]; then
  echo "❌ Cancelled"
  exit 1
fi

gcloud config set project bldcebu-portal --quiet

# Delete Cloud Run services
echo ""
echo "🗑️  Deleting Cloud Run services..."
echo ""

echo "📦 Deleting backend..."
gcloud run services delete bld-portal-backend \
  --region asia-southeast1 \
  --quiet 2>/dev/null && echo "✅ Backend deleted" || echo "⚠️  Backend may not exist"

echo ""
echo "🌐 Deleting frontend..."
gcloud run services delete bld-portal-frontend \
  --region asia-southeast1 \
  --quiet 2>/dev/null && echo "✅ Frontend deleted" || echo "⚠️  Frontend may not exist"

# Ask about Cloud SQL
echo ""
echo "💾 Cloud SQL Database:"
echo "----------------------"
echo "   The database contains all your data."
echo ""
echo "   Options:"
echo "   1. DELETE database (stops all charges, DELETES ALL DATA)"
echo "   2. KEEP database (small charge ~\$0.83-1.67/day, data preserved)"
echo ""
read -p "Delete Cloud SQL instance? (yes/no): " delete_db

if [ "$delete_db" == "yes" ]; then
  echo ""
  echo "⚠️  FINAL WARNING: This will DELETE ALL DATA in the database!"
  read -p "Type 'DELETE DATABASE' to confirm: " confirm_db
  if [ "$confirm_db" == "DELETE DATABASE" ]; then
    echo ""
    echo "🗑️  Deleting Cloud SQL instance..."
    gcloud sql instances delete bld-portal-db \
      --quiet 2>/dev/null && echo "✅ Database deleted" || echo "⚠️  Database may not exist or deletion failed"
  else
    echo "❌ Database deletion cancelled"
  fi
else
  echo ""
  echo "✅ Database kept (will continue to incur charges ~\$0.83-1.67/day)"
  echo "   To delete later:"
  echo "   gcloud sql instances delete bld-portal-db"
fi

echo ""
echo "✅ ========================================"
echo "✅ Services stopped/deleted!"
echo "✅ ========================================"
echo ""
echo "💰 Charges will stop immediately for:"
echo "   - Cloud Run services (deleted)"
echo "   - Cloud Build (no more deployments)"
if [ "$delete_db" == "yes" ]; then
  echo "   - Cloud SQL (deleted)"
else
  echo "   - Cloud SQL (still running - small charge continues)"
fi
echo ""
echo "💡 To verify services are deleted:"
echo "   gcloud run services list --region asia-southeast1"
echo ""
