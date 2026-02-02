#!/bin/bash
# Setup script for creating and pushing to production repository
# Usage: ./scripts/setup-production-repo.sh

set -e

echo "🚀 Setting Up Production GitHub Repository"
echo "========================================="
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
  echo "❌ Not a git repository. Please initialize git first:"
  echo "   git init"
  echo "   git add ."
  echo "   git commit -m 'Initial commit'"
  exit 1
fi

echo "📋 Current repository status:"
git remote -v
echo ""

echo "📝 Steps to create production repository:"
echo ""
echo "   1. Go to https://github.com/new"
echo "   2. Create a new repository (e.g., 'BLDCebu-Online-Portal-Production')"
echo "   3. Don't initialize with README, .gitignore, or license"
echo "   4. Copy the repository URL"
echo ""

read -p "Have you created the repository on GitHub? (y/n): " repo_created

if [ "$repo_created" != "y" ]; then
  echo ""
  echo "⏸️  Please create the repository first, then run this script again"
  echo ""
  echo "💡 Quick steps:"
  echo "   1. Go to: https://github.com/new"
  echo "   2. Repository name: BLDCebu-Online-Portal-Production"
  echo "   3. Visibility: Private (recommended)"
  echo "   4. Don't initialize with anything"
  echo "   5. Click 'Create repository'"
  exit 1
fi

echo ""
read -p "Enter your production repository URL (e.g., https://github.com/username/repo.git): " PROD_REPO_URL

if [ -z "$PROD_REPO_URL" ]; then
  echo "❌ Repository URL is required"
  exit 1
fi

echo ""
echo "🔗 Adding production remote..."

# Check if production remote already exists
if git remote | grep -q "^production$"; then
  echo "⚠️  Production remote already exists"
  read -p "Update it? (y/n): " update_remote
  if [ "$update_remote" == "y" ]; then
    git remote set-url production "$PROD_REPO_URL"
    echo "✅ Production remote updated"
  else
    echo "ℹ️  Keeping existing production remote"
  fi
else
  git remote add production "$PROD_REPO_URL"
  echo "✅ Production remote added"
fi

echo ""
echo "📤 Pushing to production repository..."

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

echo "   Current branch: $CURRENT_BRANCH"
echo "   Pushing to: production/$CURRENT_BRANCH"

read -p "Continue? (y/n): " confirm_push

if [ "$confirm_push" == "y" ]; then
  git push production "$CURRENT_BRANCH"
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully pushed to production repository!"
    echo ""
    echo "📊 Next Steps:"
    echo ""
    echo "   1. Connect Vercel:"
    echo "      - Go to https://vercel.com/dashboard"
    echo "      - Add New Project"
    echo "      - Import from GitHub: $PROD_REPO_URL"
    echo "      - Root Directory: frontend"
    echo ""
    echo "   2. Connect Railway:"
    echo "      - Go to https://railway.app/dashboard"
    echo "      - New Project → Deploy from GitHub"
    echo "      - Select: $PROD_REPO_URL"
    echo "      - Select backend directory"
    echo ""
    echo "   3. Set environment variables in both platforms"
    echo "   4. Configure domain (app.BLDCebu.com)"
    echo ""
    echo "📚 See SETUP_SEPARATE_GITHUB_REPO.md for detailed instructions"
  else
    echo ""
    echo "❌ Push failed. Common issues:"
    echo "   - Repository doesn't exist"
    echo "   - Authentication required (use GitHub CLI or SSH)"
    echo "   - No write access to repository"
    echo ""
    echo "💡 Try:"
    echo "   - Verify repository URL is correct"
    echo "   - Authenticate: gh auth login (if using GitHub CLI)"
    echo "   - Or use SSH URL: git@github.com:username/repo.git"
  fi
else
  echo "⏸️  Push cancelled"
fi

echo ""
