#!/bin/bash
# Run database migrations on Cloud SQL
# Usage: ./scripts/run-migrations.sh

set -e

echo "🔄 Running database migrations..."
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

INSTANCE_NAME="bld-portal-db"
REGION="asia-southeast1"
DATABASE_NAME="bld_portal_prod"
CONNECTION_NAME="bldcebu-portal:${REGION}:${INSTANCE_NAME}"

cd backend

echo "📋 Database connection options:"
echo "   1. Use Cloud SQL Proxy (Recommended - most secure)"
echo "   2. Use Public IP (if enabled)"
echo ""
read -p "Choose option (1/2): " option

case $option in
  1)
    echo ""
    echo "🔧 Cloud SQL Proxy Setup:"
    echo ""
    echo "First, install Cloud SQL Proxy if not already installed:"
    echo "  macOS: brew install cloud-sql-proxy"
    echo "  Or download from: https://cloud.google.com/sql/docs/postgres/sql-proxy"
    echo ""
    echo "Then in a separate terminal, run:"
    echo "  cloud-sql-proxy ${CONNECTION_NAME} --port 5432"
    echo ""
    read -p "Press Enter when Cloud SQL Proxy is running on port 5432..."
    
    echo -n "Enter database password: "
    read -s DB_PASSWORD
    echo ""
    
    DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@127.0.0.1:5432/${DATABASE_NAME}"
    ;;
    
  2)
    echo ""
    echo "📋 Getting public IP address..."
    PUBLIC_IP=$(gcloud sql instances describe "$INSTANCE_NAME" \
      --format="value(ipAddresses[?type=='PRIMARY'].ipAddress)" \
      --project=bldcebu-portal 2>/dev/null || echo "")
    
    if [ -z "$PUBLIC_IP" ]; then
      echo "❌ Public IP not found. Please enable public IP or use Cloud SQL Proxy (option 1)"
      exit 1
    fi
    
    echo "✅ Public IP: $PUBLIC_IP"
    echo ""
    echo -n "Enter database password: "
    read -s DB_PASSWORD
    echo ""
    
    DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@${PUBLIC_IP}:5432/${DATABASE_NAME}"
    ;;
    
  *)
    echo "❌ Invalid option"
    exit 1
    ;;
esac

echo ""
echo "🔄 Running Prisma migrations..."
echo "Database: $DATABASE_NAME"
echo ""

# Set DATABASE_URL for Prisma
export DATABASE_URL

# Run migrations
npx prisma migrate deploy

echo ""
echo "✅ Migrations completed!"
