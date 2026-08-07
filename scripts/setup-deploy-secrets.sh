#!/usr/bin/env bash
# Configure GitHub Actions secrets for auto-deploy to Railway + Vercel.
# Run from repo root after generating tokens in each platform dashboard.

set -euo pipefail

REPO="${1:-nmatunog/BLD-Online-Production}"

echo "=== BLD Online Portal — Deploy Secrets Setup ==="
echo "Target repo: $REPO"
echo ""

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) is required. Install: brew install gh"
  exit 1
fi

echo "1) Railway token"
echo "   Open: https://railway.com/project/0aa4acc1-343f-43bd-b0cd-54bf4ac9ea89/settings/tokens"
echo "   Create a project token for the production environment."
read -rsp "   Paste RAILWAY_TOKEN: " RAILWAY_TOKEN
echo ""

echo "2) Vercel token"
echo "   Open: https://vercel.com/account/tokens"
echo "   Create a token named 'github-actions-bld-online'."
read -rsp "   Paste VERCEL_TOKEN: " VERCEL_TOKEN
echo ""

echo ""
echo "Setting GitHub secrets on $REPO ..."
gh secret set RAILWAY_TOKEN --repo "$REPO" --body "$RAILWAY_TOKEN"
gh secret set VERCEL_TOKEN --repo "$REPO" --body "$VERCEL_TOKEN"

echo ""
echo "Done. Push to main to trigger .github/workflows/deploy-production.yml"
echo "Monitor: https://github.com/$REPO/actions"
