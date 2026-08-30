import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * INTEG-WEBHOOK-001. /api/webhooks is in crmProxies, and the webhooks edge
 * function calls auth.getUser() before it routes anything. A provider sends no
 * JWT, so every inbound delivery got 401 - and the proxy falls through only on
 * a NETWORK error, never a 401, so the Express receiver never ran on either
 * host. Stripe deliveries reached nothing, which is the defect this story
 * exists to fix.
 *
 * The fix is ordering, and ordering is invisible to tsc: mount
 * POST /api/webhooks/:provider BEFORE registerEdgeFunctionProxy. Three things
 * have to stay true, and each is checked here because nothing else can see
 * them.
 */
const repoRoot = join(__dirname, '..', '..', '..');

function codeOf(...segments: string[]): string {
  // Comments stripped: the comments explaining this fix necessarily describe
  // the broken ordering, and a check that cannot tell prose from code reports
  // its own explanation as the defect.
  return readFileSync(join(repoRoot, ...segments), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('inbound webhook receiver ordering', () => {
  const registry = codeOf('server', 'routes-registry.ts');

  it('mounts the receiver before the edge-function proxy', () => {
    const mount = registry.indexOf('app.use(inboundWebhookReceiver)');
    const proxy = registry.indexOf('registerEdgeFunctionProxy(app)');

    expect(mount, 'inboundWebhookReceiver is not mounted').toBeGreaterThan(-1);
    expect(proxy, 'registerEdgeFunctionProxy is not called').toBeGreaterThan(-1);
    // Express matches in registration order. Swap these and every provider
    // delivery goes back to getting a 401 from the edge function.
    expect(mount).toBeLessThan(proxy);
  });

  it('the receiver is a separate router, not the whole webhook-routes default', () => {
    const routes = codeOf('server', 'integrations', 'webhook-routes.ts');

    expect(routes).toMatch(/export const inboundWebhookReceiver = express\.Router\(\)/);
    expect(routes).toMatch(/inboundWebhookReceiver\.post\('\/api\/webhooks\/:provider'/);
    // Mounting the default router early would also steal GET /api/webhooks,
    // the outbound list the edge function legitimately owns.
    expect(registry).not.toMatch(/app\.use\(webhookRoutes\)/);
  });

  it('the edge function still has no POST /:id branch to collide with', () => {
    // The whole fix rests on this: POST /api/webhooks/<provider> is a shape the
    // edge function does not serve, so routing it to Express takes nothing away.
    // If someone adds a POST /:id branch there, the two surfaces overlap and
    // this arrangement stops being safe.
    const edge = codeOf('supabase', 'functions', 'webhooks', 'index.ts');
    const postBranches = [...edge.matchAll(/req\.method === 'POST'[^)]*\)/g)].map((m) => m[0]);

    expect(postBranches.length).toBeGreaterThan(0);
    for (const branch of postBranches) {
      // `&& webhookId` is the POSITIVE form. `&& !webhookId` is the create
      // branch (POST / with no id), which is not a collision and must not be
      // counted - the first version of this check did, and failed on it.
      const bare = /&&\s*webhookId/.test(branch) && !branch.includes('subResource');
      expect(bare, `edge fn gained a bare POST /:id branch: ${branch}`).toBe(false);
    }
  });

  it('the raw body parser is still on the receiver, since the HMAC needs the bytes', () => {
    const routes = codeOf('server', 'integrations', 'webhook-routes.ts');
    expect(routes).toMatch(/inboundWebhookReceiver\.post\([^)]*rawBodyParser/);
  });
});
