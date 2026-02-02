#!/bin/bash
# Compare dev and prod secrets to see what's different
# Usage: ./scripts/compare-dev-prod-secrets.sh

set -e

echo "🔍 Comparing Dev vs Prod Database URLs"
echo "======================================"
echo ""

echo "DEV Database URL (working):"
echo "---------------------------"
DEV_URL=$(gcloud secrets versions access latest --secret=dev-database-url --project=bld-cebu-portal-dev 2>/dev/null || echo "NOT FOUND")
if [ "$DEV_URL" != "NOT FOUND" ]; then
  echo "$DEV_URL" | sed 's/:[^:@]*@/:***@/g'
  echo ""
  echo "Length: ${#DEV_URL} characters"
  echo "Contains host=/cloudsql/: $(echo "$DEV_URL" | grep -q "host=/cloudsql/" && echo "YES" || echo "NO")"
  echo "Contains socketPath: $(echo "$DEV_URL" | grep -q "socketPath" && echo "YES" || echo "NO")"
else
  echo "❌ Dev secret not found or not accessible"
fi
echo ""

echo "PROD Database URL (not working):"
echo "--------------------------------"
PROD_URL=$(gcloud secrets versions access latest --secret=prod-database-url --project=bldcebu-portal 2>/dev/null || echo "NOT FOUND")
if [ "$PROD_URL" != "NOT FOUND" ]; then
  echo "$PROD_URL" | sed 's/:[^:@]*@/:***@/g'
  echo ""
  echo "Length: ${#PROD_URL} characters"
  echo "Contains host=/cloudsql/: $(echo "$PROD_URL" | grep -q "host=/cloudsql/" && echo "YES" || echo "NO")"
  echo "Contains socketPath: $(echo "$PROD_URL" | grep -q "socketPath" && echo "YES" || echo "NO")"
  
  # Check for newlines or special characters
  if [[ "$PROD_URL" == *$'\n'* ]] || [[ "$PROD_URL" == *$'\r'* ]]; then
    echo "⚠️  WARNING: Contains newline characters!"
  fi
  
  # Show exact format
  echo ""
  echo "First 100 characters (exact):"
  echo "${PROD_URL:0:100}"
else
  echo "❌ Prod secret not found"
fi
echo ""

echo "Difference Analysis:"
echo "-------------------"
if [ "$DEV_URL" != "NOT FOUND" ] && [ "$PROD_URL" != "NOT FOUND" ]; then
  if [ "$DEV_URL" == "$PROD_URL" ]; then
    echo "⚠️  URLs are identical - but one works and one doesn't!"
    echo "    This suggests a different issue (permissions, network, etc.)"
  else
    echo "✅ URLs are different - this might be the issue"
    echo ""
    echo "Key differences:"
    # Extract connection names
    DEV_CONN=$(echo "$DEV_URL" | grep -oP 'host=/cloudsql/\K[^?]*' || echo "NOT FOUND")
    PROD_CONN=$(echo "$PROD_URL" | grep -oP 'host=/cloudsql/\K[^?]*' || echo "NOT FOUND")
    echo "  Dev connection: $DEV_CONN"
    echo "  Prod connection: $PROD_CONN"
  fi
fi
