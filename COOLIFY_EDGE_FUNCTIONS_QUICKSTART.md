# 🚀 Coolify Edge Functions - Quick Start

Get your Supabase Edge Functions running in Coolify in 5 minutes!

---

## ✅ Prerequisites

- [ ] GitHub repository with your code
- [ ] Coolify instance running
- [ ] Supabase instance (self-hosted in Coolify)
- [ ] Supabase URL, ANON_KEY, and SERVICE_ROLE_KEY

---

## 📋 Step-by-Step Setup

### 1️⃣ Push Code to GitHub (30 seconds)

```bash
git add .
git commit -m "Add Supabase Edge Functions"
git push origin main
```

### 2️⃣ Create Service in Coolify (2 minutes)

1. **Coolify Dashboard** → **+ New Resource** → **Service**
2. Select **"Dockerfile"**
3. **Connect GitHub:**
   - Repository: `your-username/Printyx`
   - Branch: `main`
   - Dockerfile: `Dockerfile.edge-functions`
4. Click **"Continue"**

### 3️⃣ Add Environment Variables (1 minute)

Click **"Environment"** and add:

```bash
SUPABASE_URL=https://your-supabase-domain.com
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Get these from:** Your Supabase service in Coolify → Environment tab

### 4️⃣ Configure Port (30 seconds)

- **Port:** `8000`
- **Enable Public Access:** ✅ Yes

### 5️⃣ Deploy (1 minute)

1. Click **"Deploy"**
2. Wait for build to complete
3. Check logs for:
   ```
   ✅ Loaded function: hello
   🚀 Edge Functions server listening on http://0.0.0.0:8000
   ```

### 6️⃣ Test It! (30 seconds)

```bash
# Health check
curl https://your-domain.com/health

# Test function
curl -X POST https://your-domain.com/hello \
  -H "Content-Type: application/json" \
  -d '{"name": "Printyx"}'
```

**Expected:**
```json
{
  "message": "Hello Printyx!",
  "timestamp": "2025-12-08T..."
}
```

---

## 🎉 You're Done!

Your Edge Functions are now running and accessible at:
- **Base URL:** `https://your-domain.com`
- **Health:** `https://your-domain.com/health`
- **Functions:** `https://your-domain.com/{function-name}`

---

## 🔄 Auto-Deploy Setup (Bonus)

Enable automatic deployments on every GitHub push:

1. **Coolify Service** → **Settings** → **Build & Deploy**
2. Enable **"Auto Deploy on Push"**
3. Select Branch: `main`
4. Save

Now every `git push` will automatically redeploy! 🚀

---

## 📝 Add More Functions

1. Create new function:
```bash
mkdir supabase/functions/my-function
```

2. Add `index.ts` (see template in `supabase/functions/README.md`)

3. Push to GitHub:
```bash
git add .
git commit -m "Add my-function"
git push
```

4. Auto-deploys in Coolify! ✨

---

## 🐛 Troubleshooting

### Build Failed?
- Check Dockerfile path is `Dockerfile.edge-functions`
- Ensure `supabase/functions/` exists in repo

### Function Not Loading?
- Check function has `index.ts`
- View logs in Coolify for error details

### Can't Connect to Supabase?
- Verify `SUPABASE_URL` is correct
- Check `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`

---

## 📚 Next Steps

- [ ] Read full guide: `SUPABASE_EDGE_FUNCTIONS_DEPLOYMENT.md`
- [ ] Add your business logic functions
- [ ] Set up production CORS settings
- [ ] Configure custom domain
- [ ] Enable monitoring and alerts

---

## 🔗 Quick Links

- **Full Deployment Guide:** [SUPABASE_EDGE_FUNCTIONS_DEPLOYMENT.md](./SUPABASE_EDGE_FUNCTIONS_DEPLOYMENT.md)
- **Function Templates:** [supabase/functions/README.md](./supabase/functions/README.md)
- **Supabase Docs:** https://supabase.com/docs/guides/functions

---

**Questions?** Check the logs in Coolify or review the full deployment guide.

**Working?** Start building your functions! 🎨

