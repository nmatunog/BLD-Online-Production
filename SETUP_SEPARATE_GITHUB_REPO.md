# Setting Up Separate GitHub Repository for Production

## 🎯 Why a Separate Repository?

**Benefits**:
- ✅ Separate production and development codebases
- ✅ Different deployment configurations
- ✅ Clean production history
- ✅ Easier to manage production-specific changes
- ✅ Can have different access controls

**Considerations**:
- ⚠️ Need to sync changes between repos (or use one as source of truth)
- ⚠️ Two repos to maintain

---

## 🚀 Option 1: Create New Repository from Current Code

### Step 1: Create New GitHub Repository

1. Go to https://github.com/new
2. Repository name: `BLDCebu-Online-Portal-Production` (or your preferred name)
3. Description: "BLD Cebu Online Portal - Production Deployment"
4. Visibility: Private (recommended) or Public
5. **Don't** initialize with README, .gitignore, or license
6. Click "Create repository"

### Step 2: Add New Remote and Push

```bash
# In your current project directory
cd /Users/nmatunog2/BLDCebu-Online-Portal

# Add the new repository as a remote
git remote add production https://github.com/YOUR_USERNAME/BLDCebu-Online-Portal-Production.git

# Push current code to new repository
git push production main
```

**Or if you want to push a specific branch:**
```bash
git push production main:main
```

### Step 3: Verify

Check your new repository on GitHub - it should have all your code.

---

## 🔄 Option 2: Fork/Copy Current Repository

### Step 1: Create New Repository on GitHub

Same as Option 1, Step 1.

### Step 2: Clone and Push

```bash
# Clone your current repository (if not already)
cd ~
git clone https://github.com/YOUR_USERNAME/BLDCebu-Online-Portal.git temp-repo
cd temp-repo

# Remove old remote
git remote remove origin

# Add new remote
git remote add origin https://github.com/YOUR_USERNAME/BLDCebu-Online-Portal-Production.git

# Push to new repository
git push -u origin main
```

---

## 🌿 Option 3: Create Production Branch in Same Repo (Alternative)

If you prefer to keep everything in one repo but separate deployments:

### Step 1: Create Production Branch

```bash
git checkout -b production
git push -u origin production
```

### Step 2: Configure Vercel/Railway

- Vercel: Deploy from `production` branch
- Railway: Deploy from `production` branch

**Benefits**:
- ✅ One repository
- ✅ Easy to sync changes
- ✅ Separate deployment branch

---

## 📋 Recommended: Option 1 (Separate Repository)

### Complete Setup Steps:

#### 1. Create New GitHub Repository

```bash
# Repository name: BLDCebu-Online-Portal-Production
# Visibility: Private (recommended)
```

#### 2. Add Remote and Push

```bash
cd /Users/nmatunog2/BLDCebu-Online-Portal

# Check current remotes
git remote -v

# Add production remote
git remote add production https://github.com/YOUR_USERNAME/BLDCebu-Online-Portal-Production.git

# Push to production repository
git push production main
```

#### 3. Verify New Repository

- Go to your new GitHub repository
- Verify all files are there
- Check that it's separate from your main repo

---

## 🔗 Connect Vercel to New Repository

### Step 1: Import Project in Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import from GitHub
4. Select: `BLDCebu-Online-Portal-Production`
5. Configure:
   - Framework Preset: Next.js
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `.next`
6. Click "Deploy"

### Step 2: Set Environment Variables

In Vercel dashboard:
- `NEXT_PUBLIC_API_BASE_URL` = Your Railway backend URL
- `NEXT_PUBLIC_API_URL` = Your Railway backend URL + `/api/v1`
- `NODE_ENV` = `production`

---

## 🚂 Connect Railway to New Repository

### Step 1: Deploy from GitHub

1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose: `BLDCebu-Online-Portal-Production`
5. Select the `backend` directory
6. Railway will auto-detect and deploy

### Step 2: Add PostgreSQL

1. In Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway automatically sets `DATABASE_URL`

### Step 3: Set Environment Variables

In Railway dashboard:
- `NODE_ENV` = `production`
- `API_PREFIX` = `api/v1`
- `PORT` = `4000`
- `JWT_SECRET` = (generate strong random string)
- `JWT_REFRESH_SECRET` = (generate strong random string)

---

## 🔄 Syncing Changes Between Repos

### Option A: Manual Sync (Recommended for Production)

When you want to update production:

```bash
# In your development repo
cd /Users/nmatunog2/BLDCebu-Online-Portal

# Make sure you're on main branch
git checkout main
git pull origin main

# Push to production repo
git push production main
```

Vercel and Railway will auto-deploy from the new push.

### Option B: Automated Sync (GitHub Actions)

Create `.github/workflows/sync-production.yml`:

```yaml
name: Sync to Production Repo

on:
  push:
    branches:
      - main

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Push to production repo
        run: |
          git remote add production https://github.com/YOUR_USERNAME/BLDCebu-Online-Portal-Production.git
          git push production main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 📁 Repository Structure

### Development Repository:
```
BLDCebu-Online-Portal/
├── backend/
├── frontend/
├── scripts/
└── ... (all development files)
```

### Production Repository:
```
BLDCebu-Online-Portal-Production/
├── backend/          # Deployed to Railway
├── frontend/         # Deployed to Vercel
├── scripts/          # Production scripts
└── ... (production-ready code)
```

---

## 🎯 Workflow Recommendation

### Development Flow:

1. **Develop** in main repository
2. **Test** locally
3. **Commit** to main branch
4. **Push to production repo** when ready:
   ```bash
   git push production main
   ```
5. **Vercel/Railway auto-deploy** from production repo

### Production Updates:

1. Make changes in development repo
2. Test thoroughly
3. Push to production repo
4. Monitor deployment in Vercel/Railway

---

## ✅ Checklist

- [ ] Create new GitHub repository
- [ ] Add production remote to current repo
- [ ] Push code to production repository
- [ ] Connect Vercel to production repository
- [ ] Connect Railway to production repository
- [ ] Set up environment variables
- [ ] Configure domain (app.BLDCebu.com)
- [ ] Test deployment
- [ ] Set up sync workflow (optional)

---

## 💡 Tips

1. **Keep production repo clean**: Only push production-ready code
2. **Use tags/releases**: Tag production deployments for easy rollback
3. **Separate branches**: Use `main` for production, `develop` for development
4. **Document differences**: Note any production-specific configurations

---

## 🚀 Quick Start Commands

```bash
# 1. Create new repo on GitHub (via web interface)

# 2. Add remote
git remote add production https://github.com/YOUR_USERNAME/BLDCebu-Online-Portal-Production.git

# 3. Push to production
git push production main

# 4. Connect Vercel/Railway to new repo (via dashboards)
```

---

## 📚 Next Steps

After setting up the separate repository:

1. ✅ Push code to production repo
2. ✅ Connect Vercel to production repo
3. ✅ Connect Railway to production repo
4. ✅ Deploy and configure
5. ✅ Set up sync workflow (optional)

**You're ready to deploy!** 🎉
