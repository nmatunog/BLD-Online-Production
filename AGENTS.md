# BLD Online Agent Instructions

**Repository:** [github.com/nmatunog/BLD-Online-Production](https://github.com/nmatunog/BLD-Online-Production)  
**Production:** [app.bldcebu.com](https://app.bldcebu.com)  
**Product:** BLD Online — Bukás Loób sa Diyós Cebu Community ID, events, attendance, member signup/login

---

## CRITICAL: Read This First

Before implementing ANY change:

1. **Read `.cursor/rules/bld-constitution.mdc`** — always-on guardrails for BLD Online
2. **Read `docs/processes/ai-delivery-pipeline.md`** — mandatory AI delivery workflow
3. **Follow frozen Architecture docs strictly** — see `docs/architecture/`

**Architecture Supremacy:** If code conflicts with approved Architecture documents, the Architecture is correct. Fix the code OR raise a controlled Architecture Change Request (ACR). Never let implementation drift override frozen architecture.

---

## Project Overview

### Tech Stack

- **Backend:** NestJS + Prisma (`backend/`)
- **Frontend:** Next.js 15 + React 19 (`frontend/`)
- **Database:** PostgreSQL on Railway
- **Deploy:** Vercel (frontend) + Railway (backend)
- **Photos:** BunnyCDN storage zone `bld-idphotos` → https://bld-idphotos.b-cdn.net
- **Timezone:** Asia/Manila (source of truth for all event dates/times)

### Repository

- **Source of truth:** GitHub ([nmatunog/BLD-Online-Production](https://github.com/nmatunog/BLD-Online-Production))
- **No Origin copy** — all PRs target GitHub `main` branch

### Deployment Flow

- **Nilo merges to `main`** → Automatic CI/CD
- **Vercel** auto-deploys frontend from `main`
- **Railway** auto-deploys backend from `main`

---

## Roles & Responsibilities

### Nilo (Product Owner / Gatekeeper)
- Provides product requirements
- **ONLY person who merges to `main`**
- Reviews and approves all PRs before merge
- Authorizes Architecture Change Requests (ACRs)

### BLD Bot (AI Development Manager)
- Receives requirements from Nilo
- Decomposes into tasks with clear acceptance criteria
- Delegates to specialized Cursor agents
- Does NOT write application code when Cursor agents are available
- Manages Architecture supremacy
- Raises ACRs when Architecture conflicts arise

### Cursor Backend A / Frontend B / Integration C (Implementers)
- Implement on feature branches following `cursor/<descriptive-name>-a457` pattern
- Follow Architecture documents strictly
- Write lint-clean, type-safe code
- Create descriptive commits
- Push regularly to feature branches
- **Do NOT merge to `main`** — only create PRs

### Cursor QA D (Quality Gate)
- **Independent verification before PR creation**
- Runs lint, typecheck, unit tests, integration tests
- Verifies security for auth/member/tenant-touching changes
- **No PR until QA passes** (or Nilo accepts explicit blockers)
- Documents test results

---

## Workflow (READ THIS)

```
Nilo (requirements)
    ↓
BLD Bot (planning, task decomposition, acceptance criteria)
    ↓
Cursor A/B/C (implement on feature branch)
    ↓
Cursor QA D (independent gate: lint, typecheck, tests, security)
    ↓
PR created (only after QA D passes)
    ↓
Nilo approval (human review)
    ↓
Nilo merges to main (ONLY Nilo)
    ↓
CI/CD (Vercel frontend + Railway backend)
```

**Critical Rules:**
- Agents NEVER merge to `main`
- Agents NEVER self-merge as "done"
- PR creation ONLY after QA D passes
- BLD Bot merges a PR ONLY when Nilo explicitly authorizes THAT PR

---

## Architecture Supremacy

### Frozen Architecture Documents

All files in `docs/architecture/` are **frozen by default** unless an ACR is approved.

**Current frozen architecture:**
- `BLD_Event_Standards_v1_Build_Brief.md` — Event creation/management standards (Series/Occurrence/One-off, CW, WSC, Encounters, LSS, unified check-in)

### Architecture Change Request (ACR) Process

If code conflicts with Architecture:

1. **STOP implementation**
2. **Document the conflict:**
   - Current Architecture requirement
   - Code implementation that conflicts
   - Why the conflict exists
   - Proposed resolution
3. **Raise ACR to Nilo** via BLD Bot
4. **Wait for approval** before proceeding
5. **Update Architecture doc** only after Nilo approves

**Anti-Pattern:** "Fixing" frozen Architecture in code to make implementation easier WITHOUT an approved ACR.

---

## Anti-Patterns (DO NOT DO THESE)

❌ Single agent that self-merges "done" without QA D  
❌ Merging to `main` without Nilo's explicit OK for that PR  
❌ "Fixing" frozen Architecture in code to make coding easier  
❌ Skipping security/auth tests when touching member/auth/tenant data  
❌ Creating PR before QA D passes (unless Nilo accepts blockers)  
❌ Implementing changes that conflict with Architecture without ACR  
❌ Assuming "it works locally" means QA passed  

---

## Feature Branch Naming

**Pattern:** `cursor/<descriptive-name>-a457`

**Examples:**
- `cursor/add-lss-shepherding-schedule-a457`
- `cursor/fix-community-worship-blackout-a457`
- `cursor/implement-wsc-ministry-routing-a457`

**Rules:**
- Always use `cursor/` prefix
- Always use `-a457` suffix
- Use lowercase with hyphens
- Be descriptive and concise

---

## Key Product Features

### Events Architecture (Frozen — see Architecture doc)

- **Series** (repeating) vs **Occurrence** (instance) vs **One-off** (single event)
- **Community Worship (CW):** Tuesdays 19:00–21:00, 1st/3rd include Holy Mass
- **WSC:** One active series per ministry, category "Word Sharing Circle"
- **Encounters:** ME, SE, SPE, YE, FE with cadences and serial numbering
- **LSS:** First Sat–Sun of March, with Shepherding sessions on Tuesdays
- **24-week horizon** for CW/WSC scheduling
- **Unified check-in** across all event types
- **Timezone:** Asia/Manila (all dates/times)

### Member Management

- Signup/login flows
- Profile with ID photo (background removal)
- Community ID card generation with QR
- Photo storage on BunnyCDN
- Member attendance tracking

### Authentication

- JWT-based auth
- Passport strategies (local, JWT)
- Admin vs member roles
- Secure member data access

---

## Development Commands

### Backend (NestJS)
```bash
cd backend
npm install
npm run start:dev        # Development mode with watch
npm run build            # TypeScript compilation + Prisma generate
npm run lint             # ESLint check
npm test                 # Jest tests
npx prisma migrate dev   # Run migrations locally
npx prisma studio        # Open Prisma Studio
```

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev              # Development server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint check
```

---

## Before Creating a PR

**Checklist (enforced by QA D):**

- [ ] Code follows Architecture documents
- [ ] Lint passes (`npm run lint`)
- [ ] TypeScript compilation clean (`npm run build`)
- [ ] Tests pass (if applicable)
- [ ] Security verified (if touching auth/member/tenant data)
- [ ] Manual testing completed
- [ ] Commits are descriptive and atomic
- [ ] Feature branch pushed to origin
- [ ] No merge conflicts with `main`

**Only after all checks pass** → Create PR

---

## PR Process

1. **QA D passes** → Agent creates PR
2. **PR targets `main`** branch
3. **PR title:** Clear, imperative (e.g., "Add LSS Shepherding schedule automation")
4. **PR body:** Context, changes, testing notes, Architecture references
5. **PR as draft:** Yes (until ready for Nilo's review)
6. **Nilo reviews** → Provides feedback OR approves
7. **Nilo merges** → Only Nilo executes the merge

**Agents NEVER use merge buttons.**

---

## Environment Variables

### Backend (Railway)
- `DATABASE_URL` — PostgreSQL connection
- `JWT_SECRET` — Auth token signing
- `BUNNY_STORAGE_API_KEY` — BunnyCDN upload
- `BUNNY_STORAGE_ZONE` — `bld-idphotos`
- `BUNNY_HOSTNAME` — `storage.bunnycdn.com`
- `BUNNY_CDN_URL` — `https://bld-idphotos.b-cdn.net`
- `PORT` — Railway assigns dynamically

### Frontend (Vercel)
- `NEXT_PUBLIC_BACKEND_URL` — Railway backend URL
- Build command: `npm run build`
- Output directory: `.next`
- Root directory: `frontend`

---

## Testing Guidelines

### Security Testing (Required for Auth/Member/Tenant Changes)

- Test unauthorized access attempts
- Verify JWT validation
- Check role-based access control
- Test member data isolation
- Verify sensitive endpoint protection

### Integration Testing

- Test full flows (signup → login → profile → event registration)
- Verify cross-service communication (frontend ↔ backend)
- Test error handling and edge cases

### Manual Testing

- Test in production-like environment
- Verify UI/UX on mobile and desktop
- Test timezone handling (Asia/Manila)
- Verify QR code generation and scanning

---

## Questions?

- **Architecture questions:** Check `docs/architecture/` first, then ask BLD Bot
- **Process questions:** Read `docs/processes/ai-delivery-pipeline.md`
- **Technical blockers:** Raise to BLD Bot with context
- **Architecture conflicts:** Initiate ACR through BLD Bot

---

## Remember

1. **Architecture over implementation** — frozen docs are the source of truth
2. **QA D gate is mandatory** — no shortcuts
3. **Nilo merges** — agents only create PRs
4. **Security matters** — test auth/member data changes rigorously
5. **Asia/Manila timezone** — all dates/times

---

**Last Updated:** 2026-09-10  
**Approved By:** Nilo  
**Next Review:** When Architecture or process changes
