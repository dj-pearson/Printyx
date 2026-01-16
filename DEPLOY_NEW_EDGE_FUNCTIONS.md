# 🚀 Deploy New Edge Functions

## What We Added

Created 4 new Edge Functions to fix missing API endpoints:

1. **`/software-products`** - Software product catalog CRUD
2. **`/enabled-products`** - Tenant-specific enabled products
3. **`/product-models`** - Copier/printer equipment models
4. **`/products`** - Combined products with pricing (route: `/with-pricing`)

---

## ⚡ Quick Deploy (If Coolify Auto-Deploy is Enabled)

If your Coolify service has **GitHub integration** enabled:

1. **Coolify will auto-detect the push** (commit `a44594b`)
2. **Wait 2-3 minutes** for the build to complete
3. **Check logs** in Coolify dashboard:
   ```
   ✅ Loaded function: software-products
   ✅ Loaded function: enabled-products
   ✅ Loaded function: product-models
   ✅ Loaded function: products
   ```

---

## 🔧 Manual Deploy (If Auto-Deploy is NOT Enabled)

### Option 1: Via Coolify Dashboard

1. Go to your **Edge Functions service** in Coolify
2. Click **"Deploy"** button
3. Coolify will pull latest code and rebuild

### Option 2: Via SSH (If Needed)

```bash
# SSH into your server
ssh root@vmi2955607.contaboserver.net

# Navigate to Edge Functions directory
cd /path/to/printyx-edge-functions

# Pull latest code
git pull origin main

# Restart the service (Coolify will handle this automatically)
# Or manually if needed:
# docker restart <edge-functions-container-id>
```

---

## ✅ Verify Deployment

After deployment completes, test the new endpoints:

```bash
# Test software-products
curl https://functions.printyx.net/software-products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test enabled-products  
curl https://functions.printyx.net/enabled-products \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test product-models
curl https://functions.printyx.net/product-models \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test products with pricing
curl https://functions.printyx.net/products/with-pricing \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected:** All should return `{ "data": [...], "total": N }` instead of 404.

---

## 🎯 What This Fixes

The software products page (`/quotes` → Software Products tab) was failing with:

❌ **Before:**
```
404 /software-products
404 /enabled-products  
404 /product-models
404 /products/with-pricing
```

✅ **After:**
- All product management pages will load correctly
- Software product creation will work
- Product catalog queries will succeed
- Onboarding form product selection will populate

---

## 📊 Summary

| Edge Function | Status | Purpose |
|---------------|--------|---------|
| `/software-products` | ✅ NEW | Software catalog CRUD |
| `/enabled-products` | ✅ NEW | Tenant product enablement |
| `/product-models` | ✅ NEW | Equipment models CRUD |
| `/products` | ✅ NEW | Combined products API |

**Commit:** `a44594b`
**Date:** 2026-01-16
