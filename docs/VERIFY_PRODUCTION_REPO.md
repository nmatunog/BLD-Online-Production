# Verify Production Repo – Why Production Still Shows Old Profile

**Production URL:** `https://bld-online-production.vercel.app`  
**What you see:** Old profile edit (dropdowns for Apostolate / Ministry).  
**What you want:** New profile edit (clickable buttons for Apostolate / Ministry).

That means the **repo Vercel deploys from** does not yet have your latest commits.

---

## Step 1: See which repo Vercel uses (30 seconds)

1. Open **Vercel Dashboard**: https://vercel.com/dashboard  
2. Open the project that owns **bld-online-production.vercel.app** (often named "bld-online-production" or similar).  
3. Go to **Settings** → **Git** (or **Repository**).  
4. Find **Connected Git Repository**. You’ll see either:
   - **nmatunog/BLD-Online-Production** → Vercel deploys from the **production** repo.
   - **nmatunog/BLDCebu-Online-Portal** → Vercel deploys from the **origin** repo.

Write it down: **Vercel is connected to _______________.

---

## Step 2: Push your local code to that repo

Your local `main` has the new profile (buttons). Push it to the **same** repo Vercel uses.

**If Vercel uses BLD-Online-Production (production repo):**

```bash
cd /Users/nmatunog2/BLDCebu-Online-Portal
git push production main
```

**If Vercel uses BLDCebu-Online-Portal (origin repo):**

```bash
cd /Users/nmatunog2/BLDCebu-Online-Portal
git push origin main
```

Do this from **Cursor (Source Control → Push)** or **Terminal** on your machine (GitHub auth required). When Cursor asks which remote, pick **production** or **origin** to match Step 1.

---

## Step 3: Wait for deploy and hard refresh

1. In Vercel → **Deployments**: wait until the latest deployment is **Ready** (from the push you just did).  
2. Open **https://bld-online-production.vercel.app/profile** and do a **hard refresh**:
   - Mac: **Cmd + Shift + R**
   - Windows: **Ctrl + Shift + R**

You should then see **Ministry Information (optional)** and **clickable buttons** for Apostolate and Ministry instead of dropdowns.

---

## Checklist

- [ ] Vercel project **bld-online-production.vercel.app** → Settings → Git → noted connected repo.  
- [ ] Pushed to that repo: `git push production main` **or** `git push origin main`.  
- [ ] New deployment finished in Vercel.  
- [ ] Hard refresh on `/profile` and confirmed new UI.

---

## If it still shows the old UI

- Confirm the **latest deployment** in Vercel is from the commit **after** your push (e.g. "Profile: apostolate/ministry as clickable buttons").  
- Try an **incognito/private** window or another browser to avoid cache.  
- If Vercel is connected to **BLD-Online-Production**, ensure you ran `git push production main` (not only `git push origin main`).
