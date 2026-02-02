#!/bin/bash
# Pre-deployment checklist for production
# Usage: ./scripts/pre-deploy-check.sh

set -e

echo "🔍 Production Deployment Pre-Check"
echo "=================================="
echo ""

# Check current project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
CURRENT_FIREBASE=$(firebase use 2>/dev/null | grep -o "bld[^ ]*" | head -1 || echo "")

echo "📌 Current Environment:"
echo "   Google Cloud: $CURRENT_PROJECT"
echo "   Firebase: $CURRENT_FIREBASE"
echo ""

# Switch to production
echo "🔄 Switching to production..."
firebase use prod
gcloud config set project bldcebu-portal

echo ""
echo "✅ Switched to production project"
echo ""

# Check database
echo "📋 Checking production database..."
DB_EXISTS=$(gcloud sql instances list --filter="name:bld-portal-db" --format="value(name)" 2>/dev/null || echo "")

if [ -z "$DB_EXISTS" ]; then
  echo "  ❌ Database instance 'bld-portal-db' not found"
  echo "  💡 Create it with:"
  echo "     gcloud sql instances create bld-portal-db \\"
  echo "       --database-version=POSTGRES_15 \\"
  echo "       --tier=db-n1-standard-1 \\"
  echo "       --region=asia-southeast1 \\"
  echo "       --root-password=YOUR_PASSWORD"
else
  echo "  ✅ Database instance exists: $DB_EXISTS"
fi

# Check secrets
echo ""
echo "📋 Checking production secrets..."
SECRETS=$(gcloud secrets list --filter="name:prod-" --format="value(name)" 2>/dev/null || echo "")

REQUIRED_SECRETS=("prod-jwt-secret" "prod-jwt-refresh-secret" "prod-database-url")
MISSING_SECRETS=()

for secret in "${REQUIRED_SECRETS[@]}"; do
  if echo "$SECRETS" | grep -q "^${secret}$"; then
    echo "  ✅ $secret exists"
  else
    echo "  ❌ $secret missing"
    MISSING_SECRETS+=("$secret")
  fi
done

if [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
  echo ""
  echo "  💡 Create missing secrets:"
  echo "     # Generate secrets:"
  echo "     node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  echo ""
  echo "     # Create secrets:"
  for secret in "${MISSING_SECRETS[@]}"; do
    if [[ "$secret" == *"jwt"* ]]; then
      echo "     echo -n \"your-secret\" | gcloud secrets create $secret --data-file=-"
    else
      echo "     echo -n \"postgresql://...\" | gcloud secrets create $secret --data-file=-"
    fi
  done
fi

# Check Cloud Run services
echo ""
echo "📋 Checking existing Cloud Run services..."
BACKEND_EXISTS=$(gcloud run services describe bld-portal-backend --region asia-southeast1 --format="value(name)" 2>/dev/null || echo "")
FRONTEND_EXISTS=$(gcloud run services describe bld-portal-frontend --region asia-southeast1 --format="value(name)" 2>/dev/null || echo "")

if [ -n "$BACKEND_EXISTS" ]; then
  echo "  ✅ Backend service exists: bld-portal-backend"
else
  echo "  ℹ️  Backend service will be created on first deployment"
fi

if [ -n "$FRONTEND_EXISTS" ]; then
  echo "  ✅ Frontend service exists: bld-portal-frontend"
else
  echo "  ℹ️  Frontend service will be created on first deployment"
fi

echo ""
echo "=================================="
if [ -z "$DB_EXISTS" ] || [ ${#MISSING_SECRETS[@]} -gt 0 ]; then
  echo "⚠️  Some prerequisites are missing"
  echo "   Please set them up before deploying"
else
  echo "✅ All prerequisites are ready!"
  echo "   You can now run: ./scripts/deploy-prod.sh"
fi
echo ""
