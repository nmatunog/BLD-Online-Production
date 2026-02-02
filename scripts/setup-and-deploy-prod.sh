#!/bin/bash
# Complete first-time production setup and deployment
# This script does: Database setup → Migrations → Data migration → Code deployment
# Usage: ./scripts/setup-and-deploy-prod.sh

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🔴 ========================================"
echo "🔴 First-Time Production Setup & Deployment"
echo "🔴 ========================================"
echo ""
echo "This will:"
echo "  1. Set up production database"
echo "  2. Create production secrets"
echo "  3. Run database migrations"
echo "  4. Migrate data from dev (excluding dummy data)"
echo "  5. Deploy production code"
echo ""
echo "⚠️  WARNING: This is for FIRST-TIME production setup!"
echo ""

read -p "Type 'SETUP PRODUCTION' to continue: " confirm
if [ "$confirm" != "SETUP PRODUCTION" ]; then
  echo "❌ Setup cancelled"
  exit 1
fi

# Switch to production
echo "📌 Setting projects to production..."
firebase use prod
gcloud config set project bldcebu-portal

# Step 1: Check if database exists
echo ""
echo "📋 Step 1: Checking production database..."
DB_EXISTS=$(gcloud sql instances list --filter="name:bld-portal-db" --format="value(name)" || echo "")

if [ -z "$DB_EXISTS" ]; then
  echo "  ⚠️  Production database not found"
  read -p "  Create production database now? (yes/no): " create_db
  if [ "$create_db" = "yes" ]; then
    read -p "  Database root password: " -s DB_PASSWORD
    echo ""
    
    echo "  Creating Cloud SQL instance..."
    gcloud sql instances create bld-portal-db \
      --database-version=POSTGRES_15 \
      --tier=db-n1-standard-1 \
      --region=asia-southeast1 \
      --root-password="$DB_PASSWORD"
    
    echo "  Creating database..."
    gcloud sql databases create bld_portal \
      --instance=bld-portal-db
    
    echo "  ✅ Database created"
  else
    echo "  ❌ Cannot continue without database"
    exit 1
  fi
else
  echo "  ✅ Database exists: $DB_EXISTS"
fi

# Step 2: Check secrets
echo ""
echo "📋 Step 2: Checking production secrets..."
SECRETS_EXIST=$(gcloud secrets list --filter="name:prod-" --format="value(name)" || echo "")

if [ -z "$SECRETS_EXIST" ]; then
  echo "  ⚠️  Production secrets not found"
  echo "  You need to create:"
  echo "    - prod-jwt-secret"
  echo "    - prod-jwt-refresh-secret"
  echo "    - prod-database-url"
  echo ""
  echo "  Generate secrets:"
  echo "    node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  echo ""
  read -p "  Create secrets now? (yes/no): " create_secrets
  if [ "$create_secrets" = "yes" ]; then
    echo "  Generating JWT secrets..."
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    JWT_REFRESH=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    read -p "  Database connection string: " DB_URL
    
    echo -n "$JWT_SECRET" | gcloud secrets create prod-jwt-secret --data-file=-
    echo -n "$JWT_REFRESH" | gcloud secrets create prod-jwt-refresh-secret --data-file=-
    echo -n "$DB_URL" | gcloud secrets create prod-database-url --data-file=-
    
    echo "  ✅ Secrets created"
  else
    echo "  ⚠️  Please create secrets manually, then run this script again"
    exit 1
  fi
else
  echo "  ✅ Secrets exist"
fi

# Step 3: Run migrations
echo ""
echo "📋 Step 3: Running database migrations..."
read -p "  Have you set up Cloud SQL Proxy? (yes/no): " proxy_setup

if [ "$proxy_setup" = "yes" ]; then
  read -p "  Database password: " -s DB_PASSWORD
  echo ""
  read -p "  Proxy port for production (default 5433): " PROD_PORT
  PROD_PORT=${PROD_PORT:-5433}
  
  cd backend
  DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@127.0.0.1:${PROD_PORT}/bld_portal" \
    npx prisma migrate deploy
  cd ..
  
  echo "  ✅ Migrations complete"
else
  echo "  ⚠️  Skipping migrations (run manually later)"
  echo "  Command: npx prisma migrate deploy"
fi

# Step 4: Migrate data
echo ""
echo "📋 Step 4: Migrate data from dev to prod..."
read -p "  Migrate data now? (yes/no): " migrate_data

if [ "$migrate_data" = "yes" ]; then
  read -p "  Dev database password: " -s DEV_PASSWORD
  echo ""
  read -p "  Prod database password: " -s PROD_PASSWORD
  echo ""
  read -p "  Dev proxy port (default 5432): " DEV_PORT
  read -p "  Prod proxy port (default 5433): " PROD_PORT
  DEV_PORT=${DEV_PORT:-5432}
  PROD_PORT=${PROD_PORT:-5433}
  
  cd backend
  DEV_DATABASE_URL="postgresql://postgres:${DEV_PASSWORD}@127.0.0.1:${DEV_PORT}/bld_portal_dev" \
  PROD_DATABASE_URL="postgresql://postgres:${PROD_PASSWORD}@127.0.0.1:${PROD_PORT}/bld_portal" \
    npx ts-node scripts/migrate-dev-to-prod.ts
  cd ..
  
  echo "  ✅ Data migration complete"
else
  echo "  ⚠️  Skipping data migration (run manually later)"
  echo "  Command: npx ts-node scripts/migrate-dev-to-prod.ts"
fi

# Step 5: Deploy code
echo ""
echo "📋 Step 5: Deploy production code..."
read -p "  Deploy code now? (yes/no): " deploy_code

if [ "$deploy_code" = "yes" ]; then
  ./scripts/deploy-prod.sh
  echo "  ✅ Code deployment complete"
else
  echo "  ⚠️  Skipping code deployment (run manually later)"
  echo "  Command: ./scripts/deploy-prod.sh"
fi

echo ""
echo "✅ ========================================"
echo "✅ Production setup complete!"
echo "✅ ========================================"
echo ""
echo "Next steps:"
echo "  1. Verify production database has data"
echo "  2. Test production environment"
echo "  3. Create production admin user (if needed)"
echo ""
