# Production Deployment Guide

This guide covers deploying the BLD Cebu Online Portal to production **without dummy data**.

## Pre-Deployment Checklist

### ✅ Database
- [ ] Production PostgreSQL database is provisioned
- [ ] Database connection string is ready
- [ ] Database is empty (no dummy data)
- [ ] All migrations are ready to apply

### ✅ Environment Variables
- [ ] All required environment variables are set (see below)
- [ ] No development/test credentials are used
- [ ] Secrets are properly secured

### ✅ Code
- [ ] All dummy data scripts remain in `backend/scripts/` (they won't run automatically)
- [ ] No automatic seed scripts exist
- [ ] Code is tested and ready

## Backend Deployment

### 1. Environment Variables

Set these in your production environment:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# JWT Secrets (generate strong random strings)
JWT_SECRET=your-production-jwt-secret-here
JWT_REFRESH_SECRET=your-production-refresh-secret-here

# Frontend URL
FRONTEND_URL=https://your-production-frontend-url.com

# API Configuration
API_PREFIX=api/v1
PORT=4000  # Or let your platform set this

# Optional: BunnyCDN (for QR code storage)
BUNNY_CDN_STORAGE_ZONE=
BUNNY_CDN_ACCESS_KEY=
BUNNY_CDN_PULL_ZONE_URL=

# Node Environment
NODE_ENV=production
```

### 2. Build and Deploy

```bash
cd backend

# Install dependencies
npm ci  # Use ci for production (clean install)

# Generate Prisma Client
npx prisma generate

# Run migrations (this will NOT create dummy data)
npx prisma migrate deploy

# Build the application
npm run build

# Start the application
npm run start:prod
```

### 3. Verify Deployment

- [ ] API is accessible: `GET https://your-backend-url.com/api/docs`
- [ ] Health check passes (if implemented)
- [ ] Database is connected
- [ ] No dummy data exists in production database

## Frontend Deployment

### 1. Environment Variables

Set these in your production environment:

```bash
# Backend API URL
NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.com
NEXT_PUBLIC_API_URL=https://your-backend-url.com/api/v1

# Node Environment
NODE_ENV=production
```

### 2. Build and Deploy

```bash
cd frontend

# Install dependencies
npm ci

# Build the application
npm run build

# Start the application
npm run start
```

### 3. Verify Deployment

- [ ] Frontend is accessible
- [ ] API calls are working
- [ ] Authentication works
- [ ] No console errors

## Important Notes

### Dummy Data Scripts

- **Dummy data scripts are NOT automatically run** - they're manual scripts in `backend/scripts/`
- These scripts are **only for development/testing**
- They will **NOT** be included in the production build
- To use them in dev: `npx ts-node scripts/create-all-dummy-data.ts`

### Database Migrations

- Use `prisma migrate deploy` for production (not `prisma migrate dev`)
- This applies migrations without creating dummy data
- Always test migrations in a staging environment first

### Security

- Never commit `.env` files
- Use environment variable management in your deployment platform
- Rotate JWT secrets regularly
- Use HTTPS in production
- Enable CORS only for your frontend domain

## Post-Deployment

### Initial Setup

1. **Create your first admin user** (manually or via a one-time script)
2. **Configure organization structure** (apostolates, ministries)
3. **Set up initial events** (if needed)
4. **Test all critical workflows**

### Monitoring

- Monitor API logs for errors
- Set up database backups
- Monitor performance metrics
- Set up alerts for critical failures

## Rollback Plan

If something goes wrong:

1. **Database**: Restore from backup
2. **Backend**: Revert to previous deployment
3. **Frontend**: Revert to previous deployment
4. **Environment**: Check environment variables

## Development vs Production

| Feature | Development | Production |
|---------|------------|------------|
| Dummy Data | Available via scripts | Not included |
| Database | Can be reset/cleared | Production data only |
| Logging | Verbose | Error-focused |
| CORS | Localhost allowed | Production domain only |
| JWT Secrets | Dev secrets | Production secrets |

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check database firewall rules
- Ensure database is accessible from deployment platform

### API Not Responding
- Check if backend is running
- Verify port configuration
- Check logs for errors

### Frontend Can't Connect to Backend
- Verify `NEXT_PUBLIC_API_BASE_URL` is correct
- Check CORS configuration
- Verify backend is accessible
