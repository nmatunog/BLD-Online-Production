#!/bin/bash
# Check Cloud SQL database instance and get connection details
# Usage: ./scripts/check-database.sh

set -e

echo "🔍 Checking Cloud SQL database instance..."
echo ""
echo "Project: bldcebu-portal"
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

INSTANCE_NAME="bld-portal-db"
REGION="asia-southeast1"
DATABASE_NAME="bld_portal_prod"

# Check if instance exists
echo "📋 Checking for Cloud SQL instance: $INSTANCE_NAME"
if gcloud sql instances describe "$INSTANCE_NAME" >/dev/null 2>&1; then
  echo "✅ Instance exists: $INSTANCE_NAME"
  echo ""
  
  # Get instance details
  echo "📊 Instance details:"
  gcloud sql instances describe "$INSTANCE_NAME" \
    --format="table(name,region,state,databaseVersion,settings.tier)"
  echo ""
  
  # Get connection name
  CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" \
    --format="value(connectionName)")
  echo "🔗 Connection Name: $CONNECTION_NAME"
  echo ""
  
  # Check for database
  echo "📋 Checking for database: $DATABASE_NAME"
  if gcloud sql databases describe "$DATABASE_NAME" --instance="$INSTANCE_NAME" >/dev/null 2>&1; then
    echo "✅ Database exists: $DATABASE_NAME"
  else
    echo "❌ Database does not exist: $DATABASE_NAME"
    echo ""
    read -p "Create database now? (yes/no): " create_db
    if [ "$create_db" == "yes" ]; then
      gcloud sql databases create "$DATABASE_NAME" --instance="$INSTANCE_NAME"
      echo "✅ Database created"
    fi
  fi
  echo ""
  
  # Get root user
  ROOT_USER=$(gcloud sql users list --instance="$INSTANCE_NAME" \
    --format="value(name)" 2>/dev/null | head -n1 || echo "postgres")
  echo "👤 Root user: $ROOT_USER"
  echo ""
  
  # Get IP addresses
  echo "🌐 IP Addresses:"
  PRIVATE_IP=$(gcloud sql instances describe "$INSTANCE_NAME" \
    --format="value(ipAddresses[0].ipAddress)" 2>/dev/null || echo "")
  PUBLIC_IP=$(gcloud sql instances describe "$INSTANCE_NAME" \
    --format="value(ipAddresses[?type=='PRIMARY'].ipAddress)" 2>/dev/null || echo "")
  
  if [ -n "$PRIVATE_IP" ]; then
    echo "  Private IP: $PRIVATE_IP"
  fi
  if [ -n "$PUBLIC_IP" ]; then
    echo "  Public IP: $PUBLIC_IP"
  fi
  echo ""
  
  # Generate connection strings
  echo "📝 Database URL formats:"
  echo ""
  echo "For Cloud SQL (Unix socket - recommended for Cloud Run):"
  echo "postgresql://${ROOT_USER}:YOUR_PASSWORD@/${DATABASE_NAME}?host=/cloudsql/${CONNECTION_NAME}"
  echo ""
  if [ -n "$PUBLIC_IP" ]; then
    echo "For Public IP:"
    echo "postgresql://${ROOT_USER}:YOUR_PASSWORD@${PUBLIC_IP}:5432/${DATABASE_NAME}"
    echo ""
  fi
  echo "⚠️  Replace YOUR_PASSWORD with your actual database password!"
  echo ""
  echo "💡 To set/reset root password:"
  echo "   gcloud sql users set-password ${ROOT_USER} --instance=${INSTANCE_NAME} --password=NEW_PASSWORD"
  
else
  echo "❌ Instance does not exist: $INSTANCE_NAME"
  echo ""
  echo "📝 Create the instance first:"
  echo ""
  echo "Option 1: Use the setup script"
  echo "   ./scripts/setup-database.sh"
  echo ""
  echo "Option 2: Manual creation"
  echo "   gcloud sql instances create $INSTANCE_NAME \\"
  echo "     --database-version=POSTGRES_15 \\"
  echo "     --tier=db-f1-micro \\"
  echo "     --region=$REGION \\"
  echo "     --root-password=YOUR_ROOT_PASSWORD"
  echo ""
  exit 1
fi
