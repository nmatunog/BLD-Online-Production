#!/bin/bash
# Create admin user using Cloud SQL Proxy on custom port
# Usage: ./scripts/create-admin-with-proxy.sh [port]
# Default port: 5433

PORT="${1:-5433}"

echo "🔐 Creating Admin User via Cloud SQL Proxy"
echo "==========================================="
echo ""

# Check if proxy is running
if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  echo "❌ Cloud SQL Proxy is not running on port $PORT"
  echo ""
  echo "Please start the proxy first:"
  echo "  ./scripts/start-cloud-sql-proxy.sh $PORT"
  echo ""
  echo "Or in another terminal:"
  echo "  cloud-sql-proxy --port $PORT bldcebu-portal:asia-southeast1:bld-portal-db"
  exit 1
fi

echo "✅ Cloud SQL Proxy is running on port $PORT"
echo ""

# Get database password
echo "📌 Enter database password (you can paste it):"
# Use read without -s to allow pasting, but it will be visible
# Or use an environment variable
if [ -n "$DB_PASSWORD" ]; then
  echo "✅ Using DB_PASSWORD from environment"
else
  read DB_PASSWORD
  if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Database password is required"
    echo ""
    echo "You can also set it as an environment variable:"
    echo "  export DB_PASSWORD='your-password'"
    echo "  ./scripts/create-admin-with-proxy.sh"
    exit 1
  fi
fi

# Construct DATABASE_URL
DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@127.0.0.1:${PORT}/bld_portal"

echo ""
echo "📝 Running admin user creation script..."
echo ""

cd backend

export DATABASE_URL
npx ts-node scripts/create-admin-user.ts

cd ..

echo ""
echo "✅ Done!"
echo ""
