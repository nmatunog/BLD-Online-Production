# Vercel Root Directory: Use Frontend, Not Backend

## What the screenshot shows

Your Vercel project **"BLD-Online-Production"** currently has:

- **Source repo:** `nmatunog/BLD-Online-Production` ✓  
- **Root Directory:** `/backend` ← **Wrong for the web app**

With Root Directory = **/backend**, Vercel is deploying the **NestJS backend**, not the **Next.js frontend**. The app users open in the browser (and where you see the 500 error) is the **frontend**. Frontend code lives in the **`frontend/`** folder.

---

## What you want

- **Backend (API, PUT /members/me):** Deployed on **Railway** (Root Directory = `backend` there).  
- **Frontend (Next.js UI):** Deployed on **Vercel** with Root Directory = **`frontend`** so CSP fixes, profile page, etc. are what users get.

---

## Fix: Set Vercel Root Directory to `frontend`

1. In **Vercel Dashboard** → project **BLD-Online-Production** → **Settings**.
2. Find **Root Directory** (under **Build and Deployment** or **General**).
3. Click **Edit**.
4. Change **`/backend`** to **`frontend`** (no leading slash).
5. **Save**.
6. Go to **Deployments** → open the **⋮** on the latest deployment → **Redeploy**.

After that, this Vercel project will build and serve the **Next.js app** from `frontend/`. Your CSP and frontend fixes will deploy.

---

## If you really deploy the backend on Vercel too

If you have **two** Vercel projects (one for frontend, one for backend), then the screenshot might be the **backend** project. In that case:

- Keep that project’s Root Directory as **backend**.
- Use a **separate** Vercel project for the frontend with Root Directory = **frontend**, connected to the same repo `nmatunog/BLD-Online-Production`, branch **main**.

Most setups use **Railway for backend** and **one Vercel project for frontend** with Root Directory = **frontend**. If you only have one Vercel project, set its Root Directory to **frontend**.
