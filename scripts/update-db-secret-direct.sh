#!/bin/bash
# Update database URL secret directly (alternative method)
# Usage: ./scripts/update-db-secret-direct.sh

set -e

echo "🔧 Update Database URL Secret"
echo ""
echo "This script will help you update the database URL in Secret Manager."
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

INSTANCE_NAME="bld-portal-db"
REGION="asia-southeast1"
DATABASE_NAME="bld_portal_prod"
CONNECTION_NAME="bldcebu-portal:${REGION}:${INSTANCE_NAME}"

echo "Connection details:"
echo "  Connection Name: $CONNECTION_NAME"
echo "  Database Name: $DATABASE_NAME"
echo ""

echo "The database URL format is:"
echo "  postgresql://postgres:YOUR_PASSWORD@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
echo ""

echo "Option 1: Enter password and let script build the URL"
echo "Option 2: Paste the complete database URL"
echo ""
read -p "Choose option (1/2): " option

case $option in
  1)
    echo ""
    echo "Enter database password (you can paste):"
    read DB_PASSWORD
    
    if [ -z "$DB_PASSWORD" ]; then
      echo "❌ Password cannot be empty"
      exit 1
    fi
    
    DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
    ;;
    
  2)
    echo ""
    echo "Paste the complete database URL:"
    read DATABASE_URL
    
    if [ -z "$DATABASE_URL" ]; then
      echo "❌ Database URL cannot be empty"
      exit 1
    fi
    ;;
    
  *)
    echo "❌ Invalid option"
    exit 1
    ;;
esac

echo ""
echo "📝 Database URL to save:"
echo "   ${DATABASE_URL//:${DB_PASSWORD}@/:***@}" 2>/dev/null || echo "   [URL hidden]"
echo ""

read -p "Update Secret Manager? (yes/no): " confirm
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
