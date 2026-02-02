# Profile Update (PUT /members/me) – No More 500

## Problem

In production, updating profile (including apostolate and ministry) could return **500 Internal Server Error**, with no clear message for the user.

## New approach (implemented)

### 1. Controller: never return 500

- **File:** `backend/src/members/members.controller.ts`
- **Change:** `updateMe()` is wrapped in try/catch.
  - If the error is already an `HttpException` (e.g. 400, 404, 409), it is rethrown so the client gets the correct status.
  - Any other error is logged and a **400 Bad Request** is returned with:  
    `"Profile update failed. Please check your entries (apostolate, ministry, class number) and try again."`

So the API **never** returns 500 for profile update; the client always gets 400 (or 404/409) with a message.

### 2. Service: defensive handling and safe errors

- **File:** `backend/src/members/members.service.ts`
- **Changes:**
  - **city / encounterType:** Values are coerced with `String(...).trim()` before calling `.toUpperCase()`, so `undefined` or bad types don’t throw.
  - **classNumber:** Empty string is skipped (no parse). Only non-empty values are parsed and validated (1–999).
  - **Transaction errors:** The whole `$transaction` is in try/catch.  
    - **P2002** (unique constraint) → **409 Conflict** with “email already in use” or “phone already in use”.  
    - **Any other error** → **400 Bad Request** with the safe message above (no raw Prisma/runtime errors).

### 3. Frontend

- **File:** `frontend/app/(dashboard)/profile/page.tsx`
- **Already in place:** The catch block reads `error.response?.data?.message` and shows it in the toast, so the user sees the backend message (e.g. duplicate email, or the generic “Profile update failed…”).

## What you need to do

1. **Deploy the backend** (e.g. push to the branch Railway builds from, or trigger a redeploy).
2. In production, try updating profile again. You should get either:
   - **Success**, or
   - **400** with a clear message in the toast (no more 500).

If you still see a 500, the new backend code is not yet deployed. Check Railway logs for the `PUT /members/me unexpected error` line to see the underlying error.
