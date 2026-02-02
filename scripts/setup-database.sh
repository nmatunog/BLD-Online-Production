#!/bin/bash
# Setup Cloud SQL database instance for production
# Usage: ./scripts/setup-database.sh

set -e

echo "🗄️  Setting up Cloud SQL database instance..."
echo ""
echo "Project: bldcebu-portal"
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

INSTANCE_NAME="bld-portal-db"
REGION="asia-southeast1"
DATABASE_NAME="bld_portal_prod"
TIER="db-f1-micro"  # Can be changed to db-n1-standard-1 for production

# Check if instance already exists
if gcloud sql instances describe "$INSTANCE_NAME" >/dev/null 2>&1; then
  echo "⚠️  Instance already exists: $INSTANCE_NAME"
  read -p "Continue anyway? (yes/no): " continue_setup
  if [ "$continue_setup" != "yes" ]; then
    echo "Exiting..."
    exit 0
  fi
  echo ""
else
  echo "📋 Creating Cloud SQL instance..."
  echo "   Instance: $INSTANCE_NAME"
  echo "   Region: $REGION"
  echo "   Tier: $TIER"
  echo ""
  
  # Prompt for root password
  echo -n "Enter root password for database (or press Enter to generate): "
  read -s ROOT_PASSWORD
  if [ -z "$ROOT_PASSWORD" ]; then
    ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-32)
    echo "✅ Generated password: $ROOT_PASSWORD"
    echo ""
    echo "⚠️  SAVE THIS PASSWORD - You'll need it for the database URL!"
  fi
  echo ""
  
  # Create instance
  gcloud sql instances create "$INSTANCE_NAME" \
    --database-version=POSTGRES_15 \
    --tier="$TIER" \
    --region="$REGION" \
    --root-password="$ROOT_PASSWORD" \
    --storage-type=SSD \
    --storage-size=10GB \
    --backup-start-time=03:00
  
  echo "✅ Instance created"
  echo ""
fi

# Get connection name
CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" \
  --format="value(connectionName)")

# Create database
echo "📋 Creating database: $DATABASE_NAME"
if gcloud sql databases describe "$DATABASE_NAME" --instance="$INSTANCE_NAME" >/dev/null 2>&1; then
  echo "⚠️  Database already exists: $DATABASE_NAME"
else
  gcloud sql databases create "$DATABASE_NAME" --instance="$INSTANCE_NAME"
  echo "✅ Database created"
fi
echo ""

# Display connection information
echo "✅ Database setup complete!"
echo ""
echo "📝 Connection details:"
echo "   Connection Name: $CONNECTION_NAME"
echo "   Database Name: $DATABASE_NAME"
echo ""
echo "📝 Database URL (use this in Secret Manager):"
if [ -n "$ROOT_PASSWORD" ]; then
  echo "   postgresql://postgres:${ROOT_PASSWORD}@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
else
  echo "   postgresql://postgres:YOUR_PASSWORD@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
  echo ""
  echo "💡 To set/reset root password:"
  echo "   gcloud sql users set-password postgres --instance=${INSTANCE_NAME} --password=NEW_PASSWORD"
fi
echo ""
echo "📝 Next steps:"
echo "   1. Save the database URL to Secret Manager"
echo "   2. Run: ./scripts/create-secrets.sh"
echo "   3. Run: ./scripts/deploy-prod.sh"
