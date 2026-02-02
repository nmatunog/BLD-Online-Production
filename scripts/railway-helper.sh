#!/bin/bash
# Railway CLI helper - uses npx to avoid global install
# Usage: ./scripts/railway-helper.sh [command] [args...]

set -e

# Use npx to run Railway CLI
npx @railway/cli "$@"
