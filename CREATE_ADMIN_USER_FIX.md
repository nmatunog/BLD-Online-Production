# Fix: "Service not found" Error

## Problem
When running the admin user creation script, you get:
```
Service not found
```

## Solution

### Step 1: Link Railway Project (if not already linked)

```bash
cd backend
npx @railway/cli link
```

Select your Railway project from the list. This will link your local directory to the Railway project.

### Step 2: Find the Correct Service Name

The service name might be different from `bld-online-production`. To find it:

**Option A: Check Railway Dashboard**
1. Go to https://railway.app
2. Open your project
3. Look at the service name in the sidebar or breadcrumbs
4. Common names:
   - `bld-online-production`
   - `backend`
   - `api`
   - `bld-online-production-production`

**Option B: List Services via CLI**
```bash
cd backend
npx @railway/cli status
```

This will show your project and services.

### Step 3: Run with Correct Service Name

Once you know the service name, run:

```bash
cd backend
npx @railway/cli run --service YOUR_SERVICE_NAME npx ts-node scripts/create-admin-user.ts
```

Replace `YOUR_SERVICE_NAME` with the actual service name from Step 2.

### Alternative: Enable Public Database Access

If Railway CLI continues to have issues, you can enable public networking on your PostgreSQL database:

1. **Railway Dashboard** → PostgreSQL service
2. **Settings** → **Networking**
3. **Enable "Public Networking"**
4. **Copy the public connection string**
5. **Run locally:**

```bash
cd backend
export DATABASE_URL="your-public-railway-database-url"
npx ts-node scripts/create-admin-user.ts
```

⚠️ **Important:** Disable public networking after creating the admin user for security!

### Alternative: Use Railway Database Proxy

Railway also provides a database proxy:

1. **Railway Dashboard** → PostgreSQL service
2. **Find "Connect" or "Proxy" section**
3. **Follow instructions to set up local proxy**
4. **Use the proxy connection string to run the script locally**

## After Creating Admin User

Test the login:

```bash
curl -X POST https://bld-online-production-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-admin-email@example.com",
    "password": "your-password"
  }'
```

Or test in browser:
- Go to: https://bld-online-production-production.up.railway.app/api/docs
- Try the `/api/v1/auth/login` endpoint
