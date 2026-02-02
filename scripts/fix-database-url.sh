#!/bin/bash
# Fix the database URL in Secret Manager
# Usage: ./scripts/fix-database-url.sh

set -e

echo "🔧 Fixing database URL in Secret Manager..."
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

INSTANCE_NAME="bld-portal-db"
REGION="asia-southeast1"
DATABASE_NAME="bld_portal_prod"
CONNECTION_NAME="bldcebu-portal:${REGION}:${INSTANCE_NAME}"

echo "📋 Current database URL format needed:"
echo "   postgresql://postgres:PASSWORD@/DATABASE?host=/cloudsql/CONNECTION_NAME"
echo ""
echo "   Connection Name: $CONNECTION_NAME"
echo "   Database Name: $DATABASE_NAME"
echo ""

echo "Enter database password (you can paste it): "
read DB_PASSWORD

# Construct the correct database URL
DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"

echo "📝 New database URL:"
echo "   postgresql://postgres:***@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
echo ""

read -p "Update Secret Manager with this URL? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Cancelled."
  exit 0
fi

# Update the secret
echo "$DATABASE_URL" | gcloud secrets versions add prod-database-url --data-file=-

echo ""
echo "✅ Database URL updated in Secret Manager!"
echo ""
echo "📝 Next steps:"
echo "   1. Redeploy backend: ./scripts/deploy-prod.sh"
echo "   2. The backend should now connect successfully"
