# How to Get DATABASE_URL from Railway PostgreSQL

## 🎯 Where to Find DATABASE_URL

After creating a PostgreSQL database in Railway, the `DATABASE_URL` is automatically available. Here's where to find it:

---

## ✅ Method 1: Check Backend Service Variables (Easiest)

Railway automatically shares the `DATABASE_URL` with all services:

1. **Go to your backend service**: "BLD-Online-Production"
2. **Click "Variables" tab**
3. **Look for `DATABASE_URL`**
   - Should be automatically listed
   - Shows the full connection string
   - Format: `postgresql://user:password@host:port/database`

**If you see it here, you're done!** Railway automatically uses it.

---

## ✅ Method 2: Get from PostgreSQL Service

If you need to see it from the database service itself:

1. **Go to your PostgreSQL service** (in Architecture view, click on the database card)
2. **Click "Variables" tab**
3. **Look for `DATABASE_URL`** or `POSTGRES_URL`
   - Copy this value
4. **Add to backend service** (if not automatically shared):
   - Go to backend service → Variables
   - Click "+ New Variable"
   - Name: `DATABASE_URL`
   - Value: Paste the connection string
   - Click "Add"

---

## ✅ Method 3: Get from Connect Tab

1. **Go to your PostgreSQL service**
2. **Click "Connect" tab** (or "Connection" tab)
3. **Copy the connection string**
   - May be labeled as "Connection String" or "PostgreSQL URL"
   - Format: `postgresql://user:password@host:port/database`

---

## 🔍 What DATABASE_URL Looks Like

The connection string format:
```
postgresql://postgres:password@hostname.railway.app:5432/railway
```

Or:
```
postgresql://user:password@containers-us-west-xxx.railway.app:5432/railway
```

---

## 📋 Quick Steps

1. **Create PostgreSQL database** (if not done)
2. **Go to backend service** → "Variables" tab
3. **Check if `DATABASE_URL` is there** (should be automatic)
4. **If not there**: Copy from PostgreSQL service → Add to backend
5. **Redeploy** backend service

---

## ✅ Verify It's Set

After adding `DATABASE_URL`:
1. Go to backend service → Variables
2. Should see `DATABASE_URL` in the list
3. Should show a connection string (not empty)
4. Redeploy service
5. Check logs - should start successfully!

---

**Railway usually sets this automatically, so check your backend service Variables tab first!**
