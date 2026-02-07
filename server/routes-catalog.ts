import { Router, type Express } from 'express';
import { storage } from './storage';
import { getUserId, getTenantId } from './utils/auth-helpers';
import { db } from './db';
import { masterProductModels } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { insertMasterProductModelSchema } from '../shared/schema';
import multer from 'multer';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-catalog');

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

/**
 * Helper: Check if user is platform admin
 */
function isPlatformAdmin(req: any): boolean {
  return (
    req.user?.isPlatformUser ||
    req.user?.is_platform_user ||
    req.user?.role === 'platform_admin' ||
    req.user?.role === 'root_admin' ||
    req.user?.role === 'Platform Admin' ||
    req.user?.role === 'Root Admin' ||
    req.user?.role === 'admin'
  );
}

/**
 * Helper: Normalize money string to number
 */
function normalizeMoney(s?: string): number | undefined {
  if (!s) return undefined;
  const n = Number(String(s).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Helper: Normalize category names for consistency
 */
function normalizeCategoryName(category: string): string {
  if (!category) return category;
  const categoryLower = category.toLowerCase().trim();

  if (categoryLower.includes('mfp') || categoryLower.includes('multifunction')) {
    return 'Multifunction';
  }

  if (
    categoryLower.includes('accessory') ||
    categoryLower.includes('hardware accessory') ||
    categoryLower.includes('paper feeding') ||
    categoryLower.includes('document feeding')
  ) {
    return 'Accessory';
  }

  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
}

/**
 * GET /api/catalog/models
 * Browse master product catalog with filtering
 */
router.get('/api/catalog/models', async (req: any, res) => {
  try {
    const manufacturer = String((req.query as any)?.manufacturer || '');
    const search = String((req.query as any)?.search || '');
    const category = String((req.query as any)?.category || '');
    const status = String((req.query as any)?.status || '');

    const rows = await storage.browseMasterProducts({
      manufacturer,
      search,
      category,
      status,
    });

    res.json(rows);
  } catch (error) {
    log.error('Error browsing master catalog:', error);
    res.status(500).json({ message: 'Failed to fetch master catalog' });
  }
});

/**
 * POST /api/catalog/models
 * Create or update master product model (platform admin only)
 */
router.post('/api/catalog/models', async (req: any, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }

    if (!isPlatformAdmin(req)) {
      return res.status(403).json({
        message: 'Platform admin required',
        code: 'FORBIDDEN',
        userRole: req.user?.role,
        userId: req.user?.id,
      });
    }

    const payload = insertMasterProductModelSchema.parse(req.body);
    const saved = await storage.upsertMasterProduct(payload);
    res.status(201).json(saved);
  } catch (error: any) {
    log.error('Error creating master product:', error);
    res.status(500).json({
      message: 'Failed to create master product',
      detail: error?.message,
    });
  }
});

/**
 * PATCH /api/catalog/models/:id
 * Update specific fields of a master product (platform admin only)
 */
router.patch('/api/catalog/models/:id', async (req: any, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }

    if (!isPlatformAdmin(req)) {
      return res.status(403).json({
        message: 'Platform admin required to update master products',
        code: 'FORBIDDEN',
      });
    }

    const { id } = req.params;
    const { displayName, msrp, dealerCost, marginPercentage, category, productType, status } =
      req.body;

    const updateData: any = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (msrp !== undefined) updateData.msrp = msrp;
    if (dealerCost !== undefined) updateData.dealerCost = dealerCost;
    if (marginPercentage !== undefined) updateData.marginPercentage = marginPercentage;
    if (category !== undefined) updateData.category = category;
    if (productType !== undefined) updateData.productType = productType;
    if (status !== undefined) updateData.status = status;
    updateData.updatedAt = new Date();

    await db.update(masterProductModels).set(updateData).where(eq(masterProductModels.id, id));

    res.json({ success: true, updated: updateData });
  } catch (error: any) {
    log.error('Error updating master product:', error);
    res.status(500).json({
      message: 'Failed to update master product',
      detail: error?.message,
    });
  }
});

/**
 * GET /api/catalog/manufacturers
 * Get list of all manufacturers in master catalog
 */
router.get('/api/catalog/manufacturers', async (_req: any, res) => {
  try {
    const rows = await storage.listMasterManufacturers();
    res.json(rows);
  } catch (error) {
    log.error('Error fetching manufacturers:', error);
    res.status(500).json({ message: 'Failed to fetch manufacturers' });
  }
});

/**
 * GET /api/enabled-products
 * Get products enabled for tenant
 */
router.get('/api/enabled-products', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const rows = await storage.getEnabledProducts(tenantId);
    res.json(rows);
  } catch (error) {
    log.error('Error fetching enabled products:', error);
    res.status(500).json({ message: 'Failed to fetch enabled products' });
  }
});

