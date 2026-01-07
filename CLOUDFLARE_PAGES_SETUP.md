# Cloudflare Pages Deployment Guide

## Custom Domain Configuration

Your Supabase services are accessed through custom domains:
- **REST API / Auth / Database**: `https://api.printyx.net` (Kong Gateway)
- **Edge Functions**: `https://functions.printyx.net` (Supabase Edge Functions)

## Environment Variables for Cloudflare Pages

Set these in: **Cloudflare Pages Dashboard → Settings → Environment Variables**

### Production Variables

```bash
VITE_SUPABASE_URL=https://api.printyx.net
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_API_BASE_URL=https://functions.printyx.net
```

### What Each Variable Does

- **VITE_SUPABASE_URL**: Points to your Supabase REST API through `api.printyx.net`
  - Used for: Database queries, Authentication, Realtime subscriptions
  
- **VITE_API_BASE_URL**: Points to your Edge Functions through `functions.printyx.net`
  - Used for: Custom backend logic, API endpoints
  
- **VITE_SUPABASE_ANON_KEY**: Your public anon key
  - Safe to expose in frontend (protected by RLS policies)

---

# Original Cloudflare Pages Deployment Guide

## Overview
This guide explains how to deploy the Printyx frontend to Cloudflare Pages while connecting to your Supabase backend.

## Prerequisites
- GitHub repository connected to Cloudflare Pages
- Supabase project with Edge Functions deployed
- Supabase project URL and anon key

## Cloudflare Pages Build Configuration

### Build Settings (via Cloudflare Dashboard)

1. **Framework preset**: None (or Vite)
2. **Build command**: `npm run build`
3. **Build output directory**: `dist/public`
4. **Root directory**: `/` (leave as default)

### Environment Variables

Add these in Cloudflare Pages → Settings → Environment Variables:

```
# Required - Supabase Configuration (self-hosted at printyx.net)
VITE_SUPABASE_URL=https://api.printyx.net
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional - Direct API Base URL (self-hosted Edge Functions)
VITE_API_BASE_URL=https://functions.printyx.net

# Optional - App Version
VITE_APP_VERSION=1.0.0
```

## Deployment Options

### Option 1: Direct API Calls (Recommended)

**Pros**: Simpler, no proxy needed  
**Cons**: Need to configure CORS in Supabase

1. Set `VITE_API_BASE_URL` in Cloudflare Pages environment variables
2. Configure CORS in your Supabase Edge Functions:

```typescript
// In your Supabase Edge Function
const headers = {
  'Access-Control-Allow-Origin': 'https://your-site.pages.dev',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### Option 2: Cloudflare Pages Proxy

**Pros**: No CORS issues, single domain  
**Cons**: Slightly more complex setup

1. Uncomment the proxy line in `client/public/_redirects`:

```
/api/* https://functions.printyx.net/:splat 200
```

2. Don't set `VITE_API_BASE_URL` (frontend will use relative URLs)

## Testing Locally

### Development Server (with Express backend)
```bash
npm run dev
```

### Development Server (frontend only)
```bash
npm run dev:frontend
```

### Production Build Preview
```bash
npm run build
npm run preview
```

## Deployment Process

### Via Git Push (Automatic)
```bash
git add .
git commit -m "Configure for Cloudflare Pages deployment"
git push origin main
```

Cloudflare Pages will automatically detect the push and deploy.

### Manual Deployment
1. Run `npm run build` locally
2. Upload `dist/public` folder via Cloudflare Pages dashboard

## Troubleshooting

### Build Fails with "Missing entry-point"
- Ensure `package.json` build script is set to `vite build` only
- Check that `dist/public` is the correct output directory

### API Calls Return 404
- Verify `VITE_API_BASE_URL` is correctly set
- Check Supabase Edge Functions are deployed
- Verify API routes match your Supabase function names

### CORS Errors
- Add your Cloudflare Pages domain to Supabase CORS configuration
- Or use the proxy option (Option 2 above)

### Environment Variables Not Working
- Ensure variables start with `VITE_` prefix
- Redeploy after adding/changing environment variables
- Variables are only available at build time, not runtime

## Post-Deployment

### Custom Domain Setup
1. Go to Cloudflare Pages → Custom domains
2. Add your domain
3. Update DNS records as instructed
4. Update `Access-Control-Allow-Origin` in Supabase if using direct API calls

### Performance Optimization
- Cloudflare automatically provides CDN caching
- Enable HTTP/3 in Cloudflare settings
- Consider enabling Cloudflare Zaraz for analytics

## Support

For issues specific to:
- **Cloudflare Pages**: Check Cloudflare dashboard logs and status
- **Supabase**: Check Supabase project logs and Edge Functions status
- **Build errors**: Check the full build log in Cloudflare Pages dashboard

