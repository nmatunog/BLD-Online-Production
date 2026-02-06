# Push to Production – Plan and Checklist

Use this once to push your local fixes to the correct production repo and avoid repeating failed pushes.

---

## Your remotes

| Remote       | Repo (GitHub)                    | Purpose |
|-------------|-----------------------------------|--------|
| **origin**  | `nmatunog/BLDCebu-Online-Portal` | Main dev repo |
| **production** | `nmatunog/BLD-Online-Production` | Production repo (if Vercel/Railway use this) |

**Important:** Vercel and Railway each have a **single connected repo**. You must push to the repo each one uses.

---

## Step 1: Confirm which repo production uses (do once)

### Railway (backend)

1. Open **Railway Dashboard**: https://railway.app/dashboard  
2. Open your project → open the **backend** service.  
3. Go to **Settings** → find **Connected Repository** (or **Source**).  
4. Note the repo name:
   - **BLD-Online-Production** → push to **production** remote.
   - **BLDCebu-Online-Portal** → push to **origin** remote.

### Vercel (frontend)

1. Open **Vercel Dashboard**: https://vercel.com/dashboard  
2. Open your project (e.g. bld-online-production).  
3. Go to **Settings** → **Git** (or **Repository**).  
4. Note the connected repo:
   - **BLD-Online-Production** → push to **production** remote.
   - **BLDCebu-Online-Portal** → push to **origin** remote.

### Typical setups

- **Same repo for both:** Railway and Vercel both use **BLDCebu-Online-Portal** → push only **origin**.
- **Production repo for both:** Both use **BLD-Online-Production** → push only **production**.
- **Split:** One uses origin, one uses production → push to **both** (see Step 3).

---

## Step 2: Push from your machine (auth required)

Pushes must be done **from your machine** (Cursor/VS Code or Terminal), not from this environment.

### Option A – Cursor / VS Code (recommended)

1. Open **Source Control** (branch icon or `Ctrl+Shift+G` / `Cmd+Shift+G`).  
2. Confirm all changes are **committed** (no uncommitted changes).  
3. Click **Sync** or **Push** (or **...** → Push).  
4. If it asks for a remote, choose the one you need:
   - **origin** → pushes to `nmatunog/BLDCebu-Online-Portal`
   - **production** → pushes to `nmatunog/BLD-Online-Production`

### Option B – Terminal

From project root:

```bash
cd /Users/nmatunog2/BLDCebu-Online-Portal
```

**If production uses BLDCebu-Online-Portal (origin):**

```bash
git push origin main
```

**If production uses BLD-Online-Production (production):**

```bash
git push production main
```

**If you need both (e.g. Railway on origin, Vercel on production):**

```bash
git push origin main
git push production main
```

---

## Step 3: Verify deploy (after push)

1. **Railway** – Deployments tab: latest deploy **succeeded** and is from the commit you just pushed.  
2. **Vercel** – Deployments: latest production deploy **succeeded** and is from that commit.  
3. **Backend** – Open `https://bld-online-production-production.up.railway.app/health` → should return `{"status":"ok",...}`.  
4. **Frontend** – Open your production URL → hard refresh (Cmd+Shift+R). Test login and Profile edit (apostolate/ministry buttons).

---

## Step 4: If push fails (auth)

- **Cursor/VS Code:** Sign in to GitHub in the editor (Accounts / Source Control) and push again.  
- **Terminal:** Ensure Git uses your credentials (e.g. Keychain for HTTPS, or SSH key). Do **not** paste tokens in chat or in scripts.

---

## Quick reference

| Goal                         | Command / action |
|-----------------------------|------------------|
| Push to BLDCebu-Online-Portal   | `git push origin main` or Cursor Push (origin) |
| Push to BLD-Online-Production  | `git push production main` or Cursor Push (production) |
| See remotes                  | `git remote -v` |
| See unpushed commits         | `git log origin/main..HEAD --oneline` (or `production/main`) |

---

## Summary

1. **Check** Railway and Vercel dashboards → note which repo each uses.  
2. **Push** from Cursor or Terminal to that repo (origin and/or production).  
3. **Verify** deploy and health/app.  
4. Use Cursor Push or Terminal with your GitHub auth; do not rely on pushes from this environment.
