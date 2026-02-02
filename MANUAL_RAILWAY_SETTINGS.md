# Manual Railway Settings Fix

## 🚨 Railway is Still Using Dockerfile

Even after removing all Dockerfiles, Railway might still be using cached settings or manual configuration.

## ✅ Manual Fix Required

### Step 1: Go to Railway Dashboard

1. Open [Railway Dashboard](https://railway.app)
2. Navigate to your project
3. Click on your **backend service**

### Step 2: Change Builder Settings

1. Click **"Settings"** tab (or gear icon)
2. Scroll to **"Build"** section
3. Look for **"Builder"** or **"Build Method"** dropdown
4. **Change it from "Dockerfile" to "Nixpacks"**
5. Click **"Save"** or **"Update"**

### Step 3: Verify Root Directory

While in Settings:

1. Check **"Root Directory"** setting
2. Should be set to: `backend`
3. If not, set it to `backend`

### Step 4: Trigger Redeploy

1. Go to **"Deployments"** tab
2. Click **"Redeploy"** button
3. Or wait for Railway to auto-detect the git push

### Step 5: Verify Build Logs

After redeploy starts, check build logs:

**Should see:**
- ✅ "Using Nixpacks builder"
- ✅ "Detected Node.js project"
- ✅ "Installing dependencies..."
- ✅ No Docker-related messages

**Should NOT see:**
- ❌ "Building Docker image"
- ❌ "Using Dockerfile"
- ❌ Docker-related commands

---

## 🔍 Alternative: Railway CLI

If dashboard doesn't work, use CLI:

```bash
# Login to Railway
npx @railway/cli login

# List services
npx @railway/cli service list

# Update builder (replace SERVICE_ID)
npx @railway/cli service update SERVICE_ID --builder nixpacks
```

---

## 📋 Checklist

- [ ] Removed all Dockerfile files
- [ ] `railway.json` has `"builder": "NIXPACKS"`
- [ ] `nixpacks.toml` exists
- [ ] `.railwayignore` created
- [ ] **Manually changed builder in Railway dashboard**
- [ ] Root directory set to `backend`
- [ ] Triggered redeploy
- [ ] Verified build logs show Nixpacks

---

## 💡 Why Manual Override is Needed

Railway might have:
- Cached the Dockerfile builder setting
- Manually configured builder in dashboard
- Detected Dockerfile before we removed it

**The dashboard override is the most reliable way to force Nixpacks!**
