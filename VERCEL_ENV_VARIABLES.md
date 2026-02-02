# Set Environment Variables in Vercel

## Current Step

You're being asked: **"Found existing file .env.local. Do you want to overwrite?"**

**Answer: `N` (No)**

Keep your local `.env.local` file for local development. We'll set environment variables in Vercel Dashboard instead.

## After Deployment

Once deployment completes, you'll see a URL like:
```
https://bld-online-production.vercel.app
```

## Step 1: Go to Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Click on your project: **bld-online-production**

## Step 2: Set Environment Variables

1. Go to **Settings** → **Environment Variables**
2. Click **Add New**
3. Add these three variables (one at a time):

### Variable 1: NEXT_PUBLIC_API_BASE_URL
- **Key:** `NEXT_PUBLIC_API_BASE_URL`
- **Value:** `https://bld-online-production-production.up.railway.app`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

### Variable 2: NEXT_PUBLIC_API_URL
- **Key:** `NEXT_PUBLIC_API_URL`
- **Value:** `https://bld-online-production-production.up.railway.app/api/v1`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

### Variable 3: NODE_ENV
- **Key:** `NODE_ENV`
- **Value:** `production`
- **Environments:** ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

## Step 3: Redeploy

After setting all environment variables:

1. Go to **Deployments** tab
2. Find the latest deployment
3. Click **⋯** (three dots) → **Redeploy**
4. Or run: `vercel --prod` from the frontend directory

## Verify

After redeployment:
1. Visit your Vercel URL
2. Test login with:
   - Email: `nmatunog@gmail.com`
   - Password: `@Nbm0823`
3. Check browser console for any errors

## Quick Reference

**Backend API URLs:**
- Base: `https://bld-online-production-production.up.railway.app`
- API: `https://bld-online-production-production.up.railway.app/api/v1`

**Environment Variables:**
```
NEXT_PUBLIC_API_BASE_URL=https://bld-online-production-production.up.railway.app
NEXT_PUBLIC_API_URL=https://bld-online-production-production.up.railway.app/api/v1
NODE_ENV=production
```
