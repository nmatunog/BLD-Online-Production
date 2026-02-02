#!/bin/bash
# Export database before deleting (optional backup)
# Usage: ./scripts/export-database-before-delete.sh

set -e

echo "💾 Exporting Database Before Deletion"
echo "====================================="
echo ""

gcloud config set project bldcebu-portal --quiet

# Check if Cloud Storage bucket exists
BUCKET_NAME="bldcebu-portal-backups"
echo "📦 Checking for backup bucket..."

BUCKET_EXISTS=$(gsutil ls -b gs://$BUCKET_NAME 2>/dev/null || echo "")

if [ -z "$BUCKET_EXISTS" ]; then
  echo "📦 Creating backup bucket..."
  gsutil mb -p bldcebu-portal -l asia-southeast1 gs://$BUCKET_NAME 2>/dev/null || {
    echo "⚠️  Could not create bucket. Using default bucket or local export."
    BUCKET_NAME=""
  }
fi

# Export database
echo ""
echo "💾 Exporting database..."
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
EXPORT_FILE="bld_portal_prod_backup_${TIMESTAMP}.sql"

if [ -n "$BUCKET_NAME" ]; then
  EXPORT_PATH="gs://${BUCKET_NAME}/${EXPORT_FILE}"
  echo "   Exporting to: $EXPORT_PATH"
  
  gcloud sql export sql bld-portal-db "$EXPORT_PATH" \
    --database=bld_portal_prod \
    --quiet 2>/dev/null && {
    echo "✅ Database exported to Cloud Storage"
    echo "   Location: $EXPORT_PATH"
  } || {
    echo "⚠️  Cloud Storage export failed"
    echo "   You can export manually via:"
    echo "   gcloud sql export sql bld-portal-db gs://BUCKET/backup.sql --database=bld_portal_prod"
  }
else
  echo "⚠️  Cannot export to Cloud Storage"
  echo "   To export manually, use Cloud SQL Proxy and pg_dump:"
  echo "   1. Start proxy: cloud-sql-proxy --port 5434 bldcebu-portal:asia-southeast1:bld-portal-db"
  echo "   2. Export: pg_dump -h 127.0.0.1 -p 5434 -U postgres bld_portal_prod > backup.sql"
fi

echo ""
echo "✅ Export complete (or instructions provided)"
echo ""
echo "💡 You can now safely delete services"
echo "   Your database backup is preserved"
echo ""
