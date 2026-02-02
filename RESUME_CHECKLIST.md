# Resume Checklist - Railway + Vercel Deployment

## ✅ Completed

- [x] Railway backend deployed
- [x] JWT_SECRET configured
- [x] App starting and routes mapping
- [x] OpenSSL fix prepared

## 🔄 Next Steps

### Step 1: Push OpenSSL Fix

```bash
git add backend/railway.json backend/nixpacks.toml backend/package.json
git commit -m "Fix OpenSSL for Prisma on Railway"
git push
```

Railway will auto-redeploy after push.

### Step 2: Verify Backend is Working

After redeploy, check:
- Railway logs show no errors
- Backend URL is accessible
- API docs work: `https://[railway-url]/api/docs`

### Step 3: Run Database Migrations

```bash
cd backend
npx @railway/cli run npx prisma migrate deploy
```

### Step 4: Deploy Frontend to Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy:
   ```bash
   cd frontend
   vercel login
   vercel
   ```

3. Set environment variables in Vercel:
   - `NEXT_PUBLIC_API_BASE_URL` = Your Railway backend URL
   - `NEXT_PUBLIC_API_URL` = Your Railway backend URL + `/api/v1`
   - `NODE_ENV` = `production`

4. Redeploy:
   ```bash
   vercel --prod
   ```

### Step 5: Configure Domain

1. In Vercel dashboard → Settings → Domains
2. Add: `app.BLDCebu.com`
3. Configure DNS at registrar:
   - Type: CNAME
   - Name: app
   - Value: cname.vercel-dns.com

## 📊 Current Status

- **Backend**: Railway (needs OpenSSL fix redeploy)
- **Frontend**: Not deployed yet
- **Database**: PostgreSQL on Railway (needs migrations)
- **Domain**: Not configured yet

## 🎯 Goal

Get everything working:
- Backend on Railway ✅ (almost - just OpenSSL fix)
- Frontend on Vercel ⏳
- Domain configured ⏳
- Database migrated ⏳
