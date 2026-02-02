# Vercel + Railway Deployment Guide

## 🎯 Overview

**Frontend**: Deploy to Vercel (FREE for Next.js)  
**Backend**: Deploy to Railway ($5-20/month)  
**Database**: PostgreSQL on Railway (included)  
**Domain**: app.BLDCebu.com (subdomain)

**Total Cost**: ~$5-20/month

---

## 📋 Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com (free)
2. **Railway Account**: Sign up at https://railway.app
3. **Domain Access**: Access to DNS settings for BLDCebu.com
4. **Git Repository**: Your code should be in Git (GitHub, GitLab, etc.)

---

## 🚀 Step 1: Install CLI Tools

```bash
# Install Vercel CLI
npm install -g vercel

# Install Railway CLI
npm install -g @railway/cli
```

---

## 🔧 Step 2: Deploy Backend to Railway

### 2.1 Login to Railway

```bash
railway login
```

This will open your browser to authenticate.

### 2.2 Create New Project

```bash
cd backend
railway init
```

Follow prompts:
- Create new project: Yes
- Project name: `bld-portal-backend`

### 2.3 Add PostgreSQL Database

```bash
railway add postgresql
```

This creates a PostgreSQL database and sets `DATABASE_URL` environment variable automatically.

### 2.4 Set Environment Variables

```bash
# Get database URL (already set, but verify)
railway variables

# Set JWT secrets
railway variables set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
railway variables set JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Set other environment variables
railway variables set NODE_ENV=production
railway variables set API_PREFIX=api/v1
railway variables set PORT=4000
```

### 2.5 Run Database Migrations

```bash
# Railway will run migrations automatically if you have a build script
# Or run manually:
railway run npx prisma migrate deploy
```

### 2.6 Deploy Backend

```bash
railway up
```

Railway will:
- Build your Docker image (or use npm build)
- Deploy to Railway
- Provide a URL like: `bld-portal-backend-production.up.railway.app`

### 2.7 Get Backend URL

```bash
railway domain
# Or check in Railway dashboard
```

**Save this URL** - you'll need it for the frontend!

---

## 🌐 Step 3: Deploy Frontend to Vercel

### 3.1 Login to Vercel

```bash
cd frontend
vercel login
```

### 3.2 Deploy to Vercel

```bash
vercel
```

Follow prompts:
- Set up and deploy? **Yes**
- Which scope? (Choose your account)
- Link to existing project? **No** (first time)
- What's your project's name? `bld-portal-frontend`
- In which directory is your code located? `./`
- Want to override settings? **No**

### 3.3 Set Environment Variables

After first deployment, set environment variables:

```bash
# Get your Railway backend URL first (from Step 2.7)
BACKEND_URL="https://bld-portal-backend-production.up.railway.app"

# Set environment variables
vercel env add NEXT_PUBLIC_API_BASE_URL production
# Enter: https://bld-portal-backend-production.up.railway.app

vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://bld-portal-backend-production.up.railway.app/api/v1

vercel env add NODE_ENV production
# Enter: production
```

Or set via Vercel Dashboard:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add:
   - `NEXT_PUBLIC_API_BASE_URL` = `https://[your-railway-backend-url]`
   - `NEXT_PUBLIC_API_URL` = `https://[your-railway-backend-url]/api/v1`
   - `NODE_ENV` = `production`

### 3.4 Redeploy with Environment Variables

```bash
vercel --prod
```

---

## 🌍 Step 4: Configure Custom Domain (app.BLDCebu.com)

### 4.1 Add Domain in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project (`bld-portal-frontend`)
3. Go to **Settings** → **Domains**
4. Click **Add Domain**
5. Enter: `app.BLDCebu.com`
6. Vercel will show you DNS records to add

### 4.2 Configure DNS at Your Registrar

Vercel will show you DNS records. Typically:

**For subdomain (app.BLDCebu.com)**:
```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
```

Or if using A record:
```
Type: A
Name: app
Value: 76.76.21.21
```

### 4.3 Wait for DNS Propagation

- Usually takes 5-30 minutes
- Can take up to 48 hours (rare)
- Check status: https://dnschecker.org

### 4.4 Verify SSL Certificate

Vercel automatically provisions SSL certificates. Once DNS propagates, SSL will be active.

---

## 🔗 Step 5: Configure CORS in Backend

Update your backend CORS to allow requests from `app.BLDCebu.com`:

### 5.1 Update Backend CORS

In `backend/src/main.ts`, ensure CORS allows your domain:

```typescript
const allowedOrigins = [
  'https://app.BLDCebu.com',
  'http://localhost:3000',
  // Add other origins as needed
];

app.enableCors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.some(allowed => origin.includes(allowed))) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  // ... rest of CORS config
});
```

### 5.2 Redeploy Backend

```bash
cd backend
railway up
```

---

## ✅ Step 6: Verify Deployment

### 6.1 Check Frontend

Visit: `https://app.BLDCebu.com`

### 6.2 Check Backend API

Visit: `https://[your-railway-backend-url]/api/docs` (Swagger docs)

### 6.3 Test API Connection

Open browser console on `app.BLDCebu.com` and check for API connection errors.

---

## 🔄 Step 7: Update Frontend API Configuration

Since we're using runtime config, the frontend should automatically detect the backend URL. However, if you need to set it explicitly:

### Option 1: Use Environment Variables (Build-time)

Set in Vercel:
- `NEXT_PUBLIC_API_BASE_URL` = Your Railway backend URL

### Option 2: Use Runtime Config (Already implemented)

The `runtime-config.ts` file should handle this automatically.

---

## 📊 Deployment Summary

### URLs:
- **Frontend**: `https://app.BLDCebu.com`
- **Backend**: `https://[railway-backend-url].up.railway.app`
- **API Docs**: `https://[railway-backend-url]/api/docs`

### Costs:
- **Vercel**: FREE ✅
- **Railway**: $5-20/month ✅
- **Total**: ~$5-20/month

### What's Deployed:
- ✅ Frontend (Next.js) on Vercel
- ✅ Backend (NestJS) on Railway
- ✅ PostgreSQL database on Railway
- ✅ Custom domain (app.BLDCebu.com)
- ✅ SSL certificates (automatic)

---

## 🛠️ Troubleshooting

### Frontend can't connect to backend

1. **Check CORS**: Ensure backend allows `app.BLDCebu.com`
2. **Check environment variables**: Verify `NEXT_PUBLIC_API_BASE_URL` is set
3. **Check backend URL**: Ensure Railway backend is running

### Database connection issues

1. **Check DATABASE_URL**: Verify in Railway dashboard
2. **Run migrations**: `railway run npx prisma migrate deploy`
3. **Check database status**: Verify in Railway dashboard

### Domain not working

1. **Check DNS**: Verify DNS records at registrar
2. **Wait for propagation**: Can take up to 48 hours
3. **Check Vercel**: Verify domain is added in Vercel dashboard

---

## 🔄 Updating Your Application

### Update Backend:

```bash
cd backend
git pull
railway up
```

### Update Frontend:

```bash
cd frontend
git pull
vercel --prod
```

Both platforms auto-deploy from Git if you connect your repository!

---

## 📝 Next Steps

1. ✅ Deploy backend to Railway
2. ✅ Deploy frontend to Vercel
3. ✅ Configure domain
4. ✅ Test everything
5. ✅ Create admin user (if needed)

**You're all set!** 🎉
