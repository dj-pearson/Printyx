# Stripe Configuration Deployment Guide

## ✅ What We've Done

Successfully created and configured Stripe products in **TEST MODE**:

### Products Created:
- ✅ **Starter Plan** - $79/month, $758/year (20% discount)
- ✅ **Professional Plan** - $99/month, $950/year (20% discount) 
- ✅ **Enterprise Plan** - $149/month, $1430/year (20% discount)

### Files Updated:
- ✅ `.env` - Local development environment variables
- ✅ `.env.example` - Template for team members
- ✅ `.dev.vars` - Cloudflare Wrangler local development (NEW)
- ✅ `.gitignore` - Added `.dev.vars` to prevent committing secrets

## 📋 Configuration Details

All Stripe product IDs, price IDs, and payment links have been added to your environment files.

**Configuration File:** `stripe-products-config-20251231-083121.txt`

## 🚀 Next Steps

### 1. Add Your Stripe API Keys

Update these files with your actual Stripe keys from https://dashboard.stripe.com/apikeys:

**In `.env` and `.dev.vars`:**
```bash
STRIPE_SECRET_KEY=sk_test_51RtUuKDicESs12qV...
STRIPE_PUBLISHABLE_KEY=pk_test_51RtUuKDicESs12qV...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2. Deploy to Cloudflare Pages

Since you're using Cloudflare Pages, you need to add these environment variables in the Cloudflare Dashboard:

#### Go to Cloudflare Dashboard:
1. Navigate to https://dash.cloudflare.com
2. Select your account > **Pages** > **printyx** project
3. Go to **Settings** > **Environment variables**

#### Add the following variables for **Production** environment:

```bash
# Supabase
SUPABASE_URL=https://api.printyx.net
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

# Stripe API Keys (get from Stripe Dashboard)
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Stripe Products & Prices
STRIPE_STARTER_PRODUCT_ID=prod_Thq67j7TkLm2Zf
STRIPE_STARTER_PRICE_MONTHLY=price_1SkQQeDSTuXQBbNUshkNZaBz
STRIPE_STARTER_PRICE_ANNUAL=price_1SkQQfDSTuXQBbNUbGptmnnT

STRIPE_PROFESSIONAL_PRODUCT_ID=prod_Thq6Fy3eE2qTfp
STRIPE_PROFESSIONAL_PRICE_MONTHLY=price_1SkQQgDSTuXQBbNUCVccXKUb
STRIPE_PROFESSIONAL_PRICE_ANNUAL=price_1SkQQgDSTuXQBbNUhuc7oNZ8

STRIPE_ENTERPRISE_PRODUCT_ID=prod_Thq607AssGCMIg
STRIPE_ENTERPRISE_PRICE_MONTHLY=price_1SkQQhDSTuXQBbNUnzzwNaw2
STRIPE_ENTERPRISE_PRICE_ANNUAL=price_1SkQQiDSTuXQBbNUeFlYuGa1

# Stripe Payment Links
STRIPE_STARTER_LINK_MONTHLY=https://buy.stripe.com/test_28EcN509i2nM99a40KgEg00
STRIPE_STARTER_LINK_ANNUAL=https://buy.stripe.com/test_28EcN55tCbYm99a8h0gEg01
STRIPE_PROFESSIONAL_LINK_MONTHLY=https://buy.stripe.com/test_4gM14ncW48Mafxy2WGgEg02
STRIPE_PROFESSIONAL_LINK_ANNUAL=https://buy.stripe.com/test_cNi3cvf4c3rQbhi7cWgEg03
STRIPE_ENTERPRISE_LINK_MONTHLY=https://buy.stripe.com/test_6oU14n9JSfaygBC7cWgEg04
STRIPE_ENTERPRISE_LINK_ANNUAL=https://buy.stripe.com/test_8x25kD8FO1jI99afJsgEg05

# Checkout URLs (update with your production domain)
STRIPE_CHECKOUT_SUCCESS_URL=https://printyx.net/settings/subscription?success=true
STRIPE_CHECKOUT_CANCEL_URL=https://printyx.net/pricing?canceled=true
STRIPE_PORTAL_RETURN_URL=https://printyx.net/settings/billing
```

### 3. Configure Client-Side Variables

For variables that need to be available in the browser, prefix them with `VITE_`:

```bash
VITE_SUPABASE_URL=https://api.printyx.net
VITE_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_AUTH_MODE=supabase
VITE_FUNCTIONS_URL=https://functions.printyx.net
```

### 4. Set Up Stripe Webhook

1. Go to https://dashboard.stripe.com/webhooks
2. Click **+ Add endpoint**
3. Set endpoint URL: `https://printyx.net/api/webhooks/stripe`
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add it to your environment variables as `STRIPE_WEBHOOK_SECRET`

### 5. Update Database (Optional)

If you have a subscription plans table in your database, update it with the new IDs:

```bash
npm run db:push
npx tsx server/seed-subscription-plans.ts
```

## 🔄 For LIVE Mode Deployment

Once you're ready to go live:

1. **Get full API access** from Stripe Dashboard (need `sk_live_` key, not `rk_live_`)
2. **Re-run the setup script** in live mode:
   ```powershell
   .\scripts\setup-stripe-products.ps1 -LiveMode
   ```
3. **Update all environment variables** with the live product IDs
4. **Update Stripe webhook** to use live mode

## 📚 Documentation

- Stripe Products: https://dashboard.stripe.com/products
- Stripe Prices: https://dashboard.stripe.com/prices
- Payment Links: https://dashboard.stripe.com/payment-links
- Webhooks: https://dashboard.stripe.com/webhooks
- Cloudflare Pages: https://dash.cloudflare.com

## 🆘 Troubleshooting

### Issue: "No such product" error
- **Solution:** Make sure the product IDs in your environment match the Stripe dashboard

### Issue: Webhook signature verification failed
- **Solution:** Verify `STRIPE_WEBHOOK_SECRET` matches the webhook signing secret from Stripe dashboard

### Issue: Payment links don't work
- **Solution:** Check that you're using test payment links in test mode and live links in production

## ✨ Quick Commands

```powershell
# View current Stripe configuration
cat stripe-products-config-20251231-083121.txt

# Test local development with Wrangler
npx wrangler pages dev dist

# Deploy to Cloudflare Pages
git push origin main  # Auto-deploys if connected

# Or manual deployment
npx wrangler pages deploy dist
```

---

**Note:** All current configuration is in **TEST MODE**. Payment links won't charge real cards. When ready for production, follow the "For LIVE Mode Deployment" section above.
