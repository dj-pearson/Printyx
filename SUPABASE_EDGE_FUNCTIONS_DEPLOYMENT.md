# Supabase Edge Functions - Coolify Deployment Guide

## Overview

This guide will help you deploy your Supabase Edge Functions as a separate service in Coolify, connected to your GitHub repository.

---

## 📁 Project Structure

```
Printyx/
├── supabase/
│   ├── functions/
│   │   ├── _shared/           # Shared utilities
│   │   │   ├── supabase.ts   # Supabase client helpers
│   │   │   └── cors.ts       # CORS utilities
│   │   ├── hello/            # Sample function
│   │   │   └── index.ts
│   │   └── [your-functions]/ # Your edge functions
│   └── config.toml           # Supabase configuration
├── Dockerfile.edge-functions  # Dockerfile for edge functions
└── .dockerignore.edge        # Docker ignore for edge functions
```

---

## 🚀 Step 1: Push to GitHub

Make sure all your edge function files are committed and pushed:

```bash
git add supabase/ Dockerfile.edge-functions .dockerignore.edge
git commit -m "Add Supabase Edge Functions setup"
git push origin main
```

---

## 🐳 Step 2: Create Service in Coolify

### 2.1 Add New Service

1. Go to your Coolify dashboard
2. Click **"+ New Resource"** → **"Service"**
3. Select **"Dockerfile"** as the service type

### 2.2 Connect to GitHub

1. **Repository:** Select your `Printyx` GitHub repository
2. **Branch:** Choose your deployment branch (e.g., `main`)
3. **Dockerfile Location:** Enter `Dockerfile.edge-functions`
4. **Docker Context:** Leave as `.` (root)

### 2.3 Configure Build

- **Build Pack:** Docker
- **Dockerfile:** `Dockerfile.edge-functions`
- **Docker Ignore:** `.dockerignore.edge` (optional)

---

## ⚙️ Step 3: Environment Variables

Add these environment variables in Coolify:

### Required Variables

```bash
# Your Supabase URL (from your PrintyxSupabase service)
SUPABASE_URL=https://your-supabase-domain.com

# Supabase Anonymous Key (from your Supabase dashboard)
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role Key (from your Supabase dashboard - KEEP SECRET!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### How to Get These Values

#### From your Coolify Supabase Service:

1. Go to your **PrintyxSupabase** service in Coolify
2. Click on **Environment Variables**
3. Find and copy:
   - `SUPABASE_URL` or construct it: `https://[your-api-domain]`
   - `ANON_KEY` → use as `SUPABASE_ANON_KEY`
   - `SERVICE_ROLE_KEY` → use as `SUPABASE_SERVICE_ROLE_KEY`

#### Or from Supabase Studio:

1. Open your Supabase Studio dashboard
2. Go to **Settings** → **API**
3. Copy the **URL** and **Keys**

---

## 🌐 Step 4: Network & Port Configuration

### Port Mapping

- **Container Port:** `8000`
- **Public Port:** Choose available port or use Coolify's proxy

### Domain Configuration (Optional)

Set up a custom domain for your edge functions:
- **Domain:** `functions.yourdomain.com`
- **Enable HTTPS:** Yes (recommended)

---

## 🏗️ Step 5: Build & Deploy

1. Click **"Save"** to save your service configuration
2. Click **"Deploy"** to build and deploy
3. Wait for the build to complete (2-5 minutes)
4. Check logs for successful deployment:

```
✅ Loaded function: hello
🚀 Edge Functions server listening on http://0.0.0.0:8000
Available functions: hello
```

---

## ✅ Step 6: Test Your Deployment

### Health Check

```bash
curl https://your-edge-functions-domain.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "functions": ["hello"],
  "timestamp": "2025-12-08T..."
}
```

### Test Function

```bash
curl -X POST https://your-edge-functions-domain.com/hello \
  -H "Content-Type: application/json" \
  -d '{"name": "Printyx"}'
```

Expected response:
```json
{
  "message": "Hello Printyx!",
  "timestamp": "2025-12-08T..."
}
```

