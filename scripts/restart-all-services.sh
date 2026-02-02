#!/bin/bash
# Restart all services after billing is enabled
# Usage: ./scripts/restart-all-services.sh

set -e

echo "🔄 Restarting All Services"
echo "=========================="
echo ""

gcloud config set project bldcebu-portal --quiet

# Verify billing
echo "💳 Verifying billing..."
BILLING=$(gcloud billing projects describe bldcebu-portal --format="value(billingAccountName)" 2>/dev/null || echo "")

if [ -z "$BILLING" ]; then
  echo "❌ Billing is not enabled!"
  echo "   Please enable billing first:"
  echo "   https://console.cloud.google.com/billing?project=bldcebu-portal"
  exit 1
fi

echo "✅ Billing enabled: $BILLING"
echo ""

# Restart backend
echo "📦 Restarting backend..."
gcloud run services update-traffic bld-portal-backend \
  --region asia-southeast1 \
  --to-latest

echo "✅ Backend restarted"
echo ""

# Restart frontend
echo "🌐 Restarting frontend..."
gcloud run services update-traffic bld-portal-frontend \
  --region asia-southeast1 \
  --to-latest

echo "✅ Frontend restarted"
echo ""

echo "⏳ Waiting 60 seconds for services to fully restart..."
echo "   (Billing changes can take 1-2 minutes to propagate)"
echo ""

for i in {60..1}; do
  printf "\r   Waiting... %2d seconds remaining" $i
  sleep 1
done
echo ""
echo ""

# Test services
echo "🧪 Testing services..."
BACKEND_URL=$(gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --format="value(status.url)")

FRONTEND_URL=$(gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="value(status.url)")

BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/docs" 2>/dev/null || echo "000")
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null || echo "000")

echo ""
if [ "$BACKEND_STATUS" = "200" ] || [ "$BACKEND_STATUS" = "301" ] || [ "$BACKEND_STATUS" = "302" ]; then
  echo "✅ Backend is responding (HTTP $BACKEND_STATUS)"
else
  echo "⚠️  Backend returned HTTP $BACKEND_STATUS"
  echo "   This might need more time - billing can take 2-3 minutes to fully activate"
fi

if [ "$FRONTEND_STATUS" = "200" ] || [ "$FRONTEND_STATUS" = "301" ] || [ "$FRONTEND_STATUS" = "302" ]; then
  echo "✅ Frontend is responding (HTTP $FRONTEND_STATUS)"
else
  echo "⚠️  Frontend returned HTTP $FRONTEND_STATUS"
  echo "   This might need more time - billing can take 2-3 minutes to fully activate"
fi

echo ""
echo "📍 Service URLs:"
echo "   Backend:  $BACKEND_URL"
echo "   Frontend: $FRONTEND_URL"
echo ""
echo "💡 If services still show errors, wait 2-3 more minutes for billing to fully propagate"
echo ""
