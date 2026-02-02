#!/bin/bash
# Complete Firebase Hosting deployment with proper API enablement
# Usage: ./scripts/complete-firebase-hosting-deploy.sh

set -e

echo "🔥 Complete Firebase Hosting Deployment"
echo "======================================"
echo ""

# Set project
gcloud config set project bldcebu-portal
firebase use prod

# Step 1: Enable Firebase Hosting API
echo "Step 1: Enabling Firebase Hosting API..."
gcloud services enable firebasehosting.googleapis.com --project bldcebu-portal

echo ""
echo "✅ API enabled!"
echo "⏳ Waiting 45 seconds for API to fully propagate..."
echo "   (This is important - the API needs time to activate)"
echo ""

# Wait for API propagation
for i in {45..1}; do
  printf "\r   Waiting... %2d seconds remaining" $i
  sleep 1
done
echo ""
echo ""

# Step 2: Verify API is enabled
echo "Step 2: Verifying API is enabled..."
API_ENABLED=$(gcloud services list --enabled --project bldcebu-portal --filter="name:firebasehosting.googleapis.com" --format="value(name)" 2>/dev/null || echo "")

if [ -z "$API_ENABLED" ]; then
  echo "⚠️  Warning: API may not be fully enabled yet"
  echo "   You can check manually:"
  echo "   https://console.cloud.google.com/apis/library/firebasehosting.googleapis.com?project=bldcebu-portal"
  echo ""
  read -p "Continue anyway? (y/n): " continue_anyway
  if [ "$continue_anyway" != "y" ]; then
    echo "❌ Deployment cancelled"
    exit 1
  fi
else
  echo "✅ API is enabled"
fi

# Step 3: Deploy Firebase Hosting
echo ""
echo "Step 3: Deploying Firebase Hosting..."
echo "   If prompted for a site ID, enter: bldcebu-portal"
echo ""

firebase deploy --only hosting

echo ""
echo "✅ ========================================"
echo "✅ Firebase Hosting deployment complete!"
echo "✅ ========================================"
echo ""
echo "📍 Your site should be available at:"
echo "   https://bldcebu-portal.web.app"
echo "   (or the site ID you specified)"
echo ""
