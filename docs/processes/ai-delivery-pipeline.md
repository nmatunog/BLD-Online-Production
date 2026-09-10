# AI Delivery Pipeline for BLD Online

**Version:** 1.0  
**Approved:** 2026-09-10  
**Owner:** Nilo  
**Repository:** [github.com/nmatunog/BLD-Online-Production](https://github.com/nmatunog/BLD-Online-Production)

---

## Table of Contents

1. [Overview](#overview)
2. [Roles & Responsibilities](#roles--responsibilities)
3. [Workflow](#workflow)
4. [Architecture Supremacy](#architecture-supremacy)
5. [Quality Gates](#quality-gates)
6. [Branch Strategy](#branch-strategy)
7. [PR Process](#pr-process)
8. [Merge Authority](#merge-authority)
9. [Architecture Change Requests (ACR)](#architecture-change-requests-acr)
10. [Security & Testing](#security--testing)
11. [Anti-Patterns](#anti-patterns)
12. [Exceptions](#exceptions)

---

## Overview

The BLD Online AI Delivery Pipeline is a **locked, mandatory process** for all AI-assisted development work on the BLD Online project. This pipeline ensures:

- **Architecture supremacy** — frozen Architecture documents are the source of truth
- **Quality gates** — independent QA before PRs
- **Merge control** — only Nilo merges to `main`
- **Role clarity** — BLD Bot manages, Cursor agents implement, QA validates
- **Predictability** — every change follows the same flow

**Key Principle:** Agents are **collaborators under Nilo's authority**, not autonomous decision-makers. Nilo retains final control over what enters `main`.

---

## Roles & Responsibilities

### 1. Nilo (Product Owner / Gatekeeper)

**Responsibilities:**
- Provide product requirements and business context
- Approve or reject PRs (human review)
- **Merge PRs to `main`** (exclusive authority)
- Approve Architecture Change Requests (ACRs)
- Set priorities and deadlines

**Authority:**
- Only person who can merge to `main`
- Final decision on all ACRs
- Can accept PRs with documented blockers (rare exception)

**Does NOT:**
- Write implementation code (delegates to BLD Bot → Cursor agents)
- Merge without review (even if tests pass)
- Delegate merge authority (non-transferable)

---

### 2. BLD Bot (AI Development Manager)

**Responsibilities:**
- Receive requirements from Nilo
- Decompose into tasks with clear acceptance criteria
- Delegate tasks to Cursor Backend A, Frontend B, Integration C agents
- Enforce Architecture supremacy
- Facilitate Architecture Change Requests (ACRs)
- Coordinate QA D validation
- Review PR readiness before submission to Nilo

**Authority:**
- Task decomposition and delegation
- ACR initiation (presents to Nilo for approval)
- Can reject implementation if it violates frozen Architecture

**Does NOT:**
- Write backend/frontend application code directly (delegates to Cursor agents)
- Merge to `main` without explicit Nilo authorization for THAT specific PR
- Approve ACRs (only facilitates; Nilo approves)
- Skip QA D gate

**Analogy:** BLD Bot is the "AI Development Manager" for BLD Online, same role as "Kody" plays in other projects, but tailored to BLD's locked process.

---

### 3. Cursor Backend A (Backend Implementer)

**Responsibilities:**
- Implement backend features on `cursor/<descriptive-kebab>` feature branches
- Follow frozen Architecture documents (e.g., Event Standards v1)
- Write lint-clean, type-safe NestJS + Prisma code
- Create descriptive, atomic commits
- Push regularly to origin
- Request QA D validation before PR

**Authority:**
- Code implementation decisions within Architecture constraints
- Database schema via Prisma migrations (reviewed by QA D)

**Does NOT:**
- Merge to `main` (creates PRs only)
- Modify frozen Architecture (raises ACR via BLD Bot)
- Skip QA D validation
- Work directly on `main` branch

**Tech Stack:**
- NestJS, Prisma, PostgreSQL
- TypeScript, class-validator, JWT auth
- Swagger docs for APIs

---

### 4. Cursor Frontend B (Frontend Implementer)

**Responsibilities:**
- Implement frontend features on `cursor/<descriptive-kebab>` feature branches
- Follow frozen Architecture documents
- Write lint-clean, type-safe Next.js + React code
- Ensure responsive design (mobile-first)
- Create descriptive, atomic commits
- Push regularly to origin
- Request QA D validation before PR

**Authority:**
- UI/UX implementation decisions within Architecture constraints
- Component design and state management

**Does NOT:**
- Merge to `main` (creates PRs only)
- Modify frozen Architecture (raises ACR via BLD Bot)
- Skip QA D validation
- Work directly on `main` branch

**Tech Stack:**
- Next.js 15, React 19, TypeScript
- Tailwind CSS, Radix UI, react-hook-form, zod

---

### 5. Cursor Integration C (Full-Stack Implementer)

**Responsibilities:**
- Implement full-stack features (frontend + backend) on `cursor/<descriptive-kebab>` branches
- Coordinate changes across backend and frontend
- Follow frozen Architecture documents
- Ensure API contracts match between services
- Create descriptive, atomic commits
- Push regularly to origin
- Request QA D validation before PR

**Authority:**
- Cross-service integration decisions within Architecture constraints

**Does NOT:**
- Merge to `main` (creates PRs only)
- Modify frozen Architecture (raises ACR via BLD Bot)
- Skip QA D validation

**Tech Stack:**
- All of Backend A + Frontend B

---

### 6. Cursor QA D (Quality Gate)

**Responsibilities:**
- **Independent validation** before PR creation (gate)
- Run lint, typecheck, build, tests
- Verify security for auth/member/tenant-touching changes
- Validate Architecture compliance
- Document test results
- **Approve or reject** PR readiness

**Authority:**
- Block PR creation if QA fails
- Require security tests for sensitive changes
- Request fixes from implementer agents

**Does NOT:**
- Fix code (implementer agents fix, QA re-validates)
- Skip checks "because it looks fine"
- Merge to `main`

**QA Checklist:**
- [ ] Lint clean (`npm run lint`)
- [ ] TypeScript compiles (`npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] Security verified (if applicable)
- [ ] Architecture compliance confirmed
- [ ] Manual testing completed
- [ ] No merge conflicts with `main`

---

## Workflow

### Step-by-Step Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Nilo: Product Requirements                               │
│    - Business context, user stories, acceptance criteria    │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. BLD Bot: Task Decomposition                              │
│    - Break into backend/frontend/integration tasks          │
│    - Define acceptance criteria per task                    │
│    - Check frozen Architecture docs for constraints         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. BLD Bot: Delegate to Cursor A/B/C                        │
│    - Assign Backend A, Frontend B, or Integration C         │
│    - Provide task context + Architecture references         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Cursor A/B/C: Implement on Feature Branch                │
│    - Create/checkout cursor/<descriptive-kebab> branch      │
│    - Implement per frozen Architecture                      │
│    - Write atomic commits                                   │
│    - Push to origin regularly                               │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Cursor A/B/C: Request QA D Validation                    │
│    - Signal implementation complete                         │
│    - Provide context for testing                            │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Cursor QA D: Run Quality Gate Checks                     │
│    - Lint, typecheck, build, tests                          │
│    - Security tests (if auth/member/tenant)                 │
│    - Architecture compliance review                         │
│    - Manual testing                                         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
                   QA Pass?
                   ↙      ↘
              YES          NO
               ↓            ↓
               ↓      ┌─────────────────────────────┐
               ↓      │ QA D: Report Failures       │
               ↓      │ A/B/C: Fix Issues           │
               ↓      │ Return to Step 6            │
               ↓      └─────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Cursor A/B/C: Create Pull Request                        │
│    - Target: main                                           │
│    - Title: Descriptive, imperative                         │
│    - Body: Summary, testing, Architecture compliance        │
│    - Draft: Yes (until ready for Nilo review)              │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Nilo: Review Pull Request                                │
│    - Read PR description                                    │
│    - Review code changes                                    │
│    - Verify Architecture compliance                         │
│    - Test manually if needed                                │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
                 Nilo Approves?
                   ↙      ↘
              YES          NO
               ↓            ↓
               ↓      ┌─────────────────────────────┐
               ↓      │ Nilo: Request Changes       │
               ↓      │ A/B/C: Update PR            │
               ↓      │ Return to Step 8            │
               ↓      └─────────────────────────────┘
               ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. Nilo: Merge to main                                      │
│    - Exclusive merge authority                              │
│    - Squash or merge commit (per repo convention)          │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. CI/CD: Automatic Deployment                             │
│     - Vercel: Frontend auto-deploy from main               │
│     - Railway: Backend auto-deploy from main               │
│     - Tests run in CI (GitHub Actions)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture Supremacy

### Core Principle

**Architecture documents in `docs/architecture/` are frozen by default and override all code.**

**If code conflicts with Architecture:**
1. ❌ **DO NOT** modify Architecture to fit code
2. ✅ **DO** fix code to match Architecture
3. ✅ **OR** raise Architecture Change Request (ACR) to Nilo via BLD Bot

### Frozen Architecture Documents

| Document | Frozen Date | Scope |
|----------|-------------|-------|
| `BLD_Event_Standards_v1_Build_Brief.md` | 2026-09-06 | Event creation, Series/Occurrence/One-off, CW, WSC, Encounters, LSS, check-in |

**Out of v1 scope (future):**
- Event redesign polish
- LSS Team report parameters
- Printer pack

### Architecture Compliance Checklist

Before implementing ANY feature:

- [ ] Read relevant Architecture doc(s)
- [ ] Identify constraints (e.g., CW must be Tuesday 19:00–21:00)
- [ ] Identify data models (e.g., Series, Occurrence, One-off)
- [ ] Identify business rules (e.g., 24-week horizon, Dec 24–Jan 1 blackout)
- [ ] Implement code that enforces Architecture (not bypasses it)

### Example: Community Worship (CW) Architecture

**Frozen Architecture (Event Standards v1):**
- **Title:** "Community Worship"
- **Day:** Tuesday
- **Time:** 19:00–21:00 Manila
- **1st/3rd Tuesday:** Holy Mass subtype
- **Blackout:** Dec 24 – Jan 1 (no CW)
- **LSS overlap:** CW shortened to 19:00–20:00 on Shepherding nights

**Code Implementation:**

```typescript
// ✅ CORRECT: Enforces frozen Architecture
export class CommunityWorshipService {
  private readonly ALLOWED_DAY = 2; // Tuesday (0=Sun, 1=Mon, 2=Tue, ...)
  private readonly START_TIME = '19:00';
  private readonly END_TIME = '21:00';
  private readonly TIMEZONE = 'Asia/Manila';

  async createCWSeries(input: CreateCWSeriesDto) {
    const manilaDate = utcToZonedTime(input.date, this.TIMEZONE);
    
    // Enforce Tuesday-only
    if (manilaDate.getDay() !== this.ALLOWED_DAY) {
      throw new BadRequestException(
        'Community Worship must be on Tuesday per Event Standards v1'
      );
    }

    // Enforce time
    if (input.startTime !== this.START_TIME || input.endTime !== this.END_TIME) {
      throw new BadRequestException(
        'Community Worship must be 19:00–21:00 per Event Standards v1'
      );
    }

    // Check blackout period
    if (this.isInBlackoutPeriod(manilaDate)) {
      throw new BadRequestException(
        'Cannot create CW during Dec 24 – Jan 1 blackout per Event Standards v1'
      );
    }

    // Proceed with creation...
  }

  private isInBlackoutPeriod(date: Date): boolean {
    const month = date.getMonth(); // 0=Jan, 11=Dec
    const day = date.getDate();
    return (month === 11 && day >= 24) || (month === 0 && day === 1);
  }
}
```

---

## Quality Gates

### Gate 1: Architecture Compliance (BLD Bot)

**Who:** BLD Bot (before delegating to implementers)

**Checks:**
- Task aligns with frozen Architecture
- No conflicts with existing Architecture
- Required Architecture docs identified

**Outcome:**
- ✅ Pass → Delegate to Cursor A/B/C
- ❌ Fail → Raise ACR to Nilo OR clarify requirements

---

### Gate 2: Implementation Quality (Cursor QA D)

**Who:** Cursor QA D (before PR creation)

**Checks:**
- [ ] **Lint:** `npm run lint` passes (backend + frontend)
- [ ] **TypeScript:** `npm run build` succeeds (no type errors)
- [ ] **Tests:** `npm test` passes (unit + integration)
- [ ] **Security:** Auth/member/tenant changes have security tests
- [ ] **Architecture:** Code matches frozen Architecture docs
- [ ] **Manual:** Feature works as expected (tested locally)
- [ ] **Commits:** Atomic, descriptive, follow conventions
- [ ] **Branch:** Follows `cursor/<descriptive-kebab>` naming
- [ ] **No conflicts:** Merges cleanly with `main`

**Outcome:**
- ✅ Pass → Create PR
- ❌ Fail → Report to implementer, request fixes, re-test

**Security Tests (if applicable):**
- Unauthorized access attempts (no JWT, invalid JWT, expired JWT)
- Role-based access control (admin vs member)
- Data isolation (member cannot access other members' data)
- Input validation (XSS, SQL injection, etc.)
- Token handling (expiry, refresh, revocation)

---

### Gate 3: Human Review (Nilo)

**Who:** Nilo (before merge)

**Checks:**
- PR description is clear and complete
- Code changes align with requirements
- Architecture compliance verified
- QA D results reviewed
- No hidden risks or dependencies

**Outcome:**
- ✅ Approve → Nilo merges to `main`
- ❌ Request changes → Back to implementer
- ⏸️ Hold → Waiting for clarification or other PRs

---

## Branch Strategy

### Main Branch (`main`)

- **Protected:** Only Nilo can merge
- **Always deployable:** CI/CD auto-deploys to production
- **Source of truth:** All features eventually land here

### Feature Branches (`cursor/<descriptive-kebab>`)

- **Pattern:** `cursor/<descriptive-kebab>`
- **Lifecycle:**
  1. Created by Cursor A/B/C from `main`
  2. Commits pushed regularly
  3. QA D validates
  4. PR created (targets `main`)
  5. Nilo reviews and merges
  6. Branch deleted after merge

**Examples:**
- `cursor/add-lss-shepherding-schedule`
- `cursor/fix-cw-blackout-dates`
- `cursor/implement-wsc-ministry-filtering`

**Rules:**
- ✅ Lowercase, hyphen-separated (kebab-case)
- ✅ Descriptive (conveys feature/fix)
- ✅ Always use `cursor/` prefix
- ❌ No uppercase, underscores, agent ID suffixes, or generic names

---

## PR Process

### 1. PR Creation (After QA D Pass)

**Who:** Cursor A/B/C (implementer)

**Requirements:**
- **Target:** `main` branch
- **Title:** Imperative, descriptive (e.g., "Add LSS Shepherding schedule automation")
- **Body:** Complete and structured (see template below)
- **Draft:** Yes (until ready for Nilo review)
- **Labels:** Add relevant labels (e.g., `feature`, `bugfix`, `docs`)

**PR Body Template:**

```markdown
## Summary
Brief description of what this PR does and why.

## Architecture Compliance
- Follows Event Standards v1 § [section name]
- Uses Asia/Manila timezone per § Principles
- Enforces [specific rule] per § [section]

## Changes
- Backend: [summary of backend changes]
- Frontend: [summary of frontend changes]
- Database: [migrations or schema changes]

## Testing (QA D)
- [x] Lint clean
- [x] TypeScript compiles
- [x] Tests pass (X new tests, Y updated)
- [x] Manual testing: [describe what was tested]
- [x] Security: [N/A or describe security tests]

## Deployment Notes
- New env vars: [list or N/A]
- Migrations: [describe or N/A]
- Rollback plan: [describe or N/A]

## Known Limitations
- [Any out-of-scope items or follow-ups]

## Related
- Closes #[issue number if applicable]
- Blocks/blocked by: [other PRs if applicable]
```

---

### 2. PR Review (Nilo)

**Who:** Nilo

**Review Checklist:**
- [ ] PR description is clear
- [ ] Code changes are reasonable
- [ ] Architecture compliance verified
- [ ] QA D results are satisfactory
- [ ] No merge conflicts
- [ ] Deployment notes understood

**Actions:**
- ✅ **Approve:** Mark PR ready, proceed to merge
- ❌ **Request changes:** Comment with specific requests
- 💬 **Comment:** Ask questions or suggest improvements

---

### 3. PR Merge (Nilo Only)

**Who:** Nilo (exclusive authority)

**Actions:**
1. Final review of PR
2. Merge to `main` (squash or merge commit per convention)
3. Monitor CI/CD deployment
4. Verify production deployment success

**Post-Merge:**
- Feature branch auto-deleted (GitHub setting)
- Vercel auto-deploys frontend
- Railway auto-deploys backend
- CI tests run on `main`

---

## Merge Authority

### Hard Rule: Only Nilo Merges

**Who can merge to `main`:** Nilo (and ONLY Nilo)

**Who CANNOT merge:**
- ❌ BLD Bot
- ❌ Cursor Backend A
- ❌ Cursor Frontend B
- ❌ Cursor Integration C
- ❌ Cursor QA D
- ❌ Any automated CI bot (unless explicitly authorized by Nilo per PR)

**Enforcement:**
- GitHub branch protection rules (require Nilo approval)
- Agent instructions (agents never attempt merge)
- Human oversight (Nilo reviews all PRs)

**Why This Rule:**
- **Control:** Nilo retains final say on what enters production
- **Quality:** Human review catches edge cases AI may miss
- **Accountability:** Clear responsibility for production state
- **Predictability:** Merge timing controlled by product owner

**Exception:** None. Even urgent hotfixes require Nilo merge.

---

## Architecture Change Requests (ACR)

### When to Raise ACR

An ACR is required when:
1. Code implementation discovers Architecture conflict
2. New requirement contradicts frozen Architecture
3. Performance or security issue requires Architecture adjustment
4. Business rule changes necessitate Architecture update

**Example Triggers:**
- "Event Standards v1 says CW must be Tuesday, but client requested Wednesday option"
- "Series model in Architecture lacks `priority` field needed for display sorting"
- "LSS Shepherding dates conflict with CW blackout period in some years"

---

### ACR Process

**Step 1: STOP Implementation**
- Do NOT proceed with conflicting code
- Do NOT modify frozen Architecture doc directly
- Do NOT assume approval or implement workaround

**Step 2: Document Conflict**

Create ACR document with:

```markdown
# ACR-XXX: [Short Title]

**Date:** YYYY-MM-DD
**Raised By:** [BLD Bot / Agent Name]
**Status:** [Pending / Approved / Rejected]

## Current Architecture
Quote the relevant section from frozen Architecture doc:
> "[exact text from frozen doc]"

**Source:** docs/architecture/[filename].md § [section]

## Conflict
Describe the conflict:
- What code/feature is blocked?
- Why does it conflict with current Architecture?
- What happens if we enforce current Architecture?

## Proposed Resolution
**Option A:** [description]
- Pros: [list]
- Cons: [list]
- Impact: [affected files/components]

**Option B:** [description]
- Pros: [list]
- Cons: [list]
- Impact: [affected files/components]

**Recommendation:** [which option and why]

## Impact Analysis
- Files to update: [list]
- Database migrations: [Y/N, describe if Y]
- Deployment changes: [list]
- User-facing changes: [list]

## Approval
**Decision:** [Pending Nilo]
**Approved By:** [N/A until approved]
**Date:** [N/A until approved]
```

**Step 3: Raise to BLD Bot**

Implementer (Cursor A/B/C) presents ACR document to BLD Bot with full context.

**Step 4: BLD Bot Reviews**

BLD Bot:
- Validates conflict description
- Reviews proposed options
- Adds analysis or alternative options
- Presents ACR to Nilo

**Step 5: Nilo Decides**

Nilo:
- Reviews ACR document
- Asks questions if needed
- **Approves** one option → proceed
- **Rejects** → explain why, implementer finds alternative
- **Defers** → needs more info or timing is wrong

**Step 6: Update Architecture**

After approval:
1. Update frozen Architecture doc with approved changes
2. Mark doc as updated (version bump or changelog)
3. Notify all agents of Architecture update

**Step 7: Proceed with Implementation**

Implementer (Cursor A/B/C):
- Implements using approved Architecture
- References ACR in commit messages
- Continues to QA D gate as usual

---

### ACR Example

```markdown
# ACR-001: Allow WSC on Wednesday as Alternative Slot

**Date:** 2026-09-10
**Raised By:** BLD Bot
**Status:** Pending

## Current Architecture
Event Standards v1 § WSC:
> "WSC: title `WSC - {Official Ministry Name}`; one active series per ministry; 
> category Word Sharing Circle; do not block shared day/time/venue across ministries"

**Source:** docs/architecture/BLD_Event_Standards_v1_Build_Brief.md § WSC

## Conflict
Three ministries (Evangelization, Formation, Pastoral) all requested Tuesday 19:00 slot.

**Problem:**
- CW also on Tuesday 19:00 (locked per Event Standards v1 § CW)
- Venue capacity: 50 people
- CW attendance: 100+ (needs full venue)
- WSC attendance per ministry: ~20

**If we enforce current Architecture:**
- All three WSC series scheduled Tuesday 19:00 (allowed per current rules)
- Total: 60 WSC + 100 CW = 160 people (exceeds venue capacity 50)

## Proposed Resolution

**Option A: Allow WSC on Wednesday 19:00**
- Pros: Simple, same time slot (easy for members), avoids CW conflict
- Cons: Requires Architecture update
- Impact: Update Event Standards v1 § WSC to allow Tue OR Wed

**Option B: Stagger WSC times on Tuesday (19:00, 20:00, 21:00)**
- Pros: Keeps Tuesday as specified
- Cons: Late slots (20:00, 21:00) may have low attendance; overlaps with CW end time
- Impact: Update Event Standards v1 § WSC to allow time staggering

**Option C: Alternate weeks (Ministry A week 1, B week 2, C week 3, repeat)**
- Pros: Keeps Tuesday 19:00 for all
- Cons: Confusing schedule, low frequency (once every 3 weeks)
- Impact: Update Event Standards v1 § WSC to allow weekly rotation

**Recommendation:** **Option A** (allow Wednesday)
- Least disruptive
- Clear schedule (Ministry X = Tue, Y = Wed, Z = Tue next week)
- Avoids CW conflict entirely

## Impact Analysis
- **Files to update:**
  - docs/architecture/BLD_Event_Standards_v1_Build_Brief.md (§ WSC)
  - backend/src/events/events.service.ts (validation logic)
  - frontend/src/components/EventForm.tsx (day picker for WSC)
- **Database migrations:** None (day already stored as enum)
- **Deployment changes:** None
- **User-facing changes:** Ministry leaders see Tue/Wed options when creating WSC

## Approval
**Decision:** [Pending Nilo]
**Approved By:** [N/A]
**Date:** [N/A]
```

---

## Security & Testing

### Security-Critical Changes

**Triggers:**
- Any change to authentication (login, signup, JWT)
- Any change to member data access (profile, ID photos, attendance)
- Any change to admin/role checks
- Any change to tenant isolation (if multi-tenant)

**Required Security Tests:**

1. **Unauthorized Access**
   - No JWT → 401 Unauthorized
   - Invalid JWT → 401 Unauthorized
   - Expired JWT → 401 Unauthorized

2. **Role-Based Access Control**
   - Admin can access admin routes → 200 OK
   - Member cannot access admin routes → 403 Forbidden

3. **Data Isolation**
   - Member A cannot fetch Member B's profile → 403 Forbidden
   - Member A can fetch own profile → 200 OK

4. **Input Validation**
   - Malicious input (XSS, SQL injection) → rejected
   - Valid input → accepted

5. **Token Handling**
   - Refresh token works → new access token issued
   - Revoked token → 401 Unauthorized

**Test Coverage:**
- Unit tests for guards and validators
- Integration tests for API routes
- E2E tests for critical flows (signup → login → access protected resource)

---

### Testing Strategy

**Unit Tests:**
- Services, controllers, utilities
- Mock external dependencies (database, APIs)
- Fast, isolated, deterministic

**Integration Tests:**
- API routes with real database (test DB, not prod)
- Test request → response with validation
- Cover happy path + error cases

**E2E Tests (Manual or Automated):**
- Full user flows (signup, login, create event, check-in)
- Test in staging environment
- Verify frontend ↔ backend integration

**Manual Testing:**
- QA D performs manual testing before PR
- Test on mobile + desktop
- Verify timezone handling (Asia/Manila)
- Check UI responsiveness and accessibility

---

## Anti-Patterns

### ❌ Anti-Pattern 1: Self-Merging Agent

**What:** Single agent implements feature, validates, and merges to `main` without QA D or Nilo review.

**Why Wrong:**
- Skips independent QA gate
- Bypasses Nilo's merge authority
- No human oversight

**Correct Pattern:** Agent implements → QA D validates → PR created → Nilo reviews → Nilo merges.

---

### ❌ Anti-Pattern 2: "Fixing" Frozen Architecture

**What:** Code conflicts with Event Standards v1 → agent updates Architecture doc to match code.

**Why Wrong:**
- Architecture is frozen by default
- Requires ACR from Nilo
- Undermines Architecture supremacy

**Correct Pattern:** Code conflicts with Architecture → raise ACR → wait for approval → update Architecture after approval.

---

### ❌ Anti-Pattern 3: Skipping Security Tests

**What:** "It's just a small change to member profile" → no security tests, PR created.

**Why Wrong:**
- Member data is sensitive
- Unauthorized access risk
- Violates QA D checklist

**Correct Pattern:** Any auth/member/tenant change → write security tests → run tests → pass QA D → PR.

---

### ❌ Anti-Pattern 4: Assuming Timezone

**What:** Code uses `new Date()` without timezone conversion → wrong times displayed to Manila users.

**Why Wrong:**
- Server may be UTC or other timezone
- Users expect Asia/Manila times
- Violates Event Standards v1 § Principles

**Correct Pattern:** Always use Asia/Manila timezone for display; store UTC in database; convert explicitly.

---

### ❌ Anti-Pattern 5: Vague Commits

**What:** `git commit -m "wip"` or `git commit -m "fixed stuff"` → merged to PR.

**Why Wrong:**
- Impossible to review
- Breaks atomic commit principle
- No context for future debugging

**Correct Pattern:** Descriptive, atomic commits (e.g., `feat: add LSS Shepherding schedule automation per Event Standards v1`).

---

## Exceptions

### Exception 1: Nilo Accepts PR with Blockers

**Scenario:** QA D reports non-critical blocker (e.g., one flaky test, minor lint warning).

**Process:**
1. Implementer documents blocker in PR body
2. QA D reports blocker severity (low/medium/high)
3. BLD Bot presents to Nilo with recommendation
4. **Nilo decides:** Accept and merge OR request fix

**Criteria for acceptance:**
- Blocker is non-critical
- Fix will be addressed in follow-up PR
- Risk is low and documented

**Example:** "One E2E test flaky due to network timeout; retries work. Low risk. Follow-up: improve test stability."

---

### Exception 2: Urgent Hotfix

**Scenario:** Production bug affecting users; immediate fix needed.

**Process:**
1. Implementer creates hotfix branch `cursor/hotfix-<description>`
2. Implements minimal fix
3. QA D fast-tracks validation (focus on regression only)
4. PR created with "HOTFIX" label
5. **Nilo reviews and merges ASAP** (human decision still required)

**Criteria for hotfix:**
- Critical production bug (not a feature request)
- Minimal code change (reduces risk)
- Regression tests pass

**Note:** Even hotfixes require Nilo merge (no auto-merge exception).

---

### Exception 3: Architecture Experiment

**Scenario:** Nilo requests prototype to evaluate Architecture options (pre-ACR).

**Process:**
1. Nilo explicitly requests experiment
2. Implementer creates branch `cursor/experiment-<description>`
3. Implements experimental code (may violate frozen Architecture)
4. **PR marked as "EXPERIMENT"** (not for merge)
5. Nilo reviews experiment → decides → may trigger ACR

**Criteria:**
- Nilo explicitly requested experiment
- PR clearly marked as not for merge
- Used for evaluation only, not production

---

## Summary

**This AI Delivery Pipeline is mandatory for all BLD Online development.**

**Key Points:**
1. **Architecture > Code** — frozen docs are source of truth
2. **Nilo merges** — exclusive authority, non-transferable
3. **QA D gate** — independent validation before PR
4. **Role clarity** — BLD Bot manages, A/B/C implement, QA validates
5. **ACR for conflicts** — never modify frozen Architecture without approval
6. **Security rigor** — test auth/member/tenant changes
7. **Timezone: Asia/Manila** — all dates/times
8. **Branch naming:** `cursor/<descriptive-kebab>` (no agent ID suffix)
9. **Commit quality** — atomic, descriptive
10. **No exceptions** — even hotfixes need Nilo merge

**When in doubt:**
- Read `AGENTS.md`
- Read `.cursor/rules/bld-constitution.mdc`
- Check `docs/architecture/<relevant>.md`
- Ask BLD Bot

**This pipeline ensures quality, control, and Architecture supremacy for BLD Online.**

---

**Last Updated:** 2026-09-10  
**Approved By:** Nilo  
**Next Review:** When process or Architecture evolves
