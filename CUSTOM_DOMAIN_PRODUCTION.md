# Make Production App Available on Your Domain

Your production frontend is on **Vercel** (from the BLD-Online-Production repo). Your domain currently shows static pages. Choose one approach below.

---

## Option A: App on subdomain (keep static site at root)

**Result:**  
- `https://yourdomain.com` → current static pages (unchanged)  
- `https://app.yourdomain.com` → BLD Online Portal (Vercel)

### 1. Add domain in Vercel

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → your **production** project (the one connected to BLD-Online-Production).
2. **Settings** → **Domains**.
3. Click **Add** and enter: `app.yourdomain.com` (replace with your real domain, e.g. `app.BLDCebu.com`).
4. Vercel will show the DNS record you need (usually a **CNAME**).

### 2. Add DNS record at your domain registrar

At the place where you manage DNS (e.g. Namecheap, GoDaddy, Cloudflare, Google Domains):

- **Type:** CNAME  
- **Name:** `app` (or `app.yourdomain.com` depending on the registrar)  
- **Value:** `cname.vercel-dns.com` (or the exact value Vercel shows)

Save. Propagation can take 5–60 minutes.

### 3. Backend (Railway) – allow your domain

In **Railway** → your backend service → **Variables**:

- Set **FRONTEND_URL** to your app URL, e.g. `https://app.yourdomain.com`

Your backend `main.ts` already allows origins containing `BLDCebu.com`; if your domain is different, add it to the CORS allowed list in `backend/src/main.ts` (or via an env-based list if you add one).

### 4. Vercel env (optional)

In Vercel → Project → **Settings** → **Environment Variables**, ensure **Production** has:

- `NEXT_PUBLIC_API_BASE_URL` = your Railway API URL (e.g. `https://your-backend.railway.app`)  
- `NEXT_PUBLIC_API_URL` = same + `/api/v1`

Redeploy if you change env vars.

---

## Option B: App on root (replace static site)

**Result:**  
- `https://yourdomain.com` → BLD Online Portal (Vercel)  
- Static pages are no longer at the root (back them up first).

### 1. Add domain in Vercel

1. Vercel Dashboard → your **production** project → **Settings** → **Domains**.
2. **Add** → enter `yourdomain.com` and `www.yourdomain.com`.
3. Vercel will show the DNS records (often A + CNAME for `www`).

### 2. Update DNS at your registrar

Replace or add the records Vercel shows, for example:

- **Root (`@`):**  
  - Type **A**  
  - Value: Vercel’s IP (e.g. `76.76.21.21`)  
  Or use Vercel nameservers if you’re moving DNS to Vercel.
- **www:**  
  - Type **CNAME**  
  - Value: `cname.vercel-dns.com` (or what Vercel shows)

This will stop the current static site from being served at the root.

### 3. Backend (Railway)

- **FRONTEND_URL** = `https://yourdomain.com` (and optionally `https://www.yourdomain.com` if you use www).

### 4. Vercel env

Same as Option A: correct `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_API_URL` for production.

---

## Checklist

- [ ] Choose Option A (subdomain) or B (root).
- [ ] Add the chosen domain(s) in Vercel → Settings → Domains.
- [ ] Add or update DNS at your registrar as Vercel instructs.
- [ ] Set **FRONTEND_URL** in Railway to the final app URL (e.g. `https://app.yourdomain.com` or `https://yourdomain.com`).
- [ ] Confirm **NEXT_PUBLIC_API_BASE_URL** / **NEXT_PUBLIC_API_URL** in Vercel for production.
- [ ] Wait for DNS (up to ~1 hour), then open the URL and test login and API calls.

---

## If login or API fails from the custom domain

- **CORS:** Backend already allows `BLDCebu.com`; for other domains, add the origin in `backend/src/main.ts` (allowedOrigins) or extend the env-based list.
- **Redirect / SSL:** Vercel handles HTTPS; ensure you didn’t add a conflicting redirect at the registrar.
- **Cache:** Try an incognito window or a different browser after DNS has propagated.
