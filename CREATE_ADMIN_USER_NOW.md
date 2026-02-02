# Create First Admin User - Quick Guide

## Current Status
✅ Backend is deployed and running on Railway  
✅ Automatic migrations are configured to run on startup  
⏭️ Need to create the first admin user

## Step 1: Verify Migrations Ran

Before creating the admin user, let's verify that database migrations completed successfully:

1. Go to Railway Dashboard: https://railway.app
2. Open your project → `bld-online-production` service
3. Check the **Deploy Logs** tab
4. Look for messages like:
   - `Applying migration...`
   - `Migration applied successfully`
   - Or any Prisma migration output

If you see errors about migrations, the database might not be set up yet.

## Step 2: Create Admin User

### Option A: Using Railway CLI (Recommended)

I've created a helper script for you:

```bash
./scripts/create-admin-user-railway.sh
```

This will:
1. Run the admin creation script inside Railway's environment
2. Prompt you for admin user details
3. Create the user and member profile

**What you'll need to provide:**
- Email (e.g., `admin@bldcebu.com`)
- Phone (optional)
- Password (min 8 characters)
- First Name
- Last Name
- Nickname (optional)

### Option B: Manual Railway CLI Command

If the script doesn't work, run this manually:

```bash
cd backend
npx @railway/cli run --service bld-online-production npx ts-node scripts/create-admin-user.ts
```

### Option C: Enable Public Database Access

If Railway CLI doesn't work, you can enable public networking:

1. Railway Dashboard → PostgreSQL service
2. Settings → Networking
3. Enable "Public Networking"
4. Copy the public connection string
5. Run locally:

```bash
cd backend
export DATABASE_URL="your-public-railway-database-url"
npx ts-node scripts/create-admin-user.ts
```

⚠️ **Security Note:** Disable public networking after creating the admin user!

## Step 3: Test Admin Login

After creating the admin user, test the login:

```bash
curl -X POST https://bld-online-production-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-admin-email@example.com",
    "password": "your-password"
  }'
```

Or test in your browser:
- Go to: https://bld-online-production-production.up.railway.app/api/docs
- Try the `/api/v1/auth/login` endpoint

## Step 4: Next Steps

Once admin user is created:
1. ✅ Backend deployed and working
2. ✅ Database migrations complete
3. ✅ Admin user created
4. ⏭️ Deploy frontend to Vercel
5. ⏭️ Connect frontend to backend API

## Troubleshooting

### "Service not found" error
- Make sure you're linked to the correct Railway project
- Run: `npx @railway/cli link` first

### "Cannot connect to database"
- Check that `DATABASE_URL` is set in Railway environment variables
- Verify PostgreSQL service is running in Railway

### "User already exists"
- The admin user might already be created
- Try logging in with those credentials
