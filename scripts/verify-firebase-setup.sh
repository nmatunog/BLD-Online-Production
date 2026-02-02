#!/bin/bash
# Verify Firebase Hosting API setup
# Usage: ./scripts/verify-firebase-setup.sh

set -e

echo "🔍 Verifying Firebase Hosting Setup"
echo "==================================="
echo ""

# Set project
gcloud config set project bldcebu-portal
firebase use prod

echo "1. Checking Firebase Hosting API status..."
echo "-------------------------------------------"
API_STATUS=$(gcloud services list --enabled --project bldcebu-portal --filter="name:firebasehosting.googleapis.com" --format="value(name)" 2>/dev/null || echo "")

if [ -z "$API_STATUS" ]; then
  echo "❌ Firebase Hosting API is NOT enabled"
  echo ""
  echo "   Enabling now..."
  gcloud services enable firebasehosting.googleapis.com --project bldcebu-portal
  echo ""
  echo "   ⏳ Please wait 60 seconds for the API to fully propagate"
  echo "   Then try creating the site via Firebase Console:"
  echo "   https://console.firebase.google.com/project/bldcebu-portal/hosting"
else
  echo "✅ Firebase Hosting API is enabled"
fi

echo ""
echo "2. Checking project billing..."
echo "-------------------------------"
BILLING=$(gcloud billing projects describe bldcebu-portal --format="value(billingAccountName)" 2>/dev/null || echo "")

if [ -z "$BILLING" ]; then
  echo "⚠️  WARNING: No billing account linked"
  echo "   Firebase Hosting may require billing to be enabled"
  echo "   Enable billing: https://console.cloud.google.com/billing"
else
  echo "✅ Billing account: $BILLING"
fi

echo ""
echo "3. Checking Firebase project access..."
echo "--------------------------------------"
firebase projects:list | grep -q bldcebu-portal && echo "✅ Firebase project accessible" || echo "❌ Cannot access Firebase project"

echo ""
echo "4. Recommendation..."
echo "--------------------"
echo "Since CLI site creation is failing, please:"
echo ""
echo "  1. Go to Firebase Console:"
echo "     https://console.firebase.google.com/project/bldcebu-portal/hosting"
echo ""
echo "  2. Click 'Get started' or 'Add site'"
echo ""
echo "  3. Create the site with ID: bldcebu-online-portal"
echo "     (or any unique name you prefer)"
echo ""
echo "  4. After site is created, run:"
echo "     firebase deploy --only hosting"
echo ""
