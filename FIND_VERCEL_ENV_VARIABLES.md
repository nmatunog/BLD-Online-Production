# How to Find Environment Variables in Vercel

## Step-by-Step Instructions

### Step 1: Click on Your Project

From the Overview page (where you are now):
1. Click on the project card: **`bld-online-production`**
2. This will take you to the project's detail page

### Step 2: Go to Settings

Once you're in the project:
1. Look at the top navigation tabs
2. Click on **"Settings"** (it's the last tab on the right)
3. You'll see a sidebar menu on the left with different settings sections

### Step 3: Find Environment Variables

In the Settings page:
1. Look at the left sidebar menu
2. Click on **"Environment Variables"** (usually near the top of the list)
3. You'll see a list of existing variables (if any) and an **"Add New"** button

## Alternative: Direct URL

You can also go directly to:
```
https://vercel.com/nilo-matunogs-projects/bld-online-production/settings/environment-variables
```

## Visual Guide

**Navigation Path:**
```
Overview → Click Project → Settings Tab → Environment Variables (left sidebar)
```

## What to Add

Once you're in Environment Variables, click **"Add New"** and add these three:

1. **NEXT_PUBLIC_API_BASE_URL**
   - Value: `https://bld-online-production-production.up.railway.app`
   - Environments: ✅ Production, ✅ Preview, ✅ Development

2. **NEXT_PUBLIC_API_URL**
   - Value: `https://bld-online-production-production.up.railway.app/api/v1`
   - Environments: ✅ Production, ✅ Preview, ✅ Development

3. **NODE_ENV**
   - Value: `production`
   - Environments: ✅ Production, ✅ Preview, ✅ Development

## After Adding Variables

1. **Redeploy** your project:
   - Go to **Deployments** tab
   - Click **⋯** (three dots) on the latest deployment
   - Click **Redeploy**

Or the variables will be used in the next deployment automatically.
