# Step-by-Step Production Deployment

Follow these steps to deploy the BLD Cebu Online Portal to production.

## Prerequisites

- [ ] Production hosting platform selected (e.g., Vercel, Railway, AWS, Google Cloud, etc.)
- [ ] PostgreSQL database provisioned for production
- [ ] Domain names ready (for frontend and backend if separate)
- [ ] SSL certificates configured (HTTPS required)

## Step 1: Prepare Production Database

### 1.1 Create Production Database
```bash
# Create a new PostgreSQL database
# (Method depends on your hosting provider)
# Example: Railway, Supabase, AWS RDS, etc.
```

### 1.2 Get Database Connection String
```
postgresql://user:password@host:port/database
```

### 1.3 Test Database Connection
```bash
# Test connection locally (optional)
psql "postgresql://user:password@host:port/database"
```

## Step 2: Set Up Backend Environment

### 2.1 Generate JWT Secrets
```bash
# Generate strong random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Run twice to get JWT_SECRET and JWT_REFRESH_SECRET
```

### 2.2 Configure Backend Environment Variables

Set these in your hosting platform's environment variables:

```bash
# Required
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=<generated-secret-1>
JWT_REFRESH_SECRET=<generated-secret-2>
FRONTEND_URL=https://your-frontend-domain.com
NODE_ENV=production

# Optional but recommended
API_PREFIX=api/v1
PORT=4000

# Optional: BunnyCDN (for QR code storage)
BUNNY_CDN_STORAGE_ZONE=
BUNNY_CDN_ACCESS_KEY=
BUNNY_CDN_PULL_ZONE_URL=
```

## Step 3: Deploy Backend

### 3.1 Connect to Your Hosting Platform

**Option A: Using Git (Recommended)**
```bash
# Push your code to GitHub/GitLab
git add .
git commit -m "Ready for production deployment"
git push origin main
```

**Option B: Manual Upload**
- Upload the `backend/` folder to your hosting platform

### 3.2 Configure Build Commands

In your hosting platform, set these build commands:

```bash
# Install dependencies
npm ci

# Generate Prisma Client
npx prisma generate

# Build the application
npm run build
```

### 3.3 Configure Start Command

```bash
# Start command
npm run start:prod
```

### 3.4 Run Database Migrations

**Before first deployment:**
```bash
# Connect to your production database
npx prisma migrate deploy
```

Or configure your hosting platform to run this automatically on deploy.

### 3.5 Verify Backend Deployment

- [ ] Backend is accessible: `https://your-backend-url.com/api/docs`
- [ ] Swagger documentation loads
- [ ] Database connection works
- [ ] No errors in logs

## Step 4: Set Up Frontend Environment

### 4.1 Configure Frontend Environment Variables

Set these in your hosting platform:

```bash
# Required
NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.com
NEXT_PUBLIC_API_URL=https://your-backend-url.com/api/v1
NODE_ENV=production
```

### 4.2 Deploy Frontend

**Option A: Vercel (Recommended for Next.js)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd frontend
vercel --prod
```

**Option B: Other Platforms**
- Upload `frontend/` folder
- Set build command: `npm run build`
- Set start command: `npm run start`
- Or use static export if supported

### 4.3 Verify Frontend Deployment

- [ ] Frontend is accessible
- [ ] Can navigate to login page
- [ ] API calls work (check browser console)
- [ ] No console errors

## Step 5: Initial Production Setup

### 5.1 Create First Admin User

You'll need to create your first admin user. Options:

**Option A: Use Prisma Studio (Temporary)**
```bash
# Connect to production database
DATABASE_URL="your-production-db-url" npx prisma studio
# Create user manually in Prisma Studio
```

**Option B: Create a one-time script**
```bash
# Create backend/scripts/create-admin-user.ts
# Run: npx ts-node scripts/create-admin-user.ts
```

**Option C: Use registration + manual role update**
- Register a user via the frontend
- Update their role to ADMINISTRATOR in the database

### 5.2 Test Critical Features

- [ ] Login works
- [ ] Can create events
- [ ] Can create members
- [ ] QR code generation works
- [ ] Public check-in works
- [ ] Reports generate correctly

## Step 6: Post-Deployment Checklist

### Security
- [ ] HTTPS is enabled
- [ ] CORS is configured correctly
- [ ] Environment variables are secure
- [ ] Database credentials are protected
- [ ] JWT secrets are strong and unique

### Monitoring
- [ ] Error logging is set up
- [ ] Database backups are configured
- [ ] Performance monitoring is active
- [ ] Uptime monitoring is configured

### Documentation
- [ ] Team has access credentials
- [ ] Deployment process is documented
- [ ] Rollback procedure is known
- [ ] Support contacts are available

## Step 7: Ongoing Maintenance

### Regular Tasks
- Monitor logs for errors
- Review database performance
- Update dependencies regularly
- Backup database regularly
- Review security settings

### Updates
```bash
# When deploying updates:
1. Test in staging first
2. Run migrations: npx prisma migrate deploy
3. Build and deploy backend
4. Build and deploy frontend
5. Verify everything works
```

## Troubleshooting

### Backend Issues
- **Can't connect to database**: Check `DATABASE_URL` and firewall rules
- **401 Unauthorized**: Verify JWT secrets are set correctly
- **CORS errors**: Check `FRONTEND_URL` matches your frontend domain

### Frontend Issues
- **Can't connect to API**: Verify `NEXT_PUBLIC_API_BASE_URL` is correct
- **Build fails**: Check for TypeScript errors locally first
- **Blank page**: Check browser console for errors

### Database Issues
- **Migration fails**: Check database permissions
- **Connection timeout**: Verify database is accessible from hosting platform

## Quick Reference

### Backend Commands
```bash
# Local development
npm run start:dev

# Production build
npm run build
npm run start:prod

# Database
npx prisma generate
npx prisma migrate deploy
npx prisma studio
```

### Frontend Commands
```bash
# Local development
npm run dev

# Production build
npm run build
npm run start
```

## Need Help?

- Check `PRODUCTION_DEPLOYMENT.md` for detailed information
- Review `DEPLOYMENT.md` for general deployment overview
- Check hosting platform documentation
- Review application logs for specific errors
