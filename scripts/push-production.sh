#!/usr/bin/env bash
# Push current branch to production repo (BLD-Online-Production).
# Vercel builds from this repo.
set -e
BRANCH=$(git branch --show-current)
echo "Pushing $BRANCH to production (github.com/nmatunog/BLD-Online-Production)..."
git push production "$BRANCH"
echo "Done. Vercel will auto-deploy from production repo."
