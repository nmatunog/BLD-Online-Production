# Firebase + Cloud Run Deployment Guide

This guide covers deploying both frontend and backend to Firebase/Google Cloud Platform.

## Architecture Overview

- **Frontend**: Next.js app deployed to Cloud Run
- **Backend**: NestJS API deployed to Cloud Run  
- **Database**: Cloud SQL (PostgreSQL)
- **Routing**: Firebase Hosting routes requests to Cloud Run services
- **Region**: `asia-southeast1` (Singapore) - recommended for Philippines

## Prerequisites

### 1. Install Required Tools

```bash
# Install Google Cloud SDK
# macOS:
brew install google-cloud-sdk

# Or download from: https://cloud.google.com/sdk/docs/install

# Install Firebase CLI
npm install -g firebase-tools
```

### 2. Authenticate

```bash
# Login to Google Cloud
gcloud auth login

# Login to Firebase
firebase login

# Set default project (replace with your project ID)
gcloud config set project YOUR_PROJECT_ID
```

### 3. Enable Required APIs

```bash
# Enable Cloud Run API
gcloud services enable run.googleapis.com

# Enable Cloud SQL Admin API
gcloud services enable sqladmin.googleapis.com

# Enable Secret Manager API (for secure env vars)
gcloud services enable secretmanager.googleapis.com
```

## Step 1: Set Up Cloud SQL Database

### 1.1 Create PostgreSQL Instance

```bash
gcloud sql instances create bld-portal-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-southeast1 \
  --root-password=YOUR_SECURE_PASSWORD
```

**Note**: For production, use a higher tier (e.g., `db-n1-standard-1`)

### 1.2 Create Database

```bash
gcloud sql databases create bld_portal \
  --instance=bld-portal-db
```

### 1.3 Get Connection Name

```bash
# Get instance connection name
gcloud sql instances describe bld-portal-db \
  --format="value(connectionName)"

# Save this value - you'll need it for Cloud Run
# Format: PROJECT_ID:REGION:INSTANCE_NAME
```

### 1.4 Get Database Connection String

```bash
# Get public IP
gcloud sql instances describe bld-portal-db \
  --format="value(ipAddresses[0].ipAddress)"

# Connection string format:
# postgresql://postgres:PASSWORD@PUBLIC_IP:5432/bld_portal
```

## Step 2: Set Up Environment Variables (Secret Manager)

### 2.1 Create Secrets

```bash
# JWT Secret
echo -n "your-jwt-secret-here" | gcloud secrets create jwt-secret --data-file=-

# JWT Refresh Secret
echo -n "your-jwt-refresh-secret-here" | gcloud secrets create jwt-refresh-secret --data-file=-

# Database URL (use Cloud SQL connection)
echo -n "postgresql://postgres:PASSWORD@/bld_portal?host=/cloudsql/PROJECT:REGION:INSTANCE" | \
  gcloud secrets create database-url --data-file=-
```

### 2.2 Grant Cloud Run Access

```bash
# Grant access to secrets
gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:YOUR_SERVICE_ACCOUNT@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Repeat for other secrets
```

## Step 3: Deploy Backend to Cloud Run

### 3.1 Build and Deploy

From the `backend/` directory:

```bash
gcloud run deploy bld-portal-backend \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 4000 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "API_PREFIX=api/v1,FRONTEND_URL=https://your-domain.com,NODE_ENV=production" \
  --set-secrets "JWT_SECRET=jwt-secret:latest,JWT_REFRESH_SECRET=jwt-refresh-secret:latest,DATABASE_URL=database-url:latest" \
  --add-cloudsql-instances PROJECT_ID:asia-southeast1:bld-portal-db
```

### 3.2 Get Backend URL

After deployment, note the service URL:
```bash
gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --format="value(status.url)"
```

## Step 4: Run Database Migrations

### 4.1 Connect and Migrate

```bash
# Option 1: Using Cloud SQL Proxy (recommended)
# Install Cloud SQL Proxy
# macOS:
brew install cloud-sql-proxy

# Start proxy
cloud-sql-proxy PROJECT_ID:asia-southeast1:bld-portal-db

# In another terminal, run migrations
cd backend
DATABASE_URL="postgresql://postgres:PASSWORD@127.0.0.1:5432/bld_portal" \
  npx prisma migrate deploy

# Option 2: Using Cloud Run Job (one-time)
# Create a migration job
gcloud run jobs create migrate-db \
  --image gcr.io/PROJECT_ID/bld-portal-backend \
  --region asia-southeast1 \
  --set-secrets "DATABASE_URL=database-url:latest" \
  --command "npx" \
  --args "prisma,migrate,deploy" \
  --add-cloudsql-instances PROJECT_ID:asia-southeast1:bld-portal-db

# Execute the job
gcloud run jobs execute migrate-db --region asia-southeast1
```

## Step 5: Deploy Frontend to Cloud Run

### 5.1 Build and Deploy

From the `frontend/` directory:

```bash
gcloud run deploy bld-portal-frontend \
  --source . \
  --region asia-southeast1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "NEXT_PUBLIC_API_BASE_URL=https://BACKEND_URL,NEXT_PUBLIC_API_URL=https://BACKEND_URL/api/v1,NODE_ENV=production"
```

**Important**: Replace `BACKEND_URL` with the actual backend Cloud Run URL from Step 3.2

