#!/bin/bash
# EMERGENCY: Immediate cost reduction - scale everything down
# Usage: ./scripts/emergency-cost-reduction.sh

set -e

echo "🚨 EMERGENCY COST REDUCTION"
echo "==========================="
echo ""
echo "⚠️  This will immediately reduce costs by:"
echo "   - Scaling down Cloud Run services"
echo "   - Setting min instances to 0 (scale to zero)"
echo "   - Reducing resource allocation"
echo ""
read -p "Continue with emergency cost reduction? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Cancelled"
  exit 1
fi

gcloud config set project bldcebu-portal --quiet

echo ""
echo "📦 Scaling down backend..."
gcloud run services update bld-portal-backend \
  --region asia-southeast1 \
  --memory 256Mi \
  --cpu 0.5 \
  --max-instances 3 \
  --min-instances 0 \
  --timeout 60

echo "✅ Backend scaled down"

echo ""
echo "🌐 Scaling down frontend..."
gcloud run services update bld-portal-frontend \
  --region asia-southeast1 \
  --memory 256Mi \
  --cpu 0.5 \
  --max-instances 3 \
  --min-instances 0 \
  --timeout 60

echo "✅ Frontend scaled down"

echo ""
echo "📊 Checking Cloud SQL instance..."
INSTANCE_TIER=$(gcloud sql instances describe bld-portal-db \
  --format="value(settings.tier)" 2>/dev/null || echo "")

if [ -n "$INSTANCE_TIER" ]; then
  echo "   Current tier: $INSTANCE_TIER"
  
  # Check if it's a high-cost tier
  if [[ "$INSTANCE_TIER" == *"db-n1-standard-2"* ]] || \
     [[ "$INSTANCE_TIER" == *"db-n1-standard-4"* ]] || \
     [[ "$INSTANCE_TIER" == *"db-n1-standard-8"* ]] || \
     [[ "$INSTANCE_TIER" == *"db-custom"* ]]; then
    echo ""
    echo "⚠️  WARNING: High-cost database tier detected!"
    echo "   $INSTANCE_TIER can cost \$50-200+/month"
    echo ""
    echo "💡 Options to reduce database costs:"
    echo "   1. Downgrade to db-f1-micro (free tier, limited)"
    echo "   2. Downgrade to db-g1-small (~\$7/month)"
    echo "   3. Keep current tier but monitor usage"
    echo ""
    read -p "Downgrade to db-g1-small? (WILL CAUSE DOWNTIME) (yes/no): " downgrade
    if [ "$downgrade" == "yes" ]; then
      echo "⚠️  Downgrading database - this will cause 5-10 minutes of downtime!"
      gcloud sql instances patch bld-portal-db \
        --tier=db-g1-small \
        --region=asia-southeast1
      echo "✅ Database downgrade initiated (takes 5-10 minutes)"
    fi
  fi
fi

echo ""
echo "✅ Emergency cost reduction complete!"
echo ""
echo "📊 New resource limits:"
echo "   Backend:  256Mi RAM, 0.5 CPU, max 3 instances, min 0"
echo "   Frontend: 256Mi RAM, 0.5 CPU, max 3 instances, min 0"
echo ""
echo "💰 Expected cost reduction:"
echo "   - Cloud Run: Reduced by ~60-70%"
echo "   - Services will scale to zero when idle (no cost)"
echo ""
echo "💡 Monitor costs:"
echo "   https://console.cloud.google.com/billing/01B333-636762-33580F/reports?project=bldcebu-portal"
echo ""
