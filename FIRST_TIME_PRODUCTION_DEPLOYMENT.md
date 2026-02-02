# First-Time Production Deployment Guide

This guide covers deploying the **entire system** to production for the first time, including both **code deployment** and **data migration**.

## Understanding the Process

### Two Separate Steps:

1. **Code Deployment** = Deploying the application code (backend + frontend) to production servers
   - This creates empty Cloud Run services
   - Sets up the infrastructure
   - Database is empty at this point

2. **Data Migration** = Copying data from dev database to prod database
   - This populates the production database with your real data
   - Excludes dummy data automatically

### Recommended Order:

**Option A: Deploy Code First, Then Migrate Data (Recommended)**
1. Deploy production code (empty database)
2. Run database migrations (create schema)
3. Migrate data from dev to prod

**Option B: Migrate Data First, Then Deploy Code**
1. Create production database
2. Run migrations on production database
3. Migrate data from dev to prod
4. Deploy production code

## Step-by-Step: First Production Deployment

### Step 1: Set Up Production Database

```bash
# Switch to production project
gcloud config set project bldcebu-portal
firebase use prod

# Create Cloud SQL instance
gcloud sql instances create bld-portal-db \
  --database-version=POSTGRES_15 \
  --tier=db-n1-standard-1 \
  --region=asia-southeast1 \
  --root-password=YOUR_SECURE_PASSWORD

# Create database
gcloud sql databases create bld_portal \
  --instance=bld-portal-db
```

### Step 2: Create Production Secrets

```bash
# Generate strong random secrets (DIFFERENT from dev!)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Run twice to get JWT_SECRET and JWT_REFRESH_SECRET

# Create secrets in Secret Manager
echo -n "your-prod-jwt-secret" | gcloud secrets create prod-jwt-secret --data-file=-
echo -n "your-prod-refresh-secret" | gcloud secrets create prod-jwt-refresh-secret --data-file=-

# Create database URL secret
echo -n "postgresql://postgres:PASSWORD@/bld_portal?host=/cloudsql/bldcebu-portal:asia-southeast1:bld-portal-db" | \
  gcloud secrets create prod-database-url --data-file=-
```

### Step 3: Run Database Migrations on Production

```bash
# Option A: Using Cloud SQL Proxy
cloud-sql-proxy bldcebu-portal:asia-southeast1:bld-portal-db

# In another terminal:
cd backend
DATABASE_URL="postgresql://postgres:PASSWORD@127.0.0.1:5432/bld_portal" \
  npx prisma migrate deploy
```

This creates the database schema (tables, relationships) but **no data yet**.

### Step 4: Migrate Data from Dev to Prod

Now copy your real data (excluding dummy data):

```bash
# Set up Cloud SQL Proxy for both databases
# Terminal 1: Dev
cloud-sql-proxy bld-cebu-portal-dev:asia-southeast1:bld-portal-db-dev --port 5432

# Terminal 2: Prod
cloud-sql-proxy bldcebu-portal:asia-southeast1:bld-portal-db --port 5433

# Terminal 3: Run migration
cd backend
DEV_DATABASE_URL="postgresql://postgres:DEV_PASSWORD@127.0.0.1:5432/bld_portal_dev" \
PROD_DATABASE_URL="postgresql://postgres:PROD_PASSWORD@127.0.0.1:5433/bld_portal" \
npx ts-node scripts/migrate-dev-to-prod.ts
```

This copies all your real data to production, excluding dummy data.

### Step 5: Deploy Production Code

```bash
# Make sure you're in production project
firebase use prod
gcloud config set project bldcebu-portal

# Deploy
./scripts/deploy-prod.sh
```

This deploys:
- Backend API to Cloud Run
- Frontend app to Cloud Run
- Firebase Hosting configuration

### Step 6: Verify Production Deployment

- [ ] Backend API is accessible: `https://backend-url/api/docs`
- [ ] Frontend loads correctly
- [ ] Can log in with migrated users
- [ ] Data is visible (events, members, etc.)
- [ ] No dummy data exists in production

## Complete Deployment Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ 1. Create Production Database                           │
│    - Cloud SQL instance: bld-portal-db                  │
│    - Database: bld_portal                               │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Create Production Secrets                            │
│    - prod-jwt-secret                                    │
│    - prod-jwt-refresh-secret                            │
│    - prod-database-url                                   │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Run Database Migrations                              │
│    - Creates schema (tables, relationships)            │
│    - Database is empty (no data)                        │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Migrate Data from Dev to Prod                        │
│    - Copies users, members, events, etc.                 │
│    - EXCLUDES dummy data automatically                  │
│    - Dev database remains unchanged                     │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Deploy Production Code                               │
│    - Backend to Cloud Run                               │
│    - Frontend to Cloud Run                              │
│    - Firebase Hosting                                   │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Verify & Test                                         │
│    - Test login, features, data                         │
│    - Confirm no dummy data                              │
└─────────────────────────────────────────────────────────┘
```

## What "Migration" Means

**Data Migration** = Copying data from one database to another
- Source: Development database (`bld_portal_dev`)
- Target: Production database (`bld_portal`)
- Process: Reads from dev, writes to prod
- Result: Production has all your real data (no dummy data)

**Code Deployment** = Deploying application code to servers
- Backend: NestJS API → Cloud Run
- Frontend: Next.js app → Cloud Run
- Routing: Firebase Hosting → Cloud Run services

## Summary

For first-time production deployment, you need to:

1. ✅ **Create production infrastructure** (database, secrets)
2. ✅ **Run migrations** (create database schema)
3. ✅ **Migrate data** (copy real data from dev, exclude dummy)
4. ✅ **Deploy code** (deploy backend + frontend to Cloud Run)
5. ✅ **Verify** (test everything works)

The migration script handles step 3 (copying data). Steps 1, 2, 4, and 5 are separate.

## Quick Command Reference

```bash
# 1. Create database
gcloud sql instances create bld-portal-db ...

# 2. Create secrets
gcloud secrets create prod-jwt-secret ...

# 3. Run migrations
npx prisma migrate deploy

# 4. Migrate data
npx ts-node scripts/migrate-dev-to-prod.ts

# 5. Deploy code
./scripts/deploy-prod.sh
```

Would you like me to create a single script that does all of this in the correct order?