### 5.2 Get Frontend URL

```bash
gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --format="value(status.url)"
```

## Step 6: Configure Firebase Hosting

### 6.1 Update firebase.json

Ensure your `firebase.json` has the correct service names:

```json
{
  "hosting": {
    "public": "frontend/public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "bld-portal-backend",
          "region": "asia-southeast1"
        }
      },
      {
        "source": "**",
        "run": {
          "serviceId": "bld-portal-frontend",
          "region": "asia-southeast1"
        }
      }
    ]
  }
}
```

### 6.2 Deploy Firebase Hosting

```bash
# From project root
firebase deploy --only hosting
```

### 6.3 Get Hosting URL

After deployment, Firebase will provide a hosting URL:
```
https://YOUR_PROJECT_ID.web.app
```

Or use your custom domain if configured.

## Step 7: Create First Admin User

### 7.1 Using Cloud SQL Proxy

```bash
# Start proxy (if not already running)
cloud-sql-proxy PROJECT_ID:asia-southeast1:bld-portal-db

# In another terminal
cd backend
DATABASE_URL="postgresql://postgres:PASSWORD@127.0.0.1:5432/bld_portal" \
  npx ts-node scripts/create-admin-user.ts
```

### 7.2 Using Cloud Run Job

```bash
# Create a job for creating admin user
gcloud run jobs create create-admin \
  --image gcr.io/PROJECT_ID/bld-portal-backend \
  --region asia-southeast1 \
  --set-secrets "DATABASE_URL=database-url:latest" \
  --command "npx" \
  --args "ts-node,scripts/create-admin-user.ts" \
  --add-cloudsql-instances PROJECT_ID:asia-southeast1:bld-portal-db \
  --interactive

# Execute interactively
gcloud run jobs execute create-admin --region asia-southeast1
```

## Step 8: Verify Deployment

### 8.1 Test Backend

```bash
# Test API docs
curl https://YOUR_HOSTING_URL/api/docs

# Test public endpoint
curl https://YOUR_HOSTING_URL/api/v1/events/public/SOME_EVENT_ID
```

### 8.2 Test Frontend

- Visit: `https://YOUR_HOSTING_URL`
- Should load the login page
- Check browser console for errors
- Test login with admin account

## Environment Variables Summary

### Backend (Cloud Run)
```bash
API_PREFIX=api/v1
FRONTEND_URL=https://your-hosting-url.com
NODE_ENV=production
PORT=4000
JWT_SECRET=<from Secret Manager>
JWT_REFRESH_SECRET=<from Secret Manager>
DATABASE_URL=<from Secret Manager>
```

### Frontend (Cloud Run)
```bash
NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.run.app
NEXT_PUBLIC_API_URL=https://your-backend-url.run.app/api/v1
NODE_ENV=production
PORT=8080
```

## Updating Deployments

### Update Backend

```bash
cd backend
gcloud run deploy bld-portal-backend \
  --source . \
  --region asia-southeast1
```

### Update Frontend

```bash
cd frontend
gcloud run deploy bld-portal-frontend \
  --source . \
  --region asia-southeast1
```

### Update Hosting Configuration

```bash
firebase deploy --only hosting
```

## Cost Optimization

### Development
- Use `db-f1-micro` for Cloud SQL
- Use minimal Cloud Run resources (256Mi memory, 1 CPU)
- Set `--max-instances 1` to limit scaling

### Production
- Use `db-n1-standard-1` or higher for Cloud SQL
- Use appropriate Cloud Run resources (512Mi+ memory)
- Set appropriate `--max-instances` based on traffic
- Enable Cloud SQL connection pooling

## Troubleshooting

### Backend Issues
- **Connection refused**: Check Cloud SQL instance is running
- **Database connection failed**: Verify connection name and secrets
- **401 Unauthorized**: Check JWT secrets are set correctly

### Frontend Issues
- **Can't connect to API**: Verify `NEXT_PUBLIC_API_BASE_URL` is correct
- **Build fails**: Check Dockerfile and build logs
- **Routing issues**: Verify `firebase.json` rewrites are correct

### Database Issues
- **Migration fails**: Check database permissions and connection
- **Connection timeout**: Verify Cloud SQL instance is accessible
- **Slow queries**: Consider connection pooling or upgrading instance

## Security Checklist

- [ ] Cloud SQL instance has private IP (recommended)
- [ ] Secrets are stored in Secret Manager
- [ ] Cloud Run services have proper IAM roles
- [ ] CORS is configured correctly
- [ ] HTTPS is enforced
- [ ] Database backups are enabled
- [ ] Access logs are monitored

## Next Steps

1. Set up custom domain in Firebase Hosting
2. Configure SSL certificates
3. Set up monitoring and alerts
4. Configure database backups
5. Set up CI/CD pipeline (optional)

## Quick Reference Commands

```bash
# List Cloud Run services
gcloud run services list --region asia-southeast1

# View backend logs
gcloud run services logs read bld-portal-backend --region asia-southeast1

# View frontend logs
gcloud run services logs read bld-portal-frontend --region asia-southeast1

# Update environment variables
gcloud run services update bld-portal-backend \
  --region asia-southeast1 \
  --set-env-vars "NEW_VAR=value"

# Scale services
gcloud run services update bld-portal-backend \
  --region asia-southeast1 \
  --min-instances 1 \
  --max-instances 10
```
