/**
 * Customer acceptance helpers, the client copy (WF-L-07).
 *
 * DUPLICATED FROM supabase/functions/_shared/acceptance.ts ON PURPOSE, and
 * locked to it by server/tests/unit/acceptance-parity.test.ts. The edge copy is
 * Deno and imports with a .ts extension; this one is inside the Vite client
 * tree. That is the same arrangement shared/quote-math.ts has with the
 * proposals function, and the parity test is what keeps the two honest.
 *
 * Keep both in sync. The agreement text especially: it is what the customer is
 * shown above the pad AND what is stored on the row, and two versions of it
 * would mean the record does not say what the person read.
 */

/**
 * Required checklist items that are not a pass.
 *
 * `passed === null` means unanswered, and the distinction is the point: a
 * checklist where every unanswered box counts as satisfied is the same as no
 * checklist.
 */
export function checklistBlockers(
  items: Array<{ item_name?: string; is_required?: boolean; passed?: boolean | null }>,
): string[] {
  return items
    .filter((item) => (item.is_required ?? false) && item.passed !== true)
    .map((item) => String(item.item_name ?? 'Unnamed item'));
}

/** Text the customer is shown above the signature pad. */
export const ACCEPTANCE_AGREEMENT =
  'I confirm the equipment listed above was delivered and installed as described, ' +
  'that the checklist items marked complete were carried out in my presence, and ' +
  'that I am authorised to accept delivery on behalf of the customer.';
