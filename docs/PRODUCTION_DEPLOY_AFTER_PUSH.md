# Production Still Shows Old UI – Deploy & Cache Checklist

The **correct repo** (nmatunog/BLD-Online-Production) **has** the profile commit on `main`.  
If the live site (bld-online-production.vercel.app) still shows the old profile, it’s **deploy** or **cache**.

---

## 1. Check Vercel deployment

1. Open **Vercel Dashboard** → your project (bld-online-production).
2. Go to **Deployments**.
3. Find the **latest production deployment** (branch: `main`).
4. Check:
   - **Commit message** – Does it say **"Profile: apostolate/ministry as clickable buttons..."** (or a newer commit)?
   - **Status** – **Ready** (green) or **Building** / **Error**?

**If the latest deploy is from an older commit:**  
Click the **⋯** on the latest **main** commit → **Redeploy** (or "Redeploy with existing Build Cache" off if you want a clean build).

**If the latest deploy failed:**  
Open the failed deployment, check the build logs, fix any errors, then push again or trigger a new deploy from the same commit.

---

## 2. Check Vercel project settings

1. Same project → **Settings** → **General**.
2. **Root Directory** – Must be **`frontend`** (so Vercel builds the Next.js app). If it’s empty or `backend`, change it to **frontend** and redeploy.
3. **Framework Preset** – **Next.js**.
4. **Build Command** – e.g. `npm run build` or leave default.

Save if you changed anything, then trigger a new deployment from **Deployments** (Redeploy from latest `main`).

---

## 3. Hard refresh / bypass cache

After a successful deploy from the profile commit:

1. Open **https://bld-online-production.vercel.app/profile**.
2. **Hard refresh:**
   - Mac: **Cmd + Shift + R**
   - Windows: **Ctrl + Shift + R**
3. Or open the same URL in an **Incognito/Private** window.

You should see **Ministry Information (optional)** and **clickable buttons** for Apostolate and Ministry.

---

## Summary

| Check | Action |
|-------|--------|
| Latest deploy from profile commit? | Deployments → confirm commit message; if not, Redeploy from latest `main`. |
| Root Directory = `frontend`? | Settings → General → Root Directory = `frontend`. |
| Still old UI? | Hard refresh (Cmd+Shift+R) or try incognito. |

The repo is correct; focus on **Vercel deployment** and **browser cache**.
