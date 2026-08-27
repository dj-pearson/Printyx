/**
 * Legacy stage -> canonical pipeline stage mirror (COP-M07).
 *
 * `deals.stage_id` holds a LEGACY `deal_stages.id`, and CRMX-005 bridges it to
 * the canonical model through `pipeline_stages.legacy_stage_id`. That bridge is
 * only useful if it is COMPLETE: a legacy stage with no mirror is invisible to
 * every surface bound to `pipeline_stages`, and a deal moved into it drops off
 * the board without an error anywhere.
 *
 * `POST /api/deal-stages` and `/api/deal-stages/initialize` created legacy
 * stages and no mirror, so that hole opened every time an admin added a stage.
 * These helpers close it at the write, which is the only place that can keep the
 * two in step without a nightly job.
 *
 * Deliberately NOT a repoint: `deals.stage_id` keeps living in the legacy id
 * space. COP-M07 is explicit that moving it without verifying every existing
 * deal orphans them, and `npm run check:stage-resolution` is the gate for that.
 */
import { and, eq } from 'drizzle-orm';

import { db } from '../db';
import { pipelineStages, pipelineTemplates } from '../../shared/pipeline-configuration-schema';
import { createModuleLogger } from './logger';

const log = createModuleLogger('pipeline-stage-mirror');

/** The shape a legacy deal_stages row exposes, as far as the mirror cares. */
export interface LegacyStage {
  id: string;
  tenantId: string;
  name: string;
  color?: string | null;
  description?: string | null;
  sortOrder?: number | null;
  isActive?: boolean | null;
  isClosingStage?: boolean | null;
  isWonStage?: boolean | null;
}

/**
 * The canonical columns a legacy stage maps to.
 *
 * `deal_stages` has no probability column, so the canonical default is derived
 * from the closed flags: 100 on won, 0 on lost, a neutral 50 elsewhere. Anything
 * finer would be invented, and a made-up probability feeds straight into
 * forecast weighting.
 */
export function canonicalFieldsFor(stage: LegacyStage) {
  const isClosing = stage.isClosingStage === true;
  const isWon = stage.isWonStage === true;
  return {
    name: stage.name,
    displayName: stage.name,
    description: stage.description ?? null,
    color: stage.color ?? '#3B82F6',
    order: stage.sortOrder ?? 0,
    isFinalStage: isClosing,
    isClosedWon: isWon,
    isClosedLost: isClosing && !isWon,
    defaultProbability: isWon ? 100 : isClosing ? 0 : 50,
    includeInForecast: true,
    isActive: stage.isActive !== false,
  };
}

/**
 * The tenant's default pipeline template, created if it has none.
 *
 * pipeline_type is NOT NULL with no default; omitting it is what made the edge
 * function's own bootstrap fail silently for every tenant.
 */
export async function ensureDefaultTemplate(tenantId: string, createdBy?: string | null) {
  const [existingDefault] = await db
    .select()
    .from(pipelineTemplates)
    .where(and(eq(pipelineTemplates.tenantId, tenantId), eq(pipelineTemplates.isDefault, true)))
    .limit(1);
  if (existingDefault) return existingDefault;

  const [any] = await db
    .select()
    .from(pipelineTemplates)
    .where(eq(pipelineTemplates.tenantId, tenantId))
    .limit(1);
  if (any) return any;

  const [created] = await db
    .insert(pipelineTemplates)
    .values({
      tenantId,
      name: 'Default Sales Pipeline',
      pipelineType: 'new_business',
      isActive: true,
      isDefault: true,
      createdBy: createdBy ?? null,
    })
    .returning();
  return created;
}

/**
 * Creates or refreshes the canonical mirror of one legacy stage.
 *
 * Never throws: a mirror failure must not fail the stage write that already
 * succeeded, because a legacy stage with no mirror is recoverable (re-run the
 * write, or the seeder) while a 500 in the middle of stage admin is not.
 * Returns the mirror row, or null when it could not be written.
 */
export async function mirrorLegacyStage(stage: LegacyStage, createdBy?: string | null) {
  try {
    if (!stage?.id || !stage.tenantId) return null;

    const template = await ensureDefaultTemplate(stage.tenantId, createdBy);
    if (!template) {
      log.warn(
        { tenantId: stage.tenantId, stageId: stage.id },
        'No pipeline template; legacy stage left unmirrored',
      );
      return null;
    }

    const fields = canonicalFieldsFor(stage);

    const [existing] = await db
      .select()
      .from(pipelineStages)
      .where(
        and(
          eq(pipelineStages.tenantId, stage.tenantId),
          eq(pipelineStages.legacyStageId, stage.id),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(pipelineStages)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(pipelineStages.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(pipelineStages)
      .values({
        ...fields,
        tenantId: stage.tenantId,
        pipelineTemplateId: template.id,
        legacyStageId: stage.id,
      })
      .returning();
    return created;
  } catch (error) {
    log.error(
      { err: error, stageId: stage?.id, tenantId: stage?.tenantId },
      'Failed to mirror legacy stage into pipeline_stages',
    );
    return null;
  }
}
