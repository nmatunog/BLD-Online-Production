#!/bin/bash
# Check if required secrets exist in Secret Manager
# Usage: ./scripts/check-secrets.sh

set -e

echo "🔍 Checking secrets in Secret Manager..."
echo ""
echo "Project: bldcebu-portal"
echo ""

# Set project
gcloud config set project bldcebu-portal --quiet

# Required secrets
REQUIRED_SECRETS=(
  "prod-jwt-secret"
  "prod-jwt-refresh-secret"
  "prod-database-url"
)

echo "📋 Required secrets:"
for secret in "${REQUIRED_SECRETS[@]}"; do
  echo "  - $secret"
done
echo ""

# List all secrets
echo "🔍 Checking existing secrets..."
EXISTING_SECRETS=$(gcloud secrets list --format="value(name.basename())" 2>/dev/null || echo "")

if [ -z "$EXISTING_SECRETS" ]; then
  echo "⚠️  No secrets found in Secret Manager"
  echo ""
  echo "📝 Secrets need to be created. Run:"
  echo "   ./scripts/create-secrets.sh"
  exit 1
fi

echo "✅ Existing secrets:"
echo "$EXISTING_SECRETS" | while read -r secret; do
  echo "  - $secret"
done
echo ""

# Check each required secret
MISSING_SECRETS=()
FOUND_SECRETS=()

for secret in "${REQUIRED_SECRETS[@]}"; do
  if echo "$EXISTING_SECRETS" | grep -q "^${secret}$"; then
    FOUND_SECRETS+=("$secret")
    echo "✅ Found: $secret"
    
    # Check if secret has versions
    VERSION_COUNT=$(gcloud secrets versions list "$secret" --format="value(name)" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$VERSION_COUNT" -eq "0" ]; then
      echo "  ⚠️  Warning: Secret exists but has no versions!"
      echo "     Create a version with: gcloud secrets versions add $secret --data-file=-"
    else
      echo "  ✓ Has $VERSION_COUNT version(s)"
    fi
  else
    MISSING_SECRETS+=("$secret")
    echo "❌ Missing: $secret"
  fi
done
echo ""

# Summary
if [ ${#MISSING_SECRETS[@]} -eq 0 ]; then
  echo "✅ All required secrets exist!"
  echo ""
  echo "📝 Next steps:"
  echo "   1. Verify secret values are correct"
  echo "   2. Run: ./scripts/deploy-prod.sh"
else
  echo "❌ Missing secrets: ${MISSING_SECRETS[*]}"
  echo ""
  echo "📝 Create missing secrets:"
  echo "   ./scripts/create-secrets.sh"
  exit 1
fi
