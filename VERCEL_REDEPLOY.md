# Vercel: Force a Redeploy

If Vercel didn’t redeploy after a git push, use one of these.

---

## Option 1: Redeploy from Vercel Dashboard (fastest)

1. Open **https://vercel.com/dashboard**
2. Open your **project** (e.g. BLDCebu-Online-Portal or your frontend app name)
3. Go to the **Deployments** tab
4. On the **latest deployment**, click the **⋮** menu → **Redeploy**
5. Leave **Use existing Build Cache** unchecked if you want a clean build
6. Click **Redeploy**

This redeploys the same commit. To deploy your latest code, push to GitHub first, then use **Option 2** or trigger a new deployment from the same **Deployments** page (e.g. **Deploy** or **Redeploy** after a new commit appears).

---

## Option 2: Deploy from your machine (deploys latest local code)

From your project root:

```bash
cd /Users/nmatunog2/BLDCebu-Online-Portal
npx vercel --prod
```

Or from the frontend folder:

```bash
cd /Users/nmatunog2/BLDCebu-Online-Portal/frontend
npx vercel --prod
```

- If the project is linked to Git, Vercel may still use the latest commit from GitHub. Push first, then run this.
- If you’re not linked to Git, this deploys your **current local files** as production.

---

## Option 3: Fix GitHub auto-deploy

If you expect every push to `main` to deploy:

1. **Vercel Dashboard** → your project → **Settings** → **Git**
2. Confirm **Connected Git Repository** is the right repo and **Production Branch** is `main` (or your branch).
3. Ensure **Deploy Hooks** or **Auto-deploy** is enabled (no “Ignore Build Step” that skips all builds).
4. Push again from your machine:
   ```bash
   git push origin main
   ```
5. In **Deployments**, a new deployment should appear; if not, use Option 1 or 2.

---

## Summary

| Goal                         | Action                                              |
|-----------------------------|-----------------------------------------------------|
| Redeploy same commit       | Dashboard → Deployments → Redeploy (Option 1)      |
| Deploy latest code now     | Push to GitHub, then Dashboard or `npx vercel --prod` (Option 2) |
| Auto-deploy on every push   | Check Git settings and Production Branch (Option 3) |
