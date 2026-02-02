# Deploy Frontend to Vercel - Quick Guide

## Current Status
✅ Backend deployed on Railway  
✅ Admin user created  
⏭️ Ready to deploy frontend

## Quick Deployment Steps

### Step 1: Navigate to Frontend Directory

```bash
cd frontend
```

### Step 2: Deploy to Vercel

```bash
npx vercel --prod
```

**Or if you have Vercel CLI installed globally:**
```bash
vercel --prod
```

### What to Expect

1. **First time?** You'll be asked to login to Vercel (opens browser)
2. **Link project?** Choose to create a new project or link to existing
3. **Project settings?** Vercel will auto-detect Next.js settings
4. **Deploy?** Confirm and wait for build to complete

### Step 3: Set Environment Variables

After deployment, **immediately** set these in Vercel Dashboard:

1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your project
3. Go to **Settings** → **Environment Variables**
4. Add these three variables:

```
NEXT_PUBLIC_API_BASE_URL=https://bld-online-production-production.up.railway.app
NEXT_PUBLIC_API_URL=https://bld-online-production-production.up.railway.app/api/v1
NODE_ENV=production
```

**Important:** Set them for **Production**, **Preview**, and **Development** environments.

### Step 4: Redeploy

After setting environment variables, trigger a new deployment:

**Option A: From Vercel Dashboard**
- Go to **Deployments** tab
- Click **Redeploy** on the latest deployment

**Option B: From Command Line**
```bash
cd frontend
npx vercel --prod
```

## Verify Deployment

1. **Visit your Vercel URL** (shown after deployment)
2. **Test Login:**
   - Email: `nmatunog@gmail.com`
   - Password: `@Nbm0823`
3. **Check Browser Console** for errors
4. **Verify API calls** are working

## Update Backend CORS (If Needed)

If the frontend can't connect to the backend, update CORS in Railway:

1. Railway Dashboard → Backend service
2. **Variables** tab
3. Update `FRONTEND_URL` to include your Vercel domain:
   ```
   FRONTEND_URL=https://your-app.vercel.app
   ```
4. Redeploy backend

## Troubleshooting

### Build Fails

**Check:**
- All dependencies are installed: `cd frontend && npm install`
- TypeScript errors: `npm run build` (test locally first)
- Next.js config is valid

### Frontend Can't Connect to Backend

**Check:**
1. Environment variables are set in Vercel
2. Variables are prefixed with `NEXT_PUBLIC_`
3. Backend is accessible: `curl https://bld-online-production-production.up.railway.app/health`
4. CORS allows Vercel domain

**Fix:**
- Update `FRONTEND_URL` in Railway
- Redeploy backend

### Environment Variables Not Working

**Check:**
- Variables are set for correct environment (Production/Preview/Development)
- Variables start with `NEXT_PUBLIC_` for client-side access
- Redeploy after setting variables

## Quick Reference

**Backend API:**
- Base: `https://bld-online-production-production.up.railway.app`
- API: `https://bld-online-production-production.up.railway.app/api/v1`

**Environment Variables:**
```bash
NEXT_PUBLIC_API_BASE_URL=https://bld-online-production-production.up.railway.app
NEXT_PUBLIC_API_URL=https://bld-online-production-production.up.railway.app/api/v1
NODE_ENV=production
```
