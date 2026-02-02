# Railway Setup Guide

## 🚂 Complete Railway Setup for Backend Deployment

---

## 📋 Step 1: Create Railway Account

1. **Go to Railway**: https://railway.app
2. **Sign up** with:
   - GitHub (recommended - easiest)
   - Google
   - Email
3. **Verify your email** if required

---

## 📦 Step 2: Install Railway CLI

### Option A: Using npm (Recommended)

```bash
npm install -g @railway/cli
```

### Option B: Using Homebrew (macOS)

```bash
brew install railway
```

### Option C: Using other package managers

See: https://docs.railway.app/develop/cli#installation

### Verify Installation

```bash
railway --version
```

Should show: `railway version X.X.X`

---

## 🔐 Step 3: Login to Railway

```bash
railway login
```

This will:
- Open your browser
- Ask you to authorize Railway CLI
- Return to terminal when done

**Verify login:**
```bash
railway whoami
```

Should show your Railway username/email.

---

## 🚀 Step 4: Create New Project

### Option A: Using CLI (Recommended)

```bash
cd backend
railway init
```

Follow prompts:
- **Create new project?** → Yes
- **Project name?** → `bld-portal-backend` (or your choice)
- **Environment?** → Production (or Development)

This creates a new Railway project and links your local directory.

### Option B: Using Dashboard

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Empty Project"** or **"Deploy from GitHub repo"**
4. Name it: `bld-portal-backend`

---

## 🗄️ Step 5: Add PostgreSQL Database

### Using CLI:

```bash
railway add postgresql
```

This will:
- Create a PostgreSQL database
- Automatically set `DATABASE_URL` environment variable
- Show database connection details

### Using Dashboard:

1. In Railway dashboard, click **"New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway creates the database automatically

### Verify Database:

```bash
railway variables
```

You should see `DATABASE_URL` in the list.

---

## ⚙️ Step 6: Set Environment Variables

### Using CLI:

```bash
# Generate JWT secrets
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Set environment variables
railway variables set NODE_ENV=production
railway variables set API_PREFIX=api/v1
railway variables set PORT=4000
railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"
```

### Using Dashboard:

1. Go to Railway dashboard
2. Select your project
3. Go to **"Variables"** tab
4. Click **"New Variable"**
5. Add each variable:
   - `NODE_ENV` = `production`
   - `API_PREFIX` = `api/v1`
   - `PORT` = `4000`
   - `JWT_SECRET` = (generate strong random string)
   - `JWT_REFRESH_SECRET` = (generate strong random string)

**Generate JWT secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run twice to get two different secrets.

---

## 🔄 Step 7: Run Database Migrations

```bash
railway run npx prisma migrate deploy
```

Or if you have a migration script:
```bash
railway run npm run prisma:migrate
```

This will:
- Connect to Railway's PostgreSQL
- Run all pending migrations
- Set up your database schema

---

## 🚢 Step 8: Deploy Backend

### Using CLI:

```bash
railway up
```

This will:
- Build your Docker image (or use npm build)
- Deploy to Railway
- Show deployment logs
- Provide deployment URL

### Using Dashboard (GitHub Integration):

1. In Railway dashboard, click **"New"**
2. Select **"GitHub Repo"**
3. Choose your repository
4. Select **"backend"** directory
5. Railway auto-detects and deploys

---

## 🌐 Step 9: Get Your Backend URL

### Using CLI:

```bash
railway domain
```

Or:
```bash
railway status
```

### Using Dashboard:

1. Go to your service
2. Click **"Settings"** tab
3. Scroll to **"Domains"**
4. Your URL will be: `[service-name].up.railway.app`

**Example**: `bld-portal-backend-production.up.railway.app`

---

## 🔍 Step 10: Verify Deployment

### Check Logs:

```bash
railway logs
```

### Check Status:

```bash
railway status
```

### Test API:

