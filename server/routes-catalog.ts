import { Router } from 'express';
import { db } from './db';
import { 
  masterProductModels, 
  masterProductAccessories, 
  tenantEnabledProducts,
  insertMasterProductModelSchema,
  insertTenantEnabledProductSchema,
  MasterProductModel,
  TenantEnabledProduct
} from '@shared/schema';
import { eq, and, like, or, desc, asc, inArray } from 'drizzle-orm';

const catalogRouter = Router();

// Platform (Root Admin) Routes for Master Catalog Management

// GET /api/catalog/models - Browse master catalog (Platform and Tenant)
catalogRouter.get('/api/catalog/models', async (req: any, res) => {
  try {
    const { manufacturer, search, category, status = 'active' } = req.query;
    const user = req.user;
    
    let query = db.select().from(masterProductModels);
    let conditions = [];
    
    // Filter by status
    if (status !== 'all') {
      conditions.push(eq(masterProductModels.status, status));
    }
    
    // Filter by manufacturer
    if (manufacturer && manufacturer !== 'all') {
      conditions.push(eq(masterProductModels.manufacturer, manufacturer));
    }
    
    // Filter by category
    if (category && category !== 'all') {
      conditions.push(eq(masterProductModels.category, category));
    }
    
    // Search functionality
    if (search) {
      conditions.push(
        or(
          like(masterProductModels.displayName, `%${search}%`),
          like(masterProductModels.modelCode, `%${search}%`)
        )
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const models = await query.orderBy(
      asc(masterProductModels.manufacturer),
      asc(masterProductModels.displayName)
    );
    
    res.json(models);
  } catch (error) {
    console.error('Error fetching master catalog models:', error);
    res.status(500).json({ message: 'Failed to fetch master catalog models', error });
  }
});

// POST /api/catalog/models - Create master product (Platform Admin only)
catalogRouter.post('/api/catalog/models', async (req: any, res) => {
  try {
    const user = req.user;
    
    // Check if user has platform admin permissions
    if (!user?.role?.includes('platform') && !user?.role?.includes('root')) {
      return res.status(403).json({ message: 'Platform admin access required' });
    }
    
    const validatedData = insertMasterProductModelSchema.parse(req.body);
    
    const [newModel] = await db.insert(masterProductModels)
      .values(validatedData)
      .returning();
    
    res.status(201).json(newModel);
  } catch (error) {
    console.error('Error creating master product model:', error);
    res.status(500).json({ message: 'Failed to create master product model', error });
  }
});

// GET /api/catalog/models/:id - Get specific master model
catalogRouter.get('/api/catalog/models/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const model = await db.select()
      .from(masterProductModels)
      .where(eq(masterProductModels.id, id))
      .limit(1);
    
    if (model.length === 0) {
      return res.status(404).json({ message: 'Master product model not found' });
    }
    
    res.json(model[0]);
  } catch (error) {
    console.error('Error fetching master product model:', error);
    res.status(500).json({ message: 'Failed to fetch master product model', error });
  }
});

// PATCH /api/catalog/models/:id - Update master model (Platform Admin only)
catalogRouter.patch('/api/catalog/models/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    
    // Check platform admin permissions
    if (!user?.role?.includes('platform') && !user?.role?.includes('root')) {
      return res.status(403).json({ message: 'Platform admin access required' });
    }
    
    const updateData = req.body;
    
    const [updatedModel] = await db.update(masterProductModels)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(masterProductModels.id, id))
      .returning();
    
    if (!updatedModel) {
      return res.status(404).json({ message: 'Master product model not found' });
    }
    
    res.json(updatedModel);
  } catch (error) {
    console.error('Error updating master product model:', error);
    res.status(500).json({ message: 'Failed to update master product model', error });
  }
});

// Tenant Enablement Routes

