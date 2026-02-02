#!/bin/bash
# Interactive guide to start Vercel + Railway deployment
# Usage: ./scripts/start-vercel-railway-deployment.sh

set -e

echo "🚀 Vercel + Railway Deployment Guide"
echo "===================================="
echo ""
echo "💰 Cost: ~\$5-20/month (vs \$175/month on Google Cloud!)"
echo ""
echo "📋 Prerequisites:"
echo "   ✅ Vercel account (sign up at https://vercel.com)"
echo "   ✅ Railway account (sign up at https://railway.app)"
echo "   ✅ Git repository (your code)"
echo "   ✅ Domain DNS access (for app.BLDCebu.com)"
echo ""

read -p "Ready to start? (y/n): " ready
if [ "$ready" != "y" ]; then
  echo "❌ Cancelled"
  exit 1
fi

echo ""
echo "📦 Step 1: Install CLI Tools"
echo "   -----------------------"
echo ""
echo "   Installing Vercel and Railway CLI..."
echo ""

if ! command -v vercel &> /dev/null; then
  echo "   Installing Vercel CLI..."
  npm install -g vercel
else
  echo "   ✅ Vercel CLI already installed"
fi

if ! command -v railway &> /dev/null; then
  echo "   Installing Railway CLI..."
  npm install -g @railway/cli
else
  echo "   ✅ Railway CLI already installed"
fi

echo ""
echo "✅ CLI tools ready"
echo ""
echo "📚 Next Steps:"
echo ""
echo "   1. Deploy Backend to Railway:"
echo "      cd backend"
echo "      railway login"
echo "      railway init"
echo "      railway add postgresql"
echo "      railway up"
echo ""
echo "   2. Deploy Frontend to Vercel:"
echo "      cd frontend"
echo "      vercel login"
echo "      vercel"
echo ""
echo "   3. Set Environment Variables:"
echo "      - In Vercel: NEXT_PUBLIC_API_BASE_URL = [your-railway-url]"
echo "      - In Railway: JWT_SECRET, JWT_REFRESH_SECRET, etc."
echo ""
echo "   4. Configure Domain:"
echo "      - Add app.BLDCebu.com in Vercel dashboard"
echo "      - Add DNS CNAME record at registrar"
echo ""
echo "📖 Full guide: See VERCEL_RAILWAY_DEPLOYMENT.md"
echo "⚡ Quick start: See QUICK_START_VERCEL_RAILWAY.md"
echo ""
echo "💡 Tip: Run './scripts/deploy-vercel-railway.sh' for automated deployment"
echo ""
