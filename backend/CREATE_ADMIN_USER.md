# Create First Admin User on Railway

## Option 1: Via Railway CLI (Recommended)

Since Railway uses internal networking (`postgres.railway.internal`), you need to run the script inside Railway's environment.

```bash
cd backend

# Link to your Railway project first (if not already linked)
npx @railway/cli link

# Run the admin creation script
npx @railway/cli run --service bld-online-production npx ts-node scripts/create-admin-user.ts
```

This will prompt you for:
- Email
- Phone (optional)
- Password
- First Name
- Last Name
- Nickname (optional)

## Option 2: Enable Public Networking

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

## Option 3: Use Railway's Database Proxy

Railway provides a database proxy feature that allows local connections:

1. Railway Dashboard → PostgreSQL service
2. Find "Connect" or "Proxy" section
3. Follow instructions to set up local proxy
4. Use the proxy connection string to run the script locally

## After Creating Admin User

Once you have an admin user:
1. Test login at: `https://bld-online-production-production.up.railway.app/api/v1/auth/login`
2. Use the credentials you just created
3. You should receive a JWT token
4. Use this token to access protected endpoints

## Next Steps

After creating the admin user:
1. ✅ Backend is deployed and working
2. ✅ Database migrations are complete
3. ✅ Admin user created
4. ⏭️ Deploy frontend to Vercel
5. ⏭️ Connect frontend to backend
