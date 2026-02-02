# Railway Service Crashed - Troubleshooting

## 🔍 Step 1: Check Logs

The logs will tell you exactly why it crashed.

### Option A: Railway Dashboard
1. Click on your service
2. Go to **"Deployments"** tab
3. Click on the crashed deployment
4. Click **"View Logs"** or **"Logs"** tab
5. Scroll to the bottom to see the error

### Option B: Railway CLI
```bash
npx @railway/cli logs
```

---

## 🐛 Common Crash Causes & Fixes

### 1. Database Connection Error

**Error**: `Can't reach database server` or `Connection refused`

**Fix**:
- Ensure PostgreSQL database is added in Railway
- Check `DATABASE_URL` is set: `npx @railway/cli variables`
- Run migrations: `npx @railway/cli run npx prisma migrate deploy`

### 2. Missing Environment Variables

**Error**: `JWT_SECRET is not defined` or similar

**Fix**:
- Go to Railway dashboard → Service → Variables
- Add missing variables:
  - `JWT_SECRET`
  - `JWT_REFRESH_SECRET`
  - `NODE_ENV=production`
  - `API_PREFIX=api/v1`

### 3. Port Binding Error

**Error**: `Port already in use` or `EADDRINUSE`

**Fix**: Railway sets PORT automatically. Make sure your code uses:
```typescript
const port = process.env.PORT || 4000;
await app.listen(port, '0.0.0.0');
```

### 4. Prisma Client Not Generated

**Error**: `PrismaClient is not generated` or `Cannot find module @prisma/client`

**Fix**: Ensure `package.json` has:
```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "prisma generate && nest build"
  }
}
```

### 5. Missing Dependencies

**Error**: `Cannot find module` or `Module not found`

**Fix**: 
- Check if dependencies are in `dependencies` (not `devDependencies`)
- Railway installs with `npm install --production` by default
- Move required packages to `dependencies`

### 6. Application Error

**Error**: Runtime errors, unhandled exceptions

**Fix**:
- Check application logs for specific error
- Fix the code issue
- Redeploy

---

## 🔧 Quick Fixes

### Fix 1: Check Environment Variables

```bash
npx @railway/cli variables
```

Ensure you have:
- ✅ `DATABASE_URL` (auto-set by Railway)
- ✅ `NODE_ENV=production`
- ✅ `JWT_SECRET` (generate if missing)
- ✅ `JWT_REFRESH_SECRET` (generate if missing)
- ✅ `API_PREFIX=api/v1`

### Fix 2: Generate JWT Secrets

If JWT secrets are missing:

```bash
# Generate secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then set in Railway:
```bash
npx @railway/cli variables set JWT_SECRET=<generated-secret>
npx @railway/cli variables set JWT_REFRESH_SECRET=<another-generated-secret>
```

### Fix 3: Run Migrations

If database schema is missing:

```bash
npx @railway/cli run npx prisma migrate deploy
```

### Fix 4: Restart Service

After fixing issues, restart:
- Click **"Restart"** button in Railway dashboard
- Or: `npx @railway/cli restart`

---

## 📋 Diagnostic Checklist

- [ ] Check logs for specific error
- [ ] Verify `DATABASE_URL` is set
- [ ] Verify `JWT_SECRET` and `JWT_REFRESH_SECRET` are set
- [ ] Check if migrations are run
- [ ] Verify `package.json` has correct scripts
- [ ] Check if all dependencies are in `dependencies`
- [ ] Verify port binding uses `process.env.PORT`
- [ ] Check application code for errors

---

## 🚀 Most Common Fix

**90% of crashes** are due to:
1. Missing `DATABASE_URL` → Add PostgreSQL database
2. Missing `JWT_SECRET` → Set environment variables
3. Database not migrated → Run migrations

**Quick fix:**
```bash
# 1. Check variables
npx @railway/cli variables

# 2. Set missing JWT secrets
npx @railway/cli variables set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
npx @railway/cli variables set JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# 3. Run migrations
npx @railway/cli run npx prisma migrate deploy

# 4. Restart
npx @railway/cli restart
```

---

## 📞 Next Steps

1. **Check the logs** - This will tell you the exact error
2. **Fix the issue** based on the error
3. **Restart the service**
4. **Verify it's running**

**Share the error from the logs and I'll help you fix it!**
