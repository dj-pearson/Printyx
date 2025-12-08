# ⚠️ IMPORTANT: Setting Up Edge Functions in Coolify

## The Issue You Just Hit

You tried to deploy Edge Functions but Coolify built your **main app Dockerfile** instead of **Dockerfile.edge-functions**.

This is because you need to create a **SEPARATE SERVICE** in Coolify specifically for Edge Functions.

---

## ✅ Correct Setup: Two Separate Services

You need **TWO services** in Coolify:

### Service 1: Main Printyx App (Already exists)
- **Dockerfile:** `Dockerfile` (default)
- **Purpose:** Your Node.js/React application
- **Domain:** `printyx.net` or similar

### Service 2: Edge Functions (NEW - Need to create)
- **Dockerfile:** `Dockerfile.edge-functions`
- **Purpose:** Supabase Edge Functions (Deno runtime)
- **Domain:** `functions.printyx.net`

---

## 🚀 Step-by-Step: Create Edge Functions Service

### Step 1: Fix Code Errors First

I just fixed the build errors in your main app:
- Fixed `contacts` → `contracts` typo in `server/routes-custom-reports.ts`
- Commented out missing schema imports in `server/services/automated-billing-service.ts`

**Commit and push these fixes:**

```bash
git add .
git commit -m "Fix build errors: correct schema imports"
git push origin main
```

### Step 2: Create New Service in Coolify

1. **Go to Coolify Dashboard**
2. Click **"+ New Resource"** → **"Service"**
3. Select **"Dockerfile"**

### Step 3: Configure the Service

**General Settings:**
- **Name:** `Printyx Edge Functions` (or similar)
- **Repository:** `dj-pearson/Printyx`
- **Branch:** `main`

**Build Settings:**
- **Dockerfile Location:** `Dockerfile.edge-functions` ⚠️ **CRITICAL!**
- **Build Context:** `.` (root directory)

**Port Configuration:**
- **Container Port:** `8000`
- **Public:** ✅ Enabled

**Domain:**
- **Domain:** `functions.printyx.net` (or your preferred subdomain)
- **HTTPS:** ✅ Enabled

### Step 4: Environment Variables

Add these three required variables:

```bash
SUPABASE_URL=https://api.printyx.net
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NDk5ODEwMCwiZXhwIjo0OTIwNjcxNzAwLCJyb2xlIjoiYW5vbiJ9.deZlFDdzzNQtSseKfZc2PXZpiYYHHsy6V8NE2cByL7c
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NDk5ODEwMCwiZXhwIjo0OTIwNjcxNzAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.WWuFoA4d-oJA0_nG_Q-87JtoAp1xaJQLRzlTVyGCTVQ
```

*(These are from your existing Supabase service)*

### Step 5: Deploy

1. Click **"Save"**
2. Click **"Deploy"**
3. Wait 2-3 minutes for build

### Step 6: Verify

Test the health endpoint:

```bash
curl https://functions.printyx.net/health
```

Expected response:
```json
{
  "status": "healthy",
  "functions": ["hello"],
  "timestamp": "2025-12-08T..."
}
```

---

## 📊 Your Coolify Services Overview

After setup, you'll have:

```
┌─────────────────────────────────────────┐
│  Coolify Project: Printyx               │
├─────────────────────────────────────────┤
│                                         │
│  ✅ Service 1: Printyx Main App         │
│     - Dockerfile: Dockerfile            │
│     - Domain: printyx.net               │
│     - Port: 5000                        │
│     - Type: Node.js + React             │
│                                         │
│  ✅ Service 2: Printyx Edge Functions   │
│     - Dockerfile: Dockerfile.edge-functions │
│     - Domain: functions.printyx.net     │
│     - Port: 8000                        │
│     - Type: Deno (Edge Functions)       │
│                                         │
│  ✅ Service 3: PrintyxSupabase          │
│     - Type: Supabase (Docker Compose)   │
│     - Domain: api.printyx.net           │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔧 Troubleshooting

### "Still building wrong Dockerfile"
- Double-check **Dockerfile Location** is set to `Dockerfile.edge-functions`
- Make sure you created a **NEW service**, not editing the existing one

### "Can't find Dockerfile.edge-functions"
- Make sure you pushed the file to GitHub:
  ```bash
  git add Dockerfile.edge-functions
  git commit -m "Add Edge Functions Dockerfile"
  git push
  ```

### "Build succeeds but functions don't work"
- Check environment variables are set correctly
- View logs in Coolify to see startup messages
- Make sure `SUPABASE_URL` points to your Supabase instance

### "Port 8000 not accessible"
- Verify **Public** is enabled for port 8000
- Check domain is properly configured
- Ensure no firewall blocking port 8000

---

## 🎯 Next Steps After Deployment

1. ✅ Test the `hello` function
2. ✅ Add your own business logic functions
3. ✅ Update CORS settings for production
4. ✅ Enable auto-deploy on push
5. ✅ Monitor logs for errors

---

## 📝 Quick Reference

**Main App Build Command:**
```bash
npm run build
```

**Edge Functions Build:**
```bash
# Handled by Dockerfile.edge-functions
# Uses Deno, not Node.js
```

**Test Edge Function Locally:**
```bash
docker build -f Dockerfile.edge-functions -t edge-test .
docker run -p 8000:8000 \
  -e SUPABASE_URL=https://api.printyx.net \
  -e SUPABASE_ANON_KEY=your-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key \
  edge-test
```

---

**Remember:** Edge Functions and Main App are **completely separate services** with different runtimes (Deno vs Node.js) and different Dockerfiles!

