# Fix: JWT_SECRET Not Being Read in Railway

## 🔍 The Problem

Even after setting `JWT_SECRET` in Railway, the error persists. This usually means:

1. **Variable not set in the correct service** - Railway has multiple services
2. **Service needs redeploy** - Not just restart
3. **Variable name mismatch** - Case sensitivity issue

---

## ✅ Solution: Verify and Fix

### Step 1: Verify Variable is Set

In Railway Dashboard:
1. Go to your **backend service** (not the database service)
2. Click **"Variables"** tab
3. Look for `JWT_SECRET` - it should show a value
4. If missing or empty, add it

### Step 2: Check Variable Name

**Must be exactly**: `JWT_SECRET` (all caps, underscore, no spaces)

Common mistakes:
- ❌ `jwt_secret` (lowercase)
- ❌ `JWT-SECRET` (hyphen)
- ❌ `JWT_SECRET ` (trailing space)
- ✅ `JWT_SECRET` (correct)

### Step 3: Set Variable Correctly

1. In Railway Dashboard → Your backend service → Variables
2. Click **"New Variable"**
3. Name: `JWT_SECRET` (exact)
4. Value: Generate with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
5. Click **"Add"**
6. Repeat for `JWT_REFRESH_SECRET` (different value)

### Step 4: REDEPLOY (Not Just Restart)

**Important**: After setting variables, you need to **redeploy**, not just restart:

1. In Railway Dashboard → Your service
2. Click **"Deployments"** tab
3. Click **"Redeploy"** or **"Deploy"** button
4. Or trigger a new deployment by:
   - Pushing to GitHub (if connected)
   - Or clicking "Redeploy" in the latest deployment

**Why redeploy?** Railway needs to rebuild with the new environment variables.

---

## 🔧 Alternative: Add Fallback for Debugging

If you want to see what's happening, we can add logging:

```typescript
// In jwt.strategy.ts
constructor(private prisma: PrismaService) {
  const secret = process.env.JWT_SECRET;
  console.log('🔑 JWT_SECRET check:', secret ? 'SET' : 'MISSING', secret ? `(length: ${secret.length})` : '');
  
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set!');
  }
  
  super({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: secret,
  });
}
```

This will show in logs if the variable is being read.

---

## 📋 Checklist

- [ ] Variable `JWT_SECRET` is set in **backend service** (not database)
- [ ] Variable name is exactly `JWT_SECRET` (case-sensitive)
- [ ] Variable has a value (not empty)
- [ ] Service is **redeployed** (not just restarted)
- [ ] Check logs after redeploy to verify

---

## 🚀 Quick Fix Steps

1. **Go to Railway Dashboard**
2. **Select your backend service** (the one that's crashing)
3. **Go to Variables tab**
4. **Verify `JWT_SECRET` exists and has a value**
5. **If missing, add it:**
   - Name: `JWT_SECRET`
   - Value: (generate with the command above)
6. **Redeploy the service** (click "Redeploy" or "Deploy")
7. **Check logs** - error should be gone

---

## 💡 Why Restart Isn't Enough

Railway caches environment variables at build time. When you:
- **Restart**: Uses cached variables (old/cached)
- **Redeploy**: Rebuilds with new variables (fresh)

**Always redeploy after changing environment variables!**

---

## 🎯 Most Likely Issue

The variable is probably:
1. Set in the wrong service (database instead of backend)
2. Not redeployed after setting
3. Has a typo in the name

**Check these three things first!**
