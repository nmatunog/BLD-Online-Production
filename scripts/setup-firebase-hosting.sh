#!/bin/bash
# Setup Firebase Hosting site for production
# Usage: ./scripts/setup-firebase-hosting.sh

set -e

echo "🔥 Setting up Firebase Hosting for production..."
echo ""

# Ensure we're using the prod project
firebase use prod

# Check if site exists
echo "📌 Checking if hosting site exists..."
SITE_LIST=$(firebase hosting:sites:list --project bldcebu-portal 2>/dev/null || echo "")

if echo "$SITE_LIST" | grep -q "bldcebu-portal"; then
  echo "✅ Site 'bldcebu-portal' already exists"
else
  echo "📌 Creating hosting site: bldcebu-portal"
  echo "bldcebu-portal" | firebase hosting:sites:create bldcebu-portal --project bldcebu-portal
  echo "✅ Site created"
fi

echo ""
echo "🚀 Deploying Firebase Hosting..."
firebase deploy --only hosting:bldcebu-portal

echo ""
echo "✅ Firebase Hosting setup complete!"
echo "📍 URL: https://bldcebu-portal.web.app"
