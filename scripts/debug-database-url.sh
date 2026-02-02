#!/bin/bash
# Debug and fix database URL format for Prisma
# Usage: ./scripts/debug-database-url.sh

set -e

echo "🔍 Debugging Database URL Format"
echo "================================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

echo "Step 1: Check current secret value"
echo "-----------------------------------"
CURRENT_URL=$(gcloud secrets versions access latest --secret=prod-database-url --project=bldcebu-portal 2>/dev/null || echo "")

if [ -z "$CURRENT_URL" ]; then
  echo "❌ Secret not found!"
  exit 1
fi

echo "Current URL (first 80 chars): ${CURRENT_URL:0:80}..."
echo "Full URL length: ${#CURRENT_URL} characters"
echo ""

# Parse the URL to check format
if [[ "$CURRENT_URL" == *"host=/cloudsql/"* ]]; then
  echo "✅ Contains host=/cloudsql/ parameter"
else
  echo "❌ Missing host=/cloudsql/ parameter"
fi

if [[ "$CURRENT_URL" == postgresql://* ]]; then
  echo "✅ Starts with postgresql://"
else
  echo "❌ Does not start with postgresql://"
fi

echo ""

echo "Step 2: Test different URL formats"
echo "-----------------------------------"
INSTANCE_NAME="bld-portal-db"
REGION="asia-southeast1"
DATABASE_NAME="bld_portal_prod"
CONNECTION_NAME="bldcebu-portal:${REGION}:${INSTANCE_NAME}"

echo -n "Enter database password: "
read DB_PASSWORD

if [ -z "$DB_PASSWORD" ]; then
  echo "❌ Password cannot be empty"
  exit 1
fi

echo ""
echo "Testing different formats..."
echo ""

# Format 1: Standard (what we've been using)
FORMAT1="postgresql://postgres:${DB_PASSWORD}@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
echo "Format 1: postgresql://postgres:***@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"

# Format 2: With localhost (sometimes Prisma needs this)
FORMAT2="postgresql://postgres:${DB_PASSWORD}@localhost/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
echo "Format 2: postgresql://postgres:***@localhost/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"

# Format 3: URL encoded password (in case password has special chars)
ENCODED_PASSWORD=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${DB_PASSWORD}'))" 2>/dev/null || echo "$DB_PASSWORD")
FORMAT3="postgresql://postgres:${ENCODED_PASSWORD}@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
echo "Format 3: postgresql://postgres:***@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME} (URL encoded password)"

# Format 4: Using socketPath parameter (alternative Prisma format)
FORMAT4="postgresql://postgres:${DB_PASSWORD}@localhost:5432/${DATABASE_NAME}?socketPath=/cloudsql/${CONNECTION_NAME}"
echo "Format 4: postgresql://postgres:***@localhost:5432/${DATABASE_NAME}?socketPath=/cloudsql/${CONNECTION_NAME}"

echo ""
echo "Step 3: Recommended fix"
echo "----------------------"
echo "Based on Prisma documentation, Format 2 (with localhost) often works better."
echo ""

read -p "Update secret with Format 2 (localhost)? (yes/no): " use_format2
if [ "$use_format2" == "yes" ]; then
  echo "$FORMAT2" | gcloud secrets versions add prod-database-url --data-file=-
  echo "✅ Updated with Format 2"
  echo ""
  echo "New URL (first 80 chars): ${FORMAT2:0:80}..."
elif [ "$use_format2" != "no" ]; then
  echo "Skipping update"
fi

echo ""
echo "Step 4: Verify secret was updated"
echo "----------------------------------"
NEW_URL=$(gcloud secrets versions access latest --secret=prod-database-url --project=bldcebu-portal)
echo "Latest secret (first 80 chars): ${NEW_URL:0:80}..."
echo ""

echo "✅ Debug complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Redeploy: ./scripts/deploy-prod.sh"
echo "   2. If still fails, try Format 4 (socketPath)"