/**
 * POST /api/catalog/models/:id/enable
 * Enable a master product for tenant with custom pricing
 */
router.post('/api/catalog/models/:id/enable', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const { id } = req.params;
    const overrides = { ...req.body, enabledBy: userId };
    const result = await storage.enableMasterProduct(tenantId, id, overrides);
    res.json(result);
  } catch (error) {
    log.error('Error enabling product:', error);
    res.status(500).json({ message: 'Failed to enable product' });
  }
});

/**
 * POST /api/catalog/models/bulk-enable
 * Enable multiple master products for tenant at once
 */
router.post('/api/catalog/models/bulk-enable', async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const { masterProductIds = [], defaultOverrides = {} } = req.body ?? {};
    let enabled = 0;
    let skipped = 0;

    for (const pid of masterProductIds) {
      try {
        await storage.enableMasterProduct(tenantId, pid, {
          ...defaultOverrides,
          enabledBy: userId,
        });
        enabled += 1;
      } catch {
        skipped += 1;
      }
    }

    res.json({ enabled, skipped });
  } catch (error) {
    log.error('Error bulk enabling products:', error);
    res.status(500).json({ message: 'Failed to bulk enable products' });
  }
});

/**
 * POST /api/catalog/models/enable-from-csv
 * Enable products from CSV file (uses Dealer Price as dealerCost)
 */
router.post('/api/catalog/models/enable-from-csv', upload.single('file'), async (req: any, res) => {
  try {
    const userId = getUserId(req);
    const tenantId = getTenantId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }
    if (!tenantId) {
      return res.status(403).json({ message: 'Tenant context required', code: 'NO_TENANT' });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ message: 'CSV file required' });

    const csvText = file.buffer.toString('utf-8');
    const lines = csvText.split(/\r?\n/);
    let columns: string[] = [];
    let enabled = 0;
    let skipped = 0;

    const isHeader = (arr: string[]) => {
      const lc = arr.map((s) => s.trim().toLowerCase());
      return (
        lc.includes('item no.') &&
        lc.includes('description') &&
        lc.some((c) => c.includes('dealer price')) &&
        lc.includes('msrp')
      );
    };

    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line) continue;
      const parts = line.split(',');

      if (isHeader(parts)) {
        columns = parts.map((h: string) => h.trim().toLowerCase());
        continue;
      }
      if (!columns.length) continue;

      const row: any = {};
      columns.forEach((c: string, i: number) => (row[c] = (parts[i] || '').trim()));
      const modelCode = row['item no.'] || row['item no'] || row['item'];
      const description = row['description'];
      const dealerPrice = normalizeMoney(row['dealer price']) ?? normalizeMoney(row['dealer']);

      if (!modelCode || !description) continue;

      // Ensure corresponding master product exists
      let master = await storage.findMasterProduct('Canon', modelCode);
      if (!master) {
        master = await storage.upsertMasterProduct({
          manufacturer: 'Canon',
          modelCode,
          displayName: description,
          msrp: undefined,
        } as any);
      }

      try {
        await storage.enableMasterProduct(tenantId, (master as any).id, {
          dealerCost: dealerPrice as any,
          updatedAt: new Date(),
        } as any);
        enabled += 1;
      } catch {
        skipped += 1;
      }
    }

    res.json({ enabled, skipped });
  } catch (error: any) {
    log.error('Error enabling products from CSV:', error);
    res.status(500).json({
      message: 'Failed to enable from CSV',
      detail: error?.message,
    });
  }
});

/**
 * POST /api/catalog/normalize-categories
 * Normalize category names across master catalog (platform admin only)
 */
router.post('/api/catalog/normalize-categories', async (req: any, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required', code: 'UNAUTHORIZED' });
    }

    if (!isPlatformAdmin(req)) {
      return res.status(403).json({
        message: 'Platform admin required',
        code: 'FORBIDDEN',
      });
    }

    const products = await db.select().from(masterProductModels);
    let updated = 0;

    for (const product of products) {
      if (product.category) {
        const normalized = normalizeCategoryName(product.category);
        if (normalized !== product.category) {
          await db
            .update(masterProductModels)
            .set({ category: normalized, updatedAt: new Date() })
            .where(eq(masterProductModels.id, product.id));
          updated++;
        }
      }
    }

    res.json({
      success: true,
      message: `Normalized ${updated} product categories`,
      updated,
      total: products.length,
    });
  } catch (error: any) {
    log.error('Error normalizing categories:', error);
    res.status(500).json({
      message: 'Failed to normalize categories',
      detail: error?.message,
    });
  }
});

export function registerCatalogRoutes(app: Express) {
  app.use(router);
}

// Named export for dynamic imports
export const catalogRouter = router;

export default router;
