/**
 * Deleting a selection, and reporting what actually happened.
 *
 * FOUR CATALOGUE PAGES SHIPPED THE SAME DEFECT because they were written by
 * copying each other: ManagedServices, ProfessionalServices, Supplies and
 * EnhancedProductAccessories all looped a DELETE with each call wrapped in
 * `catch {}` and then toasted `Deleted ${ids.length}` regardless. When the
 * endpoint was missing in production - which is exactly what
 * /api/managed-services and /api/professional-services were - a rep could
 * select twenty products, be told all twenty were gone, and lose none.
 *
 * A destructive action that reports a success it did not have is worse than one
 * that fails loudly, and none of the three fabrication guards watches a WRITE
 * outcome: they all watch rendered reads.
 *
 * One definition rather than four copies of the fix, so the fifth page inherits
 * it. The rules it encodes:
 *
 *   - COUNT THE SUCCESSES, never the attempts.
 *   - KEEP THE FAILURES SELECTED, so retrying does not mean finding them again.
 *   - A PARTIAL FAILURE IS NOT A SUCCESS: it reads as destructive, because the
 *     user has to decide what to do about the remainder.
 *   - CARRY ON AFTER A FAILURE rather than aborting the loop. Nineteen of
 *     twenty deleted with one named survivor beats stopping at the first, which
 *     leaves the user unable to tell what went.
 */

export interface BulkDeleteOutcome {
  /** Ids the server confirmed. */
  deleted: string[];
  /** Ids that threw, in the order they were attempted. */
  failed: string[];
}

export async function bulkDelete(
  ids: string[],
  remove: (id: string) => Promise<unknown>,
): Promise<BulkDeleteOutcome> {
  const deleted: string[] = [];
  const failed: string[] = [];
  for (const id of ids) {
    try {
      await remove(id);
      deleted.push(id);
    } catch {
      failed.push(id);
    }
  }
  return { deleted, failed };
}

export interface BulkDeleteToast {
  title: string;
  description: string;
  variant?: 'destructive';
}

/**
 * `noun` is the plural the page uses ("services", "supplies"). Singular and
 * plural are both produced from it rather than from a count elsewhere, so the
 * message cannot disagree with the number beside it.
 */
export function bulkDeleteToast(outcome: BulkDeleteOutcome, noun: string): BulkDeleteToast {
  const { deleted, failed } = outcome;
  const attempted = deleted.length + failed.length;

  if (attempted === 0) {
    return { title: 'Nothing selected', description: `No ${noun} were selected.` };
  }
  if (failed.length === 0) {
    return { title: 'Deleted', description: `Deleted ${deleted.length} ${noun}.` };
  }
  if (deleted.length === 0) {
    return {
      title: 'Nothing deleted',
      description: `None of the ${attempted} selected ${noun} could be deleted. They are still selected.`,
      variant: 'destructive',
    };
  }
  return {
    title: 'Partly deleted',
    description: `${deleted.length} of ${attempted} ${noun} deleted. ${failed.length} could not be and are still selected.`,
    variant: 'destructive',
  };
}
