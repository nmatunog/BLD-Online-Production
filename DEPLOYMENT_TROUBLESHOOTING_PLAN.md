# Production Deployment Troubleshooting Plan

## Current Situation

### ✅ What Works
- **Dev deployment works perfectly** - `./scripts/deploy-dev.sh` succeeds
- Local builds work (both frontend and backend)
- Code compiles without errors locally

### ❌ What Doesn't Work
- **Production deployment fails** with build errors
- Frontend build fails in Cloud Build with TypeScript error (even after fixes)
- Backend deployment may have database connection issues

## What We've Tried (Failed Approaches)

### 1. TypeScript Error Fix
- **Issue**: `important: true` property not supported in `sonner` toast
- **Fix Applied**: Removed `important: true` from `frontend/app/(auth)/login/page.tsx`
- **Result**: Still failing (possibly caching or file not deployed)

### 2. Database URL Format
- **Issue**: "empty host in database URL" error
- **Attempts**: 
  - Unix socket format: `postgresql://user:pass@/db?host=/cloudsql/...`
  - Localhost placeholder: `postgresql://user:pass@localhost/db?host=/cloudsql/...`
  - Public IP format: `postgresql://user:pass@IP:5432/db`
- **Result**: Still failing

### 3. Dockerfile Modifications
- **Issue**: Prisma requires OpenSSL
- **Fix Applied**: Added `apt-get install -y openssl` to all Dockerfile stages
- **Result**: Build still fails

### 4. Deployment Script Simplification
- **Issue**: Too many checks and complexity
- **Fix Applied**: Created `deploy-prod-simple.sh` mirroring dev exactly
- **Result**: Still failing

## Key Differences: Dev vs Prod

### Environment Differences
| Aspect | Dev | Prod |
|--------|-----|------|
| Project | `bld-cebu-portal-dev` | `bldcebu-portal` |
| Service Names | `*-dev` suffix | No suffix |
| Secrets | `dev-*` prefix | `prod-*` prefix |
| Database | `bld-portal-db-dev` | `bld-portal-db` |
| Max Instances | 10 | 20 |

### What's the Same
- Same Dockerfile
- Same source code
- Same build commands
- Same region (asia-southeast1)
- Same memory/CPU settings

## Root Cause Analysis

### Hypothesis 1: Cloud Build Caching
- Cloud Build might be using cached layers with old code
- The TypeScript fix might not be in the deployed code

### Hypothesis 2: File Not Saved/Committed
- The fix might not be in the actual file being deployed
- Git might not have the changes

### Hypothesis 3: Different Build Environment
- Cloud Build might have different Node/npm versions
- Different TypeScript strictness settings

### Hypothesis 4: Secret Format Issues
- Database URL secret might have hidden characters
- Newlines or encoding issues in Secret Manager

## Fresh Approach for Tomorrow

### Strategy 1: Verify Code is Actually Fixed
1. **Check the actual file being deployed**:
   ```bash
   cat frontend/app/(auth)/login/page.tsx | grep -A 5 "toast.error"
   ```
2. **Test build locally FIRST**:
   ```bash
   cd frontend
   rm -rf .next node_modules
   npm ci
   npm run build
   ```
3. **If local build fails, fix it before deploying**

### Strategy 2: Use Pre-built Docker Images
Instead of `--source .`, build locally and push to Container Registry:
1. Build Docker image locally: `docker build -t gcr.io/bldcebu-portal/backend .`
2. Push to registry: `docker push gcr.io/bldcebu-portal/backend`
3. Deploy from image: `gcloud run deploy --image gcr.io/bldcebu-portal/backend`

**Advantages**:
- See build errors immediately
- Can test Docker build locally
- No Cloud Build surprises
- Faster iterations

### Strategy 3: Deploy Backend and Frontend Separately
1. **First**: Deploy backend only (it might work)
2. **Then**: Fix frontend build issues separately
3. **Finally**: Deploy frontend once backend is confirmed working

### Strategy 4: Use Cloud Build Config File
Create `cloudbuild.yaml` for explicit control:
```yaml
steps:
  - name: 'node:20'
    entrypoint: 'npm'
    args: ['ci']
  - name: 'node:20'
    entrypoint: 'npm'
    args: ['run', 'build']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/backend', '.']
```

### Strategy 5: Check What Dev Actually Does
1. **Inspect dev deployment logs**:
   ```bash
   gcloud builds list --project=bld-cebu-portal-dev --limit=1
   ```
2. **Compare dev vs prod build logs** side-by-side
3. **Find the exact difference** that makes dev work

## Action Plan for Tomorrow

### Step 1: Verification (15 min)
- [ ] Verify TypeScript fix is in the file
- [ ] Test local frontend build (`cd frontend && npm run build`)
- [ ] Test local backend build (`cd backend && npm run build`)
- [ ] Test local Docker build (`cd backend && docker build -t test .`)

### Step 2: Choose Approach (5 min)
- [ ] Option A: Fix Cloud Build issues (if local builds work)
- [ ] Option B: Use pre-built Docker images (if Docker builds work)
- [ ] Option C: Use Cloud Build config file (for explicit control)

### Step 3: Execute (30-60 min)
- [ ] Deploy backend first (test separately)
- [ ] Fix any backend issues
- [ ] Deploy frontend (test separately)
- [ ] Fix any frontend issues
- [ ] Deploy Firebase Hosting

### Step 4: Verification (10 min)
- [ ] Test backend API: `curl https://backend-url/api/docs`
- [ ] Test frontend: Open in browser
- [ ] Test database connection: Check logs
- [ ] Test authentication: Try logging in

## Questions to Answer Tomorrow

1. **Does the local build work?** (If no, fix code first)
2. **Does Docker build work locally?** (If yes, use pre-built images)
3. **What's different in dev build logs vs prod?** (Compare side-by-side)
4. **Are secrets correctly formatted?** (Check for hidden characters)
5. **Is the code actually fixed?** (Verify file contents)

## Files to Check Tomorrow

1. `frontend/app/(auth)/login/page.tsx` - Verify TypeScript fix
2. `backend/Dockerfile` - Verify OpenSSL installation
3. `scripts/deploy-dev.sh` - Compare with prod script
4. Cloud Build logs - Compare dev vs prod
5. Secret Manager - Check database URL format

## Recommended First Step Tomorrow

**Start with local Docker build**:
```bash
cd backend
docker build -t test-backend .
```

If this works, we know the Dockerfile is correct and can use pre-built images.
If this fails, we fix the Dockerfile first before deploying.

---

**Created**: $(date)
**Status**: Planning phase - Ready for fresh approach tomorrow
