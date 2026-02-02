# 🎉 Railway Backend is Online! Next Steps

## ✅ What's Done

- ✅ Backend deployed to Railway
- ✅ PostgreSQL database added
- ✅ Build successful
- ✅ Service running

---

## 🔗 Step 1: Get Your Backend URL

### Option A: Railway Dashboard
1. Go to Railway dashboard
2. Click on your backend service
3. Go to **"Settings"** tab
4. Scroll to **"Domains"**
5. Your URL: `https://[service-name].up.railway.app`

### Option B: Railway CLI
```bash
npx @railway/cli domain
```

**Save this URL** - you'll need it for the frontend!

---

## 🗄️ Step 2: Run Database Migrations

Your database needs the schema. Run migrations:

### Option A: Railway Dashboard
1. Go to your service
2. Click **"Deployments"** tab
3. Click on latest deployment
4. Go to **"Shell"** tab
5. Run: `npx prisma migrate deploy`

### Option B: Railway CLI
```bash
cd backend
npx @railway/cli run npx prisma migrate deploy
```

---

## ⚙️ Step 3: Set Environment Variables (If Not Done)

In Railway dashboard → Your service → **Variables** tab:

- ✅ `DATABASE_URL` (auto-set by Railway)
- ✅ `NODE_ENV` = `production`
- ✅ `API_PREFIX` = `api/v1`
- ✅ `PORT` = `4000` (Railway sets this automatically)
- ⚠️ `JWT_SECRET` = (generate if not set)
- ⚠️ `JWT_REFRESH_SECRET` = (generate if not set)

**Generate JWT secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## ✅ Step 4: Test Your Backend

### Test API Documentation:
Visit: `https://[your-railway-url].up.railway.app/api/docs`

You should see Swagger API documentation!

### Test Health Endpoint:
```bash
curl https://[your-railway-url].up.railway.app/api/v1/health
```

---

## 🌐 Step 5: Deploy Frontend to Vercel

Now that backend is ready, deploy frontend:

### Quick Steps:
1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy Frontend:**
   ```bash
   cd frontend
   vercel login
   vercel
   ```

3. **Set Environment Variables in Vercel:**
   - Go to Vercel dashboard → Your project → Settings → Environment Variables
   - Add:
     - `NEXT_PUBLIC_API_BASE_URL` = `https://[your-railway-url].up.railway.app`
     - `NEXT_PUBLIC_API_URL` = `https://[your-railway-url].up.railway.app/api/v1`
     - `NODE_ENV` = `production`

4. **Redeploy:**
   ```bash
   vercel --prod
   ```

---

## 🌍 Step 6: Configure Custom Domain

### Add Domain in Vercel:
1. Go to Vercel dashboard
2. Select your frontend project
3. Go to **Settings** → **Domains**
4. Add: `app.BLDCebu.com`

### Configure DNS:
At your domain registrar, add:
```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
```

---

## 📊 Summary

### What You Have:
- ✅ **Backend**: Railway (online!)
- ⏳ **Frontend**: Vercel (next step)
- ✅ **Database**: PostgreSQL on Railway
- ⏳ **Domain**: app.BLDCebu.com (configure after Vercel)

### Costs:
- **Railway**: $5-20/month ✅
- **Vercel**: FREE ✅
- **Total**: ~$5-20/month (vs $175/month on Google Cloud!)

---

## 🎯 Quick Checklist

- [ ] Get backend URL from Railway
- [ ] Run database migrations
- [ ] Test backend API (visit /api/docs)
- [ ] Set JWT secrets in Railway (if not done)
- [ ] Deploy frontend to Vercel
- [ ] Set frontend environment variables (backend URL)
- [ ] Configure domain app.BLDCebu.com
- [ ] Test full application

---

## 🚀 You're Almost There!

**Backend is live!** Now just:
1. Deploy frontend to Vercel
2. Connect them together
3. Add your domain

**Great progress!** 🎉
