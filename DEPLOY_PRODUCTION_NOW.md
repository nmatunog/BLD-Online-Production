# Deploy Code to Production - Step by Step

Follow these steps to deploy your code to production.

## Pre-Deployment Checklist

Before deploying, ensure:

- [ ] You're logged into Google Cloud: `gcloud auth login`
- [ ] You're logged into Firebase: `firebase login`
- [ ] Production database exists: `bld-portal-db`
- [ ] Production secrets exist in Secret Manager:
  - `prod-jwt-secret`
  - `prod-jwt-refresh-secret`
  - `prod-database-url`
- [ ] You have the backend Cloud Run service URL (for frontend env vars)

## Step 1: Verify Current Environment

```bash
# Check Firebase project
firebase use
# Should show: prod (bldcebu-portal)

# Check Google Cloud project
gcloud config get-value project
# Should show: bldcebu-portal

# If not correct, switch:
firebase use prod
gcloud config set project bldcebu-portal
```

## Step 2: Verify Production Database Exists

```bash
# Check if database instance exists
gcloud sql instances list --filter="name:bld-portal-db"

# If it doesn't exist, create it first:
gcloud sql instances create bld-portal-db \
  --database-version=POSTGRES_15 \
  --tier=db-n1-standard-1 \
  --region=asia-southeast1 \
  --root-password=YOUR_SECURE_PASSWORD

gcloud sql databases create bld_portal \
  --instance=bld-portal-db
```

## Step 3: Verify Production Secrets Exist

```bash
# List secrets
gcloud secrets list --filter="name:prod-"

# Should see:
# - prod-jwt-secret
# - prod-jwt-refresh-secret
# - prod-database-url

# If missing, create them:
# Generate secrets:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Run twice to get two different secrets

# Create secrets:
echo -n "your-jwt-secret" | gcloud secrets create prod-jwt-secret --data-file=-
echo -n "your-refresh-secret" | gcloud secrets create prod-jwt-refresh-secret --data-file=-
echo -n "postgresql://postgres:PASSWORD@/bld_portal?host=/cloudsql/bldcebu-portal:asia-southeast1:bld-portal-db" | \
  gcloud secrets create prod-database-url --data-file=-
```

## Step 4: Run Database Migrations (If Not Done)

```bash
# Set up Cloud SQL Proxy
cloud-sql-proxy bldcebu-portal:asia-southeast1:bld-portal-db

# In another terminal:
cd backend
DATABASE_URL="postgresql://postgres:PASSWORD@127.0.0.1:5432/bld_portal" \
  npx prisma migrate deploy
```

## Step 5: Deploy Production Code

```bash
# Make sure script is executable
chmod +x scripts/deploy-prod.sh

# Run deployment
./scripts/deploy-prod.sh
```

The script will:
1. Deploy backend to Cloud Run (`bld-portal-backend`)
2. Deploy frontend to Cloud Run (`bld-portal-frontend`)
3. Deploy Firebase Hosting configuration

## Step 6: Get Service URLs

After deployment, get the URLs:

```bash
# Backend URL
gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --format="value(status.url)"

# Frontend URL
gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="value(status.url)"
```

## Step 7: Update Frontend Environment Variables (If Needed)

If the frontend needs the backend URL, update it:

```bash
# Get backend URL first
BACKEND_URL=$(gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --format="value(status.url)")

# Update frontend service
gcloud run services update bld-portal-frontend \
  --region asia-southeast1 \
  --set-env-vars "NEXT_PUBLIC_API_BASE_URL=$BACKEND_URL,NEXT_PUBLIC_API_URL=$BACKEND_URL/api/v1"
```

## Step 8: Verify Deployment

- [ ] Backend API accessible: `https://backend-url/api/docs`
- [ ] Frontend loads: `https://frontend-url` or Firebase Hosting URL
- [ ] No errors in Cloud Run logs
- [ ] Database connection works

## Troubleshooting

### Deployment Fails
- Check Cloud Run API is enabled: `gcloud services enable run.googleapis.com`
- Verify you have permissions
- Check build logs for errors

### Backend Can't Connect to Database
- Verify Cloud SQL instance name is correct
- Check `--add-cloudsql-instances` parameter
- Verify database URL secret is correct

### Frontend Can't Connect to Backend
- Verify `NEXT_PUBLIC_API_BASE_URL` is set correctly
- Check CORS configuration in backend
- Verify backend URL is accessible

## Next Steps After Code Deployment

1. **Migrate Data** (if you have data in dev):
   ```bash
   ./scripts/migrate-to-prod.sh
   ```

2. **Create Admin User** (if needed):
   ```bash
   DATABASE_URL="postgresql://..." npx ts-node scripts/create-admin-user.ts
   ```

3. **Test Production**:
   - Test login
   - Test creating events
   - Test creating members
   - Verify all features work
