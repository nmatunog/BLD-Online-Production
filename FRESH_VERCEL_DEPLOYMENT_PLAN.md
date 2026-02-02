# Fresh Vercel Deployment Plan

## Current Problems
1. Vercel not auto-deploying from GitHub commits
2. Build failures: "cd frontend: No such file or directory"
3. Configuration mismatch between project settings and production overrides
4. Going in circles with fixes

## Root Cause Analysis

### Issue 1: Root Directory Configuration
- **Problem**: Vercel doesn't know where the Next.js app is located
- **Current State**: Root Directory is set to `frontend` in Vercel UI
- **Issue**: `vercel.json` had `cd frontend` commands, but when Root Directory is `frontend`, Vercel already runs from there

### Issue 2: Auto-Deploy Not Working
- **Problem**: GitHub webhook not triggering deployments
- **Possible Causes**: 
  - Webhook expired or misconfigured
  - Production Branch setting not visible/configured
  - Repository connection issue

### Issue 3: Build Configuration Mismatch
- **Problem**: Production Overrides differ from Project Settings
- **Impact**: Build uses wrong commands/paths

## Fresh Approach - Step by Step

### Phase 1: Clean Local State ✅
1. **Test local build first**
   ```bash
   cd frontend
   rm -rf .next node_modules
   npm ci
   npm run build
   ```
   - If this fails, fix code issues first
   - Don't deploy broken code

2. **Verify all changes are committed**
   ```bash
   git status
   git add -A
   git commit -m "Clean commit before fresh Vercel setup"
   ```

### Phase 2: Reset Vercel Configuration 🔄

#### Option A: Disconnect and Reconnect (Recommended)
1. Go to: https://vercel.com/nilo-matunogs-projects/bld-online-production/settings/git
2. Click **"Disconnect"** button
3. Click **"Connect Git Repository"**
4. Select: `nmatunog/BLD-Online-Production`
5. **During setup, configure:**
   - **Production Branch**: `main` (select from dropdown)
   - **Root Directory**: `frontend` (enter manually)
   - **Framework Preset**: `Next.js` (select from dropdown)
6. Click **"Save"**

#### Option B: Manual Configuration (If Option A doesn't work)
1. Go to: https://vercel.com/nilo-matunogs-projects/bld-online-production/settings/build-and-deployment
2. Set **Root Directory**: `frontend`
3. Set **Framework Preset**: `Next.js`
4. **Remove any Production Overrides:**
   - Click on the blue link in "Production Overrides" section
   - Remove or reset any overrides
5. Click **"Save"**

### Phase 3: Minimal vercel.json (No cd frontend) ✅
- **Status**: Using minimal `vercel.json` at repo root with `installCommand: "npm ci"` and `buildCommand: "npm run build"`.
- **Why**: Root Directory=`frontend` means these run inside `frontend/`. No `cd frontend` in commands (that caused "No such file or directory").

### Phase 4: Verify GitHub Connection 🔍
1. Go to GitHub: https://github.com/nmatunog/BLD-Online-Production/settings/hooks
2. Check for Vercel webhook:
   - Should show `vercel.com` in URL
   - Status should be "Active" (green)
   - Recent deliveries should show successful requests
3. If missing or failed:
   - Reconnect repository in Vercel (Phase 2)

### Phase 5: Test Deployment 🧪
1. **Make a small test change:**
   ```bash
   # Add a comment to any file
   echo "# Test deployment" >> frontend/README.md
   git add frontend/README.md
   git commit -m "Test: Trigger Vercel deployment"
   git push production main
   ```

2. **Watch Vercel Dashboard:**
   - Go to: https://vercel.com/nilo-matunogs-projects/bld-online-production/deployments
   - Should see new deployment start automatically within seconds
   - If not, manually trigger: Click "..." → "Redeploy" → Select latest commit

### Phase 6: Verify Build Success ✅
1. Check build logs for:
   - ✅ No "cd frontend" errors
   - ✅ npm install succeeds
   - ✅ npm run build succeeds
   - ✅ No TypeScript/ESLint errors

2. If build fails:
   - Check the specific error
   - Fix locally first (Phase 1)
   - Then redeploy

## Expected Vercel Settings (Final State)

### Build and Deployment Settings:
- **Root Directory**: `frontend`
- **Framework Preset**: `Next.js`
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)
- **Install Command**: `npm install` (auto-detected)

### Git Settings:
- **Repository**: `nmatunog/BLD-Online-Production`
- **Production Branch**: `main`
- **Auto-deploy**: Enabled

## Troubleshooting Checklist

If auto-deploy still doesn't work:
- [ ] Check GitHub webhook is active
- [ ] Verify Production Branch is `main`
- [ ] Check if there are Production Overrides
- [ ] Try disconnecting and reconnecting repository
- [ ] Manually trigger a deployment to test

If build still fails:
- [ ] Test local build first (`cd frontend && npm run build`)
- [ ] Check Root Directory is exactly `frontend` (no trailing slash)
- [ ] Verify Framework Preset is `Next.js` (not "Other")
- [ ] Check for any remaining `vercel.json` file
- [ ] Review build logs for specific error messages

## Success Criteria
- ✅ Vercel auto-deploys when you push to `main` branch
- ✅ Build completes successfully
- ✅ App is accessible at Vercel URL
- ✅ No configuration warnings in Vercel dashboard

## Next Steps
1. Follow Phase 1: Test local build
2. Follow Phase 2: Reset Vercel configuration
3. Follow Phase 5: Test deployment
4. Report results
