# ============================================================================
# Printyx Stripe Products Setup Script (PowerShell)
# ============================================================================

param(
    [switch]$LiveMode = $false,
    [switch]$TestMode = $true
)

# Set mode
$modeFlag = if ($LiveMode) { "--live" } else { "" }
$modeLabel = if ($LiveMode) { "LIVE" } else { "TEST" }

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Printyx Stripe Products Setup" -ForegroundColor Cyan
Write-Host "  Mode: $modeLabel" -ForegroundColor $(if ($LiveMode) { "Red" } else { "Yellow" })
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if ($LiveMode) {
    Write-Host "WARNING: You are about to create LIVE products!" -ForegroundColor Red
    $confirm = Read-Host "Type 'CONFIRM' to proceed"
    if ($confirm -ne "CONFIRM") {
        Write-Host "Aborted." -ForegroundColor Yellow
        exit 1
    }
}

# Check if Stripe CLI is installed
try {
    $stripeVersion = stripe version
    Write-Host "Stripe CLI version: $stripeVersion" -ForegroundColor Green
} catch {
    Write-Host "Error: Stripe CLI is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Install from: https://stripe.com/docs/stripe-cli" -ForegroundColor Yellow
    exit 1
}

# Store created IDs
$results = @{
    starter = @{}
    professional = @{}
    enterprise = @{}
}

# ============================================================================
# Create Products
# ============================================================================

Write-Host "`n[1/9] Creating Starter product..." -ForegroundColor Yellow
$cmd = "stripe products create -d name=`"Printyx Starter`" -d description=`"Perfect for small copier dealers (5-20 employees) with core contract management and meter billing`" -d `"metadata[tier]=starter`" -d `"metadata[maxUsers]=20`" -d `"metadata[maxLocations]=3`" -d `"metadata[maxStorage]=100`""
if ($modeFlag) { $cmd += " $modeFlag" }
$starterProductJson = Invoke-Expression "$cmd 2>&1" | Out-String
$starterProduct = $starterProductJson | ConvertFrom-Json
$starterProductId = $starterProduct.id
Write-Host "  Product ID: $starterProductId" -ForegroundColor Green

Write-Host "`n[2/9] Creating Professional product..." -ForegroundColor Yellow
$cmd = "stripe products create -d name=`"Printyx Professional`" -d description=`"For growing copier dealers (20-100 employees) with service dispatch, mobile app, and advanced inventory`" -d `"metadata[tier]=professional`" -d `"metadata[maxUsers]=100`" -d `"metadata[maxLocations]=10`" -d `"metadata[popular]=true`""
if ($modeFlag) { $cmd += " $modeFlag" }
$professionalProductJson = Invoke-Expression "$cmd 2>&1" | Out-String
$professionalProduct = $professionalProductJson | ConvertFrom-Json
$professionalProductId = $professionalProduct.id
Write-Host "  Product ID: $professionalProductId" -ForegroundColor Green

Write-Host "`n[3/9] Creating Enterprise product..." -ForegroundColor Yellow
$cmd = "stripe products create -d name=`"Printyx Enterprise`" -d description=`"For large copier dealers (100+ employees) with dedicated account manager, API access, and SLA guarantees`" -d `"metadata[tier]=enterprise`" -d `"metadata[maxUsers]=unlimited`" -d `"metadata[maxLocations]=unlimited`" -d `"metadata[sla]=true`""
if ($modeFlag) { $cmd += " $modeFlag" }
$enterpriseProductJson = Invoke-Expression "$cmd 2>&1" | Out-String
$enterpriseProduct = $enterpriseProductJson | ConvertFrom-Json
$enterpriseProductId = $enterpriseProduct.id
Write-Host "  Product ID: $enterpriseProductId" -ForegroundColor Green

# ============================================================================
# Create Prices
# ============================================================================

Write-Host "`n[4/9] Creating Starter prices..." -ForegroundColor Yellow

