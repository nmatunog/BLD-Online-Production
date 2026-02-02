#!/bin/bash
# Redeploy frontend with hydration fix
# Usage: ./scripts/redeploy-frontend-fixed.sh

set -e

echo "🔧 Redeploying Frontend with Hydration Fix"
echo "==========================================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

# Get backend URL
echo "📌 Getting backend URL..."
BACKEND_URL=$(gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --format="value(status.url)")

if [ -z "$BACKEND_URL" ]; then
  echo "❌ Could not get backend URL. Is the backend deployed?"
  exit 1
fi

echo "✅ Backend URL: $BACKEND_URL"
echo ""

echo "📦 Redeploying frontend with fixes..."
echo "   - Fixed React hydration error"
echo "   - Runtime backend URL detection"
echo ""

cd frontend

gcloud run deploy bld-portal-frontend \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 20 \
  --set-env-vars "NEXT_PUBLIC_API_BASE_URL=$BACKEND_URL,NEXT_PUBLIC_API_URL=$BACKEND_URL/api/v1,NODE_ENV=production"

cd ..

echo ""
echo "✅ Frontend redeployed with fixes!"
echo ""
echo "⏳ Wait 3-5 minutes for build and deployment"
echo "   Then refresh your browser - the hydration error should be gone"
echo "   And the frontend should auto-detect the backend URL"
echo ""
