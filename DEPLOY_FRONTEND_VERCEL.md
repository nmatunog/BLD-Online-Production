# Deploy Frontend to Vercel

## Prerequisites

✅ Backend is deployed and working on Railway
✅ Admin user created and login tested
✅ Backend URL: `https://bld-online-production-production.up.railway.app`

## Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

Or use npx (no global install needed):
```bash
npx vercel
```

## Step 2: Login to Vercel

```bash
vercel login
```

This will open a browser window for authentication.

## Step 3: Deploy Frontend

Navigate to the frontend directory and deploy:

```bash
cd frontend
vercel --prod
```

Or for a preview deployment first:
```bash
vercel
```

## Step 4: Set Environment Variables in Vercel

After deployment, set these environment variables in Vercel Dashboard:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

### Required Environment Variables:

```bash
NEXT_PUBLIC_API_BASE_URL=https://bld-online-production-production.up.railway.app
NEXT_PUBLIC_API_URL=https://bld-online-production-production.up.railway.app/api/v1
NODE_ENV=production
```

### How to Add:

1. Click **Add New**
2. For each variable:
   - **Key**: `NEXT_PUBLIC_API_BASE_URL`
   - **Value**: `https://bld-online-production-production.up.railway.app`
   - **Environment**: Select **Production**, **Preview**, and **Development**
3. Repeat for all three variables

## Step 5: Redeploy After Setting Variables

After setting environment variables, trigger a new deployment:

```bash
cd frontend
vercel --prod
```

Or redeploy from Vercel Dashboard:
- Go to **Deployments** tab
- Click **Redeploy** on the latest deployment

## Step 6: Verify CORS Configuration

Make sure the backend CORS allows your Vercel domain:

1. Check `backend/src/main.ts` - CORS configuration
2. The backend should allow:
   - Your Vercel domain (e.g., `https://your-app.vercel.app`)
   - Or use wildcard for Vercel: `*.vercel.app`

If needed, update Railway environment variable:
- `FRONTEND_URL=https://your-app.vercel.app`

Then redeploy the backend on Railway.

## Step 7: Test the Deployment

1. **Visit your Vercel URL**: `https://your-app.vercel.app`
2. **Test Login**:
   - Email: `nmatunog@gmail.com`
   - Password: `@Nbm0823`
3. **Check Browser Console** for any errors
4. **Verify API calls** are going to the Railway backend

## Troubleshooting

### Frontend can't connect to backend

**Check:**
1. Environment variables are set correctly in Vercel
2. CORS is configured in backend to allow Vercel domain
3. Backend is accessible (test: `curl https://bld-online-production-production.up.railway.app/health`)

**Fix:**
- Update `FRONTEND_URL` in Railway to include your Vercel domain
- Redeploy backend on Railway

### Build errors

**Check:**
1. All dependencies are in `package.json`
2. TypeScript errors are resolved
3. Build works locally: `cd frontend && npm run build`

### Environment variables not working

**Check:**
1. Variables are prefixed with `NEXT_PUBLIC_` for client-side access
2. Variables are set for the correct environment (Production/Preview/Development)
3. Redeploy after setting variables

## Quick Reference

**Backend URLs:**
- Base: `https://bld-online-production-production.up.railway.app`
- API: `https://bld-online-production-production.up.railway.app/api/v1`
- Health: `https://bld-online-production-production.up.railway.app/health`
- Docs: `https://bld-online-production-production.up.railway.app/api/docs`

**Frontend Environment Variables:**
```bash
NEXT_PUBLIC_API_BASE_URL=https://bld-online-production-production.up.railway.app
NEXT_PUBLIC_API_URL=https://bld-online-production-production.up.railway.app/api/v1
NODE_ENV=production
```

## Next Steps After Deployment

1. ✅ Test login on Vercel frontend
2. ✅ Verify all API endpoints work
3. ✅ Test creating events, members, etc.
4. ✅ Set up custom domain (optional)
5. ✅ Configure monitoring and analytics
