#!/bin/bash
# Simple script to create admin user - allows password pasting
# Usage: DB_PASSWORD='your-password' ./scripts/create-admin-simple.sh [port] [database-name]
# Or: ./scripts/create-admin-simple.sh [port] [database-name] (will prompt)
# Default port: 5434, default database: bld_portal_prod

PORT="${1:-5433}"

echo "🔐 Creating Admin User"
echo "====================="
echo ""

# Check if proxy is running
if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  echo "❌ Cloud SQL Proxy is not running on port $PORT"
  echo ""
  echo "Please start the proxy first in another terminal:"
  echo "  cloud-sql-proxy --port $PORT bldcebu-portal:asia-southeast1:bld-portal-db"
  echo ""
  exit 1
fi

echo "✅ Cloud SQL Proxy is running on port $PORT"
echo ""

# Get database password
if [ -z "$DB_PASSWORD" ]; then
  echo "📌 Enter database password (you can paste - it will be visible):"
  read DB_PASSWORD
  
  if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Database password is required"
    exit 1
  fi
else
  echo "✅ Using DB_PASSWORD from environment"
fi

# Construct DATABASE_URL
# Use the correct database name
DATABASE_NAME="${2:-bld_portal_prod}"
DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@127.0.0.1:${PORT}/${DATABASE_NAME}"

echo ""
echo "📝 Running admin user creation script..."
echo "   (The script will prompt you for user details)"
echo ""

cd backend

export DATABASE_URL
npx ts-node scripts/create-admin-user.ts

cd ..

echo ""
echo "✅ Done!"
echo ""
