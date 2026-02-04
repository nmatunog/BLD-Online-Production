# Verify Which Repo Railway Uses (Fix 500 Still Happening)

If you still see **PUT /members/me 500** after pushing the backend fix, Railway may be deploying from a **different repo** than the one you pushed to.

---

## Your remotes

| Remote      | Repo (GitHub)              | You pushed here with Option A |
|------------|-----------------------------|-------------------------------|
| **origin** | `nmatunog/BLDCebu-Online-Portal`   | No                            |
| **production** | `nmatunog/BLD-Online-Production` | Yes (`git push production main`) |

---

## Step 1: See which repo Railway uses

1. Open **Railway Dashboard**: https://railway.app/dashboard  
2. Open your project (e.g. **bld-online-production**).  
3. Open the **backend** service (the one that serves the API).  
4. Go to **Settings** (or the tab that shows **Source** / **GitHub**).  
5. Find **Connected Repository** (or **Source**, **GitHub Repo**).  
6. Note:
   - **Repository**: `nmatunog/BLD-Online-Production` or `nmatunog/BLDCebu-Online-Portal`  
   - **Branch**: usually `main`

---

## Step 2: Apply the fix

### If Railway is connected to **BLDCebu-Online-Portal** (origin)

You pushed only to **production**, so Railway never got the backend fix. Push the same commits to **origin**:

```bash
git push origin main
```

Railway will deploy from **origin**; after the deploy finishes, try profile update again.

---

### If Railway is connected to **BLD-Online-Production** (production)

The fix should already be in the repo. Check:

1. **GitHub**: Open `https://github.com/nmatunog/BLD-Online-Production` and confirm the latest commit on `main` is **"Fix PUT /members/me: never return 500..."** (or the CSP commit after it).  
2. **Railway**: In the same project, open **Deployments**. Check that the latest deployment is **after** that commit and that it **succeeded**.  
3. If the latest deploy is old or failed: click **Redeploy** (or deploy from the latest commit).

---

## Step 3: Confirm the backend is updated

After a successful deploy:

- Open: `https://bld-online-production-production.up.railway.app/health`  
- Try **profile update** again in the app.

If it still returns 500, open Railway → backend service → **Deployments** → latest deploy → **View Logs** and look for errors or the line `PUT /members/me unexpected error` (from our new code).
