#!/usr/bin/env bash
# Push to production – status check and exact commands.
# Run the printed commands from your machine (Cursor or Terminal); do not rely on this script to push (auth required).
set -e
cd "$(git rev-parse --show-toplevel)"

echo "=== Remotes ==="
git remote -v
echo ""

echo "=== Branch ==="
git branch --show-current
echo ""

echo "=== Unpushed commits (ahead of origin/main) ==="
AHEAD_ORIGIN=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "?")
echo "  origin/main: $AHEAD_ORIGIN commits ahead"
AHEAD_PROD=$(git rev-list --count production/main..HEAD 2>/dev/null || echo "?")
echo "  production/main: $AHEAD_PROD commits ahead"
echo ""

echo "=== Latest 3 commits (what will be pushed) ==="
git log -3 --oneline
echo ""

echo "=============================================="
echo "PUSH FROM YOUR MACHINE (Cursor or Terminal)"
echo "=============================================="
echo ""
echo "1. If Railway AND Vercel use: nmatunog/BLDCebu-Online-Portal"
echo "   Run:  git push origin main"
echo ""
echo "2. If Railway AND Vercel use: nmatunog/BLD-Online-Production"
echo "   Run:  git push production main"
echo ""
echo "3. If unsure or they use different repos, run BOTH:"
echo "   git push origin main"
echo "   git push production main"
echo ""
echo "Check which repo each uses: Railway Dashboard → backend → Settings → Connected Repository; Vercel → project → Settings → Git."
echo "See docs/PUSH_TO_PRODUCTION.md for full checklist."
echo ""
