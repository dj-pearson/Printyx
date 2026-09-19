// Customer acceptance at delivery and installation (WF-L-07).
//
// The only signature capability in the tree was
// supabase/functions/field-service/handlers/signatures.ts over
// service_signatures, and the whole function had no caller in any of the seven
// client trees. Nothing captured a delivery checklist or an acceptance form at
// all, so "the customer signed for it" was a claim with no record behind it.

/** A checklist line as the acceptance screen sends it. */
export interface AcceptanceChecklistItem {
  id?: string;
  itemName: string;
  passed: boolean | null;
  notes?: string | null;
}

/**
 * Which staged/in_transit -> installed requirements a signature row satisfies.
 *
 * Same evidence-not-enforcement boundary WF-L-05 and WF-L-06 drew. WF-L-13 is
 * the story that makes the transition endpoint CHECK its 25 requirement
 * strings; until then it accepts whatever the caller claims, and what these
 * stories owe is a durable record for the check to read.
 *
 * The two are separate because they are separate events: a driver collects a
 * signature at the door, and the customer accepts the installed unit
 * afterwards. A delivery signature is not an acceptance, which is exactly the
 * conflation this keeps out of the data.
 */
export function acceptanceRequirements(row: Record<string, unknown> | null | undefined): string[] {
  if (!row || !row.signature_data_url || !row.signer_name) return [];
  const type = String(row.signature_type ?? '');
  if (type === 'delivery') return ['delivery_signature_collected'];
  if (type === 'installation' || type === 'acceptance') return ['acceptance_signed'];
  return [];
}

/**
 * Is the checklist complete enough to accept against?
 *
 * A required item that nobody answered is NOT a pass. `passed === null` means
 * unanswered, and the distinction is the point: a checklist where every box is
 * silently treated as satisfied is the same as no checklist.
 */
export function checklistBlockers(
  items: Array<{
    itemName?: string;
    item_name?: string;
    isRequired?: boolean;
    is_required?: boolean;
    passed?: boolean | null;
  }>,
): string[] {
  return items
    .filter((item) => {
      const required = item.isRequired ?? item.is_required ?? false;
      return required && item.passed !== true;
    })
    .map((item) => String(item.itemName ?? item.item_name ?? 'Unnamed item'));
}

/** Text the customer is shown above the signature pad. One definition, two surfaces. */
export const ACCEPTANCE_AGREEMENT =
  'I confirm the equipment listed above was delivered and installed as described, ' +
  'that the checklist items marked complete were carried out in my presence, and ' +
  'that I am authorised to accept delivery on behalf of the customer.';
