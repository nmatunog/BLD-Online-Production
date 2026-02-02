# Enable Railway Auto-Deploy

## 🎯 Enable Auto-Deploy from GitHub

Railway can automatically deploy when you push to GitHub. Here's how to enable it:

---

## Step 1: Check Service Source Connection

### Option A: Service Already Connected to GitHub

1. **Go to Railway Dashboard**
   - Navigate to your project
   - Click on your service: "BLD-Online-Production"

2. **Check Settings → Source**
   - Click **"Settings"** tab
   - Look for **"Source"** or **"GitHub"** section
   - Should show your GitHub repository
   - Should show branch (usually `main`)

3. **Enable Auto-Deploy**
   - Look for **"Auto Deploy"** toggle or checkbox
   - Turn it **ON**
   - Save changes

### Option B: Service Not Connected to GitHub

If your service isn't connected to GitHub:

1. **Go to Railway Dashboard**
   - Navigate to your project
   - Click on your service

2. **Connect to GitHub**
   - Click **"Settings"** tab
   - Find **"Source"** section
   - Click **"Connect GitHub Repo"** or **"Change Source"**
   - Select your repository: `nmatunog/BLDCebu-Online-Portal`
   - Select branch: `main`
   - Enable **"Auto Deploy"**
   - Save

---

## Step 2: Verify Project-Level Settings

Sometimes auto-deploy is set at the project level:

1. **Go to Railway Dashboard**
   - Click on your **Project** (not the service)
   - Click **"Settings"** tab

2. **Check GitHub Integration**
   - Look for **"GitHub"** or **"Source"** section
   - Verify repository is connected
   - Check **"Auto Deploy"** is enabled

---

## Step 3: Manual Deploy (If Auto-Deploy Doesn't Work)

If auto-deploy still doesn't work, you can manually trigger:

### Via Dashboard:

1. **Railway Dashboard → Your Service**
2. Click **"Deployments"** tab
3. Click **"Deploy"** or **"Redeploy"** button
4. Select **"Deploy latest commit"** or **"Deploy from GitHub"**

### Via Railway CLI:

```bash
# Login
npx @railway/cli login

# Deploy latest
npx @railway/cli up
```

---

## Step 4: Verify Auto-Deploy is Working

After enabling:

1. **Make a small change** (or use the empty commit we just pushed)
2. **Push to GitHub**: `git push`
3. **Check Railway Dashboard**:
   - Should see new deployment starting automatically
   - Should show "Deploying..." status
   - Should show the commit hash

---

## 🔍 Troubleshooting

### Auto-Deploy Not Working?

1. **Check GitHub Connection**
   - Railway Dashboard → Project Settings → GitHub
   - Verify repository is connected
   - Check Railway has access to your repo

2. **Check Branch**
   - Verify Railway is watching `main` branch
   - If you push to a different branch, it won't auto-deploy

3. **Check Service Settings**
   - Service Settings → Source
   - Verify branch is `main`
   - Verify auto-deploy is enabled

4. **Check Railway Status**
   - Railway might have issues
   - Check Railway status page

5. **Reconnect GitHub**
   - Try disconnecting and reconnecting GitHub
   - Railway Dashboard → Project Settings → GitHub → Disconnect
   - Then reconnect and enable auto-deploy

---

## 📋 Quick Checklist

- [ ] Service is connected to GitHub repository
- [ ] Branch is set to `main` (or your default branch)
- [ ] Auto-deploy is enabled (toggle ON)
- [ ] Pushed a test commit
- [ ] Railway automatically started deployment
- [ ] Deployment shows latest commit hash

---

## 💡 Alternative: Use Railway CLI for Deployments

If auto-deploy is unreliable, you can deploy manually:

```bash
# Install Railway CLI (if not already)
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Deploy
railway up
```

Or add to your workflow:
```bash
# After git push, run:
npx @railway/cli up
```

---

**The key is finding the "Auto Deploy" toggle in your service or project settings!**
