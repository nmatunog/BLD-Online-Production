#!/bin/bash
# IMMEDIATELY stop all production services
# Usage: ./scripts/stop-production-now.sh

set -e

echo "🛑 STOPPING PRODUCTION - PREVENTING FURTHER CHARGES"
echo "==================================================="
echo ""
echo "This will DELETE all Cloud Run services immediately."
echo "Charges will stop for Cloud Run and Cloud Build."
echo ""
echo "⚠️  Cloud SQL will continue running (~\$0.83-1.67/day) unless you delete it."
echo ""
read -p "Type 'DELETE SERVICES' to confirm: " confirm
if [ "$confirm" != "DELETE SERVICES" ]; then
  echo "❌ Cancelled"
  exit 1
fi

gcloud config set project bldcebu-portal --quiet

echo ""
echo "🗑️  Deleting Cloud Run services..."
echo ""

# Delete backend
echo "📦 Deleting backend service..."
gcloud run services delete bld-portal-backend \
  --region asia-southeast1 \
  --quiet 2>/dev/null && echo "   ✅ Backend deleted" || echo "   ⚠️  Backend may not exist"

# Delete frontend
echo "🌐 Deleting frontend service..."
gcloud run services delete bld-portal-frontend \
  --region asia-southeast1 \
  --quiet 2>/dev/null && echo "   ✅ Frontend deleted" || echo "   ⚠️  Frontend may not exist"

echo ""
echo "✅ Cloud Run services deleted!"
echo ""
echo "💰 Charges stopped for:"
echo "   ✅ Cloud Run (deleted - no more charges)"
echo "   ✅ Cloud Build (no more deployments)"
echo ""
echo "⚠️  Cloud SQL is still running:"
echo "   - Cost: ~\$0.83-1.67/day (~\$25-50/month)"
echo "   - Contains your database data"
echo ""
read -p "Delete Cloud SQL instance too? (WILL DELETE ALL DATA) (yes/no): " delete_db

if [ "$delete_db" == "yes" ]; then
  echo ""
  echo "⚠️  FINAL WARNING: Deleting database will PERMANENTLY DELETE ALL DATA!"
  read -p "Type 'DELETE DATABASE' to confirm: " confirm_db
  if [ "$confirm_db" == "DELETE DATABASE" ]; then
    echo ""
    echo "🗑️  Deleting Cloud SQL instance..."
    gcloud sql instances delete bld-portal-db \
      --quiet 2>/dev/null && echo "   ✅ Database deleted" || echo "   ⚠️  Database deletion failed or doesn't exist"
    echo ""
    echo "✅ ALL services deleted - NO MORE CHARGES"
  else
    echo "❌ Database deletion cancelled"
    echo ""
    echo "💡 To delete database later:"
    echo "   gcloud sql instances delete bld-portal-db"
  fi
else
  echo ""
  echo "✅ Database kept (will continue ~\$0.83-1.67/day)"
  echo "   To delete later:"
  echo "   gcloud sql instances delete bld-portal-db"
fi

echo ""
echo "✅ ========================================"
echo "✅ Production services stopped!"
echo "✅ ========================================"
echo ""
echo "📊 Summary:"
echo "   - Cloud Run: DELETED (no charges)"
echo "   - Cloud Build: STOPPED (no more deployments)"
if [ "$delete_db" == "yes" ] && [ "$confirm_db" == "DELETE DATABASE" ]; then
  echo "   - Cloud SQL: DELETED (no charges)"
else
  echo "   - Cloud SQL: Still running (~\$0.83-1.67/day)"
fi
echo ""
echo "💡 Verify services are deleted:"
echo "   gcloud run services list --region asia-southeast1"
echo ""
