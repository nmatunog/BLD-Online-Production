#!/bin/bash
# Force Railway to redeploy with latest changes
# This creates an empty commit to trigger a fresh deployment

set -e

echo "🔄 Forcing Railway Redeploy"
echo "============================"
echo ""

# Check if we're in the right directory
if [ ! -f "backend/package.json" ]; then
    echo "❌ Error: Must run from project root"
    exit 1
fi

# Show current commit
echo "📋 Current commit:"
git log --oneline -1
echo ""

# Show what Railway should see
echo "📋 Files Railway should see:"
echo "  - backend/railway.json: $(test -f backend/railway.json && echo '✅ EXISTS' || echo '❌ MISSING')"
echo "  - backend/nixpacks.toml: $(test -f backend/nixpacks.toml && echo '✅ EXISTS' || echo '❌ MISSING')"
echo "  - backend/Dockerfile: $(test -f backend/Dockerfile && echo '❌ EXISTS (BAD!)' || echo '✅ MISSING (GOOD!)')"
echo "  - backend/.railwayignore: $(test -f backend/.railwayignore && echo '✅ EXISTS' || echo '❌ MISSING')"
echo ""

# Show railway.json content
echo "📋 railway.json builder setting:"
grep -A 2 '"builder"' backend/railway.json || echo "  Not found"
echo ""

# Create empty commit to force redeploy
echo "🔄 Creating empty commit to trigger redeploy..."
git commit --allow-empty -m "Force Railway redeploy - use Nixpacks builder"
echo ""

# Push to trigger deployment
echo "📤 Pushing to trigger Railway deployment..."
git push
echo ""

echo "✅ Done!"
echo ""
echo "Next steps:"
echo "1. Go to Railway Dashboard → Your Service"
echo "2. Check 'Deployments' tab - should see new deployment starting"
echo "3. Watch build logs - should see 'Using Nixpacks builder'"
echo "4. If still using Dockerfile, manually change builder in Settings"
echo ""