// POST /api/catalog/models/:id/enable - Enable master product for tenant
catalogRouter.post('/api/catalog/models/:id/enable', async (req: any, res) => {
  try {
    const { id: masterProductId } = req.params;
    const user = req.user;
    const tenantId = user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID required' });
    }
    
    const {
      customSku,
      customName,
      dealerCost,
      markupRuleId,
      companyPrice,
      priceOverridden = false
    } = req.body;
    
    // Check if already enabled
    const existing = await db.select()
      .from(tenantEnabledProducts)
      .where(
        and(
          eq(tenantEnabledProducts.tenantId, tenantId),
          eq(tenantEnabledProducts.masterProductId, masterProductId)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Product already enabled for this tenant' });
    }
    
    const [enabledProduct] = await db.insert(tenantEnabledProducts)
      .values({
        tenantId,
        masterProductId,
        source: 'master',
        enabled: true,
        customSku,
        customName,
        dealerCost,
        markupRuleId,
        companyPrice,
        priceOverridden,
        enabledAt: new Date(),
        enabledBy: user?.id
      })
      .returning();
    
    res.status(201).json(enabledProduct);
  } catch (error) {
    console.error('Error enabling master product:', error);
    res.status(500).json({ message: 'Failed to enable master product', error });
  }
});

// POST /api/catalog/models/bulk-enable - Bulk enable multiple products
catalogRouter.post('/api/catalog/models/bulk-enable', async (req: any, res) => {
  try {
    const user = req.user;
    const tenantId = user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID required' });
    }
    
    const { 
      masterProductIds, 
      defaultOverrides = {} 
    } = req.body;
    
    if (!Array.isArray(masterProductIds) || masterProductIds.length === 0) {
      return res.status(400).json({ message: 'Master product IDs array required' });
    }
    
    // Check which products are already enabled
    const existingEnabled = await db.select()
      .from(tenantEnabledProducts)
      .where(
        and(
          eq(tenantEnabledProducts.tenantId, tenantId),
          inArray(tenantEnabledProducts.masterProductId, masterProductIds)
        )
      );
    
    const alreadyEnabledIds = existingEnabled.map(p => p.masterProductId);
    const newIds = masterProductIds.filter(id => !alreadyEnabledIds.includes(id));
    
    if (newIds.length === 0) {
      return res.status(409).json({ message: 'All selected products are already enabled' });
    }
    
    // Bulk insert new enabled products
    const newEnabledProducts = newIds.map(masterProductId => ({
      tenantId,
      masterProductId,
      source: 'master' as const,
      enabled: true,
      customSku: defaultOverrides.customSku || null,
      customName: defaultOverrides.customName || null,
      dealerCost: defaultOverrides.dealerCost || null,
      markupRuleId: defaultOverrides.markupRuleId || null,
      companyPrice: defaultOverrides.companyPrice || null,
      priceOverridden: defaultOverrides.priceOverridden || false,
      enabledAt: new Date(),
      enabledBy: user?.id
    }));
    
    const results = await db.insert(tenantEnabledProducts)
      .values(newEnabledProducts)
      .returning();
    
    res.status(201).json({
      enabled: results.length,
      skipped: alreadyEnabledIds.length,
      enabledProducts: results
    });
  } catch (error) {
    console.error('Error bulk enabling products:', error);
    res.status(500).json({ message: 'Failed to bulk enable products', error });
  }
});

// GET /api/enabled-products - Get tenant's enabled products
catalogRouter.get('/api/enabled-products', async (req: any, res) => {
  try {
    const user = req.user;
    const tenantId = user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID required' });
    }
    
    const { source, enabled = 'true' } = req.query;
    
    // Join with master catalog to get full product details
    const query = db.select({
      // Tenant enablement fields
      enabledProductId: tenantEnabledProducts.id,
      tenantId: tenantEnabledProducts.tenantId,
      source: tenantEnabledProducts.source,
      enabled: tenantEnabledProducts.enabled,
      customSku: tenantEnabledProducts.customSku,
      customName: tenantEnabledProducts.customName,
      dealerCost: tenantEnabledProducts.dealerCost,
      companyPrice: tenantEnabledProducts.companyPrice,
      priceOverridden: tenantEnabledProducts.priceOverridden,
      enabledAt: tenantEnabledProducts.enabledAt,
      // Master product fields
      masterProductId: masterProductModels.id,
      manufacturer: masterProductModels.manufacturer,
      modelCode: masterProductModels.modelCode,
      displayName: masterProductModels.displayName,
      specsJson: masterProductModels.specsJson,
      msrp: masterProductModels.msrp,
      status: masterProductModels.status,
      category: masterProductModels.category,
      productType: masterProductModels.productType
    })
    .from(tenantEnabledProducts)
    .leftJoin(
      masterProductModels,
      eq(tenantEnabledProducts.masterProductId, masterProductModels.id)
    )
    .where(eq(tenantEnabledProducts.tenantId, tenantId));
    
    // Apply filters
    if (source && source !== 'all') {
      query.where(eq(tenantEnabledProducts.source, source));
    }
    
    if (enabled !== 'all') {
      query.where(eq(tenantEnabledProducts.enabled, enabled === 'true'));
    }
    
    const enabledProducts = await query.orderBy(
      asc(masterProductModels.manufacturer),
      asc(masterProductModels.displayName)
    );
    
    res.json(enabledProducts);
  } catch (error) {
    console.error('Error fetching enabled products:', error);
    res.status(500).json({ message: 'Failed to fetch enabled products', error });
  }
});

