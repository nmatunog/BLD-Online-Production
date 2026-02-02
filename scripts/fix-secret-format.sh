#!/bin/bash
# Fix secret format - ensure no newlines or extra characters
# This is the REAL fix - Prisma is very sensitive to URL format
# Usage: ./scripts/fix-secret-format.sh

set -e

echo "🔧 Fix Database URL Secret Format (The Real Fix)"
echo "=================================================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

INSTANCE_NAME="bld-portal-db"
REGION="asia-southeast1"
DATABASE_NAME="bld_portal_prod"
CONNECTION_NAME="bldcebu-portal:${REGION}:${INSTANCE_NAME}"

echo "Step 1: Check current secret"
echo "----------------------------"
CURRENT=$(gcloud secrets versions access latest --secret=prod-database-url --project=bldcebu-portal 2>/dev/null || echo "")
if [ -n "$CURRENT" ]; then
  echo "Current value length: ${#CURRENT} characters"
  echo "First 80 chars: ${CURRENT:0:80}..."
  # Check for newlines
  if [[ "$CURRENT" == *$'\n'* ]] || [[ "$CURRENT" == *$'\r'* ]]; then
    echo "⚠️  WARNING: Contains newline characters - this is likely the problem!"
  fi
else
  echo "Secret not found"
fi
echo ""

echo "Step 2: Get password and create clean URL"
echo "-----------------------------------------"
echo -n "Enter database password: "
read DB_PASSWORD

if [ -z "$DB_PASSWORD" ]; then
  echo "❌ Password required"
  exit 1
fi

# Create URL with NO newlines, NO extra spaces
# Use printf instead of echo to avoid any shell interpretation
DATABASE_URL=$(printf "postgresql://postgres:%s@localhost/%s?host=/cloudsql/%s" "$DB_PASSWORD" "$DATABASE_NAME" "$CONNECTION_NAME")

echo ""
echo "Step 3: Verify URL format"
echo "------------------------"
echo "URL length: ${#DATABASE_URL} characters"
echo "URL preview: ${DATABASE_URL:0:60}..."
echo ""

# Verify it doesn't have newlines
if [[ "$DATABASE_URL" == *$'\n'* ]] || [[ "$DATABASE_URL" == *$'\r'* ]]; then
  echo "❌ ERROR: URL contains newlines!"
  exit 1
fi

# Verify format
if [[ "$DATABASE_URL" != postgresql://* ]]; then
  echo "❌ ERROR: URL doesn't start with postgresql://"
  exit 1
fi

if [[ "$DATABASE_URL" != *"host=/cloudsql/${CONNECTION_NAME}"* ]]; then
  echo "❌ ERROR: URL doesn't contain correct connection name"
  exit 1
fi

echo "✅ URL format looks correct"
echo ""

echo "Step 4: Update secret (using printf to avoid newlines)"
echo "-----------------------------------------------------"
# Use printf and pipe directly to avoid any shell newline issues
printf "%s" "$DATABASE_URL" | gcloud secrets versions add prod-database-url --data-file=-

echo ""
echo "✅ Secret updated with clean format (no newlines)"
echo ""

echo "Step 5: Verify the update"
echo "-------------------------"
VERIFIED=$(gcloud secrets versions access latest --secret=prod-database-url --project=bldcebu-portal)
echo "Verified length: ${#VERIFIED} characters"
if [ "$VERIFIED" == "$DATABASE_URL" ]; then
  echo "✅ Secret matches exactly - no extra characters"
else
  echo "⚠️  WARNING: Secret doesn't match exactly"
  echo "   Expected length: ${#DATABASE_URL}"
  echo "   Actual length: ${#VERIFIED}"
fi
echo ""

echo "✅ Fix complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Redeploy: ./scripts/deploy-prod.sh"
echo "   2. The URL now uses 'localhost' as host (Prisma requirement)"
echo "   3. The 'host=/cloudsql/...' parameter overrides it for actual connection"
