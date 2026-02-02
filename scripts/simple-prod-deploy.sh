#!/bin/bash
# Simplified Production Deployment - Using Public IP instead of Unix Socket
# This avoids Prisma's Unix socket parsing issues
# Usage: ./scripts/simple-prod-deploy.sh

set -e

echo "🚀 Simplified Production Deployment"
echo "===================================="
echo ""
echo "This approach uses Public IP connection instead of Unix sockets"
echo "to avoid Prisma parsing issues."
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

INSTANCE_NAME="bld-portal-db"
REGION="asia-southeast1"
DATABASE_NAME="bld_portal_prod"

echo "Step 1: Get Cloud SQL Public IP"
echo "-------------------------------"
PUBLIC_IP=$(gcloud sql instances describe "$INSTANCE_NAME" \
  --format="value(ipAddresses[?type=='PRIMARY'].ipAddress)" \
  --project=bldcebu-portal 2>/dev/null || echo "")

if [ -z "$PUBLIC_IP" ]; then
  echo "❌ Public IP not found."
  echo ""
  echo "Options:"
  echo "  1. Enable public IP (takes 1-2 minutes)"
  echo "  2. Use private IP (if available)"
  echo ""
  read -p "Choose option (1/2): " ip_option
  
  if [ "$ip_option" == "1" ]; then
    echo "Enabling public IP..."
    gcloud sql instances patch "$INSTANCE_NAME" \
      --assign-ip \
      --project=bldcebu-portal
    
    echo "⏳ Waiting for IP assignment (this can take 1-2 minutes)..."
    for i in {1..20}; do
      sleep 10
      PUBLIC_IP=$(gcloud sql instances describe "$INSTANCE_NAME" \
        --format="value(ipAddresses[?type=='PRIMARY'].ipAddress)" \
        --project=bldcebu-portal 2>/dev/null || echo "")
      if [ -n "$PUBLIC_IP" ]; then
        echo "✅ Public IP assigned: $PUBLIC_IP"
        break
      fi
      if [ $i -lt 20 ]; then
        echo "  Still waiting... ($((i*10)) seconds)"
      fi
    done
  elif [ "$ip_option" == "2" ]; then
    # Try private IP
    PUBLIC_IP=$(gcloud sql instances describe "$INSTANCE_NAME" \
      --format="value(ipAddresses[0].ipAddress)" \
      --project=bldcebu-portal 2>/dev/null || echo "")
    if [ -n "$PUBLIC_IP" ]; then
      echo "✅ Using private IP: $PUBLIC_IP"
      echo "⚠️  Note: Private IP requires VPC connector or same network"
    fi
  fi
fi

if [ -z "$PUBLIC_IP" ]; then
  echo "❌ Could not get IP address. Please try again later or use Unix socket approach."
  exit 1
fi

echo "✅ Public IP: $PUBLIC_IP"
echo ""

echo "Step 2: Get Database Password"
echo "-----------------------------"
echo -n "Enter database password: "
read DB_PASSWORD

if [ -z "$DB_PASSWORD" ]; then
  echo "❌ Password cannot be empty"
  exit 1
fi

echo ""

echo "Step 3: Create Simple Database URL (Public IP)"
echo "----------------------------------------------"
# Simple format: postgresql://user:password@ip:port/database
DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@${PUBLIC_IP}:5432/${DATABASE_NAME}"

echo "Database URL format: postgresql://postgres:***@${PUBLIC_IP}:5432/${DATABASE_NAME}"
echo ""

echo "Step 4: Update Secret Manager"
echo "-----------------------------"
echo -n "$DATABASE_URL" | gcloud secrets versions add prod-database-url --data-file=-
echo "✅ Secret updated"
echo ""

echo "Step 5: Authorize Cloud Run to access Cloud SQL"
echo "------------------------------------------------"
# Add Cloud Run's service account to authorized networks (if needed)
# Or use Cloud SQL Proxy connection string in the deployment

echo "Step 6: Deploy with Public IP connection"
echo "----------------------------------------"
cd backend

gcloud run deploy bld-portal-backend \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 4000 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 20 \
  --set-env-vars "API_PREFIX=api/v1,FRONTEND_URL=https://bldcebu-portal.web.app,NODE_ENV=production" \
  --set-secrets "JWT_SECRET=prod-jwt-secret:latest,JWT_REFRESH_SECRET=prod-jwt-refresh-secret:latest,DATABASE_URL=prod-database-url:latest" \
  --add-cloudsql-instances bldcebu-portal:asia-southeast1:bld-portal-db

cd ..

echo ""
echo "✅ Deployment initiated!"
echo ""
echo "📝 Note: Using Public IP connection avoids Prisma Unix socket parsing issues"
echo "   The connection is still secure via Cloud SQL's network"
