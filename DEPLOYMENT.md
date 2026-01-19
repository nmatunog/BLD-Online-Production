## Deployment overview (Dev → Production)

This repo has two apps:
- `backend/`: NestJS + Prisma (HTTP API)
- `frontend/`: Next.js (App Router)

## Local ports (standard)
- **Frontend**: `http://localhost:3000`
- **Backend**: `http://localhost:4000` (API prefix: `/api/v1`)

## Environment files
- Backend: copy `backend/.env.example` → `backend/.env.local`
- Frontend: copy `frontend/.env.example` → `frontend/.env.local`

## Deploy: DEV environment
### 1) Provision DEV database
- Create a Postgres database for DEV.
- Set `DATABASE_URL` in your backend DEV environment.

### 2) Deploy backend (DEV)
Minimum required env vars:
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `FRONTEND_URL` (your deployed frontend DEV URL)
- `PORT` (most platforms set this automatically)

Build/run commands (typical):
- Build: `npm run build`
- Migrate: `npx prisma migrate deploy` (or `prisma migrate dev` in non-prod)
- Start: `npm run start:prod`

After deploy, confirm:
- `GET /api/docs` loads
- `GET /api/v1/health` if/when you add a health route

### 3) Deploy frontend (DEV)
Set env vars:
- `NEXT_PUBLIC_API_BASE_URL` = your backend DEV base URL (e.g. `https://your-backend-dev.example.com`)

Build/run commands:
- Build: `npm run build`
- Start: `npm run start`

## Deploy: PRODUCTION environment
Same as DEV, but with:
- Separate database
- Separate secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`)
- `NODE_ENV=production`
- `FRONTEND_URL` set to your production frontend URL

## Port troubleshooting
Check listeners:
- `lsof -nP -iTCP:3000 -sTCP:LISTEN`
- `lsof -nP -iTCP:4000 -sTCP:LISTEN`

Kill a stuck process (example):
- `kill -9 <PID>`
