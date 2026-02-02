# Find GitHub Connection at Service Level

## 🎯 GitHub is at Service Level, Not Project Level

Since you only see Vercel in Project Settings → Integrations, the GitHub connection is likely configured at the **service level**, not the project level.

---

## Step 1: Go to Your Service

1. **Click on "bld-online-production"** in the breadcrumbs at the top
   - Or click "Architecture" in the top navigation
   - This takes you back to your service view

2. **Click on your service card**
   - Should be named "BLD-Online-Production" or similar
   - The card that shows "Crashed" or deployment status

---

## Step 2: Open Service Settings

1. **Click the "Settings" tab** on your service
   - Should be in the top navigation of the service view
   - Or click the gear icon on the service card

2. **Look for "Source" section**
   - This is where GitHub connection is configured
   - Should show:
     - Repository connection
     - Branch selection
     - Auto-deploy toggle

---

## Step 3: Connect GitHub (If Not Connected)

If you don't see a GitHub connection:

1. **In Service Settings → Source**
2. **Click "Connect GitHub Repo"** or **"Change Source"**
3. **Select your repository**: `nmatunog/BLDCebu-Online-Portal`
4. **Select branch**: `main`
5. **Enable "Auto Deploy"** toggle
6. **Save**

---

## Alternative: Check How Service Was Created

If the service was created from GitHub:
- It should already be connected
- Check Service Settings → Source

If the service was created manually:
- You need to connect it to GitHub
- Go to Service Settings → Source → Connect GitHub

---

## 📋 Quick Checklist

- [ ] Navigated to service (not project settings)
- [ ] Opened Service Settings tab
- [ ] Found "Source" section
- [ ] Verified GitHub repository is connected
- [ ] Verified branch is `main`
- [ ] Enabled "Auto Deploy" toggle
- [ ] Saved changes

---

**The GitHub connection is at the SERVICE level, not the project level!**
