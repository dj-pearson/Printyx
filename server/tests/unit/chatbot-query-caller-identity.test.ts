/**
 * Round 153: /api/chatbot.
 *
 * POST /api/chatbot/query (Express; production answers it with a deliberate
 * 501) resolved the RBAC subject from a platformUserId in the caller's own
 * request body, so any tenant member could name a manager's Slack id and have
 * every read-only tool run with that manager's scope. And the Express console
 * handlers had no role check while the edge function requires a manager to
 * change a workspace install or a user mapping; those paths are proxied now.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';

const stripComments = (src: string) =>
  src.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
const express = stripComments(readFileSync('server/routes-chatbot.ts', 'utf8'));

describe('a mapped chat identity must be the caller', () => {
  const at = express.indexOf('if (platformUserId) {');
  const branch = express.slice(at, express.indexOf('} else {', at));

  it('locates the branch', () => {
    expect(at).toBeGreaterThan(-1);
  });

  it('refuses a link that resolves to a different Printyx user, before any tool runs', () => {
    expect(branch).toMatch(/printyxUserId !== getUserId\(req\)/);
    expect(branch).toMatch(/status\(403\)/);
    expect(express.indexOf('PLATFORM_USER_NOT_CALLER')).toBeLessThan(
      express.indexOf('await selectTool(question)'),
    );
  });
});

describe('the console paths run the gated edge function in dev too', () => {
  it('Express registers only /query', () => {
    const registered = [...express.matchAll(/app\.(get|post|put|patch|delete)\('([^']+)'/g)].map(
      (m) => `${m[1]} ${m[2]}`,
    );
    expect(registered).toEqual(['post /api/chatbot/query']);
  });

  it('each console path has a scoped proxy entry to the chatbot function', () => {
    const proxy = stripComments(readFileSync('server/middleware/edge-function-proxy.ts', 'utf8'));
    for (const seg of ['connections', 'connect', 'links', 'query-log']) {
      expect(proxy).toContain(`'/api/chatbot/${seg}': { fn: 'chatbot', pathPrefix: '/${seg}' }`);
    }
    // /query must NOT be proxied: the edge function 501s it on purpose.
    expect(proxy).not.toMatch(/'\/api\/chatbot'\s*:/);
    expect(proxy).not.toMatch(/'\/api\/chatbot\/query'\s*:/);
  });

  it('the Node projection twin is gone', () => {
    expect(existsSync('server/lib/chatbot-projection.ts')).toBe(false);
  });
});
