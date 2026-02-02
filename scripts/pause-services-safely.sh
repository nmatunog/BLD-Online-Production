#!/bin/bash
# Pause services safely (scale to zero) - preserves data, stops most charges
# Usage: ./scripts/pause-services-safely.sh

set -e

echo "⏸️  PAUSING SERVICES (Safe Mode)"
echo "================================="
echo ""
echo "This will:"
echo "  ✅ Scale services to zero (no charges when idle)"
echo "  ✅ Keep Cloud SQL running (small charge ~\$0.83-1.67/day)"
echo "  ✅ Preserve all data"
echo "  ✅ Services can be restarted anytime"
echo ""
read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Cancelled"
  exit 1
fi

gcloud config set project bldcebu-portal --quiet

# Scale services to zero
echo ""
echo "📦 Scaling backend to zero..."
gcloud run services update bld-portal-backend \
  --region asia-southeast1 \
  --min-instances 0 \
  --max-instances 0 \
  --memory 128Mi \
  --cpu 0.25

echo "✅ Backend scaled to zero"

echo ""
echo "🌐 Scaling frontend to zero..."
gcloud run services update bld-portal-frontend \
  --region asia-southeast1 \
  --min-instances 0 \
  --max-instances 0 \
  --memory 128Mi \
  --cpu 0.25

echo "✅ Frontend scaled to zero"

echo ""
echo "✅ Services paused!"
echo ""
echo "💰 Charges reduced to:"
echo "   - Cloud Run: \$0 (scaled to zero, no requests = no charge)"
echo "   - Cloud SQL: ~\$0.83-1.67/day (kept running to preserve data)"
echo ""
echo "🔄 To restart services:"
echo "   gcloud run services update bld-portal-backend --region asia-southeast1 --min-instances 1"
echo "   gcloud run services update bld-portal-frontend --region asia-southeast1 --min-instances 1"
echo ""
