# Troubleshooting Deployment Issues

## Backend Container Failed to Start

If you see: "The user-provided container failed to start and listen on the port"

### Step 1: Check Cloud Run Logs

View the logs to see the actual error:

```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-backend" \
  --limit 50 \
  --project=bldcebu-portal \
  --format=json
```

Or view in console:
https://console.cloud.google.com/logs/viewer?project=bldcebu-portal

### Step 2: Common Issues

#### 1. Database Connection Failed

**Symptoms:**
- Error about database connection
- Prisma connection timeout
- "ECONNREFUSED" errors

**Solutions:**
- Verify database instance is running:
  ```bash
  gcloud sql instances describe bld-portal-db --project=bldcebu-portal
  ```
- Check database URL secret is correct:
  ```bash
  gcloud secrets versions access latest --secret=prod-database-url --project=bldcebu-portal
  ```
- Ensure Cloud Run has access to Cloud SQL:
  - The `--add-cloudsql-instances` flag should be set
  - Service account needs Cloud SQL Client role

#### 2. Missing Environment Variables

**Symptoms:**
- JWT_SECRET errors
- DATABASE_URL errors

**Solutions:**
- Verify secrets exist:
  ```bash
  ./scripts/check-secrets.sh
  ```
- Check secret versions:
  ```bash
  gcloud secrets versions list prod-jwt-secret --project=bldcebu-portal
  gcloud secrets versions list prod-database-url --project=bldcebu-portal
  ```

#### 3. Application Startup Errors

**Symptoms:**
- Module not found errors
- TypeScript compilation errors
- Missing dependencies

**Solutions:**
- Check Dockerfile builds correctly locally:
  ```bash
  cd backend
  docker build -t test-backend .
  docker run -p 4000:4000 test-backend
  ```
- Verify all dependencies are in package.json
- Check for TypeScript errors:
  ```bash
  cd backend
  npm run build
  ```

#### 4. Port Configuration

**Symptoms:**
- "Failed to listen on port" errors

**Solutions:**
- Cloud Run automatically sets PORT environment variable
- Backend should use: `process.env.PORT || 4000`
- Verify in main.ts that port is correctly configured

### Step 3: Test Locally with Production Environment

Test the backend locally with production-like environment:

```bash
cd backend

# Set environment variables
export DATABASE_URL="postgresql://postgres:PASSWORD@/bld_portal_prod?host=/cloudsql/bldcebu-portal:asia-southeast1:bld-portal-db"
export JWT_SECRET="your-jwt-secret"
export JWT_REFRESH_SECRET="your-refresh-secret"
export NODE_ENV=production
export API_PREFIX=api/v1
export FRONTEND_URL=https://bldcebu-portal.web.app
export PORT=4000

# Run migrations
npx prisma migrate deploy

# Start the server
npm run start:prod
```

### Step 4: Check Database Migrations

Ensure database schema is up to date:

```bash
# Connect to Cloud SQL
gcloud sql connect bld-portal-db --user=postgres --project=bldcebu-portal

# Or run migrations via Cloud Run
gcloud run services update bld-portal-backend \
  --region asia-southeast1 \
  --update-env-vars "RUN_MIGRATIONS=true" \
  --project=bldcebu-portal
```

### Step 5: Increase Startup Timeout

If the app takes time to start (e.g., running migrations), increase timeout:

```bash
gcloud run services update bld-portal-backend \
  --timeout 600 \
  --region asia-southeast1 \
  --project=bldcebu-portal
```

### Step 6: Check Service Account Permissions

Ensure Cloud Run service account has necessary permissions:

```bash
PROJECT_NUMBER=$(gcloud projects describe bldcebu-portal --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding bldcebu-portal \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudsql.client"
```

## Quick Fix Commands

### View Recent Logs
```bash
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bld-portal-backend" \
  --limit 20 \
  --project=bldcebu-portal \
  --format="table(timestamp,textPayload)"
```

### Redeploy with Debugging
```bash
cd backend
gcloud run deploy bld-portal-backend \
  --source . \
  --region asia-southeast1 \
  --set-env-vars "NODE_ENV=production,LOG_LEVEL=debug" \
  --project=bldcebu-portal
```

### Check Service Status
```bash
gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --project=bldcebu-portal \
  --format="value(status.conditions)"
```
