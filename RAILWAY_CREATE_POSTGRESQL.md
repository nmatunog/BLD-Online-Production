# Create PostgreSQL Database in Railway

## 🎯 Step-by-Step: Create PostgreSQL Database

### Step 1: Add Database Service

1. **In Railway Dashboard** (where you are now - Architecture view)
2. **Click the "+ Create" button** (top right)
   - Or click "+ New" if you see it
3. **Select "Database"**
4. **Select "PostgreSQL"**

### Step 2: Railway Auto-Configuration

Railway will automatically:
- ✅ Create a PostgreSQL database
- ✅ Set `DATABASE_URL` as a shared variable
- ✅ Make it available to all services in the project
- ✅ Your backend service will automatically get `DATABASE_URL`

### Step 3: Verify DATABASE_URL is Set

1. **Go to your backend service**: "BLD-Online-Production"
2. **Click "Variables" tab**
3. **Look for `DATABASE_URL`**
   - Should be automatically set
   - Should show the connection string

### Step 4: Redeploy Backend

After PostgreSQL is created:
1. **Go to your backend service**
2. **Click "Deployments" tab**
3. **Click "Redeploy"**
   - Or Railway might auto-redeploy

---

## 📋 What Happens Next

1. **PostgreSQL database created** ✅
2. **DATABASE_URL automatically set** ✅
3. **Backend service redeploys** ✅
4. **Service should start successfully** ✅
5. **Run migrations** (next step)

---

## 🚀 After Database is Created

### Run Database Migrations

Once the service starts successfully, run migrations:

**Option 1: Via Railway Dashboard**
1. Go to your backend service
2. Click "Deployments" → Latest deployment
3. Click "View Logs"
4. Use Railway's terminal/console feature if available

**Option 2: Via Railway CLI**
```bash
# Login
npx @railway/cli login

# Run migrations
npx @railway/cli run --service <your-service-id> npx prisma migrate deploy
```

---

## ✅ Quick Checklist

- [ ] Click "+ Create" in Railway
- [ ] Select "Database" → "PostgreSQL"
- [ ] Wait for database to be created
- [ ] Verify `DATABASE_URL` appears in backend service Variables
- [ ] Redeploy backend service
- [ ] Check logs - should start successfully!
- [ ] Run migrations

---

**Create the PostgreSQL database and Railway will automatically configure everything!**
