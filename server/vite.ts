import express, { type Express } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer, createLogger } from 'vite';
import { type Server } from 'http';
import viteConfig from '../vite.config';
import { nanoid } from 'nanoid';
import { createModuleLogger } from './lib/logger';

const viteLogger = createLogger();

// Create module-specific logger for server operations
const serverLog = createModuleLogger('server');

/**
 * Backward-compatible log function
 * Uses structured logging internally while maintaining the same API
 */
export function log(message: string, source = 'express') {
  // Use structured logging
  const moduleLog = createModuleLogger(source);

  // Parse message for error detection
  if (message.toLowerCase().includes('error') || message.toLowerCase().includes('fail')) {
    moduleLog.error(message);
  } else if (message.toLowerCase().includes('warn')) {
    moduleLog.warn(message);
  } else {
    moduleLog.info(message);
  }
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: 'custom',
  });

  app.use(vite.middlewares);
  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(import.meta.dirname, '..', 'client', 'index.html');

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, 'utf-8');
      template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, 'public');

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files with aggressive caching for hashed assets
  app.use(
    express.static(distPath, {
      maxAge: '1y', // 1 year cache for hashed assets
      immutable: true, // Files with hashes never change
      setHeaders: (res, filePath) => {
        // For non-hashed files (index.html, manifest.json, etc.), use shorter cache
        if (
          filePath.endsWith('.html') ||
          filePath.endsWith('.json') ||
          filePath === path.join(distPath, 'service-worker.js')
        ) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
        // Security headers for all static files
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );

  // fall through to index.html if the file doesn't exist
  app.use('*', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}