---

## 📝 Step 7: Add Your Own Functions

### Create a New Function

1. Create a new directory in `supabase/functions/`:

```bash
mkdir supabase/functions/my-function
```

2. Create `index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createSupabaseClient } from '../_shared/supabase.ts'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = createSupabaseClient(req)
    
    // Your function logic here
    const { data, error } = await supabase
      .from('your_table')
      .select('*')
    
    if (error) throw error

    return new Response(
      JSON.stringify({ data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      },
    )
  }
})
```

3. Commit and push:

```bash
git add supabase/functions/my-function/
git commit -m "Add my-function edge function"
git push
```

4. Coolify will automatically rebuild and redeploy (if auto-deploy is enabled)

---

## 🔄 Step 8: CI/CD Setup (Auto-Deploy on Push)

### Enable Auto-Deploy in Coolify

1. Go to your Edge Functions service in Coolify
2. Go to **Settings** → **Build & Deploy**
3. Enable **"Auto Deploy on Push"**
4. Set **Branch:** `main` (or your preferred branch)

Now every push to GitHub will trigger a new deployment!

---

## 🔐 Security Best Practices

1. **Never commit secrets** to GitHub:
   - Use Coolify environment variables
   - Add `.env` to `.gitignore`

2. **Use Service Role Key carefully:**
   - Only use in server-side functions
   - Never expose to clients

3. **Enable JWT verification:**
   - Set `verify_jwt = true` in `config.toml` for protected functions
   - Use `SUPABASE_ANON_KEY` for public functions

4. **CORS Configuration:**
   - Update `cors.ts` to allow only your domains in production
   - Replace `'*'` with specific origins

---

## 📊 Monitoring & Logs

### View Logs in Coolify

1. Go to your Edge Functions service
2. Click **"Logs"** tab
3. Monitor function execution and errors

### Common Log Messages

- ✅ `Loaded function: [name]` - Function loaded successfully
- ❌ `Failed to load [name]` - Check function syntax
- 🚀 `Executing function: [name]` - Function being called

---

## 🐛 Troubleshooting

### Build Fails

**Error:** `Cannot find function directory`
- **Solution:** Make sure `supabase/functions/` exists in your repo

**Error:** `Deno import failed`
- **Solution:** Check import URLs in your function files

### Function Not Loading

**Check:**
1. Function has `index.ts` file
2. Function exports a `serve()` handler
3. No syntax errors in the function code

### Connection to Supabase Fails

**Check:**
1. `SUPABASE_URL` is correct
2. `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY` is set
3. Network connectivity between Edge Functions and Supabase

### CORS Errors

Update `supabase/functions/_shared/cors.ts`:
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://yourdomain.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

---

## 📞 Calling Functions from Your App

### From Frontend (React)

```typescript
// In your React app
const callEdgeFunction = async (functionName: string, data: any) => {
  const response = await fetch(`https://your-edge-functions-domain.com/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`
    },
    body: JSON.stringify(data)
  })
  
  return response.json()
}

// Usage
const result = await callEdgeFunction('hello', { name: 'John' })
```

### Using Supabase Client

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const { data, error } = await supabase.functions.invoke('hello', {
  body: { name: 'John' }
})
```

---

## 🎯 Next Steps

1. ✅ Deploy your Edge Functions service
2. ✅ Test with the sample `hello` function
3. ✅ Add your custom business logic functions
4. ✅ Set up auto-deploy for CI/CD
5. ✅ Monitor logs and performance
6. ✅ Update CORS for production domains

---

## 📚 Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Deno Documentation](https://deno.land/manual)
- [Coolify Documentation](https://coolify.io/docs)

---

## 💡 Tips

- **Local Testing:** Use `deno run --allow-all supabase/functions/[function]/index.ts`
- **Function Isolation:** Each function runs independently
- **Shared Code:** Use `_shared/` for common utilities
- **TypeScript:** Full TypeScript support out of the box
- **Hot Reload:** Enabled in development (with `--watch` flag)

---

**Need help?** Check the logs in Coolify or review the function code for errors.

