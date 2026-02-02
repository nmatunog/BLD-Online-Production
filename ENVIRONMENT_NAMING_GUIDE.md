# Environment Naming Convention Guide

This guide ensures clear separation between **Development** and **Production** environments to avoid confusion and conflicts.

## Naming Convention Summary

| Resource Type | Development | Production |
|--------------|-------------|------------|
| **Firebase Project** | `bld-cebu-portal-dev` | `bldcebu-portal` |
| **Cloud Run Backend** | `bld-portal-backend-dev` | `bld-portal-backend` |
| **Cloud Run Frontend** | `bld-portal-frontend-dev` | `bld-portal-frontend` |
| **Cloud SQL Instance** | `bld-portal-db-dev` | `bld-portal-db` |
| **Database Name** | `bld_portal_dev` | `bld_portal` |
| **Secrets (prefix)** | `dev-` | `prod-` |
| **Domain** | `dev.yourdomain.com` | `yourdomain.com` |

## File Structure

```
BLDCebu-Online-Portal/
├── .firebaserc                    # Firebase project aliases
├── firebase.json                  # Firebase hosting config (shared)
├── firebase.dev.json              # Dev-specific Firebase config (optional)
├── firebase.prod.json             # Prod-specific Firebase config (optional)
│
├── backend/
│   ├── .env                       # Local dev (gitignored)
│   ├── .env.example               # Template for local dev
│   ├── .env.dev                   # Dev environment template
│   ├── .env.prod                  # Prod environment template
│   ├── Dockerfile                 # Shared Dockerfile
│   └── scripts/
│       ├── deploy-dev.sh          # Dev deployment script
│       └── deploy-prod.sh         # Prod deployment script
│
├── frontend/
│   ├── .env.local                 # Local dev (gitignored)
│   ├── .env.example               # Template for local dev
│   ├── .env.dev                   # Dev environment template
│   ├── .env.prod                  # Prod environment template
│   └── Dockerfile                 # Shared Dockerfile
│
└── scripts/
    ├── deploy-dev.sh              # Master dev deployment script
    ├── deploy-prod.sh             # Master prod deployment script
    └── setup-env.sh               # Environment setup helper
```

## Configuration Files

### 1. Firebase Configuration

#### `.firebaserc` (Already exists)
```json
{
  "projects": {
    "default": "bld-cebu-portal-dev",
    "dev": "bld-cebu-portal-dev",
    "prod": "bldcebu-portal"
  }
}
```

#### `firebase.json` (Shared - routes to different Cloud Run services)
```json
{
  "hosting": {
    "public": "frontend/public",
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "bld-portal-backend",  // Will be overridden per environment
          "region": "asia-southeast1"
        }
      },
      {
        "source": "**",
        "run": {
          "serviceId": "bld-portal-frontend",  // Will be overridden per environment
          "region": "asia-southeast1"
        }
      }
    ]
  }
}
```

### 2. Backend Environment Files

#### `backend/.env.example` (Template)
```bash
# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/bld_portal_dev

# JWT Secrets (generate strong random strings)
JWT_SECRET=dev-jwt-secret-change-me
JWT_REFRESH_SECRET=dev-refresh-secret-change-me

# API Configuration
API_PREFIX=api/v1
PORT=4000

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Node Environment
NODE_ENV=development
```

#### `backend/.env.dev` (Dev Environment Template)
```bash
# Development Environment Variables
# Copy this to your hosting platform's environment variables

# Database (Cloud SQL connection string)
DATABASE_URL=postgresql://postgres:PASSWORD@/bld_portal_dev?host=/cloudsql/PROJECT_ID:asia-southeast1:bld-portal-db-dev

# JWT Secrets (use Secret Manager in production)
JWT_SECRET=dev-jwt-secret-generate-strong-random
JWT_REFRESH_SECRET=dev-refresh-secret-generate-strong-random

# API Configuration
API_PREFIX=api/v1
PORT=4000

# Frontend URL
FRONTEND_URL=https://dev.yourdomain.com

# Node Environment
NODE_ENV=production
```

#### `backend/.env.prod` (Prod Environment Template)
```bash
# Production Environment Variables
# Copy this to your hosting platform's environment variables

# Database (Cloud SQL connection string)
DATABASE_URL=postgresql://postgres:PASSWORD@/bld_portal?host=/cloudsql/PROJECT_ID:asia-southeast1:bld-portal-db

# JWT Secrets (use Secret Manager in production)
JWT_SECRET=prod-jwt-secret-generate-strong-random
JWT_REFRESH_SECRET=prod-refresh-secret-generate-strong-random

# API Configuration
API_PREFIX=api/v1
PORT=4000

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Node Environment
NODE_ENV=production
```

### 3. Frontend Environment Files

#### `frontend/.env.example` (Template)
```bash
# Backend API URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1

# Node Environment
NODE_ENV=development
```

#### `frontend/.env.dev` (Dev Environment Template)
```bash
# Development Environment Variables
NEXT_PUBLIC_API_BASE_URL=https://bld-portal-backend-dev-XXXXX.run.app
NEXT_PUBLIC_API_URL=https://bld-portal-backend-dev-XXXXX.run.app/api/v1
NODE_ENV=production
```

