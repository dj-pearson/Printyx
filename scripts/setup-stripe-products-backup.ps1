# ============================================================================
# Printyx Stripe Products Setup Script (PowerShell)
# ============================================================================
# This script creates all subscription products, prices, and payment links
# in your Stripe account using the Stripe CLI.
#
# Prerequisites:
#   1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
#   2. Login to Stripe CLI: stripe login
#   3. Run this script from PowerShell
#
# Usage:
#   .\setup-stripe-products.ps1
#   .\setup-stripe-products.ps1 -TestMode  # For test mode (default)
#   .\setup-stripe-products.ps1 -LiveMode  # For production
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
if ($modeFlag) {
    $starterProductJson = stripe products create --name="Printyx Starter" --description="Perfect for small copier dealers (5-20 employees) with core contract management and meter billing" --metadata tier=starter --metadata maxUsers=20 --metadata maxLocations=3 --metadata maxStorage=100 $modeFlag 2>&1 | Out-String
} else {
    $starterProductJson = stripe products create --name="Printyx Starter" --description="Perfect for small copier dealers (5-20 employees) with core contract management and meter billing" --metadata tier=starter --metadata maxUsers=20 --metadata maxLocations=3 --metadata maxStorage=100 2>&1 | Out-String
}

$starterProduct = $starterProductJson | ConvertFrom-Json
$starterProductId = $starterProduct.id
$results.starter.productId = $starterProductId
Write-Host "  Product ID: $starterProductId" -ForegroundColor Green

Write-Host "`n[2/9] Creating Professional product..." -ForegroundColor Yellow
$professionalProductJson = stripe products create `
    --name="Printyx Professional" `
    --description="For growing copier dealers (20-100 employees) with service dispatch, mobile app, and advanced inventory" `
    --metadata[tier]="professional" `
    --metadata[maxUsers]="100" `
    --metadata[maxLocations]="10" `
    --metadata[popular]="true" `
    $modeFlag 2>&1 | Out-String

$professionalProduct = $professionalProductJson | ConvertFrom-Json
$professionalProductId = $professionalProduct.id
$results.professional.productId = $professionalProductId
Write-Host "  Product ID: $professionalProductId" -ForegroundColor Green

Write-Host "`n[3/9] Creating Enterprise product..." -ForegroundColor Yellow
$enterpriseProductJson = stripe products create `
    --name="Printyx Enterprise" `
    --description="For large copier dealers (100+ employees) with dedicated account manager, API access, and SLA guarantees" `
    --metadata[tier]="enterprise" `
    --metadata[maxUsers]="unlimited" `
    --metadata[maxLocations]="unlimited" `
    --metadata[sla]="true" `
    $modeFlag 2>&1 | Out-String

$enterpriseProduct = $enterpriseProductJson | ConvertFrom-Json
$enterpriseProductId = $enterpriseProduct.id
$results.enterprise.productId = $enterpriseProductId
Write-Host "  Product ID: $enterpriseProductId" -ForegroundColor Green

# ============================================================================
# Create Prices
# ============================================================================

Write-Host "`n[4/9] Creating Starter prices..." -ForegroundColor Yellow

# Starter Monthly - $79/month
$starterMonthlyPriceJson = stripe prices create `
    --product=$starterProductId `
    --unit-amount=7900 `
    --currency=usd `
    --recurring[interval]=month `
    --nickname="Starter Monthly" `
    --metadata[plan]="starter" `
    --metadata[billing]="monthly" `
    $modeFlag 2>&1 | Out-String

$starterMonthlyPrice = $starterMonthlyPriceJson | ConvertFrom-Json
$starterMonthlyPriceId = $starterMonthlyPrice.id
$results.starter.monthlyPriceId = $starterMonthlyPriceId
Write-Host "  Monthly Price ID: $starterMonthlyPriceId ($79/month)" -ForegroundColor Green

