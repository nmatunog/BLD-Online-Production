# Railway Build Failure Troubleshooting

## 🔍 Common Build Failure Causes

### 1. Missing Build Script

Railway needs a build script in `package.json`:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js"
  }
}
```

### 2. Missing Start Script

Railway needs a start script:

```json
{
  "scripts": {
    "start": "node dist/main.js"
  }
}
```

### 3. Prisma Not Generated

If using Prisma, you need to generate the client:

```json
{
  "scripts": {
    "build": "prisma generate && nest build",
    "postinstall": "prisma generate"
  }
}
```

### 4. Missing Dependencies

Check that all dependencies are in `package.json`, not just `devDependencies`.

### 5. TypeScript Build Errors

Check for TypeScript errors locally:
```bash
cd backend
npm run build
```

### 6. Missing Environment Variables

Railway needs certain environment variables set.

---

## 🔧 Quick Fixes

### Fix 1: Add Build Scripts

Ensure `backend/package.json` has:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js",
    "start:prod": "node dist/main.js"
  }
}
```

### Fix 2: Add Prisma Generate

If using Prisma:

```json
{
  "scripts": {
    "build": "prisma generate && nest build",
    "postinstall": "prisma generate"
  }
}
```

### Fix 3: Check Railway Configuration

Railway should auto-detect Node.js, but you can create `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Fix 4: Check Build Logs

1. Go to Railway dashboard
2. Click on your service
3. Go to "Deployments" tab
4. Click on the failed deployment
5. Check "Build Logs" for errors

Common errors to look for:
- `npm ERR!` - Dependency issues
- `Cannot find module` - Missing dependencies
- `TypeScript error` - Code errors
- `Prisma error` - Database schema issues

---

## 🛠️ Step-by-Step Debugging

### Step 1: Check Build Locally

```bash
cd backend
npm install
npm run build
```

If this fails locally, fix the errors first.

### Step 2: Check package.json

Ensure you have:
- ✅ `build` script
- ✅ `start` script
- ✅ All dependencies listed (not just devDependencies)

### Step 3: Check for Railway-Specific Files

Create `railway.json` in backend directory:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start"
  }
}
```

### Step 4: Check Environment Variables

Ensure these are set in Railway:
- `NODE_ENV=production`
- `DATABASE_URL` (auto-set by Railway when you add PostgreSQL)
- `PORT` (Railway sets this automatically, but you can override)
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

### Step 5: Check Prisma

If using Prisma:

1. Ensure `prisma/schema.prisma` exists
2. Add to `package.json`:
   ```json
   {
     "scripts": {
       "postinstall": "prisma generate",
       "build": "prisma generate && nest build"
     }
   }
   ```

---

## 📋 Railway Configuration File

Create `backend/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install && npm run build"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/v1/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## 🔍 Common Error Messages

### Error: "Cannot find module"

**Fix**: Ensure all dependencies are in `dependencies`, not `devDependencies`

### Error: "Command 'build' not found"

**Fix**: Add build script to `package.json`:
```json
{
  "scripts": {
    "build": "nest build"
  }
}
```

### Error: "Prisma Client not generated"

**Fix**: Add to `package.json`:
```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "prisma generate && nest build"
  }
}
```

### Error: "Port already in use"

**Fix**: Railway sets PORT automatically. Use:
```typescript
const port = process.env.PORT || 4000;
```

### Error: "Database connection failed"

**Fix**: 
1. Ensure PostgreSQL is added: `railway add postgresql`
2. Check `DATABASE_URL` is set: `railway variables`
3. Run migrations: `railway run npx prisma migrate deploy`

---

## ✅ Checklist Before Deploying

- [ ] `package.json` has `build` script
- [ ] `package.json` has `start` script
- [ ] All dependencies are in `dependencies` (not just `devDependencies`)
- [ ] Prisma generate is in build script (if using Prisma)
- [ ] Build works locally: `npm run build`
- [ ] Start works locally: `npm start`
- [ ] Environment variables are set in Railway
- [ ] Database is added and `DATABASE_URL` is set
- [ ] Migrations are run: `railway run npx prisma migrate deploy`

---

## 🚀 Quick Fix Script

Run this to check your setup:

```bash
cd backend

# Check package.json has required scripts
echo "Checking package.json..."
grep -q '"build"' package.json && echo "✅ Build script found" || echo "❌ Build script missing"
grep -q '"start"' package.json && echo "✅ Start script found" || echo "❌ Start script missing"

# Try building locally
echo "Testing build..."
npm install
npm run build && echo "✅ Build successful" || echo "❌ Build failed"

# Check for Prisma
if [ -f "prisma/schema.prisma" ]; then
  echo "Prisma found - checking generate..."
  npx prisma generate && echo "✅ Prisma generate successful" || echo "❌ Prisma generate failed"
fi
```

---

## 📞 Getting Help

1. **Check Build Logs**: Railway dashboard → Service → Deployments → Failed deployment → Build Logs
2. **Check Runtime Logs**: Railway dashboard → Service → Logs
3. **Test Locally**: Fix errors locally first
4. **Railway Docs**: https://docs.railway.app

---

## 🎯 Most Common Fix

**90% of build failures** are due to missing build/start scripts. Ensure your `package.json` has:

```json
{
  "scripts": {
    "build": "nest build",
    "start": "node dist/main.js"
  }
}
```

And if using Prisma:

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "prisma generate && nest build",
    "start": "node dist/main.js"
  }
}
```
