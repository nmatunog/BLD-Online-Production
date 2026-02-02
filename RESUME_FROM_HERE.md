# Resume from Here – BLD Cebu Online Portal

**Production stack:** **Railway + Vercel** (backend on Railway, frontend on Vercel).  
**Last context:** Backend is live on Railway; next step is deploy frontend to Vercel and verify.

---

## ✅ Done

- **Backend on Railway**
  - URL: `https://bld-online-production-production.up.railway.app`
  - Health: `/health`
  - API docs: `/api/docs`
  - API base: `/api/v1`
- **Database**: PostgreSQL on Railway, migrations run on deploy
- **Admin user**: `nmatunog@gmail.com` (password in BACKEND_DEPLOYMENT_COMPLETE.md)

---

## 🔄 Next steps (in order)

### 1. Deploy frontend to Vercel

From project root:

```bash
cd frontend
npm install -g vercel   # if needed
vercel login            # if needed
vercel                  # first deploy (preview)
```

In **Vercel Dashboard → Project → Settings → Environment Variables**, add:

| Name | Value | Env |
|------|--------|-----|
| `NEXT_PUBLIC_API_BASE_URL` | `https://bld-online-production-production.up.railway.app` | Production (and Preview if you want) |
| `NEXT_PUBLIC_API_URL` | `https://bld-online-production-production.up.railway.app/api/v1` | Production (and Preview if you want) |

Then:

```bash
vercel --prod
```

### 2. Security: disable public DB access on Railway

If you turned on public networking for PostgreSQL to run scripts:

1. Railway Dashboard → your PostgreSQL service  
2. Settings → Networking  
3. **Disable Public Networking**

### 3. Fix 404 on Vercel (Root Directory)

If `bld-online-production.vercel.app` shows **404: NOT_FOUND**, Vercel is building from the repo root instead of the Next.js app in `frontend/`.

**Where to find Root Directory:** It’s under **Build and Deployment**, not General.

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your team → project **bld-online-production**.
2. Go to the **Settings** tab.
3. In the **left sidebar**, click **“Build and Deployment”** (or scroll the main area to the “Build and Deployment” section).
4. Scroll down to **“Root Directory”**.
5. Click **Edit**, set the value to **`frontend`** (no leading slash), then **Save**.
6. **Redeploy:** Deployments tab → ⋮ on the latest deployment → **Redeploy**.

**If you still don’t see it:** Some UIs show build options under **General** in an expandable “Build and Development Settings” block—scroll that section for **Root Directory**.  
**Alternative:** Deploy from your machine so the app root is `frontend`: run `cd frontend && vercel --prod` and, when asked, link to the existing project so future Git deploys use the same settings.

### 4. CSP / console errors (inline script, Stripe blocked)

The app sets a relaxed CSP in `frontend/next.config.ts` and `frontend/vercel.json` so inline scripts and Stripe work. **Redeploy the frontend** after pulling these changes.

If you still see **"script-src 'self'"** blocking inline scripts or Stripe:

1. **Check which CSP the browser gets:** Open DevTools → **Network** tab → refresh → click the first request (the document, e.g. `bld-online-production.vercel.app`) → **Headers** → **Response Headers**. Look for `Content-Security-Policy`. If it says `script-src 'self'` with no `'unsafe-inline'`, that strict policy is coming from elsewhere (usually Vercel).

2. **Turn off Vercel’s strict CSP:** **Vercel Dashboard** → your project → **Settings** → **Security**. Look for **"Security Headers"**, **"Attack Challenge Mode"**, or anything that sets **Content-Security-Policy**. **Disable** it (or set a custom CSP that includes `'unsafe-inline'` and Stripe) so only our CSP from the app is used.

3. **Redeploy and hard refresh:** Redeploy the frontend, then hard refresh (Ctrl+Shift+R / Cmd+Shift+R) or use an incognito window so the new headers aren’t cached.

### 5. Vercel build: `npm ci` lock file out of sync

If the Vercel build fails with **"lock file's next@… does not satisfy next@…"** or **"package.json and package-lock.json are in sync"**:

- **Quick fix:** The app uses **`npm install`** in `frontend/vercel.json` (not `npm ci`) so the build doesn’t require an exact lock match. Push the latest code so Vercel gets that change.
- **Proper fix:** In the repo Vercel builds from (e.g. **github.com/nmatunog/BLD-Online-Production**), run in the **frontend** folder: `npm install`, then commit and push `package-lock.json`. You can switch back to `"installCommand": "npm ci"` in `frontend/vercel.json` for reproducible installs.

### 6. Verify

- [ ] Backend: open `https://bld-online-production-production.up.railway.app/health` and `/api/docs`
- [ ] Frontend: open your Vercel URL, log in with admin
- [ ] CORS: if login fails from Vercel, add the Vercel domain to backend `FRONTEND_URL` / CORS in Railway env

---

## Quick reference

- **Production = Railway + Vercel** (not Cloud Run)
- **Backend**: https://bld-online-production-production.up.railway.app  
- **Frontend env**: `NEXT_PUBLIC_API_BASE_URL` + `NEXT_PUBLIC_API_URL` (see above)  
- **Admin**: see `BACKEND_DEPLOYMENT_COMPLETE.md` for credentials  

---

## Alternative: Cloud Run / Firebase

We are **not** using Cloud Run for production. If you ever switch to Google Cloud, see `RESUME_DEPLOYMENT.md` for the Cloud Run + Firebase path.