```bash
curl https://[your-railway-url].up.railway.app/api/v1/health
```

Or visit in browser:
- API Docs: `https://[your-railway-url].up.railway.app/api/docs`
- Health Check: `https://[your-railway-url].up.railway.app/api/v1/health`

---

## 📊 Railway Dashboard Overview

### Main Sections:

1. **Projects**: List of all your projects
2. **Services**: Your deployed services (backend, database, etc.)
3. **Variables**: Environment variables
4. **Deployments**: Deployment history
5. **Logs**: Real-time logs
6. **Metrics**: CPU, memory, network usage
7. **Settings**: Project settings, domains, etc.

---

## 🔧 Common Commands

```bash
# Login
railway login

# Check current project
railway status

# View logs
railway logs

# View environment variables
railway variables

# Set environment variable
railway variables set KEY=value

# Run command in Railway environment
railway run [command]

# Deploy
railway up

# Get domain/URL
railway domain

# Open dashboard
railway open
```

---

## 🛠️ Troubleshooting

### Issue: "Not logged in"

**Solution:**
```bash
railway login
```

### Issue: "No project found"

**Solution:**
```bash
railway init
# Or link to existing project
railway link
```

### Issue: Database connection fails

**Solution:**
1. Check `DATABASE_URL` is set: `railway variables`
2. Verify database is running in dashboard
3. Check database name matches your Prisma schema

### Issue: Build fails

**Solution:**
1. Check logs: `railway logs`
2. Verify `package.json` has build script
3. Check for build errors in logs
4. Ensure all dependencies are in `package.json`

### Issue: Can't find service

**Solution:**
```bash
# List all services
railway status

# Or check dashboard
railway open
```

---

## 💰 Railway Pricing

### Hobby Plan: $5/month per service
- ✅ 512MB RAM
- ✅ 1GB storage
- ✅ 100GB bandwidth
- ✅ Good for small apps

### Pro Plan: $20/month per service
- ✅ 8GB RAM
- ✅ 100GB storage
- ✅ 1TB bandwidth
- ✅ Better for production

**Database**: Included with service (no extra cost for PostgreSQL)

---

## 📝 Quick Setup Checklist

- [ ] Create Railway account
- [ ] Install Railway CLI
- [ ] Login: `railway login`
- [ ] Initialize project: `railway init`
- [ ] Add PostgreSQL: `railway add postgresql`
- [ ] Set environment variables
- [ ] Run migrations: `railway run npx prisma migrate deploy`
- [ ] Deploy: `railway up`
- [ ] Get URL: `railway domain`
- [ ] Test API endpoint
- [ ] Save backend URL for frontend configuration

---

## 🎯 Next Steps After Railway Setup

1. ✅ **Save your backend URL** - You'll need it for Vercel frontend
2. ✅ **Test your API** - Visit `/api/docs` to see Swagger documentation
3. ✅ **Configure CORS** - Ensure backend allows frontend domain
4. ✅ **Set up frontend** - Deploy to Vercel with Railway backend URL
5. ✅ **Create admin user** - Use Railway CLI to run admin creation script

---

## 📚 Additional Resources

- **Railway Docs**: https://docs.railway.app
- **CLI Reference**: https://docs.railway.app/develop/cli
- **Database Guide**: https://docs.railway.app/databases
- **Environment Variables**: https://docs.railway.app/develop/variables

---

## 🚀 Quick Start Command Summary

```bash
# 1. Install
npm install -g @railway/cli

# 2. Login
railway login

# 3. Setup (in backend directory)
cd backend
railway init
railway add postgresql

# 4. Configure
railway variables set NODE_ENV=production
railway variables set API_PREFIX=api/v1
railway variables set PORT=4000
railway variables set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
railway variables set JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 5. Migrate
railway run npx prisma migrate deploy

# 6. Deploy
railway up

# 7. Get URL
railway domain
```

**That's it! Your backend is deployed on Railway!** 🎉
