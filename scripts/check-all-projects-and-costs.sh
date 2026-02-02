#!/bin/bash
# Check all projects and their Cloud SQL instances
# Usage: ./scripts/check-all-projects-and-costs.sh

set -e

echo "🔍 Checking All Projects and Cloud SQL Instances"
echo "================================================"
echo ""

echo "📋 Listing all projects..."
gcloud projects list --format="table(projectId,name,projectNumber)" 2>/dev/null || {
  echo "⚠️  Could not list projects"
}

echo ""
echo "🔍 Checking Cloud SQL instances in each project..."
echo ""

# Check production project
echo "📦 Project: bldcebu-portal (Production)"
gcloud config set project bldcebu-portal --quiet 2>/dev/null
echo "   Cloud SQL instances:"
gcloud sql instances list --format="table(name,databaseVersion,region,tier,settings.ipConfiguration.ipv4Enabled)" 2>/dev/null || echo "   ⚠️  Could not list instances"

echo ""
echo "📦 Checking for 'dev' project..."
# Try to find dev project
DEV_PROJECT=$(gcloud projects list --filter="name:dev OR projectId:*dev*" --format="value(projectId)" 2>/dev/null | head -1)

if [ -n "$DEV_PROJECT" ]; then
  echo "   Found potential dev project: $DEV_PROJECT"
  echo ""
  echo "📦 Project: $DEV_PROJECT (Dev)"
  gcloud config set project "$DEV_PROJECT" --quiet 2>/dev/null
  echo "   Cloud SQL instances:"
  gcloud sql instances list --format="table(name,databaseVersion,region,tier,settings.ipConfiguration.ipv4Enabled)" 2>/dev/null || echo "   ⚠️  Could not list instances"
  
  echo ""
  echo "💰 Checking billing for $DEV_PROJECT..."
  echo "   (This may require billing API access)"
fi

echo ""
echo "💡 The billing shows charges from 'BLD Cebu Portal Dev' project"
echo "   This is likely a DIFFERENT project than your production 'bldcebu-portal'"
echo ""
echo "🔍 To find the exact project:"
echo "   1. Check Google Cloud Console: https://console.cloud.google.com/billing"
echo "   2. Look for project named 'BLD Cebu Portal Dev'"
echo ""
