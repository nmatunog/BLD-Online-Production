#!/bin/bash
# Verify and fix the database URL secret with the correct Prisma-compatible format
# Usage: ./scripts/verify-and-fix-secret.sh

set -e

echo "🔧 Verify and Fix Database URL Secret"
echo "======================================"
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

INSTANCE_NAME="bld-portal-db"
REGION="asia-southeast1"
DATABASE_NAME="bld_portal_prod"
CONNECTION_NAME="bldcebu-portal:${REGION}:${INSTANCE_NAME}"

echo "Step 1: Check current secret"
echo "----------------------------"
CURRENT_URL=$(gcloud secrets versions access latest --secret=prod-database-url --project=bldcebu-portal 2>/dev/null || echo "")

if [ -z "$CURRENT_URL" ]; then
  echo "❌ Secret not found!"
  exit 1
fi

echo "Current URL:"
echo "$CURRENT_URL" | sed 's/:[^:@]*@/:***@/g'  # Hide password
echo ""

# Check for common issues
echo "Checking for issues..."
if [[ "$CURRENT_URL" == *$'\n'* ]] || [[ "$CURRENT_URL" == *$'\r'* ]]; then
  echo "⚠️  WARNING: Secret contains newline characters!"
fi

if [[ "$CURRENT_URL" != postgresql://* ]]; then
  echo "❌ ERROR: URL does not start with postgresql://"
  exit 1
fi

echo ""

echo "Step 2: Get database password"
echo "-----------------------------"
echo -n "Enter database password: "
read DB_PASSWORD

if [ -z "$DB_PASSWORD" ]; then
  echo "❌ Password cannot be empty"
  exit 1
fi

echo ""

echo "Step 3: Create correct format"
echo "-----------------------------"
# Prisma-compatible format for Cloud SQL Unix sockets
# Using socketPath parameter instead of host parameter
NEW_URL="postgresql://postgres:${DB_PASSWORD}@localhost:5432/${DATABASE_NAME}?socketPath=/cloudsql/${CONNECTION_NAME}"

echo "New URL format (using socketPath):"
echo "$NEW_URL" | sed 's/:[^:@]*@/:***@/g'
echo ""

# Alternative: Try the standard format but ensure no trailing characters
NEW_URL2="postgresql://postgres:${DB_PASSWORD}@localhost/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"

echo "Alternative format (using host parameter):"
echo "$NEW_URL2" | sed 's/:[^:@]*@/:***@/g'
echo ""

echo "Step 4: Update secret"
echo "---------------------"
echo "Trying Format 1 (socketPath) first..."
echo -n "$NEW_URL" | gcloud secrets versions add prod-database-url --data-file=-

echo ""
echo "✅ Secret updated with socketPath format"
echo ""

echo "Step 5: Verify update"
echo "---------------------"
VERIFIED_URL=$(gcloud secrets versions access latest --secret=prod-database-url --project=bldcebu-portal)
echo "Latest secret (first 100 chars):"
echo "${VERIFIED_URL:0:100}..."
echo ""

# Check if it matches
if [[ "$VERIFIED_URL" == *"socketPath=/cloudsql/${CONNECTION_NAME}"* ]]; then
  echo "✅ Secret contains socketPath parameter"
elif [[ "$VERIFIED_URL" == *"host=/cloudsql/${CONNECTION_NAME}"* ]]; then
  echo "✅ Secret contains host parameter"
else
  echo "⚠️  WARNING: Secret might not have correct format"
fi

echo ""
echo "✅ Fix complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Redeploy: ./scripts/deploy-prod.sh"
echo "   2. If still fails, we may need to check Prisma version compatibility"
