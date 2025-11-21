import { Request, Response } from "express";
import { storage } from "./storage";
import { 
  insertCompanyPricingSettingSchema, 
  insertProductPricingSchema,
  insertQuotePricingSchema,
  insertQuotePricingLineItemSchema
} from "@shared/schema";
import { z } from "zod";

// Company Pricing Settings Routes
export async function getCompanyPricingSettings(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const settings = await storage.getCompanyPricingSettings(user.tenantId);
    res.json(settings);
  } catch (error) {
    console.error("Error fetching company pricing settings:", error);
    res.status(500).json({ message: "Failed to fetch company pricing settings" });
  }
}

export async function updateCompanyPricingSettings(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validated = insertCompanyPricingSettingSchema.parse({
      ...req.body,
      tenantId: user.tenantId,
    });

    const settings = await storage.updateCompanyPricingSettings(user.tenantId, validated);
    res.json(settings);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    }
    console.error("Error updating company pricing settings:", error);
    res.status(500).json({ message: "Failed to update company pricing settings" });
  }
}

// Product Pricing Routes
export async function getProductPricing(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const productPricing = await storage.getProductPricing(user.tenantId);
    res.json(productPricing);
  } catch (error) {
    console.error("Error fetching product pricing:", error);
    res.status(500).json({ message: "Failed to fetch product pricing" });
  }
}

export async function createProductPricing(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validated = insertProductPricingSchema.parse({
      ...req.body,
      tenantId: user.tenantId,
      createdBy: user.id,
    });

    const productPricing = await storage.createProductPricing(validated);
    res.json(productPricing);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    }
    console.error("Error creating product pricing:", error);
    res.status(500).json({ message: "Failed to create product pricing" });
  }
}

export async function updateProductPricing(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const validated = insertProductPricingSchema.partial().parse(req.body);

    const productPricing = await storage.updateProductPricing(id, user.tenantId, validated);
    if (!productPricing) {
      return res.status(404).json({ message: "Product pricing not found" });
    }

    res.json(productPricing);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    }
    console.error("Error updating product pricing:", error);
    res.status(500).json({ message: "Failed to update product pricing" });
  }
}

export async function deleteProductPricing(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const success = await storage.deleteProductPricing(id, user.tenantId);
    
    if (!success) {
      return res.status(404).json({ message: "Product pricing not found" });
    }

    res.json({ message: "Product pricing deleted successfully" });
  } catch (error) {
    console.error("Error deleting product pricing:", error);
    res.status(500).json({ message: "Failed to delete product pricing" });
  }
}

// Quote Pricing Routes
export async function getQuotePricing(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { quoteId } = req.params;
    const quotePricing = await storage.getQuotePricing(quoteId, user.tenantId);
    res.json(quotePricing);
  } catch (error) {
    console.error("Error fetching quote pricing:", error);
    res.status(500).json({ message: "Failed to fetch quote pricing" });
  }
}

export async function createQuotePricing(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validated = insertQuotePricingSchema.parse({
      ...req.body,
      tenantId: user.tenantId,
      createdBy: user.id,
    });

    const quotePricing = await storage.createQuotePricing(validated);
    res.json(quotePricing);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    }
    console.error("Error creating quote pricing:", error);
    res.status(500).json({ message: "Failed to create quote pricing" });
  }
}

export async function updateQuotePricing(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const validated = insertQuotePricingSchema.partial().parse(req.body);

    const quotePricing = await storage.updateQuotePricing(id, user.tenantId, validated);
    if (!quotePricing) {
      return res.status(404).json({ message: "Quote pricing not found" });
    }

    res.json(quotePricing);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    }
    console.error("Error updating quote pricing:", error);
    res.status(500).json({ message: "Failed to update quote pricing" });
  }
}

// Quote Line Items Routes
export async function getQuoteLineItems(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { quotePricingId } = req.params;
    const lineItems = await storage.getQuotePricingLineItems(quotePricingId, user.tenantId);
    res.json(lineItems);
  } catch (error) {
    console.error("Error fetching quote line items:", error);
    res.status(500).json({ message: "Failed to fetch quote line items" });
  }
}

export async function createQuoteLineItem(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const validated = insertQuotePricingLineItemSchema.parse({
      ...req.body,
      tenantId: user.tenantId,
    });

    const lineItem = await storage.createQuotePricingLineItem(validated);
    res.json(lineItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    }
    console.error("Error creating quote line item:", error);
    res.status(500).json({ message: "Failed to create quote line item" });
  }
}

export async function updateQuoteLineItem(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const validated = insertQuotePricingLineItemSchema.partial().parse(req.body);

    const lineItem = await storage.updateQuotePricingLineItem(id, user.tenantId, validated);
    if (!lineItem) {
      return res.status(404).json({ message: "Quote line item not found" });
    }

    res.json(lineItem);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid data", errors: error.errors });
    }
    console.error("Error updating quote line item:", error);
    res.status(500).json({ message: "Failed to update quote line item" });
  }
}

export async function deleteQuoteLineItem(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { id } = req.params;
    const success = await storage.deleteQuotePricingLineItem(id, user.tenantId);
    
    if (!success) {
      return res.status(404).json({ message: "Quote line item not found" });
    }

    res.json({ message: "Quote line item deleted successfully" });
  } catch (error) {
    console.error("Error deleting quote line item:", error);
    res.status(500).json({ message: "Failed to delete quote line item" });
  }
}

// Pricing calculation helpers
export async function calculatePricingForProduct(req: Request, res: Response) {
  try {
    const user = req.user as any;
    if (!user?.tenantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { productId, productType, dealerCost, customMarkup, quantity = 1 } = req.body;

    // Get company settings
    const companySettings = await storage.getCompanyPricingSettings(user.tenantId);
    
    // Get product-specific pricing if exists
    const productPricing = await storage.getProductPricingByProductId(productId, productType, user.tenantId);

    // Calculate pricing layers
    const dealerCostNum = parseFloat(dealerCost);
    const markupPercentage = customMarkup || productPricing?.companyMarkupPercentage || companySettings?.defaultMarkupPercentage || 20;
    const companyPrice = dealerCostNum * (1 + parseFloat(markupPercentage) / 100);
    
    const calculations = {
      dealerCost: dealerCostNum,
      markupPercentage: parseFloat(markupPercentage),
      companyPrice,
      minimumSalePrice: productPricing?.minimumSalePrice || companyPrice,
      suggestedRetailPrice: productPricing?.suggestedRetailPrice || companyPrice * 1.3,
      quantity,
      totalDealerCost: dealerCostNum * quantity,
      totalCompanyPrice: companyPrice * quantity,
    };

    res.json(calculations);
  } catch (error) {
    console.error("Error calculating pricing:", error);
    res.status(500).json({ message: "Failed to calculate pricing" });
  }
}