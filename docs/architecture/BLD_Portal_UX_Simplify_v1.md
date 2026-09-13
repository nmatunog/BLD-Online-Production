# BLD Portal UX Simplify v1

**Version:** 1.0  
**Approved:** 2026-09-10  
**Status:** ACTIVE (Phase 1: Check-in complete)  
**Product:** BLD Online Portal — Check-in simplification  
**Owner:** Nilo  
**Repository:** [github.com/nmatunog/BLD-Online-Production](https://github.com/nmatunog/BLD-Online-Production)

---

## Overview

This document defines the approved UX models for Phase 1: Check-in simplification across all three check-in surfaces (public, dashboard staff, self). The goal is to enable door volunteers to check someone in within ~5 seconds without training, while preserving all existing functionality.

**Scope:**
- Public check-in `/checkin/[eventId]`
- Dashboard staff check-in `/checkin`
- Self check-in `/checkin/self-checkin`
- Shared check-in components

**Out of Phase 1 Scope:**
- Events mega-page redesign
- Reports mega-page redesign
- Candidate check-in redesign

---

## Core UX Principles

### 1. Progressive Disclosure

**Principle:** Show only what's immediately needed; hide secondary/advanced options behind clear affordances.

**Examples:**
- Manual Community ID behind "Can't scan?" button (not always visible)
- Event picker collapsed when only one eligible event
- CheckInChatbot behind "Get help" button

**Rationale:** Reduces visual noise; guides user to primary path (scanner for staff, giant CTA for self).

---

### 2. Calm Check-In

**Principle:** Continuous scanning as the default; visual calm after successful scan; minimal interruptions.

**Implementation:**
- Continuous mode DEFAULT ON for all staff scanning paths
- Success toast (3-5s) then immediately ready for next member
- No navigation away from scanner unless user chooses
- Hide Login/Registration CTAs while scanner is active (staff path)

**Rationale:** Door staff need to process many people quickly; continuous scanning reduces taps.

---

### 3. Large Tap Targets

**Principle:** Primary actions ≥44px minimum tap target (Apple/Google accessibility guidelines).

**Implementation:**
- Primary CTAs: min-h-[56px] (Check In, Start Scanner)
- Secondary buttons: min-h-[48px] (Back, Can't scan?, Need help?)
- Tertiary actions: min-h-[44px] (Not you? link)

**Rationale:** Mobile-first; volunteers often using phones in low-light/rushed environments.

---

### 4. Role-Aware Defaults

**Principle:** Device memory determines starting mode; staff see scanner first, remembered members see "Check in as {Name}" CTA.

**Implementation:**
- Public page: deviceMemory checks role → staff = scanner, member = self-checkin CTA
- Dashboard: staff only (members redirected to /checkin/self-checkin)
- Self: giant Check In CTA for remembered member; collapse picker if only one eligible event

**Rationale:** Minimize decision fatigue; most common path is one tap away.

---

## Phase 1 Implementation

### Public Check-In `/checkin/[eventId]`

**Before:** Event header, mode selection, scanner/manual always visible, Login/Registration CTAs compete for attention.

**After:**
- **Event header:** One unified component (title + Manila date+time + location)
- **Mode selection:** Choose (if remembered member) → Self (auto-check-in) OR Staff (scanner)
- **Staff mode:**
  - Prominent QRScannerCard (continuous ON by default)
  - ManualCheckInCard behind "Can't scan?" (collapsed by default)
  - Login/Registration quiet (small, top-right)
- **Self mode:** Status card + Back button
- **Choose mode:** Large "Check in as {Name}" (≥56px), secondary "I'm staff — scan members", quiet "Not you?"

**Files changed:**
- `frontend/app/checkin/[eventId]/page.tsx` (simplified)
- Shared components: `EventHeader`, `QRScannerCard`, `ManualCheckInCard`

---

### Dashboard Staff Check-In `/checkin`

**Before:** Event selector, scanner/manual/search in large cards, stats, recent check-ins — all visible at once.

**After:**
- **Event selector:** Tonight/in-window events prioritized (via `sortEventsNearestFirst`)
- **Tonight-first cards:** Large event cards (not yet implemented; dropdown for now)
- **Check-in methods:** QRScannerCard + ManualCheckInCard (continuous ON)
- **Live count:** CheckInStats component (Total / QR / Manual)
- **Recent check-ins:** RecentCheckIns component with auto-refresh, undo
- **Manual lookup:** Secondary behind "Can't scan?" in ManualCheckInCard

**Files changed:**
- `frontend/app/(dashboard)/checkin/page.tsx` (simplified)
- Shared components: `QRScannerCard`, `ManualCheckInCard`, `CheckInStats`, `RecentCheckIns`

---

### Self Check-In `/checkin/self-checkin`

**Before:** Event picker always visible, CheckInChatbot competes with Check In CTA.

**After:**
- **Giant Check In CTA:** Primary action (≥56px), one event → collapsed picker by default
- **Event picker:** Behind "Need a different event?" (collapsed by default if only one event)
- **Past events:** CW/WSC search behind same collapsed section
- **CheckInChatbot:** Behind "Get help" button (not inline)
- **Manila date/time:** Consistent with public/dashboard pages

**Files changed:**
- `frontend/app/(dashboard)/checkin/self-checkin/page.tsx` (already simplified in previous work)

---

## Shared Components

### Created in Phase 1

All components live in `frontend/components/checkin/`:

1. **EventHeader.tsx**
   - Unified event display: title + Manila date+time + location
   - Used across public, dashboard (future), self

2. **QRScannerCard.tsx**
   - Prominent scanner with continuous mode DEFAULT ON
   - Controls: torch, camera switch, continuous toggle, stop
   - Used in public staff mode, dashboard staff

3. **ManualCheckInCard.tsx**
   - Manual Community ID behind "Can't scan?" expansion
   - Optional name search (firstName + lastName)
   - Used in public staff mode, dashboard staff

4. **CheckInStats.tsx**
   - Live count: Total / QR Code / Manual
   - Loading state support
   - Used in dashboard staff

5. **RecentCheckIns.tsx**
   - Recent list with method badge (QR / Manual)
   - Refresh + auto-refresh toggle
   - Undo/remove (admin/member permissions)
   - Used in dashboard staff

**Export:** `frontend/components/checkin/index.ts` (barrel export)

---

## Technical Constraints

### No Backend Changes (Phase 1)

**Rule:** UI/IA only — do not change Event Standards behavior or attendance API contracts unless absolutely required. Prefer zero backend changes.

**Rationale:** Phase 1 is UX simplification; backend changes introduce risk and delay.

**Exception:** If API change is absolutely required, document in PR and get Nilo approval before implementation.

---

### Keep Existing Stack

**Stack:**
- Next.js App Router
- Tailwind CSS
- shadcn/ui + Radix
- lucide-react icons
- sonner toasts
- html5-qrcode via `lib/qr-scanner-service.ts`
- `lib/device-memory.ts` (remember-this-phone)
- `lib/event-checkin-window.ts` (check-in window helpers)

**No new libraries** in Phase 1.

---

### Preserve All Functionality

**Rule:** No intentional feature removal.

**Preserved features:**
- QR scan (continuous mode)
- Manual Community ID entry
- Name search (firstName + lastName)
- Undo/remove check-in
- Self check-in
- Remember-this-phone (deviceMemory)
- Role redirects (member → self-checkin)
- Live stats (Total / QR / Manual)
- Auto-refresh recent check-ins
- Camera torch/switch
- Duplicate event canonical confirmation

---

### Manila Timezone (Always)

**Rule:** All dates/times displayed in Asia/Manila timezone.

**Implementation:**
- `lib/event-checkin-window.ts` helpers use Manila time
- `EventHeader` component formats dates in Manila
- Backend stores UTC, frontend converts to Manila for display

**Source of truth:** Event Standards v1 § Principles (Asia/Manila)

---

## Future Work (Out of Phase 1 Scope)

### Phase 2: Dashboard Event Cards (Not Yet Implemented)

**Goal:** Tonight/in-window events as **large cards** (not dropdown).

**Design:**
- Each card: event title, date/time, location, live "Checked in: N"
- Tap card → opens scanner for that event
- Card visual: purple gradient, large tap target (≥72px)

**Files to change:**
- `frontend/app/(dashboard)/checkin/page.tsx` (replace dropdown with card grid)

**Rationale:** Deferred to Phase 2 to ship Phase 1 faster.

---

### Phase 2: Events UX Simplify (Implemented)

**Goal:** Replace the Events kitchen-sink mega-page with calm, task-first IA without removing power.

**Status:** Implemented (Phase 2 complete)

**Route Structure:**

1. **`/events` — List/Home Page**
   - Shows upcoming/ongoing occurrences + one-offs (not a wall of admin generators)
   - Primary CTA: "Set up an event" → `/events/new`
   - Filters/status sections present but calmer
   - Role-gated "Admin tools" accordion for: Ensure CW, LSS Shepherding, Super-user audit/duplicates, and other power tools

2. **`/events/new` — Event Setup Picker**
   - Three large cards (≥72px tap target):
     - **Weekly gathering** → Community Worship ensure / CW setup flow
     - **Ministry circle** → WSC Setup dialog/flow
     - **Special program** → Create Program one-off catalog flow (includes LSS)
   - Each card: icon, title, description, "Set up" CTA

3. **`/events/[id]` — Event Detail Page**
   - Header with Manila-friendly datetime, venue, location
   - Actions: Edit (with `EventUpdateScopeDialog` for series: "Just this night" / "This and future nights"), QR, Registrations link, role-gated Cancel/Delete
   - Shepherds/Accounting via overflow if present
   - Calm single-event focus (not mixed with list)

**EventCard Simplification:**
- Collapsed dense emoji/action row into: primary actions visible (Open / Check-in link) + `⋯` overflow menu for the rest
- Preserves all functionality (Edit, QR, Registrations, Shepherds, Accounting, Cancel, Delete) with role gates

**Technical Constraints:**
- No backend changes (Event Standards v1 APIs stay frozen)
- Reuses existing `frontend/services/events.service.ts` methods
- Preserves auth/role checks from mega-page
- shadcn/Tailwind/lucide/sonner stack unchanged

**Components Extracted:**
- `frontend/components/events/EventsList.tsx` (list view for `/events`)
- `frontend/components/events/EventSetupPicker.tsx` (picker for `/events/new`)
- `frontend/components/events/EventDetail.tsx` (detail for `/events/[id]`)
- Admin tools extracted to separate components

**Files Changed:**
- `frontend/app/(dashboard)/events/page.tsx` → simplified to list only
- `frontend/app/(dashboard)/events/new/page.tsx` → picker page (new)
- `frontend/app/(dashboard)/events/[id]/page.tsx` → detail page (new)
- `frontend/components/events/EventCard.tsx` → overflow menu pattern
- `docs/architecture/BLD_Portal_UX_Simplify_v1.md` → Phase 2 section added

**Definition of Done:**
- Routes above work; mega-page replaced with task-first surfaces
- Coordinator path: `/events/new` → "Ministry circle" → WSC wizard without LSS/Encounter on that screen
- Admin can still reach CW ensure, LSS shepherding, audit, duplicates (via "Admin tools" on `/events`)
- `cd frontend && npm run lint && npm run build` pass
- PR created but NOT merged (Nilo-only merge)

---

### Phase 3: Candidate Check-In Redesign (Not Covered)

**Out of scope:** Candidate check-in flow simplification.

**Current state:** Functional; search by name, confirm encounter, auto-assign Community ID.

**Future:** Apply same UX principles (progressive disclosure, large tap targets).

---

## Acceptance Criteria (Phase 1)

**Definition of Done:**

- [ ] All three check-in surfaces still perform check-in via existing endpoints
- [ ] Continuous scan defaults ON for staff paths (public staff, dashboard staff)
- [ ] Manual Community ID behind "Can't scan?" on public staff path
- [ ] Dashboard staff landing prioritizes tonight/in-window events (sorted)
- [ ] No intentional feature removal (scan/manual/undo/remember-device)
- [ ] `frontend` lint and build typecheck pass for changed code
- [ ] Shared components extracted to `frontend/components/checkin/*`
- [ ] PR title: `feat(checkin): simplify door staff and public check-in UX`
- [ ] PR body: summary, screenshots (if available), test notes, link to this doc
- [ ] PR created but NOT merged (Nilo-only merge per bld-constitution)

---

## Testing Notes

### Manual Testing (Minimum)

**Public check-in `/checkin/[eventId]`:**
1. Load public page with remembered member → see Choose mode
2. Tap "Check in as {Name}" → auto-check-in works
3. Tap "I'm staff — scan members" → scanner opens, continuous ON
4. Scan member QR → check-in succeeds, scanner stays open for next
5. Tap "Can't scan?" → manual input expands
6. Enter Community ID → check-in succeeds

**Dashboard staff check-in `/checkin`:**
1. Login as staff → redirected to /checkin (members redirect to self-checkin)
2. Select tonight's event from dropdown
3. Start QR scanner → continuous ON by default
4. Scan member QR → check-in succeeds, scanner stays open
5. Check live stats update (Total / QR / Manual)
6. Check recent check-ins list updates
7. Tap undo → check-in removed

**Self check-in `/checkin/self-checkin`:**
1. Login as member → giant Check In CTA visible
2. One eligible event → event picker collapsed by default
3. Tap Check In → success
4. Multiple eligible events → picker expanded by default
5. Tap "Need a different event?" → picker expands/collapses
6. Tap "Get help" → CheckInChatbot opens

---

## Architecture Compliance

**Frozen docs followed:**
- `BLD_Event_Standards_v1_Build_Brief.md` § Asia/Manila timezone
- `AGENTS.md` § Feature branch naming: `cursor/checkin-ux-simplify`
- `.cursor/rules/bld-constitution.mdc` § QA gate, Nilo-only merge

**No ACR required:** This is UI/IA only; no Event Standards behavior changes.

---

## References

**PR:** [Link to PR after creation]

**Related files:**
- `frontend/app/checkin/[eventId]/page.tsx`
- `frontend/app/(dashboard)/checkin/page.tsx`
- `frontend/app/(dashboard)/checkin/self-checkin/page.tsx`
- `frontend/components/checkin/*`

**Frozen Architecture:**
- `docs/architecture/BLD_Event_Standards_v1_Build_Brief.md` (timezone, check-in window)

---

**Last Updated:** 2026-09-10  
**Approved By:** Nilo  
**Next Review:** When Phase 2 (dashboard event cards) is planned
