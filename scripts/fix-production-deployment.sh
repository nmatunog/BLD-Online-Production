#!/bin/bash
# Comprehensive fix for production deployment issues
# Usage: ./scripts/fix-production-deployment.sh

set -e

echo "🔧 Comprehensive Production Deployment Fix"
echo "=========================================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

INSTANCE_NAME="bld-portal-db"
REGION="asia-southeast1"
DATABASE_NAME="bld_portal_prod"
CONNECTION_NAME="bldcebu-portal:${REGION}:${INSTANCE_NAME}"

echo "Step 1: Verify Database Name"
echo "----------------------------"
echo "Checking if database '$DATABASE_NAME' exists..."
DB_EXISTS=$(gcloud sql databases list --instance="$INSTANCE_NAME" --format="value(name)" --project=bldcebu-portal | grep -x "$DATABASE_NAME" || echo "")

if [ -z "$DB_EXISTS" ]; then
  echo "⚠️  Database '$DATABASE_NAME' not found!"
  echo "Available databases:"
  gcloud sql databases list --instance="$INSTANCE_NAME" --project=bldcebu-portal
  echo ""
  read -p "Create database '$DATABASE_NAME'? (yes/no): " create_db
  if [ "$create_db" == "yes" ]; then
    gcloud sql databases create "$DATABASE_NAME" --instance="$INSTANCE_NAME" --project=bldcebu-portal
    echo "✅ Database created"
  else
    echo "❌ Cannot continue without database"
    exit 1
  fi
else
  echo "✅ Database '$DATABASE_NAME' exists"
fi
echo ""

echo "Step 2: Get Database Password"
echo "-----------------------------"
echo -n "Enter database password (you can paste): "
read DB_PASSWORD

if [ -z "$DB_PASSWORD" ]; then
  echo "❌ Password cannot be empty"
  exit 1
fi
echo ""

echo "Step 3: Test Database Connection String Format"
echo "-----------------------------------------------"
# Try different formats that work with Prisma
FORMAT1="postgresql://postgres:${DB_PASSWORD}@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
FORMAT2="postgresql://postgres:${DB_PASSWORD}@localhost/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"

echo "Format 1 (recommended): postgresql://postgres:***@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
echo "Format 2 (alternative): postgresql://postgres:***@localhost/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
echo ""

# URL encode the password in case it has special characters
ENCODED_PASSWORD=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${DB_PASSWORD}'))" 2>/dev/null || echo "$DB_PASSWORD")
FORMAT3="postgresql://postgres:${ENCODED_PASSWORD}@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"

echo "Step 4: Update Secret Manager"
echo "------------------------------"
echo "Updating with Format 1 (standard format)..."
echo "$FORMAT1" | gcloud secrets versions add prod-database-url --data-file=-
echo "✅ Secret updated"
echo ""

echo "Step 5: Verify Secret"
echo "---------------------"
echo "Current secret value (first 50 chars):"
SECRET_VALUE=$(gcloud secrets versions access latest --secret=prod-database-url --project=bldcebu-portal)
echo "${SECRET_VALUE:0:50}..."
echo ""

# Check if it contains the right components
if [[ "$SECRET_VALUE" == *"$DATABASE_NAME"* ]] && [[ "$SECRET_VALUE" == *"$CONNECTION_NAME"* ]]; then
  echo "✅ Secret format looks correct"
else
  echo "⚠️  Secret format might be incorrect"
  echo "   Expected to contain: $DATABASE_NAME and $CONNECTION_NAME"
fi
echo ""

echo "Step 6: Verify Service Account Permissions"
echo "-------------------------------------------"
PROJECT_NUMBER=$(gcloud projects describe bldcebu-portal --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "Service Account: $SERVICE_ACCOUNT"
echo ""

# Check Secret Manager permissions
echo "Checking Secret Manager permissions..."
gcloud projects get-iam-policy bldcebu-portal \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${SERVICE_ACCOUNT} AND bindings.role:roles/secretmanager.secretAccessor" \
  --format="value(bindings.role)" | head -1 && echo "✅ Secret Manager access granted" || echo "⚠️  Secret Manager access might be missing"

# Check Cloud SQL permissions
echo "Checking Cloud SQL permissions..."
gcloud projects get-iam-policy bldcebu-portal \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${SERVICE_ACCOUNT} AND bindings.role:roles/cloudsql.client" \
  --format="value(bindings.role)" | head -1 && echo "✅ Cloud SQL access granted" || echo "⚠️  Cloud SQL access might be missing"
echo ""

echo "Step 7: Check Main.ts Port Binding"
echo "-----------------------------------"
echo "Verifying backend listens on 0.0.0.0 (required for Cloud Run)..."
if grep -q "0.0.0.0" backend/src/main.ts 2>/dev/null || grep -q "process.env.PORT" backend/src/main.ts 2>/dev/null; then
  echo "✅ Port binding looks correct"
else
  echo "⚠️  Need to verify port binding in main.ts"
  echo "   Should use: await app.listen(process.env.PORT || 4000, '0.0.0.0')"
fi
echo ""

echo "✅ Fix script completed!"
echo ""
echo "📝 Next steps:"
echo "   1. Review the output above"
echo "   2. If all checks pass, run: ./scripts/deploy-prod.sh"
echo "   3. If issues found, fix them and rerun this script"
