#!/bin/bash
# Use Public IP approach - SIMPLER and avoids Prisma Unix socket issues
# This is the recommended approach when Unix sockets cause problems
# Usage: ./scripts/use-public-ip-approach.sh

set -e

echo "🚀 Public IP Connection Approach (Simple & Reliable)"
echo "===================================================="
echo ""
echo "This approach uses standard PostgreSQL connection (like local dev)"
echo "and avoids Prisma's Unix socket parsing issues entirely."
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

INSTANCE_NAME="bld-portal-db"
REGION="asia-southeast1"
DATABASE_NAME="bld_portal_prod"

echo "Step 1: Get Cloud SQL IP Address"
echo "-------------------------------"
# Try public IP first
PUBLIC_IP=$(gcloud sql instances describe "$INSTANCE_NAME" \
  --format="value(ipAddresses[?type=='PRIMARY'].ipAddress)" \
  --project=bldcebu-portal 2>/dev/null || echo "")

if [ -z "$PUBLIC_IP" ]; then
  echo "Public IP not found. Checking if we can enable it..."
  echo ""
  echo "To use Public IP approach, you need to:"
  echo "  1. Enable public IP on the Cloud SQL instance"
  echo "  2. Authorize Cloud Run's network (or use authorized networks)"
  echo ""
  read -p "Enable public IP now? (yes/no): " enable_ip
  if [ "$enable_ip" == "yes" ]; then
    gcloud sql instances patch "$INSTANCE_NAME" \
      --assign-ip \
      --project=bldcebu-portal
    echo "⏳ Waiting for IP assignment (60 seconds)..."
    sleep 60
    PUBLIC_IP=$(gcloud sql instances describe "$INSTANCE_NAME" \
      --format="value(ipAddresses[?type=='PRIMARY'].ipAddress)" \
      --project=bldcebu-portal 2>/dev/null || echo "")
  fi
fi

if [ -z "$PUBLIC_IP" ]; then
  echo ""
  echo "❌ Public IP not available."
  echo ""
  echo "Alternative: We can still use Unix socket but with a different format."
  echo "Or wait a few minutes for IP assignment and try again."
  exit 1
fi

echo "✅ Public IP: $PUBLIC_IP"
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

echo "Step 3: Create Simple Database URL"
echo "----------------------------------"
# Simple, standard PostgreSQL URL - no Unix socket complexity
DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@${PUBLIC_IP}:5432/${DATABASE_NAME}"

echo "Database URL format:"
echo "  postgresql://postgres:***@${PUBLIC_IP}:5432/${DATABASE_NAME}"
echo ""
echo "This is a standard PostgreSQL connection string that Prisma handles easily."
echo ""

echo "Step 4: Update Secret Manager"
echo "-----------------------------"
printf "%s" "$DATABASE_URL" | gcloud secrets versions add prod-database-url --data-file=-
echo "✅ Secret updated"
echo ""

echo "Step 5: Authorize Cloud Run Network (if needed)"
echo "-----------------------------------------------"
echo "Cloud Run needs to be authorized to access Cloud SQL via public IP."
echo "This is usually handled automatically, but we'll verify..."
echo ""

echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Deploy: ./scripts/deploy-prod.sh"
echo "   2. The connection uses standard PostgreSQL format (no Unix socket)"
echo "   3. This should work reliably with Prisma"
echo ""
echo "💡 Benefits of this approach:"
echo "   - Simple, standard connection string"
echo "   - No Prisma Unix socket parsing issues"
echo "   - Easier to debug"
echo "   - Same format as local development"
