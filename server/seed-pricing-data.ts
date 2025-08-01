import { db } from "./db";
import { 
  companyPricingSettings, 
  productPricing, 
  quotePricing, 
  quotePricingLineItems 
} from "@shared/schema";

export async function seedPricingData() {
  const tenantId = "550e8400-e29b-41d4-a716-446655440000"; // Default tenant
  const userId = "6f3224b2-221c-42ad-a7f5-a24a11e33621"; // Default user

  try {
    // 1. Create company pricing settings
    console.log("Creating company pricing settings...");
    const [companySettings] = await db
      .insert(companyPricingSettings)
      .values({
        tenantId,
        defaultMarkupPercentage: "25.00",
        minimumGrossProfitPercentage: "5.00",
        allowSalespersonOverride: true,
        isActive: true,
        createdBy: userId,
      })
      .onConflictDoNothing()
      .returning();

    console.log("Company settings created:", companySettings?.id);

    // 2. Create product pricing for various product types
    console.log("Creating product pricing entries...");
    
    const productPricingData = [
      // Equipment Models
      {
        tenantId,
        productId: "CANON-IR-C3025i",
        productType: "model",
        dealerCost: "2500.00",
        companyMarkupPercentage: "30.00",
        companyPrice: "3250.00",
        minimumSalePrice: "3000.00",
        suggestedRetailPrice: "3800.00",
        isActive: true,
        createdBy: userId,
      },
      {
        tenantId,
        productId: "HP-LaserJet-M404dn",
        productType: "model",
        dealerCost: "180.00",
        companyMarkupPercentage: "25.00",
        companyPrice: "225.00",
        minimumSalePrice: "210.00",
        suggestedRetailPrice: "280.00",
        isActive: true,
        createdBy: userId,
      },
      {
        tenantId,
        productId: "XEROX-WorkCentre-6515",
        productType: "model",
        dealerCost: "350.00",
        companyMarkupPercentage: "28.00",
        companyPrice: "448.00",
        minimumSalePrice: "420.00",
        suggestedRetailPrice: "520.00",
        isActive: true,
        createdBy: userId,
      },
      
      // Accessories
      {
        tenantId,
        productId: "FINISHER-BOOKLET-FB501",
        productType: "accessory",
        dealerCost: "800.00",
        companyMarkupPercentage: "35.00",
        companyPrice: "1080.00",
        minimumSalePrice: "1000.00",
        suggestedRetailPrice: "1200.00",
        isActive: true,
        createdBy: userId,
      },
      {
        tenantId,
        productId: "PAPER-TRAY-PF-701",
        productType: "accessory",
        dealerCost: "120.00",
        companyMarkupPercentage: "40.00",
        companyPrice: "168.00",
        minimumSalePrice: "150.00",
        suggestedRetailPrice: "200.00",
        isActive: true,
        createdBy: userId,
      },
      
      // Services
      {
        tenantId,
        productId: "SETUP-INSTALLATION",
        productType: "service",
        dealerCost: "150.00",
        companyMarkupPercentage: "50.00",
        companyPrice: "225.00",
        minimumSalePrice: "200.00",
        suggestedRetailPrice: "275.00",
        isActive: true,
        createdBy: userId,
      },
      {
        tenantId,
        productId: "TRAINING-BASIC",
        productType: "service",
        dealerCost: "100.00",
        companyMarkupPercentage: "60.00",
        companyPrice: "160.00",
        minimumSalePrice: "140.00",
        suggestedRetailPrice: "200.00",
        isActive: true,
        createdBy: userId,
      },
      
      // Software
      {
        tenantId,
        productId: "PRINT-MANAGEMENT-SUITE",
        productType: "software",
        dealerCost: "200.00",
        companyMarkupPercentage: "45.00",
        companyPrice: "290.00",
        minimumSalePrice: "260.00",
        suggestedRetailPrice: "350.00",
        isActive: true,
        createdBy: userId,
      },
      
      // Supplies
      {
        tenantId,
        productId: "TONER-BLACK-GPR-58",
        productType: "supply",
        dealerCost: "45.00",
        companyMarkupPercentage: "20.00",
        companyPrice: "54.00",
        minimumSalePrice: "50.00",
        suggestedRetailPrice: "68.00",
        isActive: true,
        createdBy: userId,
      },
      {
        tenantId,
        productId: "DRUM-UNIT-GPR-58",
        productType: "supply",
        dealerCost: "85.00",
        companyMarkupPercentage: "25.00",
        companyPrice: "106.25",
        minimumSalePrice: "95.00",
        suggestedRetailPrice: "125.00",
        isActive: true,
        createdBy: userId,
      },
    ];

    for (const pricing of productPricingData) {
      await db
        .insert(productPricing)
        .values(pricing)
        .onConflictDoNothing();
    }

    console.log(`Created ${productPricingData.length} product pricing entries`);

    // 3. Create sample quote pricing with line items
    console.log("Creating sample quote pricing...");
    
    const [sampleQuote] = await db
      .insert(quotePricing)
      .values({
        tenantId,
        quoteNumber: "Q-2025-001",
        customerId: "customer-1",
        leadId: "lead-1",
        salespersonId: userId,
        quoteDate: new Date(),
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: "draft",
        subtotal: "4500.00",
        taxAmount: "360.00",
        totalAmount: "4860.00",
        companyGrossProfit: "1250.00",
        salespersonGrossProfit: "300.00",
        salespersonGrossProfitPercentage: "6.17",
        notes: "Sample quote for Canon iR-C3025i with accessories and setup",
        isActive: true,
        createdBy: userId,
      })
      .onConflictDoNothing()
      .returning();

    if (sampleQuote) {
      console.log("Created sample quote:", sampleQuote.id);

      // Create line items for the quote
      const lineItems = [
        {
          tenantId,
          quotePricingId: sampleQuote.id,
          lineNumber: 1,
          productId: "CANON-IR-C3025i",
          productType: "model",
          description: "Canon imageRUNNER C3025i Color Multifunction Printer",
          quantity: 1,
          dealerCost: "2500.00",
          companyPrice: "3250.00",
          salePrice: "3600.00",
          salespersonGrossProfit: "350.00",
          salespersonGrossProfitPercentage: "10.78",
        },
        {
          tenantId,
          quotePricingId: sampleQuote.id,
          lineNumber: 2,
          productId: "FINISHER-BOOKLET-FB501",
          productType: "accessory",
          description: "Booklet Finisher FB-501",
          quantity: 1,
          dealerCost: "800.00",
          companyPrice: "1080.00",
          salePrice: "1150.00",
          salespersonGrossProfit: "70.00",
          salespersonGrossProfitPercentage: "6.48",
        },
        {
          tenantId,
          quotePricingId: sampleQuote.id,
          lineNumber: 3,
          productId: "SETUP-INSTALLATION",
          productType: "service",
          description: "Professional Setup and Installation",
          quantity: 1,
          dealerCost: "150.00",
          companyPrice: "225.00",
          salePrice: "250.00",
          salespersonGrossProfit: "25.00",
          salespersonGrossProfitPercentage: "11.11",
        },
      ];

      for (const lineItem of lineItems) {
        await db
          .insert(quotePricingLineItems)
          .values(lineItem)
          .onConflictDoNothing();
      }

      console.log(`Created ${lineItems.length} quote line items`);
    }

    console.log("✅ Pricing data seeding completed successfully!");
    
    return {
      companySettings: companySettings?.id,
      productPricingCount: productPricingData.length,
      sampleQuote: sampleQuote?.id,
      lineItemsCount: 3,
    };

  } catch (error) {
    console.error("❌ Error seeding pricing data:", error);
    throw error;
  }
}

// Run seeding if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPricingData()
    .then((result) => {
      console.log("Seeding result:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}