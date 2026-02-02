# Firebase Hosting Setup - Manual Steps

Since the CLI site creation is failing with a 404 error, you need to create the Firebase Hosting site manually through the Firebase Console.

## Option 1: Create Site via Firebase Console (Recommended)

1. **Go to Firebase Console:**
   https://console.firebase.google.com/project/bldcebu-portal/hosting

2. **Click "Get started" or "Add site"**

3. **Enter site ID:** `bldcebu-portal`
   - Or use any unique name like `bldcebu-portal-prod`

4. **After site is created, deploy from command line:**
   ```bash
   firebase use prod
   firebase deploy --only hosting
   ```

## Option 2: Skip Firebase Hosting (Cloud Run is Already Working)

Your backend and frontend are **already deployed and working** on Cloud Run:
- Backend: `https://bld-portal-backend-*.run.app`
- Frontend: `https://bld-portal-frontend-*.run.app`

Firebase Hosting is optional - it's just a routing layer. You can:
- Use the Cloud Run URLs directly
- Set up a custom domain on Cloud Run
- Add Firebase Hosting later when needed

## Option 3: Try Different Site ID

Sometimes the site ID needs to be different from the project ID. Try:

```bash
firebase deploy --only hosting
# When prompted, enter: bld-portal-prod
# or: bldcebu-portal-site
# or: portal-prod
```

## Troubleshooting

### Check API Status
```bash
gcloud services list --enabled --project bldcebu-portal --filter="name:firebasehosting.googleapis.com"
```

### Verify Project Access
```bash
firebase projects:list
```

### Check Firebase CLI Version
```bash
firebase --version
# Update if needed: npm install -g firebase-tools
```

## Current Status

✅ **Backend deployed** - Working on Cloud Run
✅ **Frontend deployed** - Working on Cloud Run  
⏳ **Firebase Hosting** - Needs manual site creation

Your application is **fully functional** without Firebase Hosting. It's just a convenience layer for routing and custom domains.
