#!/bin/bash
# Test admin login endpoint
# Usage: ./scripts/test-admin-login.sh

set -e

echo "🔐 Testing Admin Login"
echo "====================="
echo ""

BACKEND_URL="https://bld-online-production-production.up.railway.app"

echo "Backend URL: $BACKEND_URL"
echo ""

echo "Testing login endpoint..."
echo ""

# Test login
curl -X POST "${BACKEND_URL}/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "nmatunog@gmail.com",
    "password": "@Nbm0823"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -s | jq '.' 2>/dev/null || echo "Response received (install jq for formatted output)"

echo ""
echo "✅ If you see a JWT token above, login is working!"
echo ""
echo "Next steps:"
echo "1. Deploy frontend to Vercel"
echo "2. Connect frontend to backend API"
echo "3. Test full application flow"
