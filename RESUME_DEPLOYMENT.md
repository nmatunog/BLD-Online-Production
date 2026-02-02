# Resume Production Deployment

## Current Status

✅ **Backend**: Deployed to Cloud Run (`bld-portal-backend`)
✅ **Frontend**: Deployed to Cloud Run (`bld-portal-frontend`)
⏳ **Firebase Hosting**: Needs manual site creation (optional)

## Step 1: Verify Current Deployments

Check if your services are running:

```bash
# Check backend
gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --project bldcebu-portal \
  --format="value(status.url)"

# Check frontend
gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --project bldcebu-portal \
  --format="value(status.url)"
```

## Step 2: Complete Firebase Hosting Setup

Since CLI site creation was failing with 404 errors, create the site manually:

### Option A: Create via Firebase Console (Recommended)

1. **Open Firebase Console:**
   ```
   https://console.firebase.google.com/project/bldcebu-portal/hosting
   ```

2. **Click "Get started" or "Add site"**

3. **Enter site ID:** `bldcebu-online-portal` (or any unique name)

4. **After site is created, deploy:**
   ```bash
   firebase use prod
   firebase deploy --only hosting
   ```

### Option B: Try CLI Again (After API Propagation)

If you want to try CLI again, ensure the API is enabled and wait:

```bash
# Enable API
gcloud services enable firebasehosting.googleapis.com --project bldcebu-portal

# Wait 2-3 minutes for full propagation
sleep 120

# Try deploying
firebase use prod
firebase deploy --only hosting
# When prompted, enter: bldcebu-online-portal
```

## Step 3: Verify Everything Works

### Test Backend
```bash
BACKEND_URL=$(gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --project bldcebu-portal \
  --format="value(status.url)")

# Test API docs
curl "$BACKEND_URL/api/docs"
```

### Test Frontend
```bash
FRONTEND_URL=$(gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --project bldcebu-portal \
  --format="value(status.url)")

# Open in browser
open "$FRONTEND_URL"
```

### Test Firebase Hosting (if deployed)
```bash
# Should be: https://bldcebu-online-portal.web.app
# Or whatever site ID you created
```

## Step 4: Get All Service URLs

Run this to get all your URLs:

```bash
echo "=== Production Deployment URLs ==="
echo ""
echo "Backend:"
gcloud run services describe bld-portal-backend \
  --region asia-southeast1 \
  --project bldcebu-portal \
  --format="value(status.url)"
echo ""
echo "Frontend:"
gcloud run services describe bld-portal-frontend \
  --region asia-southeast1 \
  --project bldcebu-portal \
  --format="value(status.url)"
echo ""
echo "Firebase Hosting (if deployed):"
echo "https://bldcebu-online-portal.web.app"
echo ""
```

## Troubleshooting

### If Firebase Hosting still fails:

1. **Check API status:**
   ```bash
   gcloud services list --enabled \
     --project bldcebu-portal \
     --filter="name:firebasehosting.googleapis.com"
   ```

2. **Verify billing:**
   ```bash
   gcloud billing projects describe bldcebu-portal \
     --format="value(billingAccountName)"
   ```

3. **Check Firebase access:**
   ```bash
   firebase projects:list
   ```

### If services aren't running:

Check service status:
```bash
gcloud run services list \
  --project bldcebu-portal \
  --region asia-southeast1
```

View logs:
```bash
# Backend logs
gcloud run services logs read bld-portal-backend \
  --region asia-southeast1 \
  --project bldcebu-portal \
  --limit 50

# Frontend logs
gcloud run services logs read bld-portal-frontend \
  --region asia-southeast1 \
  --project bldcebu-portal \
  --limit 50
```

## Important Notes

- **Firebase Hosting is optional** - Your app works without it
- **Cloud Run URLs are permanent** - You can use them directly
- **Firebase Hosting provides** - Custom domains, CDN, and routing

## Next Steps After Deployment

1. ✅ Test all endpoints
2. ✅ Verify database connections
3. ✅ Test authentication
4. ✅ Set up custom domain (optional)
5. ✅ Configure monitoring and alerts
6. ✅ Set up database backups

## Quick Reference

```bash
# Switch to production
firebase use prod
gcloud config set project bldcebu-portal

# Deploy backend
cd backend
gcloud run deploy bld-portal-backend --source . --region asia-southeast1 ...

# Deploy frontend
cd frontend
gcloud run deploy bld-portal-frontend --source . --region asia-southeast1 ...

# Deploy Firebase Hosting
firebase deploy --only hosting
```
