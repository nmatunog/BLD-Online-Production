#!/bin/bash
# Fresh Railway Deployment Script
# This uses Railway's native Nixpacks build system

set -e

echo "🚀 Starting Fresh Railway Deployment"
echo "======================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "backend/package.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    exit 1
fi

echo -e "${YELLOW}📋 Pre-deployment Checklist:${NC}"
echo "1. Railway project created"
echo "2. PostgreSQL database added to Railway"
echo "3. Backend service added to Railway"
echo "4. Environment variables set in Railway dashboard"
echo ""
read -p "Have you completed the checklist? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}⚠️  Please complete the checklist first${NC}"
    echo "See RAILWAY_FRESH_START.md for details"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Configuration files updated:${NC}"
echo "  - backend/railway.json (using NIXPACKS builder)"
echo "  - backend/nixpacks.toml (simplified)"
echo "  - backend/prisma/schema.prisma (auto-detect binary)"

echo ""
echo -e "${YELLOW}📦 Committing changes...${NC}"
cd backend
git add railway.json nixpacks.toml prisma/schema.prisma
cd ..

echo ""
echo -e "${GREEN}✅ Ready to deploy!${NC}"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff --cached"
echo "2. Commit: git commit -m 'Fresh Railway deployment: Use Nixpacks'"
echo "3. Push: git push"
echo "4. Railway will auto-deploy"
echo ""
echo "After deployment:"
echo "1. Check Railway logs for any errors"
echo "2. Run migrations: npx @railway/cli run --service <service-id> npx prisma migrate deploy"
echo "3. Verify health endpoint: https://your-service.railway.app/api/v1/health"
echo ""
