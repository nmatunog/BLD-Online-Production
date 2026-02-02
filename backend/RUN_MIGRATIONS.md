# Run Database Migrations on Railway

## Step 1: Get DATABASE_URL from Railway

1. Go to Railway Dashboard
2. Click on your **PostgreSQL** service (or the service that has the database)
3. Go to **Variables** tab
4. Find `DATABASE_URL` or `POSTGRES_URL`
5. Copy the entire connection string

**OR** if DATABASE_URL is in your backend service:

1. Go to Railway Dashboard
2. Click on **BLD-Online-Production** service
3. Go to **Variables** tab
4. Find `DATABASE_URL`
5. Copy it

## Step 2: Run Migrations Locally

```bash
cd backend

# Set the DATABASE_URL (paste your Railway database URL)
export DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/DATABASE"

# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

## Alternative: Use Railway CLI

If you have Railway CLI set up:

```bash
cd backend
npx @railway/cli run --service bld-online-production npx prisma migrate deploy
```

## What This Does

- Creates all database tables
- Sets up relationships
- Applies all migrations from `prisma/migrations/`

## After Migrations

Once migrations complete, you'll need to:
1. Create your first admin user
2. Test the API endpoints
3. Deploy frontend to Vercel
