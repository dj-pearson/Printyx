/**
 * Duplicate route registration detector (CR-018).
 *
 * Express resolves routes first-registered-wins, so if two modules register the
 * same method+path the first one silently shadows the second. That has hidden
 * real bugs where an unauthenticated or mock handler shadowed the authenticated
 * / real one. This scans the finished Express router stack and warns on any
 * duplicate method+path so a future regression is caught at startup instead of
 * in production.
 */
import type { Express } from 'express';

export interface DuplicateRoute {
  method: string;
  path: string;
  count: number;
}

interface RouteLayer {
  route?: { path?: unknown; methods?: Record<string, boolean> };
  name?: string;
  handle?: { stack?: RouteLayer[] };
}

/**
 * Return every method+path that was registered more than once as a direct
 * Express route. Mounted sub-routers are traversed but without their mount
 * prefix (Express does not expose it on the layer), so only their internal
 * paths are compared — good enough to catch the common `app.get()` shadow.
 */
export function findDuplicateRoutes(app: Express): DuplicateRoute[] {
  const counts = new Map<string, number>();

  const visit = (layers: RouteLayer[] | undefined): void => {
    if (!Array.isArray(layers)) return;
    for (const layer of layers) {
      if (layer.route && typeof layer.route.path === 'string') {
        const methods = Object.keys(layer.route.methods ?? {}).filter((m) => m !== '_all');
        for (const method of methods) {
          const key = `${method.toUpperCase()} ${layer.route.path}`;
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      } else if (layer.name === 'router' && layer.handle?.stack) {
        visit(layer.handle.stack);
      }
    }
  };

  // Express 5 exposes app.router; Express 4 uses the private app._router.
  const router = app as unknown as {
    router?: { stack?: RouteLayer[] };
    _router?: { stack?: RouteLayer[] };
  };
  visit(router.router?.stack ?? router._router?.stack);

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => {
      const spaceIdx = key.indexOf(' ');
      return { method: key.slice(0, spaceIdx), path: key.slice(spaceIdx + 1), count };
    });
}

/**
 * Log a warning for each duplicate method+path. Called once after all route
 * modules are registered. Never throws — purely diagnostic.
 */
export function warnOnDuplicateRoutes(
  app: Express,
  log: { warn: (msg: string) => void },
): DuplicateRoute[] {
  let duplicates: DuplicateRoute[] = [];
  try {
    duplicates = findDuplicateRoutes(app);
    for (const dup of duplicates) {
      log.warn(
        `Duplicate route registration: ${dup.method} ${dup.path} registered ${dup.count} times — ` +
          `only the first-registered handler is reachable (possible auth/behavior shadow).`,
      );
    }
  } catch {
    // Router introspection is best-effort; never block startup.
  }
  return duplicates;
}
