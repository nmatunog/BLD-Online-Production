#!/bin/bash
# Wait for Public IP and setup connection
# Usage: ./scripts/wait-and-setup-public-ip.sh

set -e

echo "⏳ Waiting for Public IP Assignment"
echo "===================================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

INSTANCE_NAME="bld-portal-db"
DATABASE_NAME="bld_portal_prod"

echo "Checking for public IP..."
echo ""

# Wait up to 3 minutes for IP assignment
for i in {1..18}; do
  PUBLIC_IP=$(gcloud sql instances describe "$INSTANCE_NAME" \
    --format="value(ipAddresses[?type=='PRIMARY'].ipAddress)" \
    --project=bldcebu-portal 2>/dev/null || echo "")
  
  if [ -n "$PUBLIC_IP" ]; then
    echo "✅ Public IP assigned: $PUBLIC_IP"
    echo ""
    
    echo "Step 2: Get Database Password"
    echo "-----------------------------"
    echo -n "Enter database password: "
    read DB_PASSWORD
    
    if [ -z "$DB_PASSWORD" ]; then
      echo "❌ Password required"
      exit 1
    fi
    
    echo ""
    echo "Step 3: Create Database URL"
    echo "---------------------------"
    DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@${PUBLIC_IP}:5432/${DATABASE_NAME}"
    
    echo "Database URL: postgresql://postgres:***@${PUBLIC_IP}:5432/${DATABASE_NAME}"
    echo ""
    
    echo "Step 4: Update Secret"
    echo "---------------------"
    printf "%s" "$DATABASE_URL" | gcloud secrets versions add prod-database-url --data-file=-
    echo "✅ Secret updated"
    echo ""
    
    echo "✅ Setup complete! You can now deploy."
    exit 0
  fi
  
  if [ $i -lt 18 ]; then
    echo "  Waiting... ($((i*10)) seconds elapsed)"
    sleep 10
  fi
done

echo ""
echo "❌ Public IP still not available after 3 minutes"
echo ""
echo "Alternative options:"
echo "  1. Wait a bit longer and check manually:"
echo "     gcloud sql instances describe $INSTANCE_NAME --format='value(ipAddresses[?type==\"PRIMARY\"].ipAddress)' --project=bldcebu-portal"
echo ""
echo "  2. Use Unix socket with proper format (we can fix the format issue)"
echo ""
echo "  3. Check Cloud SQL instance status:"
echo "     gcloud sql instances describe $INSTANCE_NAME --project=bldcebu-portal"
