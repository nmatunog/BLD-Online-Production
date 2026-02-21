# Verify Railway Deployment (Fix “property gender should not exist”)

Use this checklist when the production API still rejects member personal fields (gender, children, etc.) after a push.

---

## 1. Which repo does Railway use?

1. Open **Railway**: https://railway.app/dashboard → your project → **backend** service.
2. Go to **Settings** → **Source** (or **GitHub** / **Connected Repository**).
3. Note:
   - **Repository**: `nmatunog/BLD-Online-Production` **or** `nmatunog/BLDCebu-Online-Portal`
   - **Branch**: (usually `main`)
   - **Root Directory**: (should be `backend` so Railway builds the Nest app)

**If you’re not sure:** Railway only deploys when you push to the repo it’s connected to. If you only push to **production** and Railway is connected to **origin** (BLDCebu-Online-Portal), it never gets updates. Push to the repo shown here.

---

## 2. Does that repo have the right code on GitHub?

Open the repo Railway uses (from step 1) on GitHub:

- **BLD-Online-Production**: https://github.com/nmatunog/BLD-Online-Production  
- **BLDCebu-Online-Portal**: https://github.com/nmatunog/BLDCebu-Online-Portal  

On the default branch (usually `main`):

1. **Latest commits** should include:
   - `Pin Prisma to 5.x so Railway build succeeds (schema uses url)`
   - `Member personal fields: gender, civil status, profile; push for production`

2. **backend/package.json** (open the file on GitHub):
   - `devDependencies.prisma` should be `"^5.22.0"` (not `^7.x`).

3. **backend/src/members/dto/update-member.dto.ts**:
   - Should contain optional fields: `gender`, `profession`, `civilStatus`, `dateOfBirth`, `spouseName`, `dateOfMarriage`, `numberOfChildren`, `children`, `dateOfEncounter`.

If any of these are missing, push from your machine to that repo:

```bash
# If Railway uses BLD-Online-Production:
git push production main

# If Railway uses BLDCebu-Online-Portal:
git push origin main
```

---

## 3. Did the latest Railway build succeed?

1. Railway → backend service → **Deployments**.
2. Open the **latest** deployment.
3. Check:
   - **Status**: must be **Success** (green). If it’s **Failed** or **Crashed**, the running API is still the previous (old) deployment.
   - **Commit**: should match the “Pin Prisma…” or “Member personal fields…” commit.

If the latest deploy **failed**:

- Click that deployment → **View Logs** (or **Build Logs**).
- Look for errors such as:
  - `The datasource property 'url' is no longer supported` → repo still has Prisma 7; ensure step 2 shows `prisma: "^5.22.0"` and push again.
  - Any **red** build error → fix that (e.g. missing env, install failure).

Then trigger a **new deploy** (Redeploy / Deploy from latest commit) after fixing.

---

## 4. Quick checks after a successful deploy

- **Health**: https://bld-online-production-production.up.railway.app/health → `{"status":"ok",...}`
- **Profile/Members update**: In the app, edit a member and set Gender / Civil Status → Save. You should **not** see “property gender should not exist”.

---

## Summary

| Issue | What to do |
|-------|------------|
| Railway connected to wrong repo | Push to the repo shown in Settings → Source (origin **or** production). |
| Repo on GitHub missing Prisma 5 or new DTO | Push latest commits: `git push production main` and/or `git push origin main`. |
| Latest deployment **failed** | Fix build (usually Prisma 5 in package.json), push, then Redeploy. |
| Latest deployment **succeeded** but API still rejects fields | Confirm the deployment commit is the one with “Member personal fields…” and “Pin Prisma…”. Clear cache / redeploy once more if needed. |
