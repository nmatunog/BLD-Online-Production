#!/bin/bash
# Script to create the first admin user on Railway
# This runs the admin creation script inside Railway's environment

set -e

echo "🔐 Creating Admin User on Railway"
echo "=================================="
echo ""
echo "This script will run the admin user creation script inside Railway's environment."
echo "You'll be prompted to enter:"
echo "  - Email"
echo "  - Phone (optional)"
echo "  - Password"
echo "  - First Name"
echo "  - Last Name"
echo "  - Nickname (optional)"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

cd "$(dirname "$0")/../backend"

echo ""
echo "🚀 Running admin user creation script on Railway..."
echo ""

# Run the script inside Railway's environment
npx @railway/cli run --service bld-online-production npx ts-node scripts/create-admin-user.ts

echo ""
echo "✅ Done!"
echo ""
echo "Next steps:"
echo "1. Test login at: https://bld-online-production-production.up.railway.app/api/v1/auth/login"
echo "2. Use the credentials you just created"
echo "3. You should receive a JWT token"
echo "4. Use this token to access protected endpoints"
