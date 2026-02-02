# Vercel Login and Deploy - Step by Step

## Issue: Invalid Token

You need to login to Vercel first before deploying.

## Step 1: Login to Vercel

Run this command:

```bash
npx vercel login
```

This will:
1. Open your browser
2. Ask you to login to Vercel (or create an account)
3. Authorize the CLI

## Step 2: Navigate to Frontend Directory

**Important:** Deploy from the `frontend` directory, not `backend`!

```bash
cd ~/BLDCebu-Online-Portal/frontend
```

## Step 3: Deploy to Vercel

```bash
npx vercel --prod
```

## What You'll See

1. **Set up and deploy?** → Type `y` or press Enter
2. **Which scope?** → Select your account/team
3. **Link to existing project?** → Type `n` (create new) or `y` (link existing)
4. **Project name?** → Press Enter for default or type a name
5. **Directory?** → Press Enter (current directory is correct)
6. **Override settings?** → Press Enter (use defaults)

## Step 4: Set Environment Variables

After deployment completes, you'll see a URL like:
```
https://your-project.vercel.app
```

**Now set environment variables:**

1. Go to: https://vercel.com/dashboard
2. Click on your project
3. **Settings** → **Environment Variables**
4. Click **Add New**
5. Add these three variables (one at a time):

   **Variable 1:**
   - Key: `NEXT_PUBLIC_API_BASE_URL`
   - Value: `https://bld-online-production-production.up.railway.app`
   - Environments: ✅ Production, ✅ Preview, ✅ Development

   **Variable 2:**
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `https://bld-online-production-production.up.railway.app/api/v1`
   - Environments: ✅ Production, ✅ Preview, ✅ Development

   **Variable 3:**
   - Key: `NODE_ENV`
   - Value: `production`
   - Environments: ✅ Production, ✅ Preview, ✅ Development

## Step 5: Redeploy

After setting environment variables:

1. Go to **Deployments** tab
2. Click **⋯** (three dots) on the latest deployment
3. Click **Redeploy**

Or run:
```bash
cd frontend
npx vercel --prod
```

## Quick Command Summary

```bash
# 1. Login
npx vercel login

# 2. Navigate to frontend
cd ~/BLDCebu-Online-Portal/frontend

# 3. Deploy
npx vercel --prod

# 4. Set environment variables in Vercel Dashboard
# 5. Redeploy
```

## Troubleshooting

### "Invalid token" error
- Run `npx vercel login` first
- Make sure you're logged in to the correct Vercel account

### Deploying from wrong directory
- Make sure you're in the `frontend` directory
- Check: `pwd` should show `.../BLDCebu-Online-Portal/frontend`

### Build fails
- Check that all dependencies are installed: `npm install`
- Test build locally: `npm run build`
- Check for TypeScript errors: `npm run lint`
