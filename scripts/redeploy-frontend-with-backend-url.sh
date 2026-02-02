#!/bin/bash
# Redeploy frontend with correct backend URL (build-time env vars)
# Usage: ./scripts/redeploy-frontend-with-backend-url.sh

set -e

echo "🔧 Redeploying Frontend with Production Backend URL"
echo "==================================================="
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

# Get backend URL
echo "📌 Getting backend URL..."
BACKEND_URL=$(gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --format="value(status.url)")

if [ -z "$BACKEND_URL" ]; then
  echo "❌ Could not get backend URL. Is the backend deployed?"
  exit 1
fi

echo "✅ Backend URL: $BACKEND_URL"
echo ""

# Deploy frontend with build-time environment variables
echo "📦 Redeploying frontend with build-time environment variables..."
echo "   Using Cloud Build with build arguments..."
echo ""

cd frontend

# Backup original .dockerignore
cp .dockerignore .dockerignore.backup

# Temporarily allow .env.production in Docker build
# Remove .env.* from .dockerignore temporarily
sed -i.bak '/^\.env\.\*$/d' .dockerignore 2>/dev/null || sed -i '' '/^\.env\.\*$/d' .dockerignore

# Create .env.production file for build-time environment variables
cat > .env.production << EOF
NEXT_PUBLIC_API_BASE_URL=$BACKEND_URL
NEXT_PUBLIC_API_URL=$BACKEND_URL/api/v1
NODE_ENV=production
EOF

echo "✅ Created .env.production with backend URL"
echo ""

# Deploy frontend (the .env.production will be used during build)
echo "🚀 Deploying frontend (this will rebuild with the backend URL)..."
gcloud run deploy bld-portal-frontend \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 20 \
  --set-env-vars "NODE_ENV=production"

# Restore .dockerignore
echo ""
echo "🧹 Cleaning up..."
mv .dockerignore.backup .dockerignore 2>/dev/null || true
rm -f .env.production .dockerignore.bak

cd ..

# Get frontend URL
FRONTEND_URL=$(gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="value(status.url)")

echo ""
echo "✅ ========================================"
echo "✅ Frontend redeployed with backend URL!"
echo "✅ ========================================"
echo ""
echo "📍 URLs:"
echo "   Backend:  $BACKEND_URL"
echo "   Frontend: $FRONTEND_URL"
echo ""
echo "⏳ The frontend is rebuilding with the correct backend URL"
echo "   This may take 3-5 minutes..."
echo ""
echo "🔄 After deployment completes, refresh your browser"
echo "   The frontend should now connect to: $BACKEND_URL"
echo ""
