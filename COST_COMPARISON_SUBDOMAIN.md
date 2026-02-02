# Cost Comparison: Subdomain Setup (app.BLDCebu.com)

## 💰 Cost Breakdown

### Important: Subdomain Setup Doesn't Change Costs!

Using `app.BLDCebu.com` vs `BLDCebu.com` is just DNS routing - **no additional cost**. The cost depends on **where you host your app**, not the domain name.

---

## 📊 Platform Cost Comparison

### Option 1: Railway (All-in-One) ⭐ SIMPLEST

**Setup**:
- Backend + Frontend + Database on Railway
- `app.BLDCebu.com` → Points to Railway

**Cost**:
- **Hobby Plan**: $5/month per service
  - Backend: $5/month
  - Frontend: $5/month
  - PostgreSQL: $5/month (included in service)
  - **Total: ~$10-15/month**

- **Pro Plan**: $20/month per service
  - Backend: $20/month
  - Frontend: $20/month
  - PostgreSQL: Included
  - **Total: ~$40/month**

**Pros**:
- ✅ Simplest setup (one platform)
- ✅ Built-in database
- ✅ Automatic deployments
- ✅ Free SSL for subdomain

**Cons**:
- ⚠️ Can get expensive if you need Pro plan
- ⚠️ Hobby plan has resource limits

---

### Option 2: Vercel (Frontend) + Railway (Backend) ⭐ MOST COST-EFFECTIVE

**Setup**:
- Frontend on Vercel (free for Next.js)
- Backend on Railway
- Database on Railway
- `app.BLDCebu.com` → Points to Vercel

**Cost**:
- **Vercel Frontend**: **FREE** (Next.js optimized)
- **Railway Backend**: $5/month (Hobby) or $20/month (Pro)
- **PostgreSQL**: Included with Railway
- **Total: $5-20/month** 🎉

**Pros**:
- ✅ **Cheapest option** (Vercel is free!)
- ✅ Best performance for Next.js
- ✅ Vercel handles frontend scaling
- ✅ Railway handles backend + database

**Cons**:
- ⚠️ Two platforms to manage
- ⚠️ Need to configure CORS between them

**Best for**: Budget-conscious, Next.js apps

---

### Option 3: Render (All-in-One)

**Setup**:
- Backend + Frontend + Database on Render
- `app.BLDCebu.com` → Points to Render

**Cost**:
- **Free Tier**: $0 (with limitations - spins down after inactivity)
- **Starter Plan**: $7/month per service
  - Backend: $7/month
  - Frontend: $7/month
  - PostgreSQL: $7/month
  - **Total: ~$21/month**

- **Standard Plan**: $25/month per service
  - Backend: $25/month
  - Frontend: $25/month
  - PostgreSQL: $20/month
  - **Total: ~$70/month**

**Pros**:
- ✅ Free tier for testing
- ✅ Good for small apps

**Cons**:
- ⚠️ Free tier spins down (slow first load)
- ⚠️ More expensive than Railway for production

---

### Option 4: Fly.io (All-in-One)

**Setup**:
- Backend + Frontend + Database on Fly.io
- `app.BLDCebu.com` → Points to Fly.io

**Cost**:
- **Free Tier**: 3 shared VMs, 3GB storage
- **Paid**: ~$1.94/month per VM (256MB RAM)
  - Backend: ~$2/month
  - Frontend: ~$2/month
  - PostgreSQL: ~$2-15/month (depending on size)
  - **Total: ~$6-20/month**

**Pros**:
- ✅ Very affordable
- ✅ Global edge deployment
- ✅ Good free tier

**Cons**:
- ⚠️ More complex setup
- ⚠️ CLI-based deployment

---

## 💵 Cost Summary Table

| Platform | Monthly Cost | Best For |
|----------|-------------|----------|
| **Vercel + Railway** | **$5-20** | ⭐ **Most cost-effective** |
| **Railway (Hobby)** | $10-15 | Simplest setup |
| **Fly.io** | $6-20 | Global edge |
| **Render (Starter)** | $21 | Free tier available |
| **Railway (Pro)** | $40 | Production scale |
| **Render (Standard)** | $70 | High traffic |

---

## 🎯 My Recommendation: Vercel + Railway

### Why This is Most Cost-Effective:

1. **Vercel Frontend**: **FREE** for Next.js
   - Optimized for Next.js
   - Automatic deployments
   - Global CDN
   - Free SSL
   - No limits for reasonable traffic

2. **Railway Backend**: $5-20/month
   - Handles NestJS backend
   - Includes PostgreSQL database
   - Automatic deployments
   - Good performance

3. **Total**: **$5-20/month** (vs $175/month on Google Cloud!)

### Setup:

```
app.BLDCebu.com → Vercel (Frontend) → FREE
Backend API → Railway → $5-20/month
Database → Railway (included) → $0 extra
```

---

## 📋 Additional Costs to Consider

### Domain DNS (Usually Free):
- Most registrars include DNS management
- **Cost: $0** (usually included with domain)

### SSL Certificate:
- All platforms provide **free SSL** (Let's Encrypt)
- **Cost: $0**

### Static Page Hosting:
- Your current static page hosting is separate
- **Cost: Whatever you're paying now** (unchanged)

### Subdomain Setup:
- **Cost: $0** (just DNS configuration)

---

## 💡 Cost Breakdown Example

### Scenario: Vercel + Railway (Recommended)

**Monthly Costs**:
- Vercel (Frontend): **$0** ✅
- Railway (Backend + DB): **$5-20** ✅
- Domain DNS: **$0** (included)
- SSL: **$0** (free)
- Static page hosting: **$X** (your current cost, unchanged)

**Total New Costs**: **$5-20/month**

**Savings vs Google Cloud**: **$155-170/month** 🎉

---

## 🚀 Setup Steps (Vercel + Railway)

### Step 1: Deploy Frontend to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel
```

### Step 2: Deploy Backend to Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy
cd backend
railway init
railway add postgresql
railway up
```

### Step 3: Configure Subdomain
- **Vercel**: Add `app.BLDCebu.com` in dashboard
- **DNS**: Add CNAME record at registrar
- **Wait**: 5-30 minutes for propagation

### Step 4: Configure CORS
- Update backend CORS to allow `app.BLDCebu.com`
- Update frontend API URL to Railway backend

**Total Setup Time**: ~30 minutes
**Monthly Cost**: **$5-20**

---

## ✅ Final Recommendation

**Use: Vercel (Frontend) + Railway (Backend)**

**Why**:
- ✅ **Cheapest**: $5-20/month total
- ✅ **Best performance**: Vercel optimized for Next.js
- ✅ **Simple**: Both platforms are easy to use
- ✅ **Scalable**: Can grow as needed
- ✅ **Free SSL**: Automatic for subdomain

**Your static page**:
- Stays at `BLDCebu.com` (unchanged)
- No additional cost
- No disruption

**Your new app**:
- Lives at `app.BLDCebu.com`
- Costs $5-20/month
- Full Next.js + NestJS stack

**Total Savings**: ~$155-170/month vs Google Cloud! 🎉

---

## 📝 Next Steps

1. **Deploy frontend to Vercel** (free)
2. **Deploy backend to Railway** ($5-20/month)
3. **Configure subdomain** `app.BLDCebu.com`
4. **Test and verify**
5. **Enjoy your cost-effective deployment!**

**This setup is much more cost-effective than Google Cloud!** 💰
