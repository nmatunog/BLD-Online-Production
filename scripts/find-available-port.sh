#!/bin/bash
# Find an available port for Cloud SQL Proxy
# Usage: ./scripts/find-available-port.sh

echo "🔍 Finding available port..."
echo ""

# Try ports starting from 5434
for port in {5434..5444}; do
  if ! lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ Port $port is available"
    echo ""
    echo "Use this command:"
    echo "  cloud-sql-proxy --port $port bldcebu-portal:asia-southeast1:bld-portal-db"
    echo ""
    echo "Then in another terminal:"
    echo "  export DB_PASSWORD='your-password'"
    echo "  ./scripts/create-admin-simple.sh $port"
    exit 0
  fi
done

echo "❌ No available ports found in range 5434-5444"
echo "   Please check what's using these ports:"
echo "   lsof -i :5434-5444"
exit 1
