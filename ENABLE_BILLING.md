# Enable Billing for Production Project

Google Cloud requires billing to be enabled before you can use services like Cloud Run, Cloud Build, and Cloud SQL.

## Enable Billing

### Option 1: Via Google Cloud Console (Recommended)

1. Go to: https://console.cloud.google.com/billing
2. Select project: `bldcebu-portal`
3. Click "Link a billing account"
4. Either:
   - Link an existing billing account, OR
   - Create a new billing account (requires credit card)

### Option 2: Via Command Line

```bash
# List available billing accounts
gcloud billing accounts list

# Link billing account to project
gcloud billing projects link bldcebu-portal \
  --billing-account=BILLING_ACCOUNT_ID
```

Replace `BILLING_ACCOUNT_ID` with your actual billing account ID from the list.

## Verify Billing is Enabled

```bash
# Check billing status
gcloud billing projects describe bldcebu-portal

# Should show:
# billingAccountName: billingAccounts/XXXXX-XXXXX-XXXXX
# billingEnabled: true
```

## Cost Estimates

### Development Environment (Free Tier Eligible)
- Cloud Run: Free tier includes 2 million requests/month
- Cloud SQL: `db-f1-micro` is eligible for free tier
- Firebase Hosting: Free tier available

### Production Environment (Paid)
- Cloud Run: ~$0.40 per million requests + compute costs
- Cloud SQL: `db-n1-standard-1` ~$25-50/month
- Firebase Hosting: Free tier available
- Cloud Build: ~$0.003 per build-minute

**Estimated monthly cost for production**: $30-60/month (depending on traffic)

## Free Tier Options

If you want to test without billing:

1. **Use Development Environment Only**
   - Development project may have free tier credits
   - Test everything in dev first

2. **Use Smaller Resources**
   - Use `db-f1-micro` for Cloud SQL (free tier eligible)
   - Use minimal Cloud Run resources

3. **Alternative Hosting**
   - Consider other platforms if budget is a concern
   - Railway, Render offer free tiers
   - Vercel (frontend) + Railway (backend) combination

## After Enabling Billing

Once billing is enabled, you can proceed with deployment:

```bash
./scripts/deploy-prod.sh
```

## Budget Alerts

Set up budget alerts to monitor spending:

```bash
# Create a budget alert
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="BLD Portal Production Budget" \
  --budget-amount=100USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90 \
  --threshold-rule=percent=100
```

## Troubleshooting

### "Billing account not found"
- Verify billing account exists
- Check you have permission to link billing accounts
- Ensure billing account is active

### "Permission denied"
- You need "Billing Account User" or "Billing Account Administrator" role
- Contact your organization's billing administrator
