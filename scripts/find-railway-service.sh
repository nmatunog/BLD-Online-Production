#!/bin/bash
# Script to find the correct Railway service name

echo "🔍 Finding Railway Service Name"
echo "================================"
echo ""

cd "$(dirname "$0")/../backend"

echo "Step 1: Checking if Railway project is linked..."
echo ""

# Try to get project info
if npx @railway/cli status 2>/dev/null; then
    echo ""
    echo "✅ Railway project is linked!"
    echo ""
else
    echo "⚠️  Railway project not linked. Let's link it first..."
    echo ""
    echo "Please run:"
    echo "  cd backend"
    echo "  npx @railway/cli link"
    echo ""
    echo "Then select your Railway project from the list."
    echo ""
    exit 1
fi

echo ""
echo "Step 2: Listing all services in the project..."
echo ""

# List services (this might not work directly, but let's try)
echo "To find your service name:"
echo "1. Go to Railway Dashboard: https://railway.app"
echo "2. Open your project"
echo "3. Look at the service name in the sidebar or URL"
echo ""
echo "Common service names:"
echo "  - bld-online-production"
echo "  - backend"
echo "  - api"
echo "  - bld-online-production-production"
echo ""

echo "Step 3: Once you know the service name, run:"
echo ""
echo "  cd backend"
echo "  npx @railway/cli run --service YOUR_SERVICE_NAME npx ts-node scripts/create-admin-user.ts"
echo ""
