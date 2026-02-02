#!/bin/bash
# Fix Unix socket format - using the EXACT format that Prisma accepts
# Based on Prisma documentation and working examples
# Usage: ./scripts/fix-unix-socket-properly.sh

set -e

echo "🔧 Fix Unix Socket Format (Prisma-Compatible)"
echo "============================================"
echo ""
echo "This uses the exact format Prisma expects for Cloud SQL Unix sockets"
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

INSTANCE_NAME="bld-portal-db"
REGION="asia-southeast1"
DATABASE_NAME="bld_portal_prod"
CONNECTION_NAME="bldcebu-portal:${REGION}:${INSTANCE_NAME}"

echo "Step 1: Get Database Password"
echo "-----------------------------"
echo -n "Enter database password: "
read DB_PASSWORD

if [ -z "$DB_PASSWORD" ]; then
  echo "❌ Password required"
  exit 1
fi

echo ""

echo "Step 2: Create Prisma-Compatible URL"
echo "------------------------------------"
# Prisma's expected format for Cloud SQL Unix sockets
# Format: postgresql://USER:PASSWORD@localhost/DATABASE?host=/cloudsql/CONNECTION_NAME
# The key is using 'localhost' as the host, then overriding with host parameter

DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@localhost/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"

echo "URL format: postgresql://postgres:***@localhost/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
echo ""

# Verify format
if [[ "$DATABASE_URL" != postgresql://* ]]; then
  echo "❌ Invalid format"
  exit 1
fi

if [[ "$DATABASE_URL" != *"host=/cloudsql/${CONNECTION_NAME}"* ]]; then
  echo "❌ Missing connection name"
  exit 1
fi

echo "✅ Format verified"
echo ""

echo "Step 3: Update Secret (using printf to avoid newlines)"
echo "------------------------------------------------------"
# Use printf to ensure no newlines or extra characters
printf "%s" "$DATABASE_URL" | gcloud secrets versions add prod-database-url --data-file=-

echo ""
echo "✅ Secret updated"
echo ""

echo "Step 4: Verify Secret"
echo "---------------------"
VERIFIED=$(gcloud secrets versions access latest --secret=prod-database-url --project=bldcebu-portal)
if [ "$VERIFIED" == "$DATABASE_URL" ]; then
  echo "✅ Secret matches exactly"
  echo "   Length: ${#VERIFIED} characters"
  echo "   Format: Correct"
else
  echo "⚠️  Secret doesn't match exactly"
  echo "   Expected: ${#DATABASE_URL} chars"
  echo "   Actual: ${#VERIFIED} chars"
fi
echo ""

echo "✅ Fix complete!"
echo ""
echo "📝 This format uses:"
echo "   - 'localhost' as host (required by Prisma)"
echo "   - 'host=/cloudsql/...' parameter (overrides to Unix socket)"
echo "   - No newlines or extra characters"
echo ""
echo "Next: ./scripts/deploy-prod.sh"
