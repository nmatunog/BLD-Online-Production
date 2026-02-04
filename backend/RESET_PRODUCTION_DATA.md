# Reset Production Data (Start from Scratch)

Use this when you want to wipe all users, members, events, attendance, registrations, and accounting so the **next person to register becomes Super User** (first user gets SUPER_USER automatically).

## Prerequisites

- **Public DATABASE_URL** from Railway (PostgreSQL service → Variables or Connect → Public Network).  
  Railway’s internal URL (`postgres.railway.internal`) only works from inside Railway, so use the public URL when running locally.

## Steps

### 1. Dry run (see what would happen)

```bash
cd backend
DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway?sslmode=require" npx ts-node scripts/reset-production-data.ts
```

(No `--confirm` = no changes, just prints instructions.)

### 2. Actually reset (wipe all data)

```bash
cd backend
DATABASE_URL="postgresql://postgres:PASSWORD@HOST:PORT/railway?sslmode=require" npx ts-node scripts/reset-production-data.ts --confirm
```

Replace the URL with your **real** public DATABASE_URL from Railway.

### 3. Register the first user (Super User)

1. Open your production frontend (e.g. `https://bld-online-production.vercel.app` or your custom domain).
2. Go to **Register** (not Login).
3. Create an account (email, phone, password, name, etc.).
4. That user will have **Super User** role.
5. Log in and use the app.

## What gets deleted

- All **users** and **members**
- All **sessions**
- All **events**, **attendance**, **event registrations**
- All **event accounts**, **income**, **expense**, **adjustment** entries
- All **event class shepherd** assignments

Schema (tables) is unchanged; only **data** is removed.

## Security

- Run only when you intend to wipe production.
- Keep DATABASE_URL secret; don’t commit it or share it.
- After reset, create the first (Super User) account immediately.