# Starter Monthly - $79/month
$cmd = "stripe prices create -d product=$starterProductId -d unit_amount=7900 -d currency=usd -d `"recurring[interval]=month`" -d nickname=`"Starter Monthly`" -d `"metadata[plan]=starter`" -d `"metadata[billing]=monthly`""
if ($modeFlag) { $cmd += " $modeFlag" }
$starterMonthlyPriceJson = Invoke-Expression "$cmd 2>&1" | Out-String
$starterMonthlyPrice = $starterMonthlyPriceJson | ConvertFrom-Json
$starterMonthlyPriceId = $starterMonthlyPrice.id
Write-Host "  Monthly Price ID: $starterMonthlyPriceId ($79/month)" -ForegroundColor Green

# Starter Annual - $758/year (20% discount)
$cmd = "stripe prices create -d product=$starterProductId -d unit_amount=75800 -d currency=usd -d `"recurring[interval]=year`" -d nickname=`"Starter Annual`" -d `"metadata[plan]=starter`" -d `"metadata[billing]=annual`" -d `"metadata[discount]=20%`""
if ($modeFlag) { $cmd += " $modeFlag" }
$starterAnnualPriceJson = Invoke-Expression "$cmd 2>&1" | Out-String
$starterAnnualPrice = $starterAnnualPriceJson | ConvertFrom-Json
$starterAnnualPriceId = $starterAnnualPrice.id
Write-Host "  Annual Price ID: $starterAnnualPriceId ($758/year)" -ForegroundColor Green

Write-Host "`n[5/9] Creating Professional prices..." -ForegroundColor Yellow

# Professional Monthly - $99/month
$cmd = "stripe prices create -d product=$professionalProductId -d unit_amount=9900 -d currency=usd -d `"recurring[interval]=month`" -d nickname=`"Professional Monthly`" -d `"metadata[plan]=professional`" -d `"metadata[billing]=monthly`""
if ($modeFlag) { $cmd += " $modeFlag" }
$professionalMonthlyPriceJson = Invoke-Expression "$cmd 2>&1" | Out-String
$professionalMonthlyPrice = $professionalMonthlyPriceJson | ConvertFrom-Json
$professionalMonthlyPriceId = $professionalMonthlyPrice.id
Write-Host "  Monthly Price ID: $professionalMonthlyPriceId ($99/month)" -ForegroundColor Green

# Professional Annual - $950/year (20% discount)
$cmd = "stripe prices create -d product=$professionalProductId -d unit_amount=95000 -d currency=usd -d `"recurring[interval]=year`" -d nickname=`"Professional Annual`" -d `"metadata[plan]=professional`" -d `"metadata[billing]=annual`" -d `"metadata[discount]=20%`""
if ($modeFlag) { $cmd += " $modeFlag" }
$professionalAnnualPriceJson = Invoke-Expression "$cmd 2>&1" | Out-String
$professionalAnnualPrice = $professionalAnnualPriceJson | ConvertFrom-Json
$professionalAnnualPriceId = $professionalAnnualPrice.id
Write-Host "  Annual Price ID: $professionalAnnualPriceId ($950/year)" -ForegroundColor Green

Write-Host "`n[6/9] Creating Enterprise prices..." -ForegroundColor Yellow

# Enterprise Monthly - $149/month
$cmd = "stripe prices create -d product=$enterpriseProductId -d unit_amount=14900 -d currency=usd -d `"recurring[interval]=month`" -d nickname=`"Enterprise Monthly`" -d `"metadata[plan]=enterprise`" -d `"metadata[billing]=monthly`""
if ($modeFlag) { $cmd += " $modeFlag" }
$enterpriseMonthlyPriceJson = Invoke-Expression "$cmd 2>&1" | Out-String
$enterpriseMonthlyPrice = $enterpriseMonthlyPriceJson | ConvertFrom-Json
$enterpriseMonthlyPriceId = $enterpriseMonthlyPrice.id
Write-Host "  Monthly Price ID: $enterpriseMonthlyPriceId ($149/month)" -ForegroundColor Green

# Enterprise Annual - $1430/year (20% discount)
$cmd = "stripe prices create -d product=$enterpriseProductId -d unit_amount=143000 -d currency=usd -d `"recurring[interval]=year`" -d nickname=`"Enterprise Annual`" -d `"metadata[plan]=enterprise`" -d `"metadata[billing]=annual`" -d `"metadata[discount]=20%`""
if ($modeFlag) { $cmd += " $modeFlag" }
$enterpriseAnnualPriceJson = Invoke-Expression "$cmd 2>&1" | Out-String
$enterpriseAnnualPrice = $enterpriseAnnualPriceJson | ConvertFrom-Json
$enterpriseAnnualPriceId = $enterpriseAnnualPrice.id
Write-Host "  Annual Price ID: $enterpriseAnnualPriceId ($1430/year)" -ForegroundColor Green

# ============================================================================
# Create Payment Links
# ============================================================================

Write-Host "`n[7/9] Creating Starter payment links..." -ForegroundColor Yellow

