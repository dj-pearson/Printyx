/**
 * API Versioning Middleware
 *
 * Provides backward compatibility and version management for the API.
 * Supports both URL-based (/api/v1/) and header-based versioning.
 */

import { Router, Request, Response, NextFunction } from 'express';

// Supported API versions
export const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2', // Future version
  CURRENT: 'v1',
  DEFAULT: 'v1',
} as const;

export type ApiVersion = (typeof API_VERSIONS)[keyof typeof API_VERSIONS];

// Version configuration
export interface VersionConfig {
  deprecated?: boolean;
  deprecationDate?: string;
  sunsetDate?: string;
  minimumVersion?: ApiVersion;
}

export const VERSION_CONFIG: Record<string, VersionConfig> = {
  v1: {
    deprecated: false,
  },
  v2: {
    deprecated: false,
  },
};

// Header names for versioning
export const VERSION_HEADERS = {
  REQUEST_VERSION: 'X-API-Version',
  RESPONSE_VERSION: 'X-API-Version',
  DEPRECATION: 'Deprecation',
  SUNSET: 'Sunset',
  LINK: 'Link',
};

/**
 * Extract API version from request
 */
export function extractVersion(req: Request): ApiVersion {
  // Check URL path first (/api/v1/...)
  const urlMatch = req.path.match(/^\/api\/(v\d+)\//);
  if (urlMatch && Object.values(API_VERSIONS).includes(urlMatch[1] as ApiVersion)) {
    return urlMatch[1] as ApiVersion;
  }

  // Check header
  const headerVersion = req.headers[VERSION_HEADERS.REQUEST_VERSION.toLowerCase()] as string;
  if (headerVersion && Object.values(API_VERSIONS).includes(headerVersion as ApiVersion)) {
    return headerVersion as ApiVersion;
  }

  // Check query parameter (for debugging)
  const queryVersion = req.query['api-version'] as string;
  if (queryVersion && Object.values(API_VERSIONS).includes(queryVersion as ApiVersion)) {
    return queryVersion as ApiVersion;
  }

  return API_VERSIONS.DEFAULT;
}

/**
 * Rewrite path for versioned routes
 */
export function rewriteVersionedPath(path: string, version: ApiVersion): string {
  // Remove version prefix if present
  const pathWithoutVersion = path.replace(/^\/api\/v\d+\//, '/api/');
  return pathWithoutVersion;
}

/**
 * API versioning middleware
 *
 * Usage:
 *   app.use(apiVersioning());
 */
export function apiVersioning(options?: {
  defaultVersion?: ApiVersion;
  headerName?: string;
  requireVersion?: boolean;
}) {
  const {
    defaultVersion = API_VERSIONS.DEFAULT,
    headerName = VERSION_HEADERS.REQUEST_VERSION,
    requireVersion = false,
  } = options || {};

  return (req: Request, res: Response, next: NextFunction) => {
    // Extract version
    const version = extractVersion(req);

    // Store version in request
    (req as any).apiVersion = version;

    // Check if version is required but not provided
    if (requireVersion) {
      const hasVersion = req.path.match(/^\/api\/v\d+\//) || req.headers[headerName.toLowerCase()];

      if (!hasVersion) {
        return res.status(400).json({
          error: 'API version required',
          code: 'VERSION_REQUIRED',
          message: `Please specify API version using URL path (/api/v1/...) or ${headerName} header`,
          supportedVersions: Object.values(API_VERSIONS).filter((v) => v.startsWith('v')),
        });
      }
    }

    // Check if version is valid
    if (!Object.values(API_VERSIONS).includes(version)) {
      return res.status(400).json({
        error: 'Invalid API version',
        code: 'INVALID_VERSION',
        message: `API version '${version}' is not supported`,
        supportedVersions: Object.values(API_VERSIONS).filter((v) => v.startsWith('v')),
      });
    }

    // Set response headers
    res.setHeader(VERSION_HEADERS.RESPONSE_VERSION, version);

    // Add deprecation headers if applicable
    const versionConfig = VERSION_CONFIG[version];
    if (versionConfig?.deprecated) {
      res.setHeader(VERSION_HEADERS.DEPRECATION, versionConfig.deprecationDate || 'true');
      if (versionConfig.sunsetDate) {
        res.setHeader(VERSION_HEADERS.SUNSET, versionConfig.sunsetDate);
      }
      // Add link to newer version docs
      res.setHeader(VERSION_HEADERS.LINK, '</api/docs>; rel="successor-version"');
    }

    next();
  };
}

/**
 * Create versioned router
 *
 * Usage:
 *   const v1Router = createVersionedRouter('v1');
 *   v1Router.get('/users', handler);
 *   app.use('/api/v1', v1Router);
 */
export function createVersionedRouter(version: ApiVersion): Router {
  const router = Router();

  // Add version info to all routes
  router.use((req: Request, res: Response, next: NextFunction) => {
    (req as any).apiVersion = version;
    res.setHeader(VERSION_HEADERS.RESPONSE_VERSION, version);
    next();
  });

  return router;
}

/**
 * Version-specific route handler wrapper
 *
 * Usage:
 *   app.get('/api/users', versionedHandler({
 *     v1: v1UsersHandler,
 *     v2: v2UsersHandler,
 *   }));
 */
export function versionedHandler(handlers: Partial<Record<ApiVersion, Function>>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const version = (req as any).apiVersion || API_VERSIONS.DEFAULT;
    const handler = handlers[version];

    if (!handler) {
      // Fall back to default version handler
      const defaultHandler = handlers[API_VERSIONS.DEFAULT];
      if (defaultHandler) {
        return defaultHandler(req, res, next);
      }

      return res.status(404).json({
        error: 'Endpoint not available',
        code: 'VERSION_NOT_SUPPORTED',
        message: `This endpoint is not available in API version ${version}`,
      });
    }

    return handler(req, res, next);
  };
}

/**
 * Route alias middleware for backward compatibility
 *
 * Usage:
 *   app.use(routeAlias('/api/customers', '/api/v1/business-records'));
 */
export function routeAlias(
  fromPath: string,
  toPath: string,
  options?: {
    methods?: string[];
    deprecated?: boolean;
  },
) {
  const { methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], deprecated = true } = options || {};

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith(fromPath)) {
      return next();
    }

    if (!methods.includes(req.method.toUpperCase())) {
      return next();
    }

    // Rewrite path
    const newPath = req.path.replace(fromPath, toPath);
    req.url = req.url.replace(fromPath, toPath);
    (req as any).originalPath = req.path;

    // Add deprecation warning
    if (deprecated) {
      res.setHeader('Warning', `299 - "Deprecated: Use ${toPath} instead"`);
      res.setHeader(VERSION_HEADERS.DEPRECATION, 'true');
    }

    next();
  };
}

