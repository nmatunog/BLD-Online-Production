#!/bin/bash
# Deploy to Vercel (Frontend) + Railway (Backend)
# Usage: ./scripts/deploy-vercel-railway.sh

set -e

echo "🚀 Deploying to Vercel + Railway"
echo "================================="
echo ""
echo "💰 Cost: ~\$5-20/month"
echo ""
echo "This will guide you through:"
echo "  1. Deploying backend to Railway"
echo "  2. Deploying frontend to Vercel"
echo "  3. Setting up environment variables"
echo ""

# Check if CLIs are installed
echo "📦 Checking for required tools..."
if ! command -v vercel &> /dev/null; then
  echo "⚠️  Vercel CLI not found"
  echo "   Install with: npm install -g vercel"
  read -p "Install now? (y/n): " install_vercel
  if [ "$install_vercel" == "y" ]; then
    npm install -g vercel
  else
    echo "❌ Please install Vercel CLI first"
    exit 1
  fi
fi

if ! command -v railway &> /dev/null; then
  echo "⚠️  Railway CLI not found"
  echo "   Install with: npm install -g @railway/cli"
  read -p "Install now? (y/n): " install_railway
  if [ "$install_railway" == "y" ]; then
    npm install -g @railway/cli
  else
    echo "❌ Please install Railway CLI first"
    exit 1
  fi
fi

echo "✅ All tools installed"
echo ""

# Backend deployment
echo "🔧 Step 1: Deploy Backend to Railway"
echo "   --------------------------------"
echo ""
read -p "Deploy backend now? (y/n): " deploy_backend

if [ "$deploy_backend" == "y" ]; then
  cd backend
  
  echo "   Logging in to Railway..."
  railway login || {
    echo "⚠️  Please login manually: railway login"
  }
  
  echo ""
  echo "   Initializing Railway project..."
  railway init || {
    echo "⚠️  Project may already exist, continuing..."
  }
  
  echo ""
  echo "   Adding PostgreSQL database..."
  railway add postgresql || {
    echo "⚠️  Database may already exist, continuing..."
  }
  
  echo ""
  echo "   Setting environment variables..."
  echo "   (You may need to set these manually in Railway dashboard)"
  
  # Generate JWT secrets
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "CHANGE_ME")
  JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "CHANGE_ME")
  
  railway variables set NODE_ENV=production 2>/dev/null || true
  railway variables set API_PREFIX=api/v1 2>/dev/null || true
  railway variables set PORT=4000 2>/dev/null || true
  railway variables set JWT_SECRET="$JWT_SECRET" 2>/dev/null || true
  railway variables set JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" 2>/dev/null || true
  
  echo ""
  echo "   Deploying backend..."
  railway up || {
    echo "⚠️  Deployment may require manual steps"
    echo "   Check Railway dashboard for details"
  }
  
  echo ""
  echo "   Getting backend URL..."
  BACKEND_URL=$(railway domain 2>/dev/null || echo "")
  
  if [ -z "$BACKEND_URL" ]; then
    echo "   ⚠️  Could not get URL automatically"
    echo "   Check Railway dashboard for your backend URL"
    read -p "   Enter backend URL manually (or press Enter to skip): " MANUAL_BACKEND_URL
    BACKEND_URL="$MANUAL_BACKEND_URL"
  else
    echo "   ✅ Backend URL: $BACKEND_URL"
  fi
  
  cd ..
  echo ""
  echo "✅ Backend deployment initiated"
  echo ""
  echo "💡 Next steps:"
  echo "   1. Check Railway dashboard for deployment status"
  echo "   2. Run migrations: cd backend && railway run npx prisma migrate deploy"
  echo "   3. Save backend URL: $BACKEND_URL"
  echo ""
fi

# Frontend deployment
echo "🌐 Step 2: Deploy Frontend to Vercel"
echo "   --------------------------------"
echo ""

if [ -z "$BACKEND_URL" ]; then
  read -p "Enter your Railway backend URL: " BACKEND_URL
fi

read -p "Deploy frontend now? (y/n): " deploy_frontend

if [ "$deploy_frontend" == "y" ]; then
  cd frontend
  
  echo "   Logging in to Vercel..."
  vercel login || {
    echo "⚠️  Please login manually: vercel login"
  }
  
  echo ""
  echo "   Deploying to Vercel..."
  vercel --yes || {
    echo "⚠️  Deployment may require manual steps"
    echo "   Run: vercel"
  }
  
  echo ""
  echo "   Setting environment variables..."
  echo "   Backend URL: $BACKEND_URL"
  
  # Set environment variables
  vercel env add NEXT_PUBLIC_API_BASE_URL production <<< "$BACKEND_URL" 2>/dev/null || {
    echo "⚠️  Could not set automatically"
    echo "   Set in Vercel dashboard:"
    echo "   NEXT_PUBLIC_API_BASE_URL = $BACKEND_URL"
  }
  
  vercel env add NEXT_PUBLIC_API_URL production <<< "$BACKEND_URL/api/v1" 2>/dev/null || {
    echo "⚠️  Could not set automatically"
    echo "   Set in Vercel dashboard:"
    echo "   NEXT_PUBLIC_API_URL = $BACKEND_URL/api/v1"
  }
  
  vercel env add NODE_ENV production <<< "production" 2>/dev/null || true
  
  echo ""
  echo "   Redeploying with environment variables..."
  vercel --prod || {
    echo "⚠️  Redeployment may require manual steps"
  }
  
  cd ..
  echo ""
  echo "✅ Frontend deployment initiated"
  echo ""
fi

echo ""
echo "🌍 Step 3: Configure Custom Domain"
echo "   ------------------------------"
echo ""
echo "   1. Go to Vercel dashboard: https://vercel.com/dashboard"
echo "   2. Select your project"
echo "   3. Go to Settings → Domains"
echo "   4. Add: app.BLDCebu.com"
echo "   5. Add DNS record at your registrar:"
echo "      Type: CNAME"
echo "      Name: app"
echo "      Value: cname.vercel-dns.com"
echo ""

echo ""
echo "✅ Deployment Guide Complete!"
echo ""
echo "📊 Summary:"
echo "   - Backend: Railway ($BACKEND_URL)"
echo "   - Frontend: Vercel (check dashboard for URL)"
echo "   - Domain: app.BLDCebu.com (configure in Vercel)"
echo ""
echo "💡 Next Steps:"
echo "   1. Complete domain setup in Vercel dashboard"
echo "   2. Configure DNS at your registrar"
echo "   3. Update backend CORS to allow app.BLDCebu.com"
echo "   4. Test deployment"
echo ""
echo "📚 Full guide: See VERCEL_RAILWAY_DEPLOYMENT.md"
echo ""
