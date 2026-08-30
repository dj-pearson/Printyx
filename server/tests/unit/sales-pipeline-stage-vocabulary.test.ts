import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * COP-E02. SalesPipelineWorkflow boards `business_records` filtered to
 * record_type='lead', so a "stage" is that row's `status` - a lifecycle string.
 * It is NOT a `pipeline_stages` row, whose id is a gen_random_uuid() varchar and
 * which belongs to the deals board.
 *
 * The page used to draw its columns from /api/pipeline-config/templates, so
 * `stages.findIndex(s => s.id === opportunity.stage)` compared a UUID to 'lead',
 * returned -1 on every record, and "move to next stage" resolved to index 0 and
 * PATCHed a UUID into business_records.status. `stage: z.string()` accepted it.
 *
 * Two things have to stay true for that to stay fixed, and neither is visible to
 * tsc: the server validates against the vocabulary, and the page reads the
 * vocabulary from the same place the server validates against. Both are checked
 * as source text because the edge function is a Deno module importing zod from
 * esm.sh, which vitest cannot load.
 */
const repoRoot = join(__dirname, '..', '..', '..');
const fnSource = readFileSync(join(repoRoot, 'supabase/functions/sales-pipeline/index.ts'), 'utf8');
const pageSourceRaw = readFileSync(
  join(repoRoot, 'client/src/pages/SalesPipelineWorkflow.tsx'),
  'utf8',
);

/**
 * Comments are stripped before asserting a path is absent. The comment
 * explaining why /api/pipeline-config/templates was removed names that path, and
 * a guard that cannot tell prose from a call site reports the explanation as the
 * defect - the same phantom check:edge-coverage was taught to avoid.
 */
const pageSource = pageSourceRaw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('sales-pipeline stage vocabulary', () => {
  it('the stage update schema is an enum, not a free string', () => {
    const schema = fnSource.slice(
      fnSource.indexOf('const stageUpdateSchema'),
      fnSource.indexOf('});', fnSource.indexOf('const stageUpdateSchema')),
    );

    expect(schema).toContain('z.enum(PIPELINE_STAGE_IDS)');
    // The regression: a free string is what let a UUID into the status column.
    expect(schema).not.toMatch(/stage:\s*z\.string\(\)/);
  });

  it('the enum is built from PIPELINE_STAGES rather than a second hand-written list', () => {
    expect(fnSource).toMatch(/PIPELINE_STAGE_IDS = PIPELINE_STAGES\.map/);
  });

  it('serves the vocabulary so the page has one source of truth', () => {
    expect(fnSource).toContain("path === '/stages'");
  });

  it('every stage id is a lifecycle status, never a UUID', () => {
    const block = fnSource.slice(
      fnSource.indexOf('const PIPELINE_STAGES = ['),
      fnSource.indexOf('];', fnSource.indexOf('const PIPELINE_STAGES = [')),
    );
    const ids = [...block.matchAll(/id: '([^']+)'/g)].map((m) => m[1]);

    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('lead');
    expect(ids).toContain('closed_won');
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z_]*$/);
      expect(id).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  });

  it('the page reads the vocabulary from sales-pipeline, not the deals pipeline config', () => {
    expect(pageSource).toContain("'/api/sales-pipeline/stages'");
    // Drawing columns from the deals template is the original defect.
    expect(pageSource).not.toContain('/api/pipeline-config/templates');
  });

  it('the page matches records on the status VALUE, not a display label', () => {
    expect(pageSource).toContain('opp.stage === stage.id');
    expect(pageSource).not.toContain('opp.stage === stage.name');
  });

  it('advancing from an unrecognised status is refused rather than reset to stage one', () => {
    expect(pageSource).toContain(
      'currentStageIndex >= 0 ? pipelineStages[currentStageIndex + 1] : undefined',
    );
  });
});
