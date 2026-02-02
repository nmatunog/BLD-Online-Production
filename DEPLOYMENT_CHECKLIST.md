# Pre-Deployment Checklist

Use this checklist before deploying to ensure everything is configured correctly.

## ✅ Current Status

### Firebase Projects
- ✅ **Dev**: `bld-cebu-portal-dev` (currently active)
- ✅ **Prod**: `bldcebu-portal`

### Verification Commands
```bash
# Check Firebase project
firebase use
# Should show: bld-cebu-portal-dev (for dev) or bldcebu-portal (for prod)

# Check Google Cloud project
gcloud config get-value project
# Should match Firebase project
```

## Pre-Deployment Checklist

### 1. Code Preparation
- [ ] All changes committed to git
- [ ] Code tested locally
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Dummy data scripts are NOT in production build (they're in scripts/ only)

### 2. Database Setup

#### Development
- [ ] Cloud SQL instance `bld-portal-db-dev` created
- [ ] Database `bld_portal_dev` created
- [ ] Connection string obtained
- [ ] Migrations ready to run

#### Production
- [ ] Cloud SQL instance `bld-portal-db` created
- [ ] Database `bld_portal` created
- [ ] Connection string obtained
- [ ] Migrations ready to run
- [ ] Database backup configured

### 3. Environment Variables

#### Development Secrets (Secret Manager)
- [ ] `dev-jwt-secret` created
- [ ] `dev-jwt-refresh-secret` created
- [ ] `dev-database-url` created
- [ ] Cloud Run service account has access

#### Production Secrets (Secret Manager)
- [ ] `prod-jwt-secret` created (DIFFERENT from dev)
- [ ] `prod-jwt-refresh-secret` created (DIFFERENT from dev)
- [ ] `prod-database-url` created
- [ ] Cloud Run service account has access

### 4. Google Cloud Resources

#### Development
- [ ] Project `bld-cebu-portal-dev` is active
- [ ] Cloud Run API enabled
- [ ] Cloud SQL Admin API enabled
- [ ] Secret Manager API enabled
- [ ] Service accounts configured

#### Production
- [ ] Project `bldcebu-portal` is active
- [ ] Cloud Run API enabled
- [ ] Cloud SQL Admin API enabled
- [ ] Secret Manager API enabled
- [ ] Service accounts configured

### 5. Domain Configuration
- [ ] Dev domain: `dev.yourdomain.com` (if using custom domain)
- [ ] Prod domain: `yourdomain.com` (if using custom domain)
- [ ] DNS records configured
- [ ] SSL certificates ready

### 6. Deployment Scripts
- [ ] `scripts/deploy-dev.sh` is executable
- [ ] `scripts/deploy-prod.sh` is executable
- [ ] Scripts have correct project IDs
- [ ] Scripts have correct service names

## Deployment Steps

### Development Deployment

1. **Verify Environment**
   ```bash
   firebase use dev
   gcloud config set project bld-cebu-portal-dev
   ```

2. **Create Database** (if not exists)
   ```bash
   gcloud sql instances create bld-portal-db-dev \
     --database-version=POSTGRES_15 \
     --tier=db-f1-micro \
     --region=asia-southeast1
   
   gcloud sql databases create bld_portal_dev \
     --instance=bld-portal-db-dev
   ```

3. **Create Secrets** (if not exists)
   ```bash
   # Generate secrets
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Create secrets
   echo -n "your-secret" | gcloud secrets create dev-jwt-secret --data-file=-
   echo -n "your-secret" | gcloud secrets create dev-jwt-refresh-secret --data-file=-
   echo -n "postgresql://..." | gcloud secrets create dev-database-url --data-file=-
   ```

4. **Deploy**
   ```bash
   ./scripts/deploy-dev.sh
   ```

5. **Run Migrations**
   ```bash
   # Using Cloud SQL Proxy
   cloud-sql-proxy bld-cebu-portal-dev:asia-southeast1:bld-portal-db-dev
   # In another terminal:
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```

### Production Deployment

1. **Verify Environment**
   ```bash
   firebase use prod
   gcloud config set project bldcebu-portal
   ```

2. **Create Database** (if not exists)
   ```bash
   gcloud sql instances create bld-portal-db \
     --database-version=POSTGRES_15 \
     --tier=db-n1-standard-1 \
     --region=asia-southeast1
   
   gcloud sql databases create bld_portal \
     --instance=bld-portal-db
   ```

3. **Create Secrets** (if not exists)
   ```bash
   # Generate DIFFERENT secrets for production
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Create secrets
   echo -n "your-prod-secret" | gcloud secrets create prod-jwt-secret --data-file=-
   echo -n "your-prod-secret" | gcloud secrets create prod-jwt-refresh-secret --data-file=-
   echo -n "postgresql://..." | gcloud secrets create prod-database-url --data-file=-
   ```

4. **Deploy** (with confirmation)
   ```bash
   ./scripts/deploy-prod.sh
   ```

5. **Run Migrations**
   ```bash
   # Using Cloud SQL Proxy
   cloud-sql-proxy bldcebu-portal:asia-southeast1:bld-portal-db
   # In another terminal:
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```

## Post-Deployment Verification

### Backend
- [ ] API docs accessible: `https://backend-url/api/docs`
- [ ] Health check passes (if implemented)
- [ ] Database connection works
- [ ] No errors in logs

### Frontend
- [ ] Frontend loads correctly
- [ ] Can navigate to login page
- [ ] API calls work (check browser console)
- [ ] No console errors

### Integration
- [ ] Can log in with admin account
- [ ] Can create events
- [ ] Can create members
- [ ] QR codes generate correctly
- [ ] Public check-in works

## Troubleshooting

### Wrong Project Active
```bash
# Check current project
firebase use
gcloud config get-value project

# Switch if needed
firebase use dev  # or prod
gcloud config set project bld-cebu-portal-dev  # or bldcebu-portal
```

### Service Not Found
- Verify service name matches environment (has `-dev` suffix for dev)
- Check service exists: `gcloud run services list --region asia-southeast1`

### Database Connection Failed
- Verify Cloud SQL instance name
- Check connection string format
- Verify Cloud Run has Cloud SQL access

### Secrets Not Found
- Verify secret names (should have `dev-` or `prod-` prefix)
- Check service account has Secret Manager access
- Verify secrets exist: `gcloud secrets list`
