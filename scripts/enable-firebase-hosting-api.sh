#!/bin/bash
# Enable Firebase Hosting API for production
# Usage: ./scripts/enable-firebase-hosting-api.sh

set -e

echo "🔧 Enabling Firebase Hosting API..."
echo ""

# Set project
gcloud config set project bldcebu-portal

# Enable the API
echo "📌 Enabling firebasehosting.googleapis.com..."
gcloud services enable firebasehosting.googleapis.com --project bldcebu-portal

echo ""
echo "✅ API enabled!"
echo ""
echo "⏳ Please wait 30-60 seconds for the API to fully propagate..."
echo ""
echo "After waiting, you can:"
echo "  1. Create the site via Firebase Console:"
echo "     https://console.firebase.google.com/project/bldcebu-portal/hosting"
echo ""
echo "  2. Or deploy directly (Firebase will prompt for site creation):"
echo "     firebase use prod"
echo "     firebase deploy --only hosting"
echo ""
