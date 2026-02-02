#!/bin/bash
# Create the first admin user in production database
# Usage: ./scripts/create-production-admin.sh

set -e

echo "🔐 Creating First Admin User for Production"
echo "==========================================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

# Get database URL from secret
echo "📌 Getting database URL from Secret Manager..."
DATABASE_URL=$(gcloud secrets versions access latest --secret="prod-database-url" 2>/dev/null || echo "")

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Could not get DATABASE_URL from Secret Manager"
  echo ""
  echo "Please provide the database URL manually:"
  read -p "DATABASE_URL: " DATABASE_URL
  if [ -z "$DATABASE_URL" ]; then
    echo "❌ Database URL is required"
    exit 1
  fi
fi

echo "✅ Database URL retrieved"
echo ""

# Check if Cloud SQL Proxy is needed
if [[ "$DATABASE_URL" == *"/cloudsql/"* ]]; then
  echo "⚠️  Database uses Unix socket connection"
  echo "   We'll use Cloud Run Job to create the admin user"
  echo ""
  
  # Create a Cloud Run Job
  echo "📦 Creating Cloud Run Job for admin user creation..."
  
  # First, we need to build and push an image, or use an existing one
  # For simplicity, let's use the existing backend service image
  BACKEND_IMAGE=$(gcloud run services describe bld-portal-backend \
    --region asia-southeast1 \
    --format="value(spec.template.spec.containers[0].image)" 2>/dev/null || echo "")
  
  if [ -z "$BACKEND_IMAGE" ]; then
    echo "❌ Could not get backend image. Please deploy backend first."
    exit 1
  fi
  
  echo "Using backend image: $BACKEND_IMAGE"
  echo ""
  echo "⚠️  Cloud Run Jobs require interactive mode for input"
  echo "   Please use the manual method instead:"
  echo ""
  echo "   1. Install Cloud SQL Proxy:"
  echo "      brew install cloud-sql-proxy"
  echo ""
  echo "   2. Start proxy in one terminal:"
  echo "      cloud-sql-proxy bldcebu-portal:asia-southeast1:bld-portal-db"
  echo ""
  echo "   3. In another terminal, run:"
  echo "      cd backend"
  echo "      DATABASE_URL=\"postgresql://postgres:PASSWORD@127.0.0.1:5432/bld_portal\" \\"
  echo "        npx ts-node scripts/create-admin-user.ts"
  echo ""
  exit 0
fi

# If using public IP or direct connection
echo "📝 Running admin user creation script..."
echo ""

cd backend

# Export DATABASE_URL and run the script
export DATABASE_URL
npx ts-node scripts/create-admin-user.ts

cd ..

echo ""
echo "✅ Admin user created!"
echo ""
echo "🔄 You can now log in to the production frontend with these credentials"
echo ""
