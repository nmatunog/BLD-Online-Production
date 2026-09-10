# BLD Event Standards v1 Build Brief

**Version:** 1.0  
**Approved:** 2026-09-06  
**Status:** FROZEN (changes require Architecture Change Request)  
**Product:** BLD Online Event Management  
**Owner:** Nilo  
**Repository:** [github.com/nmatunog/BLD-Online-Production](https://github.com/nmatunog/BLD-Online-Production)

---

## Table of Contents

1. [Overview](#overview)
2. [Principles](#principles)
3. [Event Types](#event-types)
4. [Community Worship (CW)](#community-worship-cw)
5. [Word Sharing Circles (WSC)](#word-sharing-circles-wsc)
6. [Encounters](#encounters)
7. [Life in the Spirit Seminar (LSS)](#life-in-the-spirit-seminar-lss)
8. [Unified Check-In](#unified-check-in)
9. [Out of Scope (v1)](#out-of-scope-v1)
10. [Implementation Requirements](#implementation-requirements)

---

## Overview

This document defines the **frozen Architecture** for BLD Online event creation, scheduling, and management. All implementation code MUST conform to these standards.

**If code conflicts with this Architecture, the Architecture is correct.** Fix the code OR raise an Architecture Change Request (ACR) to Nilo via BLD Bot.

**Scope:**
- Event data model (Series, Occurrence, One-off)
- Community Worship (CW) scheduling and rules
- Word Sharing Circle (WSC) scheduling and rules
- Encounter event cadences and naming
- Life in the Spirit Seminar (LSS) scheduling and Shepherding sessions
- Unified check-in system
- 24-week scheduling horizon

**Out of v1 Scope:**
- Event UI redesign polish
- LSS Team report parameters
- Printer pack integration

---

## Principles

### 1. Staff Set Series Once

**Principle:** BLD staff create repeating event **Series** once (e.g., Community Worship). The system generates **Occurrences** (individual instances) automatically within a defined horizon.

**Rationale:** Reduces manual work; ensures consistency; enables bulk operations (reschedule, cancel series).

**Example:**
- Staff creates "Community Worship" series: Tuesdays 19:00–21:00
- System generates occurrences: Sep 10, Sep 17, Sep 24, Oct 1, … (24 weeks)

---

### 2. Stable Titles

**Principle:** Event titles are stable and predictable. No ad-hoc naming.

**Format:**
- **Community Worship:** "Community Worship"
- **WSC:** "WSC - {Official Ministry Name}"
- **Encounters:** "{Encounter Type} {Serial Number}" (e.g., "ME 45", "SE 23")
- **LSS:** "Life in the Spirit Seminar {Serial Number}" (e.g., "LSS 12")

**Rationale:** Easy to search, filter, and display; no confusion across years.

---

### 3. Series vs Occurrence vs One-off

**Data Model:**

| Type | Definition | Examples |
|------|------------|----------|
| **Series** | Repeating event template; generates occurrences | Community Worship, WSC |
| **Occurrence** | Single instance of a series; linked to parent series | CW on Sep 10, 2026 |
| **One-off** | Standalone event; no series parent | Special prayer service, fundraiser |

**Key Attributes:**

**Series:**
- `id` (UUID)
- `title` (string)
- `category` (enum: CW, WSC, Encounter, LSS, One-off)
- `recurrenceRule` (e.g., RRULE: FREQ=WEEKLY;BYDAY=TU)
- `startDate`, `endDate` (horizon boundaries)
- `defaultStartTime`, `defaultEndTime` (Asia/Manila timezone)
- `venue` (string)
- `isActive` (boolean)

**Occurrence:**
- `id` (UUID)
- `seriesId` (foreign key to Series)
- `date` (date only, Asia/Manila)
- `startTime`, `endTime` (time only, Asia/Manila)
- `venue` (string, can override series venue)
- `status` (enum: Scheduled, Cancelled, Completed)
- `subtype` (optional, e.g., "Holy Mass" for 1st/3rd CW)

**One-off:**
- `id` (UUID)
- `title` (string)
- `category` (enum)
- `date` (Asia/Manila)
- `startTime`, `endTime` (Asia/Manila)
- `venue` (string)

**Uniqueness Constraint:**
- Series: `title + category` (one "Community Worship" CW series active at a time)
- Occurrence: `seriesId + date + startTime` (idempotent; same series + Manila date + start time = same occurrence)

---

### 4. Asia/Manila Timezone (Source of Truth)

**Principle:** All event dates and times are expressed in **Asia/Manila** timezone (GMT+8).

**Storage:** Store as UTC in database (best practice).

**Display/Input:** Always convert to/from Asia/Manila for user-facing operations.

**Implementation:**
- Backend: Use `date-fns-tz` or equivalent
- Frontend: Use `date-fns-tz` or equivalent
- Database: Store as `TIMESTAMP WITH TIME ZONE` (UTC)

**Example:**
- User selects: "2026-09-10 19:00" (Manila time)
- Backend stores: "2026-09-10 11:00:00+00" (UTC)
- Backend returns: "2026-09-10 19:00" (Manila time for display)

**Critical:** Do NOT assume server timezone = Manila timezone. Always convert explicitly.

---

### 5. Idempotent Series + Manila Date + Start Time

**Principle:** Generating occurrences for a series is idempotent. Same series + same Manila date + same start time → same occurrence (no duplicates).

**Implementation:** Use UPSERT logic (create if not exists, update if exists).

**Example:**
- Generate occurrences for "Community Worship" series twice
- Result: No duplicates; existing occurrences unchanged

---

### 6. Serial/Class Never Includes Year in Title

**Principle:** Encounter and LSS titles use **serial numbers**, not years.

**Correct:**
- "ME 45" (not "ME 2026-45")
- "LSS 12" (not "LSS 2026")
- "SE 23" (not "SE 2026-23")

**Rationale:** Cleaner titles; serial numbers are globally unique; no year confusion.

**Serial Tracking:** Backend maintains `nextSerial` counter per event type (ME, SE, SPE, YE, FE, LSS).

---

### 7. Admin Overwrite with Warnings

**Principle:** Staff can manually override system-generated values (e.g., change occurrence time), but system displays warnings.

**Example:**
- System generates CW occurrence: Sep 10, 19:00–21:00
- Staff changes to: Sep 10, 18:00–20:00
- System warns: "This occurrence time differs from series default (19:00–21:00). Confirm?"

**Rationale:** Flexibility for exceptions (e.g., venue conflict), but discourages drift from standards.

---

## Event Types

### Category Enum

| Category | Description | Examples |
|----------|-------------|----------|
| `CW` | Community Worship | Tuesday prayer service |
| `WSC` | Word Sharing Circle | Ministry-specific Bible study |
| `ME` | Marriage Encounter | Couples retreat |
| `SE` | Singles Encounter | Singles retreat |
| `SPE` | Solo Parent Encounter | Solo parents retreat |
| `YE` | Youth Encounter | Youth retreat |
| `FE` | Family Encounter | Family retreat |
| `LSS` | Life in the Spirit Seminar | 7-week course |
| `ONE_OFF` | One-off event | Special events, fundraisers |

---

## Community Worship (CW)

### Definition

**Community Worship (CW)** is the weekly Tuesday prayer service for the entire BLD Cebu community.

---

### Schedule

| Attribute | Value |
|-----------|-------|
| **Title** | "Community Worship" |
| **Category** | `CW` |
| **Day** | Tuesday (fixed) |
| **Time** | 19:00–21:00 (Asia/Manila) |
| **Venue** | [TBD — configurable per deployment] |
| **Frequency** | Weekly |
| **Horizon** | 24 weeks from current week |

---

### Subtype: Holy Mass

**Rule:** 1st and 3rd Tuesday of each month include **Holy Mass** subtype.

**Implementation:**
- Generate CW occurrences
- For each occurrence:
  - If Tuesday is 1st or 3rd Tuesday of month → set `subtype = 'Holy Mass'`
  - Else → `subtype = null`

**Display:** Show "Community Worship (Holy Mass)" for 1st/3rd Tuesdays.

---

### Blackout Period: Dec 24 – Jan 1

**Rule:** No Community Worship during Dec 24 – Jan 1 (Christmas/New Year break).

**Implementation:**
- When generating CW occurrences, skip any Tuesday falling within Dec 24 – Jan 1 (inclusive).

**Example:**
- Dec 24, 2026 (Wed) → Dec 25 (Thu) → Dec 29 (Tue, skip), Jan 1 (Thu)
- Dec 24, 2027 (Fri) → Dec 28 (Tue, skip), Jan 1 (Sat)

---

### LSS Overlap: Shortened CW (19:00–20:00)

**Rule:** On **LSS Shepherding nights** (Tuesdays during LSS sessions), CW is shortened to 19:00–20:00.

**Context:** LSS Shepherding sessions run 20:00–21:00 on Tuesdays. CW ends early to accommodate.

**Implementation:**
- Identify LSS Shepherding Tuesdays (see [LSS section](#life-in-the-spirit-seminar-lss))
- For CW occurrences on those Tuesdays, set `endTime = '20:00'` (instead of default 21:00)
- Display: "Community Worship (LSS Shepherding Night)"

**LSS Shepherding Tuesdays:**
- Last Tuesday of January (Salubungan)
- Following 6 Tuesdays (Sessions 1–6)
- Total: 7 Tuesdays

---

### Implementation Checklist

- [ ] Series: `title = "Community Worship"`, `category = CW`, `recurrenceRule = WEEKLY on Tuesday`
- [ ] Occurrences: Generate 24 weeks from current week
- [ ] Time: 19:00–21:00 (shortened to 19:00–20:00 on LSS Shepherding nights)
- [ ] Subtype: "Holy Mass" for 1st/3rd Tuesdays
- [ ] Blackout: Skip Dec 24 – Jan 1
- [ ] Timezone: Asia/Manila
- [ ] Validation: Reject manual changes to non-Tuesday days (unless admin override with warning)

---

## Word Sharing Circles (WSC)

### Definition

**Word Sharing Circles (WSC)** are ministry-specific Bible study sessions. Each ministry has one active WSC series.

---

### Schedule

| Attribute | Value |
|-----------|-------|
| **Title** | `WSC - {Official Ministry Name}` (e.g., "WSC - Evangelization") |
| **Category** | `WSC` |
| **Day** | Configurable per ministry (typically mid-week) |
| **Time** | Configurable per ministry |
| **Venue** | Configurable per ministry |
| **Frequency** | Weekly or bi-weekly (configurable) |
| **Horizon** | 24 weeks from current week |

---

### Rules

1. **One Active Series per Ministry**
   - Each ministry has at most ONE active WSC series at a time
   - Creating a new WSC series for the same ministry auto-deactivates the previous series

2. **Official Ministry Name**
   - Title format: `WSC - {Official Ministry Name}`
   - Examples:
     - "WSC - Evangelization"
     - "WSC - Formation"
     - "WSC - Pastoral"
     - "WSC - Management"

3. **No Day/Time/Venue Blocking Across Ministries**
   - **Rule:** Multiple ministries CAN schedule WSC on the same day/time/venue.
   - **Rationale:** Different ministries, different audiences; no conflict.
   - **Example:** "WSC - Evangelization" and "WSC - Formation" can both be Tuesday 19:00 at the same venue (different participants).

4. **Category**
   - All WSC series have `category = WSC`

---

### Implementation Checklist

- [ ] Series: `title = "WSC - {Ministry Name}"`, `category = WSC`
- [ ] One active series per ministry (enforce via database constraint or validation)
- [ ] Allow shared day/time/venue across different ministries (no conflict check)
- [ ] Occurrences: Generate 24 weeks from current week
- [ ] Timezone: Asia/Manila

---

## Encounters

### Definition

**Encounters** are spiritual retreats for specific groups: married couples (ME), singles (SE), solo parents (SPE), youth (YE), families (FE).

---

### Types & Cadences

| Type | Full Name | Typical Frequency | Typical Months |
|------|-----------|-------------------|----------------|
| **ME** | Marriage Encounter | ~3×/year | Jul–Nov |
| **SE** | Singles Encounter | ~2×/year | Jul, Oct |
| **SPE** | Solo Parent Encounter | ~1×/year | Sep or Oct |
| **YE** | Youth Encounter | ~1×/year | May–Jun |
| **FE** | Family Encounter | ~1×/year | Apr–May |

**Note:** Frequencies are typical patterns, not strict rules. Actual dates depend on staffing and demand.

---

### Naming & Serials

**Title Format:** `{Encounter Type} {Serial Number}`

**Examples:**
- "ME 45" (Marriage Encounter #45)
- "SE 23" (Singles Encounter #23)
- "YE 10" (Youth Encounter #10)

**Serial Numbering:**
- Each encounter type has a separate serial counter
- Serials are globally unique and increment sequentially
- **Do NOT include year** in title (e.g., "ME 2026-45" is wrong)

---

### Event Type

**Encounters are One-off events**, not Series.

**Rationale:** Each encounter is unique (different dates, participants, staff). Not repeating weekly.

**Implementation:**
- Create as `ONE_OFF` with `category = ME/SE/SPE/YE/FE`
- Title: Auto-generate as `{Type} {nextSerial}`
- Backend increments `nextSerial` per type after creation

---

### Implementation Checklist

- [ ] One-off events (not series)
- [ ] Title: `{Type} {Serial}` (e.g., "ME 45")
- [ ] Category: `ME`, `SE`, `SPE`, `YE`, `FE`
- [ ] Serial auto-increment per type
- [ ] No year in title
- [ ] Timezone: Asia/Manila

---

## Life in the Spirit Seminar (LSS)

### Definition

**Life in the Spirit Seminar (LSS)** is a 7-week spiritual course with weekend sessions and weeknight Shepherding sessions.

---

### Schedule

| Attribute | Value |
|-----------|-------|
| **Title** | `Life in the Spirit Seminar {Serial}` (e.g., "LSS 12") |
| **Typical Dates** | First Sat–Sun of March (Feb flex) |
| **Duration** | 2 days (Sat–Sun) + 7 Tuesdays (Shepherding sessions) |
| **Category** | `LSS` |
| **Horizon** | Annual (one per year) |

---

### Weekend Sessions (Sat–Sun)

**Format:**
- **Saturday:** Full day (e.g., 9:00–17:00)
- **Sunday:** Full day (e.g., 9:00–17:00)

**Typical Scheduling:**
- First weekend of March
- Flexibility: Can shift to late February if venue/staff conflicts

**Event Type:** One-off (or short 2-day series)

---

### Shepherding Sessions (7 Tuesdays)

**Format:**
- **Salubungan (Reunion):** Last Tuesday of January, 20:00–21:00
- **Sessions 1–6:** Following 6 Tuesdays, 20:00–21:00

**Total:** 7 Tuesdays (Salubungan + 6 sessions)

**Timing:** After Community Worship (which is shortened to 19:00–20:00 on these nights)

**Event Type:** Series with 7 occurrences (LSS Shepherding Series)

---

### Naming & Serials

**Title Format:** `Life in the Spirit Seminar {Serial Number}`

**Examples:**
- "Life in the Spirit Seminar 12" (LSS #12)
- "Life in the Spirit Seminar 13" (LSS #13)

**Serial Numbering:**
- Global counter for all LSS events
- Increments once per LSS (not per session)
- **Do NOT include year** in title

---

### LSS + CW Interaction

**Rule:** On LSS Shepherding Tuesdays, Community Worship is shortened to 19:00–20:00.

**Implementation:**
1. When LSS Shepherding series is created, system identifies the 7 Tuesdays
2. For each CW occurrence on those Tuesdays, set `endTime = '20:00'`
3. Display CW as "Community Worship (LSS Shepherding Night)"

**Rationale:** Avoid venue/time conflict; CW attendees can stay for LSS Shepherding if desired.

---

### Implementation Checklist

- [ ] LSS weekend: One-off event, 2 days (Sat–Sun)
- [ ] LSS Shepherding: Series with 7 occurrences (Salubungan + Sessions 1–6)
- [ ] Title: `Life in the Spirit Seminar {Serial}`
- [ ] Category: `LSS`
- [ ] Serial auto-increment globally
- [ ] Shepherding sessions: Tuesdays 20:00–21:00
- [ ] CW shortened to 19:00–20:00 on Shepherding nights
- [ ] Timezone: Asia/Manila

---

## Unified Check-In

### Definition

**Unified check-in** means attendance tracking is consistent across all event types (CW, WSC, Encounters, LSS).

---

### Check-In Data Model

**Attendance Record:**
- `id` (UUID)
- `memberId` (foreign key to Member)
- `eventId` (foreign key to Occurrence or One-off)
- `checkInTime` (timestamp, Asia/Manila)
- `checkInMethod` (enum: QR, Manual, Admin)
- `status` (enum: Present, Absent, Excused)

---

### Check-In Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| **QR** | Member scans QR code with app | Self-service at event entrance |
| **Manual** | Staff manually marks attendance | Backup if QR fails |
| **Admin** | Admin records attendance post-event | Data correction |

---

### Check-In with CW

**Rule:** CW check-in uses the same system as other events (QR, Manual, Admin).

**Implementation:**
- CW occurrence has a `checkInOpenTime` (e.g., 18:30) and `checkInCloseTime` (e.g., 19:15)
- Members can check in during this window via QR or Manual
- Staff can record attendance post-event via Admin

---

### LSS Team Report (Deferred)

**Note:** LSS Team report parameters (e.g., team assignments, roles) are OUT OF SCOPE for v1.

**Future:** LSS Shepherding sessions may require additional metadata (team assignments, session attendance by team). This will be defined in a future Architecture update.

---

### Implementation Checklist

- [ ] Attendance table: `memberId`, `eventId`, `checkInTime`, `checkInMethod`, `status`
- [ ] Check-in methods: QR, Manual, Admin
- [ ] Check-in window: Configurable per event (e.g., 30 min before start → 15 min after start)
- [ ] Same system for CW, WSC, Encounters, LSS
- [ ] Timezone: Asia/Manila

---

## Out of Scope (v1)

The following are **explicitly out of scope** for Event Standards v1 and will be addressed in future versions:

1. **Event UI Redesign Polish**
   - Current UI is functional; redesign for better UX is deferred

2. **LSS Team Report Parameters**
   - Team assignments, roles, team-level attendance tracking (deferred)

3. **Printer Pack Integration**
   - Direct printing of attendance reports, ID cards (deferred)

**Rationale:** Focus on core event creation, scheduling, and check-in for v1. Defer enhancements to reduce scope.

---

## Implementation Requirements

### Backend (NestJS + Prisma)

**Database Schema:**

```prisma
enum EventCategory {
  CW
  WSC
  ME
  SE
  SPE
  YE
  FE
  LSS
  ONE_OFF
}

enum EventStatus {
  SCHEDULED
  CANCELLED
  COMPLETED
}

enum CheckInMethod {
  QR
  MANUAL
  ADMIN
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  EXCUSED
}

model Series {
  id                String        @id @default(uuid())
  title             String
  category          EventCategory
  recurrenceRule    String        // RRULE format
  startDate         DateTime      // Horizon start (Manila TZ, stored UTC)
  endDate           DateTime      // Horizon end (Manila TZ, stored UTC)
  defaultStartTime  String        // HH:MM (Manila TZ)
  defaultEndTime    String        // HH:MM (Manila TZ)
  venue             String?
  isActive          Boolean       @default(true)
  createdAt         DateTime      @default(now())
  updatedAt         DateTime      @updatedAt
  occurrences       Occurrence[]

  @@unique([title, category])
}

model Occurrence {
  id          String        @id @default(uuid())
  seriesId    String
  series      Series        @relation(fields: [seriesId], references: [id])
  date        DateTime      // Date only (Manila TZ, stored UTC)
  startTime   String        // HH:MM (Manila TZ)
  endTime     String        // HH:MM (Manila TZ)
  venue       String?       // Override series venue if needed
  status      EventStatus   @default(SCHEDULED)
  subtype     String?       // e.g., "Holy Mass" for 1st/3rd CW
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  attendance  Attendance[]

  @@unique([seriesId, date, startTime]) // Idempotent
}

model OneOffEvent {
  id          String        @id @default(uuid())
  title       String
  category    EventCategory
  date        DateTime      // Date (Manila TZ, stored UTC)
  startTime   String        // HH:MM (Manila TZ)
  endTime     String        // HH:MM (Manila TZ)
  venue       String?
  status      EventStatus   @default(SCHEDULED)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  attendance  Attendance[]
}

model Attendance {
  id              String            @id @default(uuid())
  memberId        String
  member          Member            @relation(fields: [memberId], references: [id])
  occurrenceId    String?
  occurrence      Occurrence?       @relation(fields: [occurrenceId], references: [id])
  oneOffEventId   String?
  oneOffEvent     OneOffEvent?      @relation(fields: [oneOffEventId], references: [id])
  checkInTime     DateTime          // Timestamp (Manila TZ, stored UTC)
  checkInMethod   CheckInMethod
  status          AttendanceStatus  @default(PRESENT)
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@unique([memberId, occurrenceId])
  @@unique([memberId, oneOffEventId])
}

model SerialCounter {
  id          String   @id @default(uuid())
  type        String   @unique // "ME", "SE", "SPE", "YE", "FE", "LSS"
  nextSerial  Int      @default(1)
  updatedAt   DateTime @updatedAt
}
```

**Validation:**
- CW must be on Tuesday (reject other days unless admin override)
- CW time must be 19:00–21:00 (or 19:00–20:00 on LSS Shepherding nights)
- WSC: One active series per ministry
- Encounters: Auto-increment serial per type
- LSS: Auto-increment global serial

**API Endpoints:**
- `POST /series` — Create series (CW, WSC, LSS Shepherding)
- `POST /series/:id/generate-occurrences` — Generate 24 weeks of occurrences
- `GET /occurrences` — List occurrences (filter by date range, category, status)
- `POST /one-off-events` — Create one-off event (Encounters, LSS weekend)
- `POST /attendance` — Record check-in (QR, Manual, Admin)
- `GET /attendance/event/:eventId` — Get attendance for an event

---

### Frontend (Next.js + React)

**Event Creation Forms:**
- **Series Form:** Title, category, recurrence rule, start/end dates, default times, venue
- **One-off Form:** Title, category, date, start/end times, venue

**Occurrence Management:**
- Display list of occurrences (table or calendar view)
- Filters: Date range, category, status
- Actions: Edit, cancel, mark completed

**Check-In UI:**
- QR scanner (HTML5 camera API or library)
- Manual check-in (search member, mark present)
- Admin override (edit attendance post-event)

**Validation:**
- Display warnings for admin overrides (e.g., CW on non-Tuesday)
- Show "Holy Mass" badge for 1st/3rd CW Tuesdays
- Show "LSS Shepherding Night" badge for shortened CW

**Timezone Handling:**
- Always display dates/times in Asia/Manila
- Use `date-fns-tz` for conversions
- Store UTC in database, convert for display

---

### Testing

**Unit Tests:**
- Series generation logic (24-week horizon)
- CW blackout period (Dec 24 – Jan 1)
- CW Holy Mass subtype (1st/3rd Tuesdays)
- WSC one-per-ministry enforcement
- Encounter serial auto-increment
- LSS + CW interaction (shortened CW)

**Integration Tests:**
- Create CW series → generate occurrences → verify count and dates
- Create LSS Shepherding series → verify CW shortened on those Tuesdays
- Create WSC series for two ministries → verify no conflict error

**E2E Tests:**
- Staff creates CW series → occurrences appear in calendar
- Member checks in to CW via QR → attendance recorded
- Staff manually records attendance post-event

---

## Summary

**Event Standards v1 is FROZEN.** All implementation must conform to this Architecture.

**Key Points:**
1. **Series** (CW, WSC, LSS Shepherding) vs **Occurrence** (instances) vs **One-off** (Encounters, LSS weekend)
2. **CW:** Tuesday 19:00–21:00; Holy Mass on 1st/3rd; blackout Dec 24 – Jan 1; shortened on LSS nights
3. **WSC:** One active per ministry; shared day/time/venue OK across ministries
4. **Encounters:** One-off with serial numbers (no year in title)
5. **LSS:** Weekend + 7 Tuesdays (Shepherding); CW shortened to 19:00–20:00 on those nights
6. **Unified check-in:** QR, Manual, Admin for all events
7. **Timezone:** Asia/Manila (source of truth)
8. **24-week horizon:** For CW and WSC
9. **Idempotent:** Same series + date + time → same occurrence

**If code conflicts with this Architecture:**
- ❌ Do NOT change this document directly
- ✅ Fix code to match Architecture
- ✅ OR raise Architecture Change Request (ACR) to Nilo via BLD Bot

---

**Last Updated:** 2026-09-06  
**Approved By:** Nilo  
**Next Review:** When business rules change or ACR is approved
