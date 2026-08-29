#!/bin/bash
# Test script to verify the public member endpoint works without authentication
# Usage: ./test-public-endpoint.sh [base-url]
# Example: ./test-public-endpoint.sh https://bld-online-production-production.up.railway.app

BASE_URL="${1:-https://bld-online-production-production.up.railway.app}"
ENDPOINT="/api/v1/members/public/community/CEB-ME1802"
FULL_URL="${BASE_URL}${ENDPOINT}"

echo "Testing public member endpoint..."
echo "URL: $FULL_URL"
echo ""

# Make the request without authentication
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$FULL_URL")

# Extract status code
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS:/d')

echo "HTTP Status: $HTTP_STATUS"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ SUCCESS: Endpoint returns 200 OK"
    echo ""
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    
    # Check if photoUrl is present
    if echo "$BODY" | jq -e '.data.photoUrl' >/dev/null 2>&1; then
        PHOTO_URL=$(echo "$BODY" | jq -r '.data.photoUrl')
        echo ""
        echo "✅ photoUrl field found: $PHOTO_URL"
    elif echo "$BODY" | jq -e '.data.photoUrl == null' >/dev/null 2>&1; then
        echo ""
        echo "⚠️  photoUrl is null (member has no photo)"
    else
        echo ""
        echo "❌ photoUrl field missing from response"
    fi
elif [ "$HTTP_STATUS" = "401" ]; then
    echo "❌ FAILED: Endpoint still returns 401 Unauthorized"
    echo "The fix may not be deployed yet."
else
    echo "⚠️  Unexpected status code: $HTTP_STATUS"
    echo "Response: $BODY"
fi
