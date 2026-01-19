## Firebase Hosting + Cloud Run (DEV then PROD)

### Recommended region
- `asia-southeast1` (Singapore)

### Cloud Run services
- Frontend service: `bld-portal-frontend`
- Backend service: `bld-portal-backend`

### Firebase Hosting routing
Configured in `firebase.json`:
- `/api/**` → Cloud Run backend
- `/**` → Cloud Run frontend

---

## 0) One-time tools
Install:
- `gcloud` SDK
- `firebase-tools`

Login:
- `gcloud auth login`
- `firebase login`

---

## 1) DEV deploy
### A) Select DEV project
- `gcloud config set project bld-cebu-portal-dev`

### B) Create Cloud SQL (Postgres)
- Create in `asia-southeast1`
- Get **instance connection name**: `PROJECT:REGION:INSTANCE`

### C) Deploy backend to Cloud Run
From `backend/` (builds Dockerfile):
- Build and deploy (example):
  - `gcloud run deploy bld-portal-backend --source . --region asia-southeast1 --allow-unauthenticated     --set-env-vars PORT=4000,API_PREFIX=api/v1,FRONTEND_URL=https://dev.yourdomain.com,JWT_SECRET=...,JWT_REFRESH_SECRET=...     --add-cloudsql-instances PROJECT:asia-southeast1:bld-portal-db`

You must also set `DATABASE_URL` (recommended via Secret Manager → env var).

### D) Deploy frontend to Cloud Run
From `frontend/`:
- `gcloud run deploy bld-portal-frontend --source . --region asia-southeast1 --allow-unauthenticated   --set-env-vars PORT=8080,NEXT_PUBLIC_API_BASE_URL=https://<your-dev-hosting-domain>`

### E) Deploy Firebase Hosting
From repo root:
- `firebase use dev`
- `firebase deploy --only hosting`

Point domain `dev.yourdomain.com` to Firebase Hosting.

---

## 2) PROD deploy
Repeat in project `bldcebu-portal`:
- `gcloud config set project bldcebu-portal`
- deploy Cloud SQL + both Cloud Run services
- `firebase use prod`
- `firebase deploy --only hosting`

Point domain `yourdomain.com` to Firebase Hosting.
