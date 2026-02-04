# Production Verification

Quick checks to confirm Vercel (frontend) and Railway (backend) are serving the latest code and responding correctly.

---

## Production URLs

| Service   | URL |
|----------|-----|
| **Frontend (Vercel)** | https://bld-online-production.vercel.app |
| **Backend (Railway)** | https://bld-online-production-production.up.railway.app |
| **API base**         | https://bld-online-production-production.up.railway.app/api/v1 |
| **Health**          | https://bld-online-production-production.up.railway.app/health |
| **API docs**        | https://bld-online-production-production.up.railway.app/api/docs |

---

## 1. Backend (Railway)

**Automated check (run locally):**

```bash
curl -s https://bld-online-production-production.up.railway.app/health
```

**Expected:** `{"status":"ok","timestamp":"...","service":"BLD Cebu Online Portal API","uptime":...}`

**Manual checks:**

- [ ] Open **Health**: https://bld-online-production-production.up.railway.app/health  
  → Should show JSON with `"status":"ok"`.
- [ ] Open **API docs**: https://bld-online-production-production.up.railway.app/api/docs  
  → Swagger UI should load.
- [ ] In Railway Dashboard → your project → backend service → **Deployments**:  
  → Latest deployment should be **succeeded** and from the commit you expect (e.g. after "Fix frontend dev" or your latest push).
- [ ] **Source**: Settings → Connected Repository = `nmatunog/BLDCebu-Online-Portal` (or your production repo). Branch = `main`.

**Last verified:** 2026-02-04 — `/health` and `/api/v1/health` returned `status: ok`.

---

## 2. Frontend (Vercel)

**Manual checks:**

- [ ] Open **App**: https://bld-online-production.vercel.app  
  → Should load the app (redirect to login or show login page).
- [ ] **Login**: Use a production user; confirm you can reach the dashboard.
- [ ] **API connection**: After login, use a feature that calls the API (e.g. Events, Profile).  
  → No CORS or network errors in DevTools → Console.
- [ ] In Vercel Dashboard → your project → **Deployments**:  
  → Latest deployment **Production** should be from the commit you pushed (e.g. "Fix frontend dev: middleware root matcher...").
- [ ] **Settings → General**:  
  → **Root Directory** = `frontend` (not empty or `backend`).
- [ ] **Settings → Environment Variables**:  
  → `NEXT_PUBLIC_API_BASE_URL` = `https://bld-online-production-production.up.railway.app`  
  → `NEXT_PUBLIC_API_URL` = `https://bld-online-production-production.up.railway.app/api/v1`  
  (So the frontend talks to your Railway backend.)

---

## 3. End-to-end

- [ ] Open https://bld-online-production.vercel.app → log in → open **Profile** → change something (e.g. name) → Save.  
  → Should succeed or show a clear error (e.g. 409 for duplicate email/phone), not 500.
- [ ] Check **Reports** and **Events** (or other API-backed pages).  
  → Data loads and no console errors.

---

## If something fails

- **Backend 500 or old behavior:** Redeploy on Railway from the latest commit; confirm env vars (e.g. `DATABASE_URL`, `JWT_SECRET`).
- **Frontend 404 or wrong app:** In Vercel, set Root Directory to `frontend` and redeploy.
- **CORS / API unreachable:** Confirm `NEXT_PUBLIC_API_BASE_URL` in Vercel and CORS on Railway allows your Vercel domain (e.g. `bld-online-production.vercel.app`).
- **CSP errors in console:** See `docs/CSP_VERCEL_FIX.md`; consider turning off Vercel Toolbar if a second CSP overrides yours.
