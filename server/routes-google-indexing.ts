/**
 * Google Indexing API Routes
 *
 * Endpoints to submit URLs to Google's Indexing API for faster
 * crawling/indexing of new or updated content.
 *
 * - POST /api/google-indexing/submit       - Submit a single URL
 * - POST /api/google-indexing/submit-batch  - Submit multiple URLs
 * - GET  /api/google-indexing/status        - Get indexing status for a URL
 */

import express from 'express';
import { z } from 'zod';
import { createModuleLogger } from './lib/logger';
import { googleIndexingService } from './services/google-indexing-service';
import { requireAuth } from './replitAuth';
import { isPlatformAdmin } from './utils/auth-helpers';

const log = createModuleLogger('routes-google-indexing');
const router = express.Router();

const submitUrlSchema = z.object({
  url: z.string().url(),
  type: z.enum(['URL_UPDATED', 'URL_DELETED']).default('URL_UPDATED'),
});

const submitBatchSchema = z.object({
  urls: z.array(z.string().url()).min(1).max(100),
  type: z.enum(['URL_UPDATED', 'URL_DELETED']).default('URL_UPDATED'),
});

const statusSchema = z.object({
  url: z.string().url(),
});

// Submit a single URL for indexing
router.post('/api/google-indexing/submit', requireAuth, async (req: any, res) => {
  try {
    if (!isPlatformAdmin(req)) {
      return res.status(403).json({ message: 'Platform admin access required' });
    }

    const parsed = submitUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request', details: parsed.error.issues });
    }

    const { url, type } = parsed.data;
    const result = await googleIndexingService.submitUrl(url, type);

    if (!result.success) {
      return res.status(502).json({ message: 'Failed to submit URL', error: result.error });
    }

    res.json(result);
  } catch (err: any) {
    log.error('Error submitting URL for indexing:', err);
    res.status(500).json({ message: err.message || 'Internal server error' });
  }
});

// Submit multiple URLs for indexing
router.post('/api/google-indexing/submit-batch', requireAuth, async (req: any, res) => {
  try {
    if (!isPlatformAdmin(req)) {
      return res.status(403).json({ message: 'Platform admin access required' });
    }

    const parsed = submitBatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request', details: parsed.error.issues });
    }

    const { urls, type } = parsed.data;
    const result = await googleIndexingService.submitUrls(urls, type);

    res.json(result);
  } catch (err: any) {
    log.error('Error in batch URL indexing:', err);
    res.status(500).json({ message: err.message || 'Internal server error' });
  }
});

// Get indexing status for a URL
router.get('/api/google-indexing/status', requireAuth, async (req: any, res) => {
  try {
    if (!isPlatformAdmin(req)) {
      return res.status(403).json({ message: 'Platform admin access required' });
    }

    const parsed = statusSchema.safeParse({ url: req.query.url });
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request', details: parsed.error.issues });
    }

    const result = await googleIndexingService.getUrlStatus(parsed.data.url);

    if (!result.success) {
      return res.status(502).json({ message: 'Failed to get URL status', error: result.error });
    }

    res.json(result);
  } catch (err: any) {
    log.error('Error getting URL indexing status:', err);
    res.status(500).json({ message: err.message || 'Internal server error' });
  }
});

export default router;
