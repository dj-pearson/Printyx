/**
 * A third workflow dispatcher and a tenant RBAC initializer, both deleted
 * (QUALITY-002).
 *
 * Neither had an importer anywhere in the tree - both were already in
 * `docs/server-orphans-baseline.json` - and neither could have run:
 *
 *   server/services/workflow-event-service.ts (394 lines) imported
 *   `workflowTriggers`, `workflowConditions`, `workflowVersions` and
 *   `workflowExecutionEvents` from `@shared/schema`, which re-exports the
 *   workflow TYPES and insert schemas from workflow-automation-schema but NOT
 *   the table objects. So every `db.select().from(...)` in it resolved to
 *   `never` - seven errors all saying "Property 'x' does not exist on type
 *   'never'", which is what that looks like.
 *
 *   server/rbac-initializer.ts called `rbacSeeder.seedEnterpriseRoles`,
 *   `rbacService.assignUserRole` and `rbacSeeder.addEnterpriseFeatures`. None
 *   of the three exists anywhere in the repo.
 *
 * The workflow one is the more dangerous of the two, and not because of its
 * errors. CLAUDE.md records "TWO DISPATCHERS, ONE PER HOST, and picking the
 * wrong one means the event never fires". This was a THIRD, sitting in
 * `server/services/` next to the real one, described in its own header as the
 * thing that "finds matching workflow triggers and initiates execution".
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

describe('neither file comes back', () => {
  for (const file of ['server/services/workflow-event-service.ts', 'server/rbac-initializer.ts']) {
    it(`${file} is gone`, () => {
      expect(existsSync(join(repo, file))).toBe(false);
    });
  }
});

describe('there are exactly two workflow dispatchers, one per host', () => {
  it('the Node one is workflow-runtime', () => {
    expect(read('server/services/workflow-runtime.ts')).toContain(
      'export async function dispatchWorkflowEvent(',
    );
  });

  it('the edge one is _shared/workflow-dispatch', () => {
    expect(read('supabase/functions/_shared/workflow-dispatch.ts')).toContain(
      'dispatchWorkflowEventSafe',
    );
  });

  it('and nothing else in server/services claims to dispatch workflow events', () => {
    // The deleted file described itself as finding matching triggers and
    // initiating execution. A second Node dispatcher is not a duplicate that
    // wastes space, it is one somebody can wire by mistake.
    const dir = join(repo, 'server/services');
    const claimants = readdirSync(dir).filter((f) => {
      if (!f.endsWith('.ts') || f === 'workflow-runtime.ts') return false;
      const src = readFileSync(join(dir, f), 'utf8');
      return /finds matching workflow triggers|initiates? (workflow )?execution/i.test(src);
    });
    expect(claimants).toEqual([]);
  });
});

describe('RBAC still has a live way in', () => {
  it('the seeder is the entry point, and it is wired', () => {
    // Deleting an initializer is only safe if something else initialises.
    expect(read('package.json')).toContain('"seed:rbac"');
    expect(read('server/routes-enhanced-rbac.ts')).toContain("from './enhanced-rbac-seeder'");
  });

  it('the methods the deleted file called still do not exist', () => {
    // Stated as a fact rather than a memory: if one of these ever appears, the
    // initializer was a real feature waiting on it and this test should be
    // revisited rather than the file quietly recreated.
    const seeder = read('server/enhanced-rbac-seeder.ts');
    const service = read('server/enhanced-rbac-service.ts');
    expect(seeder).not.toContain('seedEnterpriseRoles');
    expect(seeder).not.toContain('addEnterpriseFeatures');
    expect(service).not.toContain('assignUserRole');
  });
});
