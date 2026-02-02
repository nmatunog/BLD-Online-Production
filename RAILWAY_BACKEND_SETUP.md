# Railway Backend Setup - Quick Reference

## ✅ Backend Deployed Successfully!

**Service URL:** `https://bld-online-production-production.up.railway.app`

## 🔗 Important Endpoints

- **Health Check:** `https://bld-online-production-production.up.railway.app/health`
- **API Documentation:** `https://bld-online-production-production.up.railway.app/api/docs`
- **API Base URL:** `https://bld-online-production-production.up.railway.app/api/v1`

## ✅ Next Steps

### 1. Test the Health Endpoint
Open in your browser:
```
https://bld-online-production-production.up.railway.app/health
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "...",
  "service": "BLD Cebu Online Portal API",
  "uptime": ...
}
```

### 2. Verify Environment Variables in Railway

Go to Railway Dashboard → Your Service → **Variables** tab

**Required Variables:**
- ✅ `DATABASE_URL` - Should be auto-set from Railway PostgreSQL
- ✅ `JWT_SECRET` - Your JWT secret (should be set)
- ✅ `JWT_REFRESH_SECRET` - Your refresh token secret (should be set)
- ✅ `NODE_ENV=production`
- ✅ `API_PREFIX=api/v1`
- ⚠️ `FRONTEND_URL` - Set this to your Vercel URL when ready (e.g., `https://app.BLDCebu.com`)

### 3. Run Database Migrations

**Option A: Via Railway CLI (Recommended)**
```bash
cd backend
npx @railway/cli run --service bld-online-production npx prisma migrate deploy
```

**Option B: Via Railway Dashboard**
1. Go to your service → **Deployments** tab
2. Click **"..."** (three dots) → **"Run Command"**
3. Run: `npx prisma migrate deploy`

**Option C: Local with Railway Database**
```bash
cd backend
# Get DATABASE_URL from Railway Variables
export DATABASE_URL="your-railway-database-url"
npx prisma migrate deploy
```

### 4. Create First Admin User

After migrations, create your first admin user:

```bash
cd backend
export DATABASE_URL="your-railway-database-url"
npx ts-node scripts/create-admin-user.ts
```

Or use the compiled version:
```bash
npm run build
node dist/scripts/create-admin-user.js
```

### 5. Test API Endpoints

- **Health:** `GET /health` ✅ (should work)
- **API Docs:** `GET /api/docs` (Swagger UI)
- **Login:** `POST /api/v1/auth/login`

## 🚀 Frontend Deployment (Next)

Once backend is fully working:
1. Deploy frontend to Vercel
2. Set `NEXT_PUBLIC_API_BASE_URL` to your Railway URL
3. Configure CORS in backend to allow Vercel domain

---

**Backend Status:** ✅ Deployed and Healthy
**Next:** Run database migrations and create admin user
