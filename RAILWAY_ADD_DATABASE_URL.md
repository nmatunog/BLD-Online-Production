# Fix: Add DATABASE_URL Environment Variable

## 🎯 Problem
```
PrismaClientInitializationError: error: Environment variable not found: DATABASE_URL
```

The build succeeded, but `DATABASE_URL` is missing!

---

## ✅ Solution: Add DATABASE_URL

### Option 1: Use Railway PostgreSQL (Recommended)

If you have a PostgreSQL database in Railway:

1. **Go to Railway Dashboard**
   - Navigate to your project
   - Find your PostgreSQL database service

2. **Get the Connection String**
   - Click on your PostgreSQL service
   - Go to "Variables" tab
   - Copy the `DATABASE_URL` value
   - Or go to "Connect" tab and copy the connection string

3. **Add to Backend Service**
   - Go to your backend service: "BLD-Online-Production"
   - Click "Variables" tab
   - Click "+ New Variable"
   - Name: `DATABASE_URL`
   - Value: Paste the connection string from PostgreSQL service
   - Click "Add"

4. **Redeploy**
   - Railway should auto-redeploy, or
   - Go to "Deployments" → "Redeploy"

### Option 2: Create PostgreSQL Database

If you don't have a database yet:

1. **Railway Dashboard → Your Project**
2. **Click "+ New"**
3. **Select "Database" → "PostgreSQL"**
4. **Railway will automatically:**
   - Create the database
   - Set `DATABASE_URL` as a shared variable
   - Make it available to your backend service

5. **Verify Connection**
   - Go to your backend service → Variables
   - Should see `DATABASE_URL` automatically set

---

## 📋 Quick Steps Summary

1. **Check if PostgreSQL exists** in Railway project
2. **If exists**: Copy `DATABASE_URL` from PostgreSQL service → Add to backend service
3. **If not exists**: Create PostgreSQL database → Railway auto-sets `DATABASE_URL`
4. **Redeploy** backend service
5. **Check logs** - should start successfully!

---

## 🔍 Verify Other Required Variables

While you're in Variables, make sure these are also set:

- ✅ `DATABASE_URL` - **MISSING - needs to be added**
- ✅ `JWT_SECRET` - Must be set
- ✅ `JWT_REFRESH_SECRET` - Must be set
- ✅ `NODE_ENV=production`
- ✅ `API_PREFIX=api/v1`
- ✅ `FRONTEND_URL` - Your frontend URL (optional but recommended)

---

## 🚀 After Adding DATABASE_URL

1. Service should start successfully
2. Healthcheck should pass
3. You can then run migrations:
   ```bash
   npx @railway/cli run --service <service-id> npx prisma migrate deploy
   ```

---

**The build works! Just need to add DATABASE_URL and it should start!**
