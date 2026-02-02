#!/bin/bash
# Check recent errors from both services
# Usage: ./scripts/check-service-errors.sh

set -e

echo "🔍 Checking Service Errors"
echo "=========================="
echo ""

gcloud config set project bldcebu-portal --quiet

echo "📦 Backend Errors (last 10):"
echo "----------------------------"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-backend AND severity>=ERROR" \
  --limit 10 \
  --project bldcebu-portal \
  --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
  --freshness=30m 2>/dev/null | head -15 || echo "No recent errors found"

echo ""
echo "🌐 Frontend Errors (last 10):"
echo "-----------------------------"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-frontend AND severity>=ERROR" \
  --limit 10 \
  --project bldcebu-portal \
  --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
  --freshness=30m 2>/dev/null | head -15 || echo "No recent errors found"

echo ""
echo "📋 Recent Backend Logs (last 5):"
echo "-------------------------------"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-backend" \
  --limit 5 \
  --project bldcebu-portal \
  --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
  --freshness=10m 2>/dev/null | head -10 || echo "No recent logs"

echo ""
echo "📋 Recent Frontend Logs (last 5):"
echo "--------------------------------"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-frontend" \
  --limit 5 \
  --project bldcebu-portal \
  --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
  --freshness=10m 2>/dev/null | head -10 || echo "No recent logs"

echo ""
echo "💡 Full logs in browser:"
echo "   Backend:  https://console.cloud.google.com/run/detail/asia-southeast1/bld-portal-backend/logs?project=bldcebu-portal"
echo "   Frontend: https://console.cloud.google.com/run/detail/asia-southeast1/bld-portal-frontend/logs?project=bldcebu-portal"
echo ""
