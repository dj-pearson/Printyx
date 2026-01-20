# Deploy Import Edge Function Fix

## What was fixed
The route parsing in `supabase/functions/import/index.ts` had incorrect array indices. When accessing `/import/entity-types`, the function was checking the wrong path segment, causing 404 errors.

## Changes Made
- Fixed path parsing to correctly handle the 'import' prefix in URLs
- Updated all route checks from `pathParts[1]` to `pathParts[0]` (after removing the 'import' prefix)

## To Deploy

### Option 1: Coolify Dashboard
1. Go to Coolify dashboard
2. Find your Edge Functions service
3. Click **Deploy** or **Redeploy**
4. Wait for completion

### Option 2: Manual Deployment
If using Supabase CLI:
```bash
# From project root
supabase functions deploy import
```

### Option 3: Git Push (if Coolify is watching your repo)
The changes are already committed. Simply push to your main branch:
```bash
git add supabase/functions/import/index.ts
git commit -m "fix: correct route parsing in import edge function"
git push origin main
```

Then Coolify should auto-deploy if configured to do so.

## Verify the Fix
After deployment, test by accessing:
- `https://functions.printyx.net/import/entity-types`
- `https://functions.printyx.net/import/ai/status`
- `https://functions.printyx.net/import/templates/business_records`

All should return 200 responses instead of 404.

## Test the Import
1. Go to https://printyx.net
2. Navigate to CRM → Customers
3. Click Import
4. Upload your CSV file
5. The import wizard should now work without 404 errors
