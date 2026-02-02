# Quick Start: Vercel + Railway Deployment

## 🚀 Fast Track Deployment

### Prerequisites Checklist:
- [ ] Vercel account (sign up at https://vercel.com)
- [ ] Railway account (sign up at https://railway.app)
- [ ] Git repository (GitHub, GitLab, etc.)
- [ ] Domain DNS access (for app.BLDCebu.com)

---

## ⚡ Quick Deploy (5 Steps)

### Step 1: Install CLI Tools

```bash
npm install -g vercel @railway/cli
```

### Step 2: Deploy Backend to Railway

```bash
cd backend
railway login
railway init
railway add postgresql
railway up
```

**Save the Railway URL** (you'll need it for frontend)

### Step 3: Deploy Frontend to Vercel

```bash
cd frontend
vercel login
vercel
```

Follow the prompts, then set environment variables:

```bash
# Replace [RAILWAY_URL] with your actual Railway backend URL
vercel env add NEXT_PUBLIC_API_BASE_URL production
# Enter: https://[your-railway-url].up.railway.app

vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://[your-railway-url].up.railway.app/api/v1

vercel --prod
```

### Step 4: Configure Domain

1. Go to https://vercel.com/dashboard
2. Select your project → Settings → Domains
3. Add: `app.BLDCebu.com`
4. Add DNS record at registrar:
   - Type: `CNAME`
   - Name: `app`
   - Value: `cname.vercel-dns.com`

### Step 5: Update Backend CORS

In `backend/src/main.ts`, add your domain to allowed origins:

```typescript
const allowedOrigins = [
  'https://app.BLDCebu.com',
  'http://localhost:3000',
];
```

Then redeploy:
```bash
cd backend
railway up
```

---

## ✅ Done!

Your app is live at:
- **Frontend**: `https://app.BLDCebu.com`
- **Backend**: `https://[railway-url].up.railway.app`
- **API Docs**: `https://[railway-url].up.railway.app/api/docs`

**Cost**: ~$5-20/month (vs $175/month on Google Cloud!)

---

## 🔧 Troubleshooting

### Backend not connecting?
- Check CORS settings in `backend/src/main.ts`
- Verify `NEXT_PUBLIC_API_BASE_URL` is set in Vercel
- Check Railway logs: `railway logs`

### Database issues?
- Run migrations: `railway run npx prisma migrate deploy`
- Check `DATABASE_URL` in Railway dashboard

### Domain not working?
- Wait 5-30 minutes for DNS propagation
- Check DNS at https://dnschecker.org
- Verify domain added in Vercel dashboard

---

## 📚 Full Guide

See `VERCEL_RAILWAY_DEPLOYMENT.md` for detailed instructions.

---

## 🎯 Next Steps

1. Create admin user (if needed)
2. Test all features
3. Monitor costs in Railway dashboard
4. Set up backups (Railway handles this)

**You're all set!** 🎉
