#!/bin/bash
# Helper script to migrate data from dev to prod
# Usage: ./scripts/migrate-to-prod.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/backend"

echo "🔄 ========================================"
echo "🔄 Migrate Development to Production"
echo "🔄 ========================================"
echo ""
echo "This will copy all data from DEV to PROD, excluding dummy data."
echo ""

# Check if Cloud SQL Proxy is recommended
echo "📋 Setup Options:"
echo "   1. Using Cloud SQL Proxy (Recommended)"
echo "   2. Direct connection (if IPs are whitelisted)"
echo "   3. Cloud SQL connection strings"
echo ""
read -p "Choose option (1/2/3): " option

case $option in
  1)
    echo ""
    echo "🔧 Cloud SQL Proxy Setup:"
    echo ""
    echo "Terminal 1 - Start Dev Proxy:"
    echo "  cloud-sql-proxy bld-cebu-portal-dev:asia-southeast1:bld-portal-db-dev --port 5432"
    echo ""
    echo "Terminal 2 - Start Prod Proxy:"
    echo "  cloud-sql-proxy bldcebu-portal:asia-southeast1:bld-portal-db --port 5433"
    echo ""
    echo "Then in Terminal 3, run this script again and choose option 2 or 3"
    echo ""
    read -p "Press Enter when proxies are running..."
    
    read -p "Dev database password: " -s DEV_PASSWORD
    echo ""
    read -p "Prod database password: " -s PROD_PASSWORD
    echo ""
    
    DEV_DATABASE_URL="postgresql://postgres:${DEV_PASSWORD}@127.0.0.1:5432/bld_portal_dev"
    PROD_DATABASE_URL="postgresql://postgres:${PROD_PASSWORD}@127.0.0.1:5433/bld_portal"
    ;;
    
  2)
    read -p "Dev database IP: " DEV_IP
    read -p "Dev database password: " -s DEV_PASSWORD
    echo ""
    read -p "Prod database IP: " PROD_IP
    read -p "Prod database password: " -s PROD_PASSWORD
    echo ""
    
    DEV_DATABASE_URL="postgresql://postgres:${DEV_PASSWORD}@${DEV_IP}:5432/bld_portal_dev"
    PROD_DATABASE_URL="postgresql://postgres:${PROD_PASSWORD}@${PROD_IP}:5432/bld_portal"
    ;;
    
  3)
    read -p "Dev database connection string: " DEV_DATABASE_URL
    read -p "Prod database connection string: " PROD_DATABASE_URL
    ;;
    
  *)
    echo "❌ Invalid option"
    exit 1
    ;;
esac

echo ""
echo "⚠️  WARNING: This will migrate data to PRODUCTION!"
echo "⚠️  Dummy data will be excluded automatically."
echo ""
read -p "Type 'MIGRATE' to continue: " confirm

if [ "$confirm" != "MIGRATE" ]; then
  echo "❌ Migration cancelled"
  exit 1
fi

echo ""
echo "🚀 Starting migration..."
echo ""

export DEV_DATABASE_URL
export PROD_DATABASE_URL

npx ts-node scripts/migrate-dev-to-prod.ts

echo ""
echo "✅ Migration complete!"
echo ""
echo "Next steps:"
echo "  1. Verify data in production database"
echo "  2. Deploy production code: ./scripts/deploy-prod.sh"
echo "  3. Test production environment"
echo ""