# Starter Annual - $758/year (20% discount)
$starterAnnualPriceJson = stripe prices create `
    --product=$starterProductId `
    --unit-amount=75800 `
    --currency=usd `
    --recurring[interval]=year `
    --nickname="Starter Annual" `
    --metadata[plan]="starter" `
    --metadata[billing]="annual" `
    --metadata[discount]="20%" `
    $modeFlag 2>&1 | Out-String

$starterAnnualPrice = $starterAnnualPriceJson | ConvertFrom-Json
$starterAnnualPriceId = $starterAnnualPrice.id
$results.starter.annualPriceId = $starterAnnualPriceId
Write-Host "  Annual Price ID: $starterAnnualPriceId ($758/year)" -ForegroundColor Green

Write-Host "`n[5/9] Creating Professional prices..." -ForegroundColor Yellow

# Professional Monthly - $99/month
$professionalMonthlyPriceJson = stripe prices create `
    --product=$professionalProductId `
    --unit-amount=9900 `
    --currency=usd `
    --recurring[interval]=month `
    --nickname="Professional Monthly" `
    --metadata[plan]="professional" `
    --metadata[billing]="monthly" `
    $modeFlag 2>&1 | Out-String

$professionalMonthlyPrice = $professionalMonthlyPriceJson | ConvertFrom-Json
$professionalMonthlyPriceId = $professionalMonthlyPrice.id
$results.professional.monthlyPriceId = $professionalMonthlyPriceId
Write-Host "  Monthly Price ID: $professionalMonthlyPriceId ($99/month)" -ForegroundColor Green

# Professional Annual - $950/year (20% discount)
$professionalAnnualPriceJson = stripe prices create `
    --product=$professionalProductId `
    --unit-amount=95000 `
    --currency=usd `
    --recurring[interval]=year `
    --nickname="Professional Annual" `
    --metadata[plan]="professional" `
    --metadata[billing]="annual" `
    --metadata[discount]="20%" `
    $modeFlag 2>&1 | Out-String

$professionalAnnualPrice = $professionalAnnualPriceJson | ConvertFrom-Json
$professionalAnnualPriceId = $professionalAnnualPrice.id
$results.professional.annualPriceId = $professionalAnnualPriceId
Write-Host "  Annual Price ID: $professionalAnnualPriceId ($950/year)" -ForegroundColor Green

Write-Host "`n[6/9] Creating Enterprise prices..." -ForegroundColor Yellow

# Enterprise Monthly - $149/month
$enterpriseMonthlyPriceJson = stripe prices create `
    --product=$enterpriseProductId `
    --unit-amount=14900 `
    --currency=usd `
    --recurring[interval]=month `
    --nickname="Enterprise Monthly" `
    --metadata[plan]="enterprise" `
    --metadata[billing]="monthly" `
    $modeFlag 2>&1 | Out-String

$enterpriseMonthlyPrice = $enterpriseMonthlyPriceJson | ConvertFrom-Json
$enterpriseMonthlyPriceId = $enterpriseMonthlyPrice.id
$results.enterprise.monthlyPriceId = $enterpriseMonthlyPriceId
Write-Host "  Monthly Price ID: $enterpriseMonthlyPriceId ($149/month)" -ForegroundColor Green

# Enterprise Annual - $1430/year (20% discount)
$enterpriseAnnualPriceJson = stripe prices create `
    --product=$enterpriseProductId `
    --unit-amount=143000 `
    --currency=usd `
    --recurring[interval]=year `
    --nickname="Enterprise Annual" `
    --metadata[plan]="enterprise" `
    --metadata[billing]="annual" `
    --metadata[discount]="20%" `
    $modeFlag 2>&1 | Out-String

$enterpriseAnnualPrice = $enterpriseAnnualPriceJson | ConvertFrom-Json
$enterpriseAnnualPriceId = $enterpriseAnnualPrice.id
$results.enterprise.annualPriceId = $enterpriseAnnualPriceId
Write-Host "  Annual Price ID: $enterpriseAnnualPriceId ($1430/year)" -ForegroundColor Green

# ============================================================================
# Create Payment Links
# ============================================================================

Write-Host "`n[7/9] Creating Starter payment links..." -ForegroundColor Yellow

