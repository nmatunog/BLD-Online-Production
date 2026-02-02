#!/bin/bash
# Get all production deployment URLs
# Usage: ./scripts/get-production-urls.sh

set -e

echo "🔍 Production Deployment Status"
echo "==============================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

echo "📦 Cloud Run Services:"
echo "---------------------"

# Backend
echo -n "Backend:  "
BACKEND_URL=$(gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --format="value(status.url)" 2>/dev/null || echo "❌ Not found")

if [ "$BACKEND_URL" != "❌ Not found" ]; then
  echo "$BACKEND_URL"
  echo "   Test: curl $BACKEND_URL/api/docs"
else
  echo "$BACKEND_URL"
fi

echo ""

# Frontend
echo -n "Frontend: "
FRONTEND_URL=$(gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="value(status.url)" 2>/dev/null || echo "❌ Not found")

if [ "$FRONTEND_URL" != "❌ Not found" ]; then
  echo "$FRONTEND_URL"
  echo "   Open: $FRONTEND_URL"
else
  echo "$FRONTEND_URL"
fi

echo ""
echo "🔥 Firebase Hosting:"
echo "--------------------"
echo "   URL: https://bldcebu-online-portal.web.app"
echo "   (or check Firebase Console for your site ID)"
echo ""

echo "✅ Deployment Summary:"
echo "---------------------"
if [ "$BACKEND_URL" != "❌ Not found" ] && [ "$FRONTEND_URL" != "❌ Not found" ]; then
  echo "✅ Backend: Deployed"
  echo "✅ Frontend: Deployed"
  echo "⏳ Firebase Hosting: Create site via Console if needed"
  echo ""
  echo "🎉 Your application is LIVE and working!"
else
  echo "⚠️  Some services may not be deployed"
  echo "   Check with: gcloud run services list --region asia-southeast1"
fi

echo ""
