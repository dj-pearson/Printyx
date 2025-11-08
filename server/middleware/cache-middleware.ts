import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

/**
 * Cache-Control middleware for GET endpoints
 * Sets appropriate cache headers based on the maxAge parameter
 *
 * @param maxAge - Cache duration in seconds (default: 300 = 5 minutes)
 * @returns Express middleware function
 *
 * @example
 * // Cache for 5 minutes
 * app.get('/api/data', cacheControl(300), handler);
 *
 * // Cache for 1 hour
 * app.get('/api/static-data', cacheControl(3600), handler);
 */
export function cacheControl(maxAge: number = 300) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET') {
      // Use 'private' for tenant-specific data
      // Browser can cache but CDN/proxies should not
      res.setHeader('Cache-Control', `private, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
    } else {
      // Ensure mutating requests are never cached
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
    next();
  };
}

/**
 * ETag middleware for efficient revalidation
 * Generates ETags based on response content and returns 304 if content hasn't changed
 *
 * @example
 * app.get('/api/data', cacheControl(300), etag(), handler);
 */
export function etag() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function(data: any) {
      const body = JSON.stringify(data);
      const hash = createHash('md5').update(body).digest('hex');
      const etagValue = `"${hash}"`;

      res.setHeader('ETag', etagValue);

      // Check If-None-Match header
      const clientEtag = req.headers['if-none-match'];
      if (clientEtag === etagValue) {
        return res.status(304).end();
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Vary header middleware for tenant-aware caching
 * Ensures caches are separated by tenant and authorization
 *
 * @example
 * app.get('/api/tenants/:id/data', varyByTenant(), cacheControl(300), handler);
 */
export function varyByTenant() {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Vary', 'X-Tenant-Id, Authorization');
    next();
  };
}

/**
 * No-cache middleware for sensitive or frequently-changing data
 * Ensures data is always fetched fresh from the server
 *
 * @example
 * app.get('/api/real-time-data', noCache(), handler);
 */
export function noCache() {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  };
}

/**
 * Immutable cache middleware for static assets
 * Use for content that never changes (e.g., files with hash in filename)
 *
 * @param maxAge - Cache duration in seconds (default: 31536000 = 1 year)
 * @example
 * app.get('/assets/:hash/:filename', immutableCache(), handler);
 */
export function immutableCache(maxAge: number = 31536000) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, immutable`);
    next();
  };
}
