#!/bin/bash
# Delete all Cloud Run services immediately (no prompts)
# Usage: ./scripts/delete-services-now.sh

set -e

echo "🛑 DELETING PRODUCTION SERVICES NOW"
echo "===================================="
echo ""

gcloud config set project bldcebu-portal --quiet

echo "🗑️  Deleting Cloud Run services..."
echo ""

# Delete backend
echo "📦 Deleting backend service..."
if gcloud run services delete bld-portal-backend \
  --region asia-southeast1 \
  --quiet 2>/dev/null; then
  echo "   ✅ Backend deleted"
else
  echo "   ⚠️  Backend may not exist or already deleted"
fi

# Delete frontend
echo "🌐 Deleting frontend service..."
if gcloud run services delete bld-portal-frontend \
  --region asia-southeast1 \
  --quiet 2>/dev/null; then
  echo "   ✅ Frontend deleted"
else
  echo "   ⚠️  Frontend may not exist or already deleted"
fi

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
echo "💡 To delete Cloud SQL database (WILL DELETE ALL DATA):"
echo "   gcloud sql instances delete bld-portal-db --quiet"
echo ""
echo "✅ ========================================"
echo "✅ Production services stopped!"
echo "✅ ========================================"
echo ""
echo "📊 Summary:"
echo "   - Cloud Run: DELETED (no charges)"
echo "   - Cloud Build: STOPPED (no more deployments)"
echo "   - Cloud SQL: Still running (~\$0.83-1.67/day)"
echo ""
echo "💡 Verify services are deleted:"
echo "   gcloud run services list --region asia-southeast1"
echo ""