#### `frontend/.env.prod` (Prod Environment Template)
```bash
# Production Environment Variables
NEXT_PUBLIC_API_BASE_URL=https://bld-portal-backend-XXXXX.run.app
NEXT_PUBLIC_API_URL=https://bld-portal-backend-XXXXX.run.app/api/v1
NODE_ENV=production
```

## Deployment Scripts

### `scripts/deploy-dev.sh`
```bash
#!/bin/bash
# Deploy to Development Environment

set -e

echo "🚀 Deploying to DEVELOPMENT environment..."
echo "Project: bld-cebu-portal-dev"
echo ""

# Set Firebase project
firebase use dev
gcloud config set project bld-cebu-portal-dev

# Deploy backend
echo "📦 Deploying backend..."
cd backend
gcloud run deploy bld-portal-backend-dev \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 4000 \
  --set-env-vars "API_PREFIX=api/v1,FRONTEND_URL=https://dev.yourdomain.com,NODE_ENV=production" \
  --add-cloudsql-instances bld-cebu-portal-dev:asia-southeast1:bld-portal-db-dev
cd ..

# Deploy frontend
echo "🌐 Deploying frontend..."
cd frontend
gcloud run deploy bld-portal-frontend-dev \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars "NEXT_PUBLIC_API_BASE_URL=https://bld-portal-backend-dev-XXXXX.run.app,NEXT_PUBLIC_API_URL=https://bld-portal-backend-dev-XXXXX.run.app/api/v1"
cd ..

# Deploy Firebase Hosting
echo "🔥 Deploying Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Development deployment complete!"
```

### `scripts/deploy-prod.sh`
```bash
#!/bin/bash
# Deploy to Production Environment

set -e

echo "🚀 Deploying to PRODUCTION environment..."
echo "Project: bldcebu-portal"
echo ""

# Confirm production deployment
read -p "⚠️  Are you sure you want to deploy to PRODUCTION? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

# Set Firebase project
firebase use prod
gcloud config set project bldcebu-portal

# Deploy backend
echo "📦 Deploying backend..."
cd backend
gcloud run deploy bld-portal-backend \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --port 4000 \
  --set-env-vars "API_PREFIX=api/v1,FRONTEND_URL=https://yourdomain.com,NODE_ENV=production" \
  --add-cloudsql-instances bldcebu-portal:asia-southeast1:bld-portal-db
cd ..

# Deploy frontend
echo "🌐 Deploying frontend..."
cd frontend
gcloud run deploy bld-portal-frontend \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars "NEXT_PUBLIC_API_BASE_URL=https://bld-portal-backend-XXXXX.run.app,NEXT_PUBLIC_API_URL=https://bld-portal-backend-XXXXX.run.app/api/v1"
cd ..

# Deploy Firebase Hosting
echo "🔥 Deploying Firebase Hosting..."
firebase deploy --only hosting

echo "✅ Production deployment complete!"
```

## Google Cloud Resource Naming

### Development Resources
```
Project: bld-cebu-portal-dev
Cloud Run Backend: bld-portal-backend-dev
Cloud Run Frontend: bld-portal-frontend-dev
Cloud SQL Instance: bld-portal-db-dev
Database: bld_portal_dev
Secrets:
  - dev-jwt-secret
  - dev-jwt-refresh-secret
  - dev-database-url
```

### Production Resources
```
Project: bldcebu-portal
Cloud Run Backend: bld-portal-backend
Cloud Run Frontend: bld-portal-frontend
Cloud SQL Instance: bld-portal-db
Database: bld_portal
Secrets:
  - prod-jwt-secret
  - prod-jwt-refresh-secret
  - prod-database-url
```

## Best Practices

### 1. Always Check Current Environment
```bash
# Before deploying, always check:
firebase use
gcloud config get-value project
```

### 2. Use Environment-Specific Scripts
- Never run dev scripts in prod
- Never run prod scripts in dev
- Always verify project before deploying

### 3. Color Coding (Optional)
Add to your scripts:
```bash
# Dev = Blue
echo -e "\033[0;34m🔵 Development Environment\033[0m"

# Prod = Red (warning)
echo -e "\033[0;31m🔴 PRODUCTION Environment\033[0m"
```

### 4. Git Branches
```
main/master     → Production
develop/dev     → Development
feature/*       → Feature branches
```

### 5. Environment Variables
- Never commit `.env` files
- Use `.env.example` and `.env.dev` / `.env.prod` templates
- Use Secret Manager for sensitive values in Cloud

## Quick Reference Commands

### Switch Environments
```bash
# Switch to dev
firebase use dev
gcloud config set project bld-cebu-portal-dev

# Switch to prod
firebase use prod
gcloud config set project bldcebu-portal
```

### Check Current Environment
```bash
# Firebase
firebase use

# Google Cloud
gcloud config get-value project

# List Cloud Run services
gcloud run services list --region asia-southeast1
```

### Deploy Commands
```bash
# Dev
./scripts/deploy-dev.sh

# Prod (with confirmation)
./scripts/deploy-prod.sh
```

## Troubleshooting

### Wrong Environment Deployed
1. Check current project: `gcloud config get-value project`
2. Check Firebase project: `firebase use`
3. Verify service names match environment
4. Check environment variables

### Conflicting Resource Names
- Always use `-dev` suffix for dev resources
- Production resources have no suffix
- Check resource names before creating

### Environment Variable Confusion
- Use `.env.dev` and `.env.prod` templates
- Never mix dev and prod values
- Always verify before deploying
