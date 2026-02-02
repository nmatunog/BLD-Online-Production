# Railway Manual Deployment Guide

## 🔄 Why Auto-Deploy Might Not Work

Railway auto-deploys when:
- ✅ Code is pushed to the connected GitHub branch
- ✅ Railway is connected to your GitHub repository
- ✅ The branch matches Railway's deployment branch

If auto-deploy didn't happen, try these:

---

## ✅ Option 1: Manual Redeploy in Dashboard (Easiest)

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Select your service** (backend service)
3. **Go to "Deployments" tab**
4. **Click "Redeploy"** button on the latest deployment
5. **Wait for deployment** to complete

This will use your latest code from GitHub.

---

## ✅ Option 2: Trigger via Empty Commit

If Railway is connected to GitHub but didn't detect the push:

```bash
git commit --allow-empty -m "Trigger Railway deploy"
git push
```

This creates an empty commit that triggers Railway to redeploy.

---

## ✅ Option 3: Check GitHub Connection

Verify Railway is connected to your GitHub repo:

1. **Railway Dashboard** → Your service
2. **Settings** tab
3. **Check "Source"** section
4. **Verify**:
   - GitHub repository is connected
   - Branch is correct (usually `main`)
   - Auto-deploy is enabled

If not connected:
- Click "Connect GitHub Repo"
- Select your repository
- Select branch: `main`
- Select root directory: `backend`

---

## ✅ Option 4: Deploy via CLI

```bash
cd backend
npx @railway/cli up
```

This will:
- Build your application
- Deploy to Railway
- Use latest code

---

## 🔍 Troubleshooting

### Issue: "No deployments found"

**Solution**: Railway might not be connected to GitHub. Connect it in dashboard.

### Issue: "Build failed"

**Solution**: Check build logs in Railway dashboard for errors.

### Issue: "Service not found"

**Solution**: Make sure you're in the correct Railway project and service.

---

## 📋 Quick Checklist

- [ ] Code is pushed to GitHub
- [ ] Railway is connected to GitHub repo
- [ ] Branch matches (usually `main`)
- [ ] Auto-deploy is enabled
- [ ] Manual redeploy triggered (if auto-deploy didn't work)

---

## 🎯 Recommended: Manual Redeploy

**Easiest method**: Go to Railway dashboard and click "Redeploy"

This will:
- ✅ Use your latest code
- ✅ Apply new configuration (OpenSSL fix)
- ✅ Start the service with updated settings

**Try the manual redeploy first!**
