# Fix Same CSP Error on Vercel

## New approach (if previous fixes didn’t help)

**1. PUT /members/me 500 (profile / apostolate–ministry update)**  
The backend no longer returns 500 for profile updates:

- **Controller** – `PUT /members/me` is wrapped in try/catch. Any unexpected error is logged and a **400** is returned with a safe message.
- **Service** – All Prisma/transaction errors are caught and turned into **400** (or **409** for duplicate email/phone). Defensive handling for `city`, `encounterType`, and `classNumber` avoids runtime errors.

Redeploy the **backend** (Railway) so production uses this. The frontend will then get 400 with a clear message instead of 500.

**2. CSP (Framing / script from vercel.live)**  
Recommended: **turn off the feature that injects the script**, instead of relaxing CSP further:

- **Vercel Dashboard** → your project → **Settings** → **General** (or **Deployment**).
- Disable **Vercel Toolbar** and/or **Vercel Live** (feedback widget).
- Redeploy and hard-refresh. The framing/script errors for `vercel.live` will stop because the script is no longer injected.

Our CSP already allows `vercel.live` in `script-src`, `connect-src`, and `frame-src`. If you still see violations, a **second CSP from Vercel** is likely; disabling the toolbar/live feature removes that source.

---

## Allow Vercel Live / feedback script (if you keep it enabled)

If the console blocks **`https://vercel.live/_next-live/feedback/feedback.js`**:

1. **Redeploy** – Our CSP allows `https://vercel.live` and `https://*.vercel.live` in `script-src`, `connect-src`, and **`frame-src`** (so the Vercel Live feedback widget can load in a frame). Push your latest code and redeploy the frontend so production uses this CSP.
2. **Hard refresh** – After deploy, do a hard refresh (Ctrl+Shift+R / Cmd+Shift+R) or open the site in an incognito window.
3. **If the error persists** – The policy in the console may be coming from **Vercel**, not our app. When Vercel sends a second CSP (e.g. from Toolbar, Speed Insights, or Security Headers), the browser merges both and the result can be stricter. Disable **Vercel Toolbar** / **Vercel Live** / **Speed Insights** (or the feature that injects the feedback script) in **Vercel Dashboard → Project → Settings** so only our CSP is sent (see below).

## Why you still see CSP errors

The browser is getting **two** Content-Security-Policy headers:

1. **Our app** (middleware + next.config + vercel.json) – includes `'unsafe-inline'`, Stripe, secured-pixel.com.
2. **Vercel** – a long policy (vercel.com, stripe, youtube, cdn.vercel-insights.com, etc.) that often **does not** include `'unsafe-inline'`.

When there are two CSP headers, the browser **merges** them (takes the **intersection**). So the effective policy is the **stricter** one – e.g. `script-src 'self'` only – and inline scripts / third‑party scripts get blocked.

## What to do (in order)

### 1. Turn off Vercel features that add a second CSP

In **Vercel Dashboard** → your project (**bld-online-production**) → **Settings**:

| Where | What to check | Action |
|-------|----------------|--------|
| **Speed Insights** | Is it enabled? | **Disable** (or turn off “Inject script” / similar if shown). |
| **Analytics** (Web Analytics) | Is it enabled? | **Disable** (or turn off if you don’t need it). |
| **General** or **Deployment** | “Vercel Toolbar” / “Preview Toolbar” | **Disable** for production (or entirely). |
| **Security** | “Security Headers”, “Attack Challenge Mode”, anything that sets **Content-Security-Policy** | **Disable** or remove the CSP. |
| **Deployment Protection** | “Vercel Authentication” / “Password Protection” | If enabled, see if there’s an option that adds CSP and **disable** that. |

After each change, **redeploy** (or trigger a new deployment) and hard‑refresh the site (Ctrl+Shift+R / Cmd+Shift+R). Check the console again; when only **one** CSP is sent (ours), the errors should stop.

### 2. Confirm which CSP is sent

1. Open DevTools → **Network**.
2. Refresh the page.
3. Click the **document** request (your app URL).
4. Open **Headers** → **Response Headers**.
5. Search for **Content-Security-Policy**.

- If you see **two** `Content-Security-Policy` lines, that’s the cause; keep disabling Vercel features until only one remains.
- If you see **one** and it already has `'unsafe-inline'` and your domains, the remaining errors may be from a **report-only** policy or cache; try incognito and a hard refresh.

### 3. If you need Speed Insights / Analytics

If you want to keep Speed Insights or Web Analytics:

- We already allow `https://*.vercel.app` and common Vercel domains in our CSP.
- The problem is Vercel **adding a second CSP** that doesn’t include `'unsafe-inline'`. So either:
  - Keep those features **off** until Vercel lets you customize or disable their CSP, or
  - Re-enable them and accept that you may still see CSP errors until Vercel changes how they inject CSP.

## Summary

- **Same CSP error** = two CSP headers (app + Vercel), so the effective policy is too strict.
- **Fix:** Disable the Vercel feature that adds the extra CSP (Speed Insights, Analytics, Toolbar, Security Headers, etc.) so only our CSP is sent.
- **Check:** Network tab → document request → Response Headers → count `Content-Security-Policy` and confirm one of them has `'unsafe-inline'`.
