#!/bin/bash
# Enable billing for production project
# Usage: ./scripts/enable-billing.sh [BILLING_ACCOUNT_ID]

set -e

echo "💳 Enabling Billing for Production Project"
echo "==========================================="
echo ""

gcloud config set project bldcebu-portal --quiet

# Check current billing status
echo "📌 Checking current billing status..."
BILLING_STATUS=$(gcloud billing projects describe bldcebu-portal \
  --format="value(billingAccountName)" 2>/dev/null || echo "")

if [ -n "$BILLING_STATUS" ]; then
  echo "✅ Billing is already enabled: $BILLING_STATUS"
  exit 0
fi

echo "❌ Billing is not enabled"
echo ""

# Get billing account ID
if [ -n "$1" ]; then
  BILLING_ACCOUNT_ID="$1"
else
  echo "📋 Listing available billing accounts..."
  gcloud billing accounts list --format="table(name,displayName,open)" 2>/dev/null || {
    echo "⚠️  Could not list billing accounts"
    echo ""
    echo "Please provide billing account ID manually:"
    echo "  ./scripts/enable-billing.sh BILLING_ACCOUNT_ID"
    echo ""
    echo "Or enable via Console:"
    echo "  https://console.cloud.google.com/billing?project=bldcebu-portal"
    exit 1
  }
  
  echo ""
  read -p "Enter billing account ID (or press Enter to use Console): " BILLING_ACCOUNT_ID
  
  if [ -z "$BILLING_ACCOUNT_ID" ]; then
    echo ""
    echo "💡 Enable billing via Console:"
    echo "   1. Go to: https://console.cloud.google.com/billing?project=bldcebu-portal"
    echo "   2. Select or create a billing account"
    echo "   3. Link it to project: bldcebu-portal"
    echo ""
    exit 0
  fi
fi

# Link billing account
echo ""
echo "🔗 Linking billing account $BILLING_ACCOUNT_ID to project..."
gcloud billing projects link bldcebu-portal \
  --billing-account="$BILLING_ACCOUNT_ID"

echo ""
echo "✅ Billing enabled!"
echo ""
echo "⏳ Wait 1-2 minutes for billing to activate"
echo "   Then your Cloud Run services should start working"
echo ""
