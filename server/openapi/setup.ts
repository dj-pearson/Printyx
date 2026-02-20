/**
 * OpenAPI/Swagger Setup
 * Configures Swagger UI and serves OpenAPI documentation
 */

import type { Express, Request, Response } from 'express';
import { openApiConfig, corePaths } from './config';
import type { OpenAPIV3 } from 'openapi-types';

/**
 * Complete OpenAPI specification with all paths
 */
function getOpenApiSpec(): OpenAPIV3.Document {
  return {
    ...openApiConfig,
    paths: {
      ...corePaths,
      // Additional paths can be added here or auto-generated
    },
  };
}

/**
 * Setup OpenAPI documentation endpoints
 * @param app Express application
 */
export function setupOpenApi(app: Express): void {
  // ── Alias routes for AC compliance ──────────────────────────────

  // /api-docs → Swagger UI (alias)
  app.get('/api-docs', (req: Request, res: Response) => {
    res.redirect(301, '/api/docs');
  });

  // /api-docs/spec.json → OpenAPI JSON spec (alias)
  app.get('/api-docs/spec.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(getOpenApiSpec());
  });

  // ── Primary routes ────────────────────────────────────────────────

  // Serve OpenAPI JSON spec
  app.get('/api/docs/openapi.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(getOpenApiSpec());
  });

  // Serve OpenAPI YAML spec
  app.get('/api/docs/openapi.yaml', async (req: Request, res: Response) => {
    try {
      const yaml = await import('yaml');
      const spec = getOpenApiSpec();
      res.setHeader('Content-Type', 'text/yaml');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(yaml.stringify(spec));
    } catch (error) {
      res.status(500).json({ message: 'YAML library not available' });
    }
  });

  // Serve Swagger UI HTML
  app.get('/api/docs', (req: Request, res: Response) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Printyx API Documentation" />
  <title>Printyx API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin-bottom: 20px; }
    .swagger-ui .info .title { font-size: 32px; }
    .swagger-ui .scheme-container { background: #f7f7f7; padding: 10px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: "/api/docs/openapi.json",
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout",
        deepLinking: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
        persistAuthorization: true,
        filter: true,
        syntaxHighlight: {
          activated: true,
          theme: "monokai"
        },
        requestInterceptor: (request) => {
          // Add tenant ID from localStorage if available
          const tenantId = localStorage.getItem('printyx_tenant_id');
          if (tenantId && !request.headers['x-tenant-id']) {
            request.headers['x-tenant-id'] = tenantId;
          }
          return request;
        }
      });
    };
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(html);
  });

  // Serve ReDoc alternative documentation
  app.get('/api/docs/redoc', (req: Request, res: Response) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Printyx API Documentation" />
  <title>Printyx API Documentation - ReDoc</title>
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <redoc spec-url='/api/docs/openapi.json'></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(html);
  });

  // API docs landing page with links
  app.get('/api/docs/index', (req: Request, res: Response) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Printyx API Documentation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      background: #f5f5f5;
    }
    h1 { color: #333; margin-bottom: 30px; }
    .card {
      background: white;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .card h2 { margin-top: 0; color: #0066cc; }
    .card p { color: #666; margin-bottom: 16px; }
    .card a {
      display: inline-block;
      padding: 10px 20px;
      background: #0066cc;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin-right: 10px;
    }
    .card a:hover { background: #0052a3; }
    .card a.secondary { background: #6c757d; }
    .card a.secondary:hover { background: #545b62; }
    code {
      background: #f0f0f0;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <h1>Printyx API Documentation</h1>

  <div class="card">
    <h2>Interactive API Explorer</h2>
    <p>Explore and test API endpoints with Swagger UI. Try out requests directly from your browser.</p>
    <a href="/api/docs">Swagger UI</a>
    <a href="/api/docs/redoc" class="secondary">ReDoc</a>
  </div>

  <div class="card">
    <h2>OpenAPI Specification</h2>
    <p>Download the raw OpenAPI 3.0 specification for use with API clients and code generators.</p>
    <a href="/api/docs/openapi.json">JSON Format</a>
    <a href="/api/docs/openapi.yaml" class="secondary">YAML Format</a>
  </div>

  <div class="card">
    <h2>Quick Start</h2>
    <p>Set your authorization token in Swagger UI, then use the "Try it out" feature to make API calls.</p>
    <p>All requests require:</p>
    <ul>
      <li>Authentication: <code>Authorization: Bearer &lt;token&gt;</code></li>
      <li>Tenant context: <code>x-tenant-id: &lt;tenant-uuid&gt;</code> (optional if in JWT)</li>
    </ul>
  </div>

  <div class="card">
    <h2>API Versioning</h2>
    <p>Current API version: <code>v1</code></p>
    <p>Base URL: <code>https://api.printyx.net/api/v1/</code></p>
  </div>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(html);
  });
}

/**
 * Utility to add a path to the OpenAPI specification at runtime
 * Can be used by route files to self-document
 */
export function addOpenApiPath(path: string, pathItem: OpenAPIV3.PathItemObject): void {
  if (!openApiConfig.paths) {
    openApiConfig.paths = {};
  }
  openApiConfig.paths[path] = pathItem;
}

/**
 * Export the spec for external use
 */
export { getOpenApiSpec };
