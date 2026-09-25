import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '../../..');

/**
 * Round 222. Two files in docs/dead-buttons-baseline.json were ALSO in
 * docs/orphan-files-baseline.json: nothing imported them, so their dead
 * buttons (an Import dialog whose submit had no handler, an Add Contact with
 * none) could not be pressed by anybody. Wiring a button on a page no route
 * reaches is work nobody sees, so both are deleted. The routed knowledge-base
 * admin is KnowledgeBaseAdmin.tsx, which does not call any of the
 * /api/admin/knowledge-base paths the orphan did.
 */
const RETIRED = [
  'client/src/pages/admin/KnowledgeBaseAdminDashboard.tsx',
  'client/src/components/mobile/MobileCustomerEntry.tsx',
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

describe('orphaned pages carrying dead buttons are retired (round 222)', () => {
  const files = walk(resolve(root, 'client/src'));

  it('walks a real corpus', () => {
    expect(files.length).toBeGreaterThan(500);
  });

  for (const rel of RETIRED) {
    const name = rel
      .split('/')
      .pop()!
      .replace(/\.tsx$/, '');
    it(`${name} is gone and nothing imports it`, () => {
      expect(existsSync(resolve(root, rel))).toBe(false);
      const importers = files.filter((f) =>
        new RegExp(`from ['"][^'"]*/${name}['"]|import\\(['"][^'"]*/${name}['"]\\)`).test(
          readFileSync(f, 'utf8'),
        ),
      );
      expect(importers).toEqual([]);
    });
  }

  it('neither is still listed in either baseline', () => {
    const orphans = readFileSync(resolve(root, 'docs/orphan-files-baseline.json'), 'utf8');
    const dead = readFileSync(resolve(root, 'docs/dead-buttons-baseline.json'), 'utf8');
    for (const rel of RETIRED) {
      expect(orphans).not.toContain(rel);
      expect(dead).not.toContain(rel);
    }
  });

  it('the routed knowledge-base admin is the other file', () => {
    expect(readFileSync(resolve(root, 'client/src/App.tsx'), 'utf8')).toContain(
      "import('@/pages/admin/KnowledgeBaseAdmin')",
    );
  });
});
