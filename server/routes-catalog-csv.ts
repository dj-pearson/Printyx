/**
 * Cost-per-copy rates for a product model.
 *
 * PROD-008: this file used to hold the master-catalogue CSV importers as well -
 * POST /api/catalog/models/import and POST /api/catalog/import-enhanced. Both
 * are gone. `/api/catalog` is proxied to supabase/functions/catalog/ now, which
 * serves the master catalogue on both hosts; the header of that function records
 * what the two hosts used to disagree about.
 *
 * The header mapping, money parsing, category normalisation and duplicate merge
 * those importers carried live in shared/master-catalog-import.ts, which both
 * runtimes import - rather than as two near-verbatim copies held together by a
 * parity test. Three defects went with the move: a line-at-a-time CSV split that
 * corrupted any quoted field containing a newline, `parseFloat` reading '12abc'
 * as a price of 12, and a duplicate merge that was never reported.
 *
 * What is NOT in the edge function, recorded so the capability is not retired in
 * silence: the Canon-specific price-list parser behind POST
 * /api/catalog/models/import. It hardcoded manufacturer 'Canon', detected
 * sections from imageRUNNER / imagePRESS / imageFORCE headings, and was the only
 * writer of `master_product_accessories` and of the base-model-to-accessory
 * relationships anywhere in the tree. It had no caller in any of the seven
 * client trees, so that table has never been filled through a reachable path.
 *
 * Includes:
 * - GET  /api/product-models/:modelId/cpc-rates
 * - POST /api/product-models/:modelId/cpc-rates
 */
import type { Express } from 'express';
import { storage } from './storage';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-catalog-csv');

import { insertCpcRateSchema } from '@shared/schema';

export function registerCatalogCsvRoutes(app: Express) {
  // PROD-014: the seven /api/<type>/import handlers that lived here were
  // DEAD - registerProductsCrudRoutes runs before registerCatalogCsvRoutes, so
  // its registrations won and these never ran. They have been removed rather
  // than left as a second, differently-broken copy of the same feature. The
  // live import is one loop over @shared/catalog-import in
  // server/routes-products-crud.ts.

  app.get('/api/product-models/:modelId/cpc-rates', async (req: any, res) => {
    try {
      const { modelId } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const rates = await storage.getCpcRates(modelId, tenantId);
      res.json(rates);
    } catch (error) {
      log.error('Error fetching CPC rates:', error);
      res.status(500).json({ message: 'Failed to fetch CPC rates' });
    }
  });

  app.post('/api/product-models/:modelId/cpc-rates', async (req: any, res) => {
    try {
      const { modelId } = req.params;
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required' });
      }
      const validatedData = insertCpcRateSchema.parse({
        ...req.body,
        modelId,
        tenantId,
      });
      const rate = await storage.createCpcRate(validatedData);
      res.json(rate);
    } catch (error) {
      log.error('Error creating CPC rate:', error);
      res.status(500).json({ message: 'Failed to create CPC rate' });
    }
  });
}
