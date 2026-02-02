#!/bin/bash
# Deploy to Vercel (Frontend) + Railway (Backend) with subdomain setup
# Usage: ./scripts/deploy-vercel-railway-subdomain.sh

set -e

echo "🚀 Deploying to Vercel + Railway (Most Cost-Effective)"
echo "======================================================="
echo ""
echo "💰 Cost: ~\$5-20/month (vs \$175/month on Google Cloud!)"
echo ""
echo "📋 This will:"
echo "   1. Deploy frontend to Vercel (FREE)"
echo "   2. Deploy backend to Railway (\$5-20/month)"
echo "   3. Set up subdomain: app.BLDCebu.com"
echo ""

read -p "Continue? (y/n): " confirm
if [ "$confirm" != "y" ]; then
  echo "❌ Cancelled"
  exit 1
fi

echo ""
echo "📦 Step 1: Install Required Tools"
echo "   -----------------------------"
echo ""
echo "   Install Vercel CLI:"
echo "   npm i -g vercel"
echo ""
echo "   Install Railway CLI:"
echo "   npm i -g @railway/cli"
echo ""

read -p "Have you installed both CLIs? (y/n): " clis_installed
if [ "$clis_installed" != "y" ]; then
  echo ""
  echo "📦 Installing CLIs..."
  npm i -g vercel @railway/cli 2>/dev/null || {
    echo "⚠️  Could not install globally. Please install manually:"
    echo "   npm i -g vercel @railway/cli"
    exit 1
  }
  echo "✅ CLIs installed"
fi

echo ""
echo "🌐 Step 2: Deploy Frontend to Vercel"
echo "   --------------------------------"
echo ""
echo "   1. Login to Vercel:"
echo "   2. vercel login"
echo ""
echo "   3. Deploy frontend:"
echo "      cd frontend"
echo "      vercel"
echo ""
echo "   4. Follow prompts:"
echo "      - Link to existing project or create new"
echo "      - Set project name"
echo "      - Deploy"
echo ""

read -p "Ready to deploy frontend? (y/n): " deploy_frontend
if [ "$deploy_frontend" == "y" ]; then
  cd frontend
  echo "🚀 Deploying to Vercel..."
  vercel --yes 2>/dev/null || {
    echo "⚠️  Vercel deployment failed or requires login"
    echo "   Please run manually: cd frontend && vercel"
  }
  cd ..
fi

echo ""
echo "🔧 Step 3: Deploy Backend to Railway"
echo "   --------------------------------"
echo ""
echo "   1. Login to Railway:"
echo "      railway login"
echo ""
echo "   2. Deploy backend:"
echo "      cd backend"
echo "      railway init"
echo "      railway add postgresql"
echo "      railway up"
echo ""

read -p "Ready to deploy backend? (y/n): " deploy_backend
if [ "$deploy_backend" == "y" ]; then
  cd backend
  echo "🚀 Deploying to Railway..."
  railway login 2>/dev/null || echo "⚠️  Please login: railway login"
  railway init 2>/dev/null || echo "⚠️  Project may already exist"
  railway add postgresql 2>/dev/null || echo "⚠️  Database may already exist"
  railway up 2>/dev/null || {
    echo "⚠️  Railway deployment requires manual steps"
    echo "   Please run manually: cd backend && railway up"
  }
  cd ..
fi

echo ""
echo "🌐 Step 4: Configure Subdomain"
echo "   ---------------------------"
echo ""
echo "   Frontend (Vercel):"
echo "   1. Go to: https://vercel.com/dashboard"
echo "   2. Select your project"
echo "   3. Go to 'Settings' → 'Domains'"
echo "   4. Add: app.BLDCebu.com"
echo "   5. Copy the DNS records shown"
echo ""
echo "   Backend (Railway):"
echo "   1. Get your Railway backend URL"
echo "   2. Update frontend environment variable:"
echo "      NEXT_PUBLIC_API_BASE_URL=https://[railway-url].railway.app"
echo ""
echo "   DNS Configuration (at your registrar):"
echo "   Type: CNAME"
echo "   Name: app"
echo "   Value: [vercel-provided-value]"
echo ""

echo ""
echo "✅ Deployment Guide Complete!"
echo ""
echo "📊 Summary:"
echo "   - Frontend: Vercel (FREE)"
echo "   - Backend: Railway (\$5-20/month)"
echo "   - Subdomain: app.BLDCebu.com"
echo "   - Total Cost: ~\$5-20/month"
echo ""
echo "💡 Next Steps:"
echo "   1. Complete Vercel deployment"
echo "   2. Complete Railway deployment"
echo "   3. Configure subdomain in Vercel dashboard"
echo "   4. Add DNS record at registrar"
echo "   5. Wait 5-30 minutes for DNS propagation"
echo "   6. Test: https://app.BLDCebu.com"
echo ""