// PATCH /api/enabled-products/:id - Update tenant product overrides
catalogRouter.patch('/api/enabled-products/:id', async (req: any, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID required' });
    }
    
    const updateData = req.body;
    
    const [updatedProduct] = await db.update(tenantEnabledProducts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(
        and(
          eq(tenantEnabledProducts.id, id),
          eq(tenantEnabledProducts.tenantId, tenantId)
        )
      )
      .returning();
    
    if (!updatedProduct) {
      return res.status(404).json({ message: 'Enabled product not found' });
    }
    
    res.json(updatedProduct);
  } catch (error) {
    console.error('Error updating enabled product:', error);
    res.status(500).json({ message: 'Failed to update enabled product', error });
  }
});

// GET /api/products/with-pricing - Unified product list (tenant-native + enabled master)
catalogRouter.get('/api/products/with-pricing', async (req: any, res) => {
  try {
    const user = req.user;
    const tenantId = user?.tenantId;
    
    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID required' });
    }
    
    // Get enabled master products with computed pricing
    const enabledMasterProducts = await db.select({
      id: tenantEnabledProducts.id,
      source: tenantEnabledProducts.source,
      displayName: masterProductModels.displayName,
      manufacturer: masterProductModels.manufacturer,
      modelCode: masterProductModels.modelCode,
      category: masterProductModels.category,
      customSku: tenantEnabledProducts.customSku,
      customName: tenantEnabledProducts.customName,
      dealerCost: tenantEnabledProducts.dealerCost,
      companyPrice: tenantEnabledProducts.companyPrice,
      msrp: masterProductModels.msrp,
      enabled: tenantEnabledProducts.enabled,
      specsJson: masterProductModels.specsJson
    })
    .from(tenantEnabledProducts)
    .leftJoin(
      masterProductModels,
      eq(tenantEnabledProducts.masterProductId, masterProductModels.id)
    )
    .where(
      and(
        eq(tenantEnabledProducts.tenantId, tenantId),
        eq(tenantEnabledProducts.enabled, true),
        eq(tenantEnabledProducts.source, 'master')
      )
    );
    
    // TODO: Add tenant-native products here
    // const tenantProducts = await db.select()...
    
    // For now, return just enabled master products
    const allProducts = enabledMasterProducts.map(product => ({
      ...product,
      effectiveName: product.customName || product.displayName,
      effectiveSku: product.customSku || product.modelCode,
      isMasterCatalog: true
    }));
    
    res.json(allProducts);
  } catch (error) {
    console.error('Error fetching products with pricing:', error);
    res.status(500).json({ message: 'Failed to fetch products with pricing', error });
  }
});

// GET /api/catalog/manufacturers - Get list of manufacturers
catalogRouter.get('/api/catalog/manufacturers', async (req: any, res) => {
  try {
    const manufacturers = await db.selectDistinct({
      manufacturer: masterProductModels.manufacturer
    })
    .from(masterProductModels)
    .where(eq(masterProductModels.status, 'active'))
    .orderBy(asc(masterProductModels.manufacturer));
    
    res.json(manufacturers.map(m => m.manufacturer));
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    res.status(500).json({ message: 'Failed to fetch manufacturers', error });
  }
});

export { catalogRouter };