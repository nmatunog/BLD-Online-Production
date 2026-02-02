#!/bin/bash
# Reduce costs by scaling down services
# Usage: ./scripts/reduce-costs.sh

set -e

echo "💰 Reducing Service Costs"
echo "========================="
echo ""

gcloud config set project bldcebu-portal --quiet

echo "⚠️  WARNING: This will scale down services to reduce costs"
echo "   Services will have:"
echo "   - Lower memory limits"
echo "   - Fewer max instances"
echo "   - May affect performance under high load"
echo ""
read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Cancelled"
  exit 1
fi

# Scale down backend
echo ""
echo "📦 Scaling down backend..."
gcloud run services update bld-portal-backend \
  --region asia-southeast1 \
  --memory 256Mi \
  --cpu 0.5 \
  --max-instances 5 \
  --min-instances 0

echo "✅ Backend scaled down (256Mi, 0.5 CPU, max 5 instances)"

# Scale down frontend
echo ""
echo "🌐 Scaling down frontend..."
gcloud run services update bld-portal-frontend \
  --region asia-southeast1 \
  --memory 256Mi \
  --cpu 0.5 \
  --max-instances 5 \
  --min-instances 0

echo "✅ Frontend scaled down (256Mi, 0.5 CPU, max 5 instances)"

# Check Cloud SQL instance
echo ""
echo "📊 Checking Cloud SQL instance..."
INSTANCE_TIER=$(gcloud sql instances describe bld-portal-db \
  --format="value(settings.tier)" 2>/dev/null || echo "")

if [ -n "$INSTANCE_TIER" ]; then
  echo "   Current tier: $INSTANCE_TIER"
  if [[ "$INSTANCE_TIER" == *"db-n1-standard"* ]] || [[ "$INSTANCE_TIER" == *"db-custom"* ]]; then
    echo ""
    echo "⚠️  Cloud SQL is using a paid tier: $INSTANCE_TIER"
    echo "   This is likely a major cost driver!"
    echo ""
    echo "💡 To reduce Cloud SQL costs:"
    echo "   1. Consider using db-f1-micro (free tier eligible, but limited)"
    echo "   2. Or db-g1-small (~\$7-10/month)"
    echo "   3. Or pause the instance when not in use"
    echo ""
    read -p "Downgrade Cloud SQL to db-f1-micro? (yes/no): " downgrade_db
    if [ "$downgrade_db" == "yes" ]; then
      echo "⚠️  Downgrading database - this will cause downtime!"
      gcloud sql instances patch bld-portal-db \
        --tier=db-f1-micro \
        --region=asia-southeast1
      echo "✅ Database tier updated (will take several minutes)"
    fi
  fi
fi

echo ""
echo "✅ Cost reduction complete!"
echo ""
echo "📊 New resource limits:"
echo "   Backend:  256Mi RAM, 0.5 CPU, max 5 instances"
echo "   Frontend: 256Mi RAM, 0.5 CPU, max 5 instances"
echo ""
echo "💡 Monitor costs at:"
echo "   https://console.cloud.google.com/billing/01B333-636762-33580F/reports?project=bldcebu-portal"
echo ""
