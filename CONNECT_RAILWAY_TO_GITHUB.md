# Connect Railway to GitHub Repository

## 🎯 Why Connect to GitHub?

Railway can automatically deploy when you push to GitHub. This is the recommended way to deploy.

---

## 🚀 Option 1: Connect via Railway Dashboard (Recommended)

### Step 1: Go to Railway Dashboard

1. Go to https://railway.app/dashboard
2. Click on your project (or create a new one)

### Step 2: Add GitHub Service

1. Click **"New"** button
2. Select **"GitHub Repo"**
3. Railway will show you a list of your GitHub repositories
4. Select your repository: `BLDCebu-Online-Portal` (or your production repo)
5. Railway will ask which directory to deploy from
6. Select: **`backend`** directory

### Step 3: Configure Service

Railway will:
- ✅ Auto-detect it's a Node.js project
- ✅ Auto-detect the build command
- ✅ Set up deployment

### Step 4: Add PostgreSQL Database

1. In the same project, click **"New"**
2. Select **"Database"** → **"PostgreSQL"**
3. Railway automatically creates the database and sets `DATABASE_URL`

### Step 5: Set Environment Variables

1. Click on your backend service
2. Go to **"Variables"** tab
3. Add these variables:
   - `NODE_ENV` = `production`
   - `API_PREFIX` = `api/v1`
   - `PORT` = `4000`
   - `JWT_SECRET` = (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `JWT_REFRESH_SECRET` = (generate another one)

### Step 6: Deploy

Railway will automatically:
- ✅ Clone your repository
- ✅ Install dependencies
- ✅ Build your application
- ✅ Deploy it

---

## 🔧 Option 2: Connect via CLI (Alternative)

If you prefer CLI:

### Step 1: Link to GitHub Repository

```bash
cd backend
npx @railway/cli link
```

This will:
- Ask you to select a project
- Ask if you want to connect to GitHub
- Guide you through the connection

### Step 2: Push to GitHub

Make sure your code is pushed to GitHub:

```bash
git add .
git commit -m "Fix Railway build configuration"
git push
```

### Step 3: Railway Auto-Deploys

Once connected, Railway will automatically deploy when you push to GitHub.

---

## 📋 Step-by-Step: Dashboard Method

### 1. Create/Select Project

- Go to https://railway.app/dashboard
- Click **"New Project"** (or select existing)
- Name it: `bld-portal-backend`

### 2. Connect GitHub Repository

- Click **"New"** → **"GitHub Repo"**
- Authorize Railway to access GitHub (if first time)
- Select repository: `BLDCebu-Online-Portal` (or your production repo)
- Select branch: `main` (or your default branch)
- Select root directory: **`backend`**

### 3. Railway Auto-Detects Configuration

Railway will:
- Detect Node.js
- Detect `package.json`
- Use `npm run build` for build
- Use `npm start` for start

### 4. Add Database

- Click **"New"** in the same project
- Select **"Database"** → **"PostgreSQL"**
- Railway creates database automatically

### 5. Set Environment Variables

In your backend service:
- Go to **"Variables"** tab
- Add:
  ```
  NODE_ENV=production
  API_PREFIX=api/v1
  PORT=4000
  JWT_SECRET=<generate-strong-random-string>
  JWT_REFRESH_SECRET=<generate-strong-random-string>
  ```

### 6. Run Migrations

After first deployment:
- Go to service → **"Deployments"** tab
- Click on deployment
- Go to **"Shell"** tab
- Run: `npx prisma migrate deploy`

Or use CLI:
```bash
npx @railway/cli run npx prisma migrate deploy
```

---

## ✅ Verification

### Check Deployment

1. Go to Railway dashboard
2. Click on your service
3. Go to **"Deployments"** tab
4. You should see deployment status

### Get Your Backend URL

1. In Railway dashboard
2. Click on your service
3. Go to **"Settings"** tab
4. Scroll to **"Domains"**
5. Your URL will be: `[service-name].up.railway.app`

Or use CLI:
```bash
npx @railway/cli domain
```

---

## 🔄 Auto-Deploy Workflow

Once connected:

1. **Make changes** in your code
2. **Commit and push** to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```
3. **Railway automatically**:
   - Detects the push
   - Builds your application
   - Deploys it
   - Updates your service

---

## 🛠️ Troubleshooting

### Issue: "Repository not found"

**Solution**: 
- Make sure Railway has access to your GitHub account
- Check repository is not private (or Railway has access to private repos)

### Issue: "Build failed"

**Solution**:
- Check build logs in Railway dashboard
- Ensure `package.json` has `build` and `start` scripts
- Test build locally: `npm run build`

### Issue: "Cannot find module"

**Solution**:
- Ensure all dependencies are in `dependencies` (not just `devDependencies`)
- Railway installs with `npm install --production` by default

---

## 📝 Checklist

- [ ] Railway account created
- [ ] GitHub repository exists
- [ ] Railway connected to GitHub repository
- [ ] Backend directory selected
- [ ] PostgreSQL database added
- [ ] Environment variables set
- [ ] Code pushed to GitHub
- [ ] Deployment successful
- [ ] Migrations run
- [ ] Backend URL obtained

---

## 🎯 Quick Start

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **New Project** → **GitHub Repo**
3. **Select your repository**
4. **Select `backend` directory**
5. **Add PostgreSQL database**
6. **Set environment variables**
7. **Done!** Railway will deploy automatically

---

## 💡 Tips

- **Auto-deploy**: Railway deploys automatically on every push
- **Branch selection**: You can deploy from specific branches
- **Preview deployments**: Railway can create preview deployments for PRs
- **Rollback**: Easy to rollback to previous deployments in dashboard

**Once connected, Railway will handle everything automatically!** 🚀
