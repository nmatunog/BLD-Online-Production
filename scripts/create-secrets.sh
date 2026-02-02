#!/bin/bash
# Create required secrets in Secret Manager
# Usage: ./scripts/create-secrets.sh

set -e

echo "🔐 Creating secrets in Secret Manager..."
echo ""
echo "Project: bldcebu-portal"
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

# Required secrets
REQUIRED_SECRETS=(
  "prod-jwt-secret"
  "prod-jwt-refresh-secret"
  "prod-database-url"
)

# Check if secrets already exist
echo "🔍 Checking existing secrets..."
for secret in "${REQUIRED_SECRETS[@]}"; do
  if gcloud secrets describe "$secret" >/dev/null 2>&1; then
    echo "⚠️  Secret '$secret' already exists"
    read -p "  Overwrite with new value? (yes/no): " overwrite
    if [ "$overwrite" != "yes" ]; then
      echo "  Skipping $secret"
      continue
    fi
  fi
done
echo ""

# Create JWT Secret
echo "📝 Creating prod-jwt-secret..."
if ! gcloud secrets describe prod-jwt-secret >/dev/null 2>&1; then
  echo -n "Enter JWT secret (or press Enter to generate a random one): "
  read -s JWT_SECRET
  if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(openssl rand -base64 32)
    echo "✅ Generated random JWT secret"
  fi
  echo "$JWT_SECRET" | gcloud secrets create prod-jwt-secret \
    --data-file=- \
    --replication-policy="automatic" \
    --quiet
  echo "✅ Created prod-jwt-secret"
else
  echo -n "Enter new JWT secret (or press Enter to skip): "
  read -s JWT_SECRET
  if [ -n "$JWT_SECRET" ]; then
    echo "$JWT_SECRET" | gcloud secrets versions add prod-jwt-secret --data-file=-
    echo "✅ Updated prod-jwt-secret"
  fi
fi
echo ""

# Create JWT Refresh Secret
echo "📝 Creating prod-jwt-refresh-secret..."
if ! gcloud secrets describe prod-jwt-refresh-secret >/dev/null 2>&1; then
  echo -n "Enter JWT refresh secret (or press Enter to generate a random one): "
  read -s JWT_REFRESH_SECRET
  if [ -z "$JWT_REFRESH_SECRET" ]; then
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    echo "✅ Generated random JWT refresh secret"
  fi
  echo "$JWT_REFRESH_SECRET" | gcloud secrets create prod-jwt-refresh-secret \
    --data-file=- \
    --replication-policy="automatic" \
    --quiet
  echo "✅ Created prod-jwt-refresh-secret"
else
  echo -n "Enter new JWT refresh secret (or press Enter to skip): "
  read -s JWT_REFRESH_SECRET
  if [ -n "$JWT_REFRESH_SECRET" ]; then
    echo "$JWT_REFRESH_SECRET" | gcloud secrets versions add prod-jwt-refresh-secret --data-file=-
    echo "✅ Updated prod-jwt-refresh-secret"
  fi
fi
echo ""

# Create Database URL Secret
echo "📝 Creating prod-database-url..."
if ! gcloud secrets describe prod-database-url >/dev/null 2>&1; then
  echo "Enter database URL (postgresql://user:password@host:port/database)"
  echo "💡 Tip: You can paste the URL (it won't be hidden)"
  echo -n "Database URL: "
  read DATABASE_URL
  if [ -z "$DATABASE_URL" ]; then
    echo "❌ Database URL is required!"
    exit 1
  fi
  echo "$DATABASE_URL" | gcloud secrets create prod-database-url \
    --data-file=- \
    --replication-policy="automatic" \
    --quiet
  echo "✅ Created prod-database-url"
else
  echo "Enter new database URL (or press Enter to skip)"
  echo "💡 Tip: You can paste the URL (it won't be hidden)"
  echo -n "Database URL: "
  read DATABASE_URL
  if [ -n "$DATABASE_URL" ]; then
    echo "$DATABASE_URL" | gcloud secrets versions add prod-database-url --data-file=-
    echo "✅ Updated prod-database-url"
  fi
fi
echo ""

echo "✅ All secrets created/updated!"
echo ""
echo "📝 Next steps:"
echo "   1. Run: ./scripts/check-secrets.sh (to verify)"
echo "   2. Run: ./scripts/deploy-prod.sh (to deploy)"
