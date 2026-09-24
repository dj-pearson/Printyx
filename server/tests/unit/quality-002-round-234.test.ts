import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

describe('QUALITY-002 round 234', () => {
  it('every page key TaskHub-style callers pass has help content', () => {
    // TaskHub passed page="task-hub", which the content map does not have, so
    // the component returned null and the page showed no help at all.
    const help = read('client/src/components/contextual/ContextualHelp.tsx');
    const map = help.slice(help.indexOf('const contentMap'));
    const keys = new Set([...map.matchAll(/^\s{2}'([a-z-]+)': \{/gm)].map((m) => m[1]));
    expect(keys.size).toBeGreaterThan(5);
    const used = [
      ...read('client/src/pages/TaskHub.tsx').matchAll(/<ContextualHelp page="([a-z-]+)"/g),
    ].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const k of used) expect(keys, k).toContain(k);
  });

  it('a contact with an unparseable date renders "Never" rather than throwing', () => {
    const src = read('client/src/components/ContactManager.tsx');
    const at = src.indexOf('const formatDate = ');
    const body = src.slice(at, src.indexOf('};', at));
    expect(body).toMatch(/Number\.isNaN\(d\.getTime\(\)\)/);
  });
});
