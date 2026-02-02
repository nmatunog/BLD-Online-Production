# ⚠️ URGENT: Cost Reduction Guide

You've been charged **$201 USD in 3 days**, which is abnormally high. Here's how to reduce costs immediately.

## Immediate Actions

### 1. Check What's Causing High Costs

```bash
./scripts/check-costs.sh
```

Or view in Console:
https://console.cloud.google.com/billing/01B333-636762-33580F/reports?project=bldcebu-portal

### 2. Scale Down Services (Quick Fix)

```bash
./scripts/reduce-costs.sh
```

This will:
- Reduce Cloud Run memory from 512Mi to 256Mi
- Reduce CPU from 1 to 0.5
- Reduce max instances from 20 to 5
- Set min instances to 0 (services scale to zero when not in use)

### 3. Check Cloud SQL Instance

The biggest cost is likely your Cloud SQL database:

```bash
gcloud sql instances describe bld-portal-db --format="value(settings.tier)"
```

**If it shows `db-n1-standard-1` or larger:**
- This costs ~$25-50/month (~$0.83-1.67/day)
- For 3 days, that's only ~$2.50-5, so this isn't the main issue

**If it shows a custom or larger tier:**
- This could be the problem
- Consider downgrading to `db-f1-micro` (free tier) or `db-g1-small` (~$7/month)

## Likely Causes of $201 in 3 Days

1. **Cloud Build charges** - Each deployment builds Docker images
   - If you deployed many times, this adds up
   - ~$0.003 per build-minute
   - 10 builds × 10 minutes = $0.30 (not the issue)

2. **High traffic/requests** - Cloud Run charges per request
   - $0.40 per million requests
   - To reach $201, you'd need ~500 million requests (unlikely)

3. **Large Cloud SQL instance** - If using db-n1-standard-2 or larger
   - db-n1-standard-2: ~$50-100/month
   - db-n1-standard-4: ~$100-200/month
   - **This is likely the culprit!**

4. **Services running 24/7 with high resources**
   - If min-instances > 0, services never scale to zero
   - 512Mi × 2 services × 24/7 = significant cost

## Immediate Cost Reduction Steps

### Step 1: Scale Down Cloud Run (No Downtime)

```bash
# Backend
gcloud run services update bld-portal-backend \
  --region asia-southeast1 \
  --memory 256Mi \
  --cpu 0.5 \
  --max-instances 5 \
  --min-instances 0

# Frontend
gcloud run services update bld-portal-frontend \
  --region asia-southeast1 \
  --memory 256Mi \
  --cpu 0.5 \
  --max-instances 5 \
  --min-instances 0
```

### Step 2: Check and Downgrade Cloud SQL

```bash
# Check current tier
gcloud sql instances describe bld-portal-db --format="value(settings.tier)"

# If it's large, downgrade (WILL CAUSE DOWNTIME)
gcloud sql instances patch bld-portal-db \
  --tier=db-f1-micro \
  --region=asia-southeast1
```

**Warning:** Downgrading database will cause downtime and may not be suitable for production.

### Step 3: Set Min Instances to 0

This allows services to scale to zero when not in use:

```bash
gcloud run services update bld-portal-backend \
  --region asia-southeast1 \
  --min-instances 0

gcloud run services update bld-portal-frontend \
  --region asia-southeast1 \
  --min-instances 0
```

## View Detailed Costs

1. Go to: https://console.cloud.google.com/billing/01B333-636762-33580F/reports?project=bldcebu-portal
2. Filter by date range (last 3 days)
3. Group by "Service" to see what's costing the most

## Set Budget Alerts

```bash
gcloud billing budgets create \
  --billing-account=016333-636762-33580F \
  --display-name="BLD Portal Budget Alert" \
  --budget-amount=50USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

## Expected Costs After Optimization

- Cloud Run (scaled down): ~$5-10/month
- Cloud SQL (db-f1-micro): $0/month (free tier)
- Cloud SQL (db-g1-small): ~$7/month
- **Total: ~$7-17/month** (vs $67/day currently!)

## If You Need to Pause Everything

If you want to stop all charges immediately:

```bash
# Stop Cloud Run services (they'll scale to zero)
# Services will restart on first request

# For Cloud SQL, you can't easily pause, but you can:
# 1. Delete the instance (WARNING: Data loss!)
# 2. Or downgrade to smallest tier
```

## Next Steps

1. **Immediately:** Run `./scripts/reduce-costs.sh`
2. **Check costs:** View billing dashboard to identify the main cost driver
3. **Set budget alerts:** Get notified before costs get too high
4. **Monitor:** Check costs daily for the next few days
