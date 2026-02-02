# Fix Secret Manager Permissions

The Cloud Run service account needs permission to access secrets in Secret Manager.

## Quick Fix

Run this command to grant the necessary permissions:

```bash
# Get the project number
PROJECT_NUMBER=$(gcloud projects describe bldcebu-portal --format="value(projectNumber)")

# Grant Secret Manager Secret Accessor role
gcloud projects add-iam-policy-binding bldcebu-portal \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Or manually (replace PROJECT_NUMBER with your actual project number):

```bash
gcloud projects add-iam-policy-binding bldcebu-portal \
  --member="serviceAccount:135871334914-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Verify Permissions

Check if permissions are set:

```bash
gcloud projects get-iam-policy bldcebu-portal \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*compute@developer.gserviceaccount.com" \
  --format="table(bindings.role)"
```

## After Fixing Permissions

1. Wait 1-2 minutes for changes to propagate
2. Run the deployment script again:
   ```bash
   ./scripts/deploy-prod.sh
   ```

## Alternative: Grant Permission via Console

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=bldcebu-portal
2. Find the service account: `135871334914-compute@developer.gserviceaccount.com`
3. Click the pencil icon to edit
4. Click "ADD ANOTHER ROLE"
5. Select: "Secret Manager Secret Accessor"
6. Click "SAVE"