$cmd = "stripe payment_links create -d `"line_items[0][price]=$starterMonthlyPriceId`" -d `"line_items[0][quantity]=1`" -d allow_promotion_codes=true -d billing_address_collection=required -d `"metadata[plan]=starter`" -d `"metadata[billing]=monthly`""
if ($modeFlag) { $cmd += " $modeFlag" }
$starterMonthlyLinkJson = Invoke-Expression "$cmd 2>&1" | Out-String
$starterMonthlyLink = $starterMonthlyLinkJson | ConvertFrom-Json
$starterMonthlyLinkUrl = $starterMonthlyLink.url
Write-Host "  Monthly Link: $starterMonthlyLinkUrl" -ForegroundColor Green

$cmd = "stripe payment_links create -d `"line_items[0][price]=$starterAnnualPriceId`" -d `"line_items[0][quantity]=1`" -d allow_promotion_codes=true -d billing_address_collection=required -d `"metadata[plan]=starter`" -d `"metadata[billing]=annual`""
if ($modeFlag) { $cmd += " $modeFlag" }
$starterAnnualLinkJson = Invoke-Expression "$cmd 2>&1" | Out-String
$starterAnnualLink = $starterAnnualLinkJson | ConvertFrom-Json
$starterAnnualLinkUrl = $starterAnnualLink.url
Write-Host "  Annual Link: $starterAnnualLinkUrl" -ForegroundColor Green

Write-Host "`n[8/9] Creating Professional payment links..." -ForegroundColor Yellow

$cmd = "stripe payment_links create -d `"line_items[0][price]=$professionalMonthlyPriceId`" -d `"line_items[0][quantity]=1`" -d allow_promotion_codes=true -d billing_address_collection=required -d `"metadata[plan]=professional`" -d `"metadata[billing]=monthly`""
if ($modeFlag) { $cmd += " $modeFlag" }
$professionalMonthlyLinkJson = Invoke-Expression "$cmd 2>&1" | Out-String
$professionalMonthlyLink = $professionalMonthlyLinkJson | ConvertFrom-Json
$professionalMonthlyLinkUrl = $professionalMonthlyLink.url
Write-Host "  Monthly Link: $professionalMonthlyLinkUrl" -ForegroundColor Green

$cmd = "stripe payment_links create -d `"line_items[0][price]=$professionalAnnualPriceId`" -d `"line_items[0][quantity]=1`" -d allow_promotion_codes=true -d billing_address_collection=required -d `"metadata[plan]=professional`" -d `"metadata[billing]=annual`""
if ($modeFlag) { $cmd += " $modeFlag" }
$professionalAnnualLinkJson = Invoke-Expression "$cmd 2>&1" | Out-String
$professionalAnnualLink = $professionalAnnualLinkJson | ConvertFrom-Json
$professionalAnnualLinkUrl = $professionalAnnualLink.url
Write-Host "  Annual Link: $professionalAnnualLinkUrl" -ForegroundColor Green

Write-Host "`n[9/9] Creating Enterprise payment links..." -ForegroundColor Yellow

$cmd = "stripe payment_links create -d `"line_items[0][price]=$enterpriseMonthlyPriceId`" -d `"line_items[0][quantity]=1`" -d allow_promotion_codes=true -d billing_address_collection=required -d `"metadata[plan]=enterprise`" -d `"metadata[billing]=monthly`""
if ($modeFlag) { $cmd += " $modeFlag" }
$enterpriseMonthlyLinkJson = Invoke-Expression "$cmd 2>&1" | Out-String
$enterpriseMonthlyLink = $enterpriseMonthlyLinkJson | ConvertFrom-Json
$enterpriseMonthlyLinkUrl = $enterpriseMonthlyLink.url
Write-Host "  Monthly Link: $enterpriseMonthlyLinkUrl" -ForegroundColor Green

$cmd = "stripe payment_links create -d `"line_items[0][price]=$enterpriseAnnualPriceId`" -d `"line_items[0][quantity]=1`" -d allow_promotion_codes=true -d billing_address_collection=required -d `"metadata[plan]=enterprise`" -d `"metadata[billing]=annual`""
if ($modeFlag) { $cmd += " $modeFlag" }
$enterpriseAnnualLinkJson = Invoke-Expression "$cmd 2>&1" | Out-String
$enterpriseAnnualLink = $enterpriseAnnualLinkJson | ConvertFrom-Json
$enterpriseAnnualLinkUrl = $enterpriseAnnualLink.url
Write-Host "  Annual Link: $enterpriseAnnualLinkUrl" -ForegroundColor Green

# ============================================================================
# Output Summary
# ============================================================================

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan

Write-Host "`n--- Environment Variables (.env) ---" -ForegroundColor Yellow
Write-Host @"

# Stripe Product & Price IDs (Auto-generated)
# Starter Plan
STRIPE_STARTER_PRODUCT_ID=$starterProductId
STRIPE_STARTER_PRICE_MONTHLY=$starterMonthlyPriceId
STRIPE_STARTER_PRICE_ANNUAL=$starterAnnualPriceId

# Professional Plan
STRIPE_PROFESSIONAL_PRODUCT_ID=$professionalProductId
STRIPE_PROFESSIONAL_PRICE_MONTHLY=$professionalMonthlyPriceId
STRIPE_PROFESSIONAL_PRICE_ANNUAL=$professionalAnnualPriceId

# Enterprise Plan
STRIPE_ENTERPRISE_PRODUCT_ID=$enterpriseProductId
STRIPE_ENTERPRISE_PRICE_MONTHLY=$enterpriseMonthlyPriceId
STRIPE_ENTERPRISE_PRICE_ANNUAL=$enterpriseAnnualPriceId

"@ -ForegroundColor White

Write-Host "--- Payment Links ---" -ForegroundColor Yellow
Write-Host @"

# Starter Plan Payment Links
STRIPE_STARTER_LINK_MONTHLY=$starterMonthlyLinkUrl
STRIPE_STARTER_LINK_ANNUAL=$starterAnnualLinkUrl

# Professional Plan Payment Links
STRIPE_PROFESSIONAL_LINK_MONTHLY=$professionalMonthlyLinkUrl
STRIPE_PROFESSIONAL_LINK_ANNUAL=$professionalAnnualLinkUrl

# Enterprise Plan Payment Links
STRIPE_ENTERPRISE_LINK_MONTHLY=$enterpriseMonthlyLinkUrl
STRIPE_ENTERPRISE_LINK_ANNUAL=$enterpriseAnnualLinkUrl

"@ -ForegroundColor White

# Save to file
$outputFile = "stripe-products-config-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
$outputContent = @"
# Printyx Stripe Configuration
# Generated: $(Get-Date)
# Mode: $modeLabel

# ===========================================
# STRIPE PRODUCT & PRICE IDS
# ===========================================

# Starter Plan ($79/month, $758/year)
STRIPE_STARTER_PRODUCT_ID=$starterProductId
STRIPE_STARTER_PRICE_MONTHLY=$starterMonthlyPriceId
STRIPE_STARTER_PRICE_ANNUAL=$starterAnnualPriceId
STRIPE_STARTER_LINK_MONTHLY=$starterMonthlyLinkUrl
STRIPE_STARTER_LINK_ANNUAL=$starterAnnualLinkUrl

# Professional Plan ($99/month, $950/year)
STRIPE_PROFESSIONAL_PRODUCT_ID=$professionalProductId
STRIPE_PROFESSIONAL_PRICE_MONTHLY=$professionalMonthlyPriceId
STRIPE_PROFESSIONAL_PRICE_ANNUAL=$professionalAnnualPriceId
STRIPE_PROFESSIONAL_LINK_MONTHLY=$professionalMonthlyLinkUrl
STRIPE_PROFESSIONAL_LINK_ANNUAL=$professionalAnnualLinkUrl

# Enterprise Plan ($149/month, $1430/year)
STRIPE_ENTERPRISE_PRODUCT_ID=$enterpriseProductId
STRIPE_ENTERPRISE_PRICE_MONTHLY=$enterpriseMonthlyPriceId
STRIPE_ENTERPRISE_PRICE_ANNUAL=$enterpriseAnnualPriceId
STRIPE_ENTERPRISE_LINK_MONTHLY=$enterpriseMonthlyLinkUrl
STRIPE_ENTERPRISE_LINK_ANNUAL=$enterpriseAnnualLinkUrl
"@

$outputContent | Out-File -FilePath $outputFile -Encoding utf8
Write-Host "`nConfiguration saved to: $outputFile" -ForegroundColor Green

Write-Host "`n--- Next Steps ---" -ForegroundColor Yellow
Write-Host "1. Copy the environment variables above to your .env file"
Write-Host "2. Run: npm run db:push (to update database schema if needed)"
Write-Host "3. Run: npx tsx server/seed-subscription-plans.ts (to update plan records)"
Write-Host "4. Configure Stripe webhook endpoint at: https://dashboard.stripe.com/webhooks"
Write-Host "   Webhook URL: https://your-domain.com/api/webhooks/stripe"
Write-Host ""
