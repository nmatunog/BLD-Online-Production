# Fix: Public Member Endpoint Authentication Issue

## Issue (CEB-ME1802)
ID card photo was not showing during signup because the public member lookup endpoint was returning `401 Unauthorized` instead of allowing unauthenticated access.

### Symptoms
- `GET /api/v1/members/public/community/CEB-ME1802` returned 401 on production
- Signup flow (PR #14) couldn't fetch member photos after tapping a suggestion
- ID card print showed empty 1×1 slot where photo should be

## Root Cause
The `MembersController` was using the wrong `JwtAuthGuard` implementation:
- **Wrong guard**: `backend/src/auth/guards/jwt-auth.guard.ts` - bare `AuthGuard('jwt')` that ignores `@Public()` decorator
- **Correct guard**: `backend/src/common/guards/jwt-auth.guard.ts` - reflector-aware guard that honors `IS_PUBLIC_KEY` metadata

Even though the endpoint at line 352-366 was decorated with `@Public()`, the class-level guard at line 38 rejected unauthenticated requests because it didn't check for the public decorator.

## Solution
Changed one import line in `members.controller.ts`:

```diff
- import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
+ import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
```

This makes the guard honor the `@Public()` decorator, allowing the public endpoint to work without JWT authentication.

## What Works After This Fix
✅ Unauthenticated requests to `/api/v1/members/public/community/:communityId` return 200  
✅ Response includes member data with `photoUrl` field  
✅ Signup flow can fetch photos after selecting a suggested member  
✅ ID card print displays the member's photo  
✅ All protected member routes still require JWT authentication  

## What Doesn't Change
- No changes to API response structure or fields
- No changes to protected routes (they still require authentication)
- No changes to password security (hashes are never exposed)
- Other public endpoints continue to work as before

## Testing
After deployment to Railway, verify with:

```bash
./backend/test-public-endpoint.sh https://bld-online-production-production.up.railway.app
```

Or manually:
```bash
curl https://bld-online-production-production.up.railway.app/api/v1/members/public/community/CEB-ME1802
```

Expected response:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "firstName": "...",
    "lastName": "...",
    "communityId": "CEB-ME1802",
    "photoUrl": "https://...",
    ...
  },
  "message": "Member retrieved successfully"
}
```

## Related Code
- Guard implementations:
  - ✅ `backend/src/common/guards/jwt-auth.guard.ts` - Reflector-aware (correct)
  - ❌ `backend/src/auth/guards/jwt-auth.guard.ts` - Bare AuthGuard (doesn't honor @Public)
- Public decorator: `backend/src/auth/decorators/public.decorator.ts`
- Controllers using correct guard:
  - `attendance.controller.ts` (line 20)
  - `events.controller.ts` (line 23)
- Controllers without class-level guard (no issue):
  - `auth.controller.ts`
  - `health.controller.ts`

## Deployment
1. Merge PR #15
2. Railway will automatically deploy (Vercel Git + Railway service)
3. Run test script to verify
4. Test signup flow end-to-end with real member

## Files Changed
- `backend/src/members/members.controller.ts` - Changed guard import (1 line)
- `backend/test-public-endpoint.sh` - Added verification script (new file)
