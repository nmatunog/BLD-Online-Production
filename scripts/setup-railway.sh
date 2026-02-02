#!/bin/bash
# Interactive Railway setup script
# Usage: ./scripts/setup-railway.sh

set -e

echo "🚂 Railway Setup Script"
echo "======================"
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
  echo "📦 Railway CLI not found"
  echo ""
  echo "Installing Railway CLI..."
  npm install -g @railway/cli
  
  if [ $? -eq 0 ]; then
    echo "✅ Railway CLI installed"
  else
    echo "❌ Failed to install Railway CLI"
    echo "   Please install manually: npm install -g @railway/cli"
    exit 1
  fi
else
  echo "✅ Railway CLI already installed"
  railway --version
fi

echo ""
echo "🔐 Step 1: Login to Railway"
echo "   ----------------------"
echo ""

# Check if already logged in
if railway whoami &> /dev/null; then
  echo "✅ Already logged in as: $(railway whoami)"
  read -p "Login again? (y/n): " relogin
  if [ "$relogin" == "y" ]; then
    railway login
  fi
else
  echo "   Logging in to Railway..."
  railway login
fi

echo ""
echo "📁 Step 2: Navigate to Backend Directory"
echo "   ------------------------------------"
echo ""

if [ ! -d "backend" ]; then
  echo "❌ Backend directory not found"
  echo "   Please run this script from the project root"
  exit 1
fi

cd backend
echo "✅ In backend directory: $(pwd)"

echo ""
echo "🚀 Step 3: Initialize Railway Project"
echo "   ---------------------------------"
echo ""

if [ -f ".railway" ] || railway status &> /dev/null; then
  echo "⚠️  Railway project already initialized"
  railway status
  read -p "Re-initialize? (y/n): " reinit
  if [ "$reinit" == "y" ]; then
    railway init
  fi
else
  echo "   Initializing Railway project..."
  railway init
fi

echo ""
echo "🗄️  Step 4: Add PostgreSQL Database"
echo "   -------------------------------"
echo ""

# Check if DATABASE_URL exists
if railway variables | grep -q "DATABASE_URL"; then
  echo "✅ PostgreSQL database already added"
  read -p "Add another database? (y/n): " add_db
  if [ "$add_db" == "y" ]; then
    railway add postgresql
  fi
else
  echo "   Adding PostgreSQL database..."
  railway add postgresql
fi

echo ""
echo "⚙️  Step 5: Set Environment Variables"
echo "   ----------------------------------"
echo ""

echo "   Setting required environment variables..."

# Check and set NODE_ENV
if ! railway variables | grep -q "NODE_ENV"; then
  railway variables set NODE_ENV=production
  echo "   ✅ NODE_ENV set"
else
  echo "   ℹ️  NODE_ENV already set"
fi

# Check and set API_PREFIX
if ! railway variables | grep -q "API_PREFIX"; then
  railway variables set API_PREFIX=api/v1
  echo "   ✅ API_PREFIX set"
else
  echo "   ℹ️  API_PREFIX already set"
fi

# Check and set PORT
if ! railway variables | grep -q "^PORT="; then
  railway variables set PORT=4000
  echo "   ✅ PORT set"
else
  echo "   ℹ️  PORT already set"
fi

# Generate and set JWT secrets
if ! railway variables | grep -q "JWT_SECRET"; then
  echo "   Generating JWT_SECRET..."
  JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "")
  if [ -n "$JWT_SECRET" ]; then
    railway variables set JWT_SECRET="$JWT_SECRET"
    echo "   ✅ JWT_SECRET set"
  else
    echo "   ⚠️  Could not generate JWT_SECRET automatically"
    echo "   Please set manually: railway variables set JWT_SECRET=<your-secret>"
  fi
else
  echo "   ℹ️  JWT_SECRET already set"
fi

if ! railway variables | grep -q "JWT_REFRESH_SECRET"; then
  echo "   Generating JWT_REFRESH_SECRET..."
  JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "")
  if [ -n "$JWT_REFRESH_SECRET" ]; then
    railway variables set JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"
    echo "   ✅ JWT_REFRESH_SECRET set"
  else
    echo "   ⚠️  Could not generate JWT_REFRESH_SECRET automatically"
    echo "   Please set manually: railway variables set JWT_REFRESH_SECRET=<your-secret>"
  fi
else
  echo "   ℹ️  JWT_REFRESH_SECRET already set"
fi

echo ""
echo "📊 Current Environment Variables:"
railway variables | head -10

echo ""
echo "🔄 Step 6: Run Database Migrations"
echo "   --------------------------------"
echo ""

read -p "Run database migrations now? (y/n): " run_migrations

if [ "$run_migrations" == "y" ]; then
  echo "   Running migrations..."
  railway run npx prisma migrate deploy
  
  if [ $? -eq 0 ]; then
    echo "   ✅ Migrations completed"
  else
    echo "   ⚠️  Migration failed. Check logs above"
  fi
else
  echo "   ⏭️  Skipping migrations"
  echo "   Run later with: railway run npx prisma migrate deploy"
fi

echo ""
echo "🚢 Step 7: Deploy Backend"
echo "   ---------------------"
echo ""

read -p "Deploy to Railway now? (y/n): " deploy_now

if [ "$deploy_now" == "y" ]; then
  echo "   Deploying..."
  railway up
  
  if [ $? -eq 0 ]; then
    echo "   ✅ Deployment initiated"
  else
    echo "   ⚠️  Deployment may have issues. Check logs above"
  fi
else
  echo "   ⏭️  Skipping deployment"
  echo "   Deploy later with: railway up"
fi

echo ""
echo "🌐 Step 8: Get Backend URL"
echo "   ----------------------"
echo ""

BACKEND_URL=$(railway domain 2>/dev/null || echo "")

if [ -n "$BACKEND_URL" ]; then
  echo "   ✅ Backend URL: https://$BACKEND_URL"
  echo ""
  echo "   📝 Save this URL for frontend configuration!"
  echo "   Use it as NEXT_PUBLIC_API_BASE_URL in Vercel"
else
  echo "   ⚠️  Could not get URL automatically"
  echo "   Check Railway dashboard or run: railway domain"
fi

echo ""
echo "✅ Railway Setup Complete!"
echo ""
echo "📊 Summary:"
echo "   - Railway CLI: ✅ Installed"
echo "   - Login: ✅ Done"
echo "   - Project: ✅ Initialized"
echo "   - Database: ✅ Added"
echo "   - Environment Variables: ✅ Set"
if [ "$run_migrations" == "y" ]; then
  echo "   - Migrations: ✅ Completed"
else
  echo "   - Migrations: ⏭️  Skipped (run manually)"
fi
if [ "$deploy_now" == "y" ]; then
  echo "   - Deployment: ✅ Initiated"
else
  echo "   - Deployment: ⏭️  Skipped (run manually)"
fi
if [ -n "$BACKEND_URL" ]; then
  echo "   - Backend URL: https://$BACKEND_URL"
fi

echo ""
echo "📚 Next Steps:"
echo "   1. Check deployment status: railway status"
echo "   2. View logs: railway logs"
echo "   3. Test API: https://$BACKEND_URL/api/docs"
echo "   4. Configure frontend (Vercel) with backend URL"
echo ""
echo "💡 Useful Commands:"
echo "   - railway status    # Check project status"
echo "   - railway logs      # View logs"
echo "   - railway variables # View environment variables"
echo "   - railway domain    # Get deployment URL"
echo "   - railway open      # Open dashboard"
echo ""

cd ..
