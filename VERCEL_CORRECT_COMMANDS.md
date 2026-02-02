# Correct Vercel Deployment Commands

## The Issue

The error `unknown or unexpected option: --prod~` suggests there's a typo. The correct flag is `--prod` (no tilde).

## Correct Commands

### Option 1: Deploy to Production

```bash
cd ~/BLDCebu-Online-Portal/frontend
vercel --prod
```

### Option 2: Deploy Preview (then promote to production)

```bash
cd ~/BLDCebu-Online-Portal/frontend
vercel
```

Then promote to production from Vercel Dashboard.

## Step-by-Step Deployment

1. **Make sure you're in the frontend directory:**
   ```bash
   cd ~/BLDCebu-Online-Portal/frontend
   ```

2. **Deploy to production:**
   ```bash
   vercel --prod
   ```

3. **Follow the prompts:**
   - Set up and deploy? → `y` or Enter
   - Which scope? → Select your account
   - Link to existing project? → `n` (new) or `y` (existing)
   - Project name? → Enter for default
   - Directory? → Enter (current directory)
   - Override settings? → Enter (use defaults)

4. **After deployment, set environment variables in Vercel Dashboard**

5. **Redeploy after setting variables**

## Using npx (if vercel command not found)

If `vercel` command doesn't work, use:

```bash
cd ~/BLDCebu-Online-Portal/frontend
npx vercel --prod
```

## Environment Variables to Set

After deployment, add these in Vercel Dashboard:

```
NEXT_PUBLIC_API_BASE_URL=https://bld-online-production-production.up.railway.app
NEXT_PUBLIC_API_URL=https://bld-online-production-production.up.railway.app/api/v1
NODE_ENV=production
```
