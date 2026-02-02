#!/bin/bash
# Run Prisma migrations on Railway
# This script can be run via Railway CLI or locally with Railway DATABASE_URL

set -e

echo "🔄 Running Prisma migrations on Railway..."
echo ""

cd "$(dirname "$0")"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL environment variable is not set"
  echo ""
  echo "To run migrations:"
  echo "  1. Get DATABASE_URL from Railway Dashboard → Your Service → Variables"
  echo "  2. Export it: export DATABASE_URL='your-railway-database-url'"
  echo "  3. Run this script again"
  echo ""
  echo "Or run via Railway CLI:"
  echo "  npx @railway/cli run --service bld-online-production npx prisma migrate deploy"
  exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Generate Prisma Client
echo "📦 Generating Prisma Client..."
npx prisma generate

# Run migrations
echo ""
echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo ""
echo "✅ Migrations completed successfully!"
echo ""
echo "Next steps:"
echo "  1. Create your first admin user"
echo "  2. Test the API endpoints"
echo "  3. Deploy the frontend to Vercel"
