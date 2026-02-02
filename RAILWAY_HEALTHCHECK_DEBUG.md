# Railway Healthcheck Debugging

## 🚨 Problem: "Service Unavailable"

The healthcheck is failing with "service unavailable" even though:
- ✅ Build succeeds
- ✅ Service starts (logs show "Backend server running")
- ✅ Health endpoint exists at `/api/v1/health`

---

## 🔍 Possible Causes

### 1. Health Route Not Registered
- Health endpoint might not be in route logs
- Check deploy logs for: `RouterExplorer] Mapped {/api/v1/health`
- If missing, the route isn't registered

### 2. Port Mismatch
- Railway sets `PORT` environment variable
- Service might be listening on wrong port
- Check deploy logs for actual PORT value

### 3. Service Binding Issue
- Service might be binding to `localhost` instead of `0.0.0.0`
- Railway can't reach `localhost` from outside container
- Check logs: should show `0.0.0.0:${port}` not `localhost:${port}`

### 4. Service Crashes After Start
- Service starts but crashes before healthcheck
- Check deploy logs for errors after "Backend server running"

---

## ✅ What to Check in Deploy Logs

### Look for:

1. **Route Registration**:
   ```
   [RouterExplorer] Mapped {/api/v1/health, GET} route
   ```
   - If this is MISSING, the route isn't registered

2. **Service Binding**:
   ```
   🚀 Backend server running on http://0.0.0.0:8080
   ```
   - Should show `0.0.0.0` NOT `localhost`

3. **PORT Variable**:
   ```
   🔍 PORT environment variable: 8080
   ```
   - Should match Railway's expected port

4. **Health Endpoint Log**:
   ```
   ❤️  Health check available at http://0.0.0.0:8080/api/v1/health
   ```

---

## 🔧 Quick Fixes to Try

### Fix 1: Verify Health Route is Registered

Check deploy logs - if health route is missing:
- HealthModule might not be loaded
- Check app.module.ts has HealthModule imported

### Fix 2: Check PORT Environment Variable

Railway Dashboard → Service → Variables:
- Verify `PORT` is set (Railway sets this automatically)
- If not set, add it manually

### Fix 3: Test Health Endpoint Manually

1. Get your Railway service URL
2. Visit: `https://your-service.railway.app/api/v1/health`
3. Should return JSON
4. If it works manually, Railway healthcheck config might be wrong

### Fix 4: Disable Healthcheck Temporarily

Railway Dashboard → Service → Settings → Deploy:
- Remove or change healthcheck path
- Deploy without healthcheck
- Verify service is accessible

---

## 📋 Next Steps

1. **Check deploy logs** for route registration
2. **Verify PORT** environment variable
3. **Test health endpoint** manually
4. **Share deploy logs** if still failing

---

**The debug logging I just added will help identify the issue!**
