# Migrate Development to Production Guide

This guide covers migrating **data only** from the development environment to production, **excluding dummy data**.

## Important: This is Data Migration Only

- **What this does**: Copies data from dev database to prod database
- **What this does NOT do**: Deploy application code (use `./scripts/deploy-prod.sh` for that)
- **When to use**: After production code is deployed and database schema exists

## Overview

- **Source**: `bld-cebu-portal-dev` (Development database)
- **Target**: `bldcebu-portal` (Production database)
- **Excludes**: All data marked with `[DUMMY]` or containing `DUMMY` in names/descriptions
- **Preserves**: Development database remains unchanged (read-only)

## Prerequisites

1. ✅ Development database has been deployed and contains data
2. ✅ Production database is created and empty (or ready to be overwritten)
3. ✅ Both databases are accessible
4. ✅ You have admin access to both databases

## Step 1: Set Up Database Access

### Option A: Using Cloud SQL Proxy (Recommended)

**Terminal 1 - Dev Database:**
```bash
cloud-sql-proxy bld-cebu-portal-dev:asia-southeast1:bld-portal-db-dev \
  --port 5432
```

**Terminal 2 - Prod Database:**
```bash
cloud-sql-proxy bldcebu-portal:asia-southeast1:bld-portal-db \
  --port 5433
```

**Terminal 3 - Run Migration:**
```bash
cd backend

DEV_DATABASE_URL="postgresql://postgres:DEV_PASSWORD@127.0.0.1:5432/bld_portal_dev" \
PROD_DATABASE_URL="postgresql://postgres:PROD_PASSWORD@127.0.0.1:5433/bld_portal" \
npx ts-node scripts/migrate-dev-to-prod.ts
```

### Option B: Direct Connection (If IPs are whitelisted)

```bash
cd backend

DEV_DATABASE_URL="postgresql://postgres:PASSWORD@DEV_IP:5432/bld_portal_dev" \
PROD_DATABASE_URL="postgresql://postgres:PASSWORD@PROD_IP:5432/bld_portal" \
npx ts-node scripts/migrate-dev-to-prod.ts
```

### Option C: Using Cloud SQL Connection Strings

```bash
cd backend

DEV_DATABASE_URL="postgresql://postgres:PASSWORD@/bld_portal_dev?host=/cloudsql/bld-cebu-portal-dev:asia-southeast1:bld-portal-db-dev" \
PROD_DATABASE_URL="postgresql://postgres:PASSWORD@/bld_portal?host=/cloudsql/bldcebu-portal:asia-southeast1:bld-portal-db" \
npx ts-node scripts/migrate-dev-to-prod.ts
```

## Step 2: Review What Will Be Migrated

The migration script will:
- ✅ Migrate all **active users**
- ✅ Migrate all **members** (excluding those with `[DUMMY]` or `DUMMY` in names/communityId)
- ✅ Migrate all **events** (excluding those with `[DUMMY]` in title/description)
- ✅ Migrate all **registrations** (only for non-dummy events/members)
- ✅ Migrate all **attendances** (only for non-dummy events/members)
- ✅ Migrate all **accounting entries** (excluding those with `[DUMMY]` in description)
- ✅ Migrate **class shepherd assignments** for migrated events

## Step 3: Run the Migration

```bash
cd backend

# Set your database URLs
export DEV_DATABASE_URL="postgresql://..."
export PROD_DATABASE_URL="postgresql://..."

# Run migration
npx ts-node scripts/migrate-dev-to-prod.ts
```

## Step 4: Verify Migration

### Check Production Database

```bash
# Connect to production database
DATABASE_URL="postgresql://..." npx prisma studio
```

Or use SQL:
```sql
-- Count records
SELECT 
  (SELECT COUNT(*) FROM "User") as users,
  (SELECT COUNT(*) FROM "Member") as members,
  (SELECT COUNT(*) FROM "Event") as events,
  (SELECT COUNT(*) FROM "EventRegistration") as registrations,
  (SELECT COUNT(*) FROM "Attendance") as attendances;

-- Verify no dummy data
SELECT COUNT(*) FROM "Event" WHERE title ILIKE '%DUMMY%' OR description ILIKE '%DUMMY%';
-- Should return 0

SELECT COUNT(*) FROM "Member" WHERE "firstName" ILIKE '%DUMMY%' OR "lastName" ILIKE '%DUMMY%' OR "communityId" ILIKE '%DUMMY%';
-- Should return 0
```

## Step 5: Deploy Production Code

After data migration, deploy the production code:

```bash
# Switch to production
firebase use prod
gcloud config set project bldcebu-portal

# Deploy
./scripts/deploy-prod.sh
```

## What Gets Excluded (Dummy Data)

The migration script automatically excludes:

1. **Events** with `[DUMMY]` or `DUMMY` in:
   - Title
   - Description

2. **Members** with `[DUMMY]` or `DUMMY` in:
   - First Name
   - Last Name
   - Community ID

3. **Accounting Entries** with `[DUMMY]` or `DUMMY` in:
   - Description

4. **Related Data** automatically excluded:
   - Registrations for dummy events/members
   - Attendances for dummy events/members
   - Accounting entries for dummy events

## Safety Features

- ✅ **Non-destructive**: Development database is read-only (not modified)
- ✅ **Upsert logic**: Uses upsert to handle existing records gracefully
- ✅ **Error handling**: Continues migration even if individual records fail
- ✅ **Detailed logging**: Shows what's migrated and what's skipped
- ✅ **Transaction safety**: Each record is handled independently

## Troubleshooting

### Connection Errors
- Verify both database URLs are correct
- Check Cloud SQL Proxy is running (if using)
- Verify IP whitelisting (if using direct connection)
- Check database credentials

### Foreign Key Errors
- The script migrates in the correct order (users → members → events → related data)
- If errors occur, check that all dependencies are migrated first

### Missing Data
- Check the skipped counts in the summary
- Verify dummy data detection logic matches your data
- Review logs for specific record failures

### Performance
- Large databases may take time
- Consider running during low-traffic periods
- Monitor database connections and resources

## Post-Migration Checklist

- [ ] Verify user count matches (excluding dummy users)
- [ ] Verify member count (should be less than dev due to dummy exclusion)
- [ ] Verify event count (should be less than dev due to dummy exclusion)
- [ ] Test login with migrated users
- [ ] Verify events display correctly
- [ ] Verify member profiles
- [ ] Check accounting entries
- [ ] Verify no dummy data exists in production

## Rollback Plan

If something goes wrong:

1. **Production database can be reset:**
   ```bash
   # Connect to production
   # Drop and recreate database
   # Re-run migrations: npx prisma migrate deploy
   # Re-run data migration
   ```

2. **Development database is safe:**
   - Migration script only reads from dev
   - Dev database remains unchanged

## Next Steps

After successful migration:

1. ✅ Deploy production code (if not already done)
2. ✅ Test all features in production
3. ✅ Create production admin user (if needed)
4. ✅ Set up monitoring and backups
5. ✅ Document production setup
