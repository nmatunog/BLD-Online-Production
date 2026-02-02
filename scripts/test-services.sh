#!/bin/bash
# Test if services are responding
# Usage: ./scripts/test-services.sh

set -e

echo "🧪 Testing Production Services"
echo "=============================="
echo ""

gcloud config set project bldcebu-portal --quiet

# Get service URLs
BACKEND_URL=$(gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --format="value(status.url)")

FRONTEND_URL=$(gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="value(status.url)")

echo "📦 Backend: $BACKEND_URL"
echo "   Testing..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/docs" || echo "000")
if [ "$BACKEND_STATUS" = "200" ] || [ "$BACKEND_STATUS" = "301" ] || [ "$BACKEND_STATUS" = "302" ]; then
  echo "   ✅ Backend is responding (HTTP $BACKEND_STATUS)"
else
  echo "   ⚠️  Backend returned HTTP $BACKEND_STATUS"
fi

echo ""
echo "🌐 Frontend: $FRONTEND_URL"
echo "   Testing..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" || echo "000")
if [ "$FRONTEND_STATUS" = "200" ] || [ "$FRONTEND_STATUS" = "301" ] || [ "$FRONTEND_STATUS" = "302" ]; then
  echo "   ✅ Frontend is responding (HTTP $FRONTEND_STATUS)"
else
  echo "   ⚠️  Frontend returned HTTP $FRONTEND_STATUS"
  echo "   💡 This might be temporary - try refreshing your browser"
fi

echo ""
echo "📍 Service URLs:"
echo "   Backend:  $BACKEND_URL"
echo "   Frontend: $FRONTEND_URL"
echo ""
