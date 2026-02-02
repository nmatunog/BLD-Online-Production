# Update Next.js to Fix Security Warning

## Issue

Vercel detected a vulnerable version of Next.js (16.0.3) and requires an update.

## Solution

I've updated `package.json` to use Next.js 15.1.0 (latest stable). Now you need to:

### Step 1: Install Updated Dependencies

```bash
cd ~/BLDCebu-Online-Portal/frontend
npm install
```

### Step 2: Test Build Locally (Optional but Recommended)

```bash
npm run build
```

This ensures everything still works with the new version.

### Step 3: Commit and Push Changes

```bash
cd ~/BLDCebu-Online-Portal
git add frontend/package.json frontend/package-lock.json
git commit -m "Update Next.js to 15.1.0 for security"
git push
```

### Step 4: Redeploy to Vercel

```bash
cd ~/BLDCebu-Online-Portal/frontend
vercel --prod
```

Or if Vercel is connected to your Git repository, it will auto-deploy after you push.

## After Deployment

1. **Set Environment Variables** in Vercel Dashboard (if not already set):
   - `NEXT_PUBLIC_API_BASE_URL=https://bld-online-production-production.up.railway.app`
   - `NEXT_PUBLIC_API_URL=https://bld-online-production-production.up.railway.app/api/v1`
   - `NODE_ENV=production`

2. **Test the deployment** at your Vercel URL

## Note

The deployment might have completed despite the warning, but it's important to update Next.js for security. The next deployment will use the updated version.