/**
 * Legacy route support middleware
 * Redirects unversioned routes to versioned routes
 *
 * Usage:
 *   app.use(legacyRouteSupport({ version: 'v1' }));
 */
export function legacyRouteSupport(options?: {
  version?: ApiVersion;
  excludePaths?: string[];
  redirect?: boolean;
}) {
  const {
    version = API_VERSIONS.DEFAULT,
    excludePaths = ['/api/health', '/api/auth', '/api/docs', '/.well-known'],
    redirect = false,
  } = options || {};

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip if already versioned
    if (req.path.match(/^\/api\/v\d+\//)) {
      return next();
    }

    // Skip excluded paths
    if (excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Only handle /api/ routes
    if (!req.path.startsWith('/api/')) {
      return next();
    }

    // Either redirect or rewrite
    if (redirect) {
      const newPath = req.path.replace('/api/', `/api/${version}/`);
      return res.redirect(301, newPath);
    }

    // Rewrite URL internally
    const newUrl = req.url.replace('/api/', `/api/${version}/`);
    req.url = newUrl;

    // Store original for logging
    (req as any).originalPath = req.path;

    // Add header indicating version was auto-selected
    res.setHeader('X-API-Version-Auto', 'true');
    res.setHeader(VERSION_HEADERS.RESPONSE_VERSION, version);

    next();
  };
}

/**
 * API documentation middleware
 * Returns supported versions and deprecation info
 */
export function apiVersionInfo() {
  return (_req: Request, res: Response) => {
    res.json({
      currentVersion: API_VERSIONS.CURRENT,
      defaultVersion: API_VERSIONS.DEFAULT,
      supportedVersions: Object.entries(VERSION_CONFIG).map(([version, config]) => ({
        version,
        deprecated: config.deprecated || false,
        deprecationDate: config.deprecationDate,
        sunsetDate: config.sunsetDate,
      })),
      versioningMethods: [
        {
          method: 'URL Path',
          example: '/api/v1/users',
          description: 'Include version in the URL path (recommended)',
        },
        {
          method: 'Header',
          example: `${VERSION_HEADERS.REQUEST_VERSION}: v1`,
          description: 'Set API version via request header',
        },
      ],
    });
  };
}

/**
 * Type augmentation for Express Request
 */
declare global {
  namespace Express {
    interface Request {
      apiVersion?: ApiVersion;
      originalPath?: string;
    }
  }
}

export default {
  apiVersioning,
  createVersionedRouter,
  versionedHandler,
  routeAlias,
  legacyRouteSupport,
  apiVersionInfo,
  extractVersion,
  API_VERSIONS,
  VERSION_CONFIG,
  VERSION_HEADERS,
};
