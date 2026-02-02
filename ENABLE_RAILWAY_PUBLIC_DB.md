# Enable Public Database Access on Railway (Temporary)

## Step 1: Enable Public Networking

1. Go to **Railway Dashboard**: https://railway.app
2. Open your project: **bld-online-production**
3. Click on the **PostgreSQL** service (not the backend service)
4. Go to **Settings** tab
5. Scroll down to **Networking** section
6. Click **Enable Public Networking**
7. Copy the **Public Connection String** that appears

The connection string will look like:
```
postgresql://postgres:PASSWORD@containers-us-west-XXX.railway.app:XXXX/railway
```

## Step 2: Run Admin User Creation Script Locally

Once you have the public connection string, run:

```bash
cd backend
export DATABASE_URL="your-public-railway-connection-string"
npx ts-node scripts/create-admin-user.ts
```

Enter your admin details when prompted:
- Email: nmatunog@gmail.com
- Phone: 09209648523
- Password: @Nbm0823
- First Name: Nilo
- Last Name: Matunog
- Nickname: Nilo

## Step 3: Disable Public Networking (IMPORTANT!)

After creating the admin user, **immediately disable public networking** for security:

1. Go back to Railway Dashboard
2. PostgreSQL service → Settings → Networking
3. Click **Disable Public Networking**

## Alternative: Use Railway Database Proxy

If you prefer not to enable public networking, Railway also provides a database proxy:

1. Railway Dashboard → PostgreSQL service
2. Find **"Connect"** or **"Proxy"** section
3. Follow instructions to set up local proxy
4. Use the proxy connection string to run the script locally
