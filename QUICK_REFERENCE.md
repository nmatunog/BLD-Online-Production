# Quick Reference: Dev vs Prod

## 🔵 Development (bld-cebu-portal-dev)

### Resources
- **Project**: `bld-cebu-portal-dev`
- **Backend Service**: `bld-portal-backend-dev`
- **Frontend Service**: `bld-portal-frontend-dev`
- **Database Instance**: `bld-portal-db-dev`
- **Database Name**: `bld_portal_dev`
- **Secrets Prefix**: `dev-`

### Commands
```bash
# Switch to dev
firebase use dev
gcloud config set project bld-cebu-portal-dev

# Deploy
./scripts/deploy-dev.sh
```

### URLs
- Backend: `https://bld-portal-backend-dev-XXXXX-uc.a.run.app`
- Frontend: `https://bld-portal-frontend-dev-XXXXX-uc.a.run.app`
- Hosting: `https://bld-cebu-portal-dev.web.app`

---

## 🔴 Production (bldcebu-portal)

### Resources
- **Project**: `bldcebu-portal`
- **Backend Service**: `bld-portal-backend`
- **Frontend Service**: `bld-portal-frontend`
- **Database Instance**: `bld-portal-db`
- **Database Name**: `bld_portal`
- **Secrets Prefix**: `prod-`

### Commands
```bash
# Switch to prod
firebase use prod
gcloud config set project bldcebu-portal

# Deploy (with confirmation)
./scripts/deploy-prod.sh
```

### URLs
- Backend: `https://bld-portal-backend-XXXXX-uc.a.run.app`
- Frontend: `https://bld-portal-frontend-XXXXX-uc.a.run.app`
- Hosting: `https://bldcebu-portal.web.app`

---

## ⚠️ Safety Checks

### Before Deploying
```bash
# Always check current environment
firebase use
gcloud config get-value project

# Verify service names match environment
gcloud run services list --region asia-southeast1
```

### Key Differences
- **Dev**: All resources have `-dev` suffix
- **Prod**: No suffix on resources
- **Dev**: Lower resource limits
- **Prod**: Higher resource limits and scaling
