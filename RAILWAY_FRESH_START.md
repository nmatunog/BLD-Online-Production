# Railway Fresh Start Deployment

## 🎯 New Approach: Use Railway's Native Build System

Instead of fighting with Dockerfiles and OpenSSL, we'll:
1. **Remove Dockerfile complexity** - Let Railway auto-detect
2. **Use Railway's PostgreSQL** - Native integration
3. **Use Nixpacks** - Railway's optimized build system
4. **Simplify Prisma setup** - Let Railway handle it

---

## Step 1: Clean Up Current Setup

### Remove Dockerfile (we'll use Nixpacks instead)

```bash
# Optionally backup first
mv backend/Dockerfile backend/Dockerfile.backup
```

### Simplify Prisma Schema

Use the simplest binary target that works:

```prisma
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native"]
}
```

---

## Step 2: Set Up Railway Project Fresh

### 2.1 Create New Railway Project

1. Go to [Railway Dashboard](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository
5. **Don't configure anything yet** - let Railway auto-detect

### 2.2 Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically:
   - Create the database
   - Set `DATABASE_URL` environment variable
   - Handle connection pooling

### 2.3 Add Backend Service

1. Click "+ New" → "GitHub Repo"
2. Select your repository
3. **Set Root Directory**: `backend`
4. Railway will auto-detect:
   - Node.js project
   - Build command: `npm run build`
   - Start command: `npm start`

---

## Step 3: Configure Environment Variables

In Railway dashboard, go to your backend service → Variables:

### Required Variables

```bash
# Database (automatically set by Railway PostgreSQL)
DATABASE_URL=postgresql://... (auto-set by Railway)

# JWT Secrets (generate new ones)
JWT_SECRET=<generate-new-secret>
JWT_REFRESH_SECRET=<generate-new-secret>

# Frontend URL (set after deploying frontend)
FRONTEND_URL=https://your-frontend.vercel.app

# Node Environment
NODE_ENV=production

# API Configuration
API_PREFIX=api/v1
PORT=4000
```

### Generate JWT Secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Run twice to get both secrets
```

---

## Step 4: Update Nixpacks Configuration

Create/update `backend/nixpacks.toml`:

```toml
[phases.setup]
nixPkgs = ["nodejs-20_x"]

[phases.install]
cmds = [
  "npm install"
]

[phases.build]
cmds = [
  "npx prisma generate",
  "npm run build"
]

[start]
cmd = "npm start"
```

**Key points:**
- No OpenSSL complexity
- Let Nixpacks handle system dependencies
- Simple, straightforward build

---

## Step 5: Update Railway Configuration

Create/update `backend/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
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

**Important:** Use `NIXPACKS` builder, not `DOCKERFILE`

---

## Step 6: Simplify Package.json

Ensure your `package.json` has:

```json
{
  "scripts": {
    "build": "prisma generate && nest build",
    "start": "node dist/main.js",
    "postinstall": "prisma generate"
  }
}
```

---

## Step 7: Deploy

### 7.1 Push to GitHub

```bash
git add backend/nixpacks.toml backend/railway.json backend/prisma/schema.prisma
git commit -m "Fresh Railway deployment: Use Nixpacks native build"
git push
```

### 7.2 Railway Auto-Deploy

Railway will:
1. Detect the push
2. Use Nixpacks to build
3. Auto-detect Node.js
4. Run `npm install`
5. Run build commands
6. Start the service

### 7.3 Run Migrations

After first deploy, run migrations:

```bash
# In Railway dashboard, go to your backend service
# Click "Deployments" → "View Logs"
# Or use Railway CLI:

npx @railway/cli run --service <your-service-id> npx prisma migrate deploy
```

---

## Step 8: Verify Deployment

1. **Check Health Endpoint**:
   ```
   GET https://your-service.railway.app/api/v1/health
   ```

2. **Check API Docs**:
   ```
   GET https://your-service.railway.app/api/docs
   ```

3. **Check Logs**:
   - Railway Dashboard → Your Service → Logs
   - Should see: "Backend server running"
   - Should NOT see: OpenSSL errors

---

## Why This Should Work

✅ **Nixpacks**: Railway's optimized build system handles OpenSSL automatically
✅ **Native PostgreSQL**: Railway's database service handles connections
✅ **Auto-detection**: Railway figures out what you need
✅ **No Docker complexity**: Let Railway handle the infrastructure

---

## Troubleshooting

### If Build Fails

1. Check Railway build logs
2. Verify `nixpacks.toml` syntax
3. Ensure `railway.json` uses `NIXPACKS` builder

### If OpenSSL Error Persists

1. Check Railway logs for exact error
2. Try updating `nixpacks.toml` to explicitly include OpenSSL:
   ```toml
   [phases.setup]
   nixPkgs = ["nodejs-20_x", "openssl"]
   ```

### If Database Connection Fails

1. Verify `DATABASE_URL` is set (should be automatic)
2. Check Railway PostgreSQL service is running
3. Verify database migrations ran

---

## Next Steps After Backend Works

1. Deploy frontend to Vercel
2. Set `FRONTEND_URL` in Railway
3. Set `NEXT_PUBLIC_API_BASE_URL` in Vercel
4. Test full stack

---

**This fresh approach should work because we're using Railway's native tools instead of fighting with Docker!**