$starterMonthlyLinkJson = stripe payment_links create `
    --line-items[0][price]=$starterMonthlyPriceId `
    --line-items[0][quantity]=1 `
    --allow-promotion-codes `
    --billing-address-collection=required `
    --metadata[plan]="starter" `
    --metadata[billing]="monthly" `
    $modeFlag 2>&1 | Out-String

$starterMonthlyLink = $starterMonthlyLinkJson | ConvertFrom-Json
$starterMonthlyLinkUrl = $starterMonthlyLink.url
$results.starter.monthlyLink = $starterMonthlyLinkUrl
Write-Host "  Monthly Link: $starterMonthlyLinkUrl" -ForegroundColor Green

$starterAnnualLinkJson = stripe payment_links create `
    --line-items[0][price]=$starterAnnualPriceId `
    --line-items[0][quantity]=1 `
    --allow-promotion-codes `
    --billing-address-collection=required `
    --metadata[plan]="starter" `
    --metadata[billing]="annual" `
    $modeFlag 2>&1 | Out-String

$starterAnnualLink = $starterAnnualLinkJson | ConvertFrom-Json
$starterAnnualLinkUrl = $starterAnnualLink.url
$results.starter.annualLink = $starterAnnualLinkUrl
Write-Host "  Annual Link: $starterAnnualLinkUrl" -ForegroundColor Green

Write-Host "`n[8/9] Creating Professional payment links..." -ForegroundColor Yellow

$professionalMonthlyLinkJson = stripe payment_links create `
    --line-items[0][price]=$professionalMonthlyPriceId `
    --line-items[0][quantity]=1 `
    --allow-promotion-codes `
    --billing-address-collection=required `
    --metadata[plan]="professional" `
    --metadata[billing]="monthly" `
    $modeFlag 2>&1 | Out-String

$professionalMonthlyLink = $professionalMonthlyLinkJson | ConvertFrom-Json
$professionalMonthlyLinkUrl = $professionalMonthlyLink.url
$results.professional.monthlyLink = $professionalMonthlyLinkUrl
Write-Host "  Monthly Link: $professionalMonthlyLinkUrl" -ForegroundColor Green

$professionalAnnualLinkJson = stripe payment_links create `
    --line-items[0][price]=$professionalAnnualPriceId `
    --line-items[0][quantity]=1 `
    --allow-promotion-codes `
    --billing-address-collection=required `
    --metadata[plan]="professional" `
    --metadata[billing]="annual" `
    $modeFlag 2>&1 | Out-String

$professionalAnnualLink = $professionalAnnualLinkJson | ConvertFrom-Json
$professionalAnnualLinkUrl = $professionalAnnualLink.url
$results.professional.annualLink = $professionalAnnualLinkUrl
Write-Host "  Annual Link: $professionalAnnualLinkUrl" -ForegroundColor Green

Write-Host "`n[9/9] Creating Enterprise payment links..." -ForegroundColor Yellow

$enterpriseMonthlyLinkJson = stripe payment_links create `
    --line-items[0][price]=$enterpriseMonthlyPriceId `
    --line-items[0][quantity]=1 `
    --allow-promotion-codes `
    --billing-address-collection=required `
    --metadata[plan]="enterprise" `
    --metadata[billing]="monthly" `
    $modeFlag 2>&1 | Out-String

$enterpriseMonthlyLink = $enterpriseMonthlyLinkJson | ConvertFrom-Json
$enterpriseMonthlyLinkUrl = $enterpriseMonthlyLink.url
$results.enterprise.monthlyLink = $enterpriseMonthlyLinkUrl
Write-Host "  Monthly Link: $enterpriseMonthlyLinkUrl" -ForegroundColor Green

$enterpriseAnnualLinkJson = stripe payment_links create `
    --line-items[0][price]=$enterpriseAnnualPriceId `
    --line-items[0][quantity]=1 `
    --allow-promotion-codes `
    --billing-address-collection=required `
    --metadata[plan]="enterprise" `
    --metadata[billing]="annual" `
    $modeFlag 2>&1 | Out-String

$enterpriseAnnualLink = $enterpriseAnnualLinkJson | ConvertFrom-Json
$enterpriseAnnualLinkUrl = $enterpriseAnnualLink.url
$results.enterprise.annualLink = $enterpriseAnnualLinkUrl
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
