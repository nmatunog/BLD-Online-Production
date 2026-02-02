#!/bin/bash
# Fix Firebase Hosting setup for production
# Usage: ./scripts/fix-firebase-hosting.sh

set -e

echo "🔧 Fixing Firebase Hosting setup..."
echo ""

# Set project
gcloud config set project bldcebu-portal
firebase use prod

# Enable Firebase Hosting API
echo "📌 Enabling Firebase Hosting API..."
gcloud services enable firebasehosting.googleapis.com --project bldcebu-portal || {
  echo "⚠️  API may already be enabled or needs manual activation"
}

echo "⏳ Waiting for API to propagate (15 seconds)..."
sleep 15

# Check if API is enabled
echo "📌 Verifying API is enabled..."
gcloud services list --enabled --project bldcebu-portal --filter="name:firebasehosting.googleapis.com" | grep -q firebasehosting || {
  echo "⚠️  Firebase Hosting API may not be enabled. Please enable it manually:"
  echo "   https://console.cloud.google.com/apis/library/firebasehosting.googleapis.com?project=bldcebu-portal"
  echo ""
  read -p "Press Enter to continue anyway, or Ctrl+C to cancel..."
}

# Try to deploy - Firebase will create the site automatically or prompt for site ID
echo ""
echo "🚀 Deploying Firebase Hosting..."
echo "   If prompted for a site ID, you can:"
echo "   1. Enter: bldcebu-portal (or any unique name)"
echo "   2. Or create the site in Firebase Console first"
echo ""

# Deploy - this will either work or prompt for site creation
firebase deploy --only hosting

echo ""
echo "✅ Firebase Hosting deployment initiated!"
echo "📍 Your site will be available at: https://<site-id>.web.app"
