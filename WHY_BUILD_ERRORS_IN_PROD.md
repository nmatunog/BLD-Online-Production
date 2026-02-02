# Why Build Errors in Production But Not in Dev?

## The Key Difference

### Next.js Dev Mode (`npm run dev` / `next dev`)
- **Purpose**: Fast development with hot reloading
- **TypeScript Checking**: 
  - Uses incremental compilation
  - May skip some type checks for speed
  - Shows warnings but doesn't always fail
  - More lenient - focuses on getting code running quickly
- **Behavior**: Type errors might show as warnings in the terminal but won't stop the dev server

### Next.js Build Mode (`npm run build` / `next build`)
- **Purpose**: Create optimized production bundle
- **TypeScript Checking**:
  - Runs **full TypeScript type check** on all files
  - **All type errors are treated as build failures**
  - No shortcuts - must pass all checks
  - More strict - ensures production code is type-safe
- **Behavior**: Any TypeScript error = build fails immediately

## Your tsconfig.json Settings

Looking at your `frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,  // ← This enables ALL strict type checking
    ...
  }
}
```

With `"strict": true`, TypeScript enforces:
- ✅ Strict null checks (`strictNullChecks`)
- ✅ No implicit any (`noImplicitAny`)
- ✅ Strict function types
- ✅ And more...

## The Errors We Fixed

All of these were **valid TypeScript errors** that existed in your code:

1. **`ministry` could be `null | undefined`**
   - Dev mode: Might work at runtime if values are always present
   - Build mode: TypeScript correctly flags this as unsafe

2. **API responses not typed**
   - Dev mode: JavaScript works, types are inferred
   - Build mode: TypeScript requires explicit types for safety

3. **Missing interface properties**
   - Dev mode: Runtime might work if properties exist
   - Build mode: TypeScript catches missing properties

## Why This is Actually Good

✅ **Production builds catch bugs before deployment**
✅ **Type safety prevents runtime errors**
✅ **Better code quality**
✅ **Easier to maintain**

## How to Catch These Earlier

### Option 1: Run Build Locally Before Committing
```bash
cd frontend
npm run build  # This will catch all TypeScript errors
```

### Option 2: Add Pre-commit Hook
Add to `package.json`:
```json
{
  "scripts": {
    "precommit": "npm run build"
  }
}
```

### Option 3: Use TypeScript in Dev Mode
You can make dev mode stricter, but it will slow down hot reloading.

## Summary

**Dev mode is forgiving** → Build mode is strict
- Dev: "Let's get it running, we'll fix types later"
- Build: "Everything must be type-safe for production"

The errors we're fixing now were always there - dev mode just didn't enforce them. This is why production builds are important - they catch issues that dev mode might miss!

---

**TL;DR**: Dev mode prioritizes speed and allows some type errors. Build mode prioritizes safety and fails on any type error. This is by design - production code should be type-safe!
