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

## Become Super User by Re-registering as First User

The backend assigns **SUPER_USER** to the *first* user (when no users exist). To get Super User automatically:

1. **Delete your current user** (run against production DB with public `DATABASE_URL` or Railway CLI):
   ```bash
   cd backend
   DATABASE_URL="your-railway-public-db-url" npx ts-node scripts/delete-user-for-first.ts your@email.com
   ```
2. **Register again** (same or new email) via the app — you’ll be the first user and get Super User.

Use this if you prefer not to run `set-super-user.ts` and want the role assigned at signup.

## Promote Admin to Superuser (without deleting)

If your user was created as **ADMINISTRATOR** and you need **SUPER_USER** (Superuser):

**Via Railway CLI (recommended):**
```bash
cd backend
npx @railway/cli link
npx @railway/cli run --service bld-online-production npx ts-node scripts/set-super-user.ts
```
This updates the user with email `nmatunog@gmail.com` to SUPER_USER.

**With a different email:**
```bash
npx @railway/cli run --service bld-online-production npx ts-node scripts/set-super-user.ts your@email.com
```

**With public DATABASE_URL (if you enabled public networking):**
```bash
cd backend
DATABASE_URL="your-railway-public-db-url" npx ts-node scripts/set-super-user.ts
```

Then log out and log in again; your role will show as **Superuser** (SUPER_USER).

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
