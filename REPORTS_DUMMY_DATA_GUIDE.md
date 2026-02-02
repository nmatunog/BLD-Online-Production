# Reports Module Dummy Data Guide

## Overview

This guide explains how to create dummy data for testing the Reports module, including historical recurring events, members with ministries/apostolates, and attendance records.

## Scripts Created

### 1. `create-all-dummy-data.ts` (Master Script - Recommended)
Creates all dummy data in one go:
- Members with ministries and apostolates
- Historical Corporate Worship events (Tuesdays 7pm)
- WSC events per ministry
- Historical attendance data

### 2. `create-dummy-recurring-events.ts`
Creates only recurring events (Corporate Worship and WSC)

### 3. `create-dummy-members-with-ministries.ts`
Creates only members with ministries and apostolates

### 4. `create-dummy-attendance-data.ts`
Creates only attendance records (requires members and events to exist first)

## Quick Start

### Option 1: Run Master Script (Recommended)

```bash
cd backend
npx ts-node scripts/create-all-dummy-data.ts
```

This will create:
- **20 members** across 4 ministries (Management Services, Service Ministry, PLSG, Intercessory)
- **6 apostolates** (Teaching, Music, Youth, Couples, Singles, Family)
- **~26 Corporate Worship events** (Tuesdays 7pm, last 6 months)
- **~26 Management Services WSC events** (Wednesdays 8pm, last 6 months)
- **~26 Service Ministry WSC events** (Fridays 7pm, last 6 months)
- **Historical attendance data** with:
  - 60-80% attendance for most members
  - 100% attendance for 5 selected members

### Option 2: Run Scripts Individually

```bash
cd backend

# Step 1: Create members
npx ts-node scripts/create-dummy-members-with-ministries.ts

# Step 2: Create events
npx ts-node scripts/create-dummy-recurring-events.ts

# Step 3: Create attendance
npx ts-node scripts/create-dummy-attendance-data.ts
```

## What Gets Created

### Members (20 total)

**Management Services (5 members):**
- John Dela Cruz - Teaching
- Maria Santos - Music
- Pedro Garcia - Youth
- Ana Lopez - Couples
- Carlos Martinez - Singles

**Service Ministry (5 members):**
- Juan Reyes - Teaching
- Rosa Fernandez - Music
- Miguel Torres - Youth
- Carmen Villanueva - Couples
- Roberto Cruz - Family

**PLSG (5 members):**
- Elena Ramos - Teaching
- Fernando Mendoza - Music
- Isabel Gutierrez - Youth
- Manuel Alvarez - Couples
- Patricia Morales - Singles

**Intercessory (5 members):**
- Ricardo Castillo - Teaching
- Sofia Jimenez - Music
- Tomas Herrera - Youth
- Victoria Navarro - Couples
- William Ortega - Family

### Events

**Corporate Worship:**
- Every Tuesday at 7pm
- Last 6 months of historical data
- Status: COMPLETED (past) or UPCOMING (future)

**Management Services WSC:**
- Every Wednesday at 8pm
- Last 6 months of historical data
- Status: COMPLETED (past) or UPCOMING (future)

**Service Ministry WSC:**
- Every Friday at 7pm
- Last 6 months of historical data
- Status: COMPLETED (past) or UPCOMING (future)

### Attendance Data

- **Corporate Worship:** 70-90% of all members attend
- **WSC Events:** 60-80% of ministry members attend their respective WSC
- **Perfect Attendance:** 5 members have 100% attendance for all their relevant events

## Testing Reports

After running the scripts, you can test:

### 1. Per Ministry Report
- Go to Reports → Recurring Attendance Report
- Select "Ministry" report type
- Choose a ministry (e.g., "Management Services" or "Service Ministry")
- Select date range (e.g., last month)
- Generate report

### 2. Per Apostolate Report
- Go to Reports → Recurring Attendance Report
- Select "Community" report type
- Choose an apostolate (e.g., "Teaching", "Music")
- Select date range
- Generate report

### 3. Community-Wide Report
- Go to Reports → Recurring Attendance Report
- Select "Community" report type
- Leave apostolate as "All Apostolates"
- Select date range
- Generate report

### 4. Individual Member Report
- Go to Reports → Recurring Attendance Report
- Select "Individual" report type
- Choose a member from the dropdown
- Select date range
- Generate report

### 5. Standard Reports
- **Attendance Report:** Filter by event, date range, member
- **Member Report:** Filter by encounter type, ministry, city
- **Event Report:** Filter by date range, encounter type
- **Registration Report:** Filter by event, date range

## Fixed Issues

### Dropdown Fixes
- Added empty state handling for all Select dropdowns
- Dropdowns now show "No [items] available" when empty instead of being blank
- Fixed potential issues with empty arrays in dropdowns

## Notes

- All members have password: `password123`
- Members are created with realistic Community IDs (e.g., CEB-ME1801)
- Events are created with proper status (COMPLETED for past, UPCOMING for future)
- Attendance records include both QR_CODE and MANUAL check-in methods
- Check-in times vary by 0-30 minutes after event start time

## Cleanup

To remove all dummy data:

```bash
# Delete dummy events (those with "Corporate Worship" or "WSC" in title)
# Delete dummy members (those created by the script)
# Delete attendance records for those events/members
```

Or manually delete through the UI.
