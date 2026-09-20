/**
 * Record page layout engine (CRM-008).
 *
 * Pure. A layout is DATA, and every hard problem here comes from that: a
 * stored layout is a snapshot of what the product looked like the day an admin
 * pressed save, and the product keeps moving.
 *
 * THREE RULES, EACH PAID FOR BY A FAILURE MODE:
 *
 *  1. A STORED LAYOUT IS AUTHORITATIVE, BUT NOT TOTAL. Sections it names keep
 *     its order, position and collapsed state - the admin meant those. A
 *     section the product has added SINCE it was saved is APPENDED rather than
 *     dropped, because the alternative is that shipping a new section makes it
 *     invisible to every tenant that has ever customised a layout, with nothing
 *     saying so. Removal is still possible: `hidden: true` says it out loud.
 *
 *  2. A SECTION THE PAGE CANNOT RENDER IS REPORTED, NOT SWALLOWED. The engine
 *     is handed a map of slot renderers; a sectionId with no renderer comes
 *     back in `unrenderable` so the page can say "this layout names a section
 *     this version does not have" instead of quietly showing less than the
 *     admin configured.
 *
 *  3. A PROPERTY FIELD THAT IS NOT A FIELD OF THE RECORD IS DROPPED AND NAMED.
 *     A renamed column would otherwise render as an endless column of blank
 *     rows, which reads as "this deal has no data" rather than "this layout is
 *     stale".
 */

export type LayoutPosition = 'header' | 'left' | 'center' | 'right';

export const LAYOUT_POSITIONS: readonly LayoutPosition[] = [
  'header',
  'left',
  'center',
  'right',
] as const;

export type RecordObjectType = 'deals' | 'leads' | 'contacts' | 'companies' | 'opportunities';

export interface LayoutPropertyField {
  field: string;
  label: string;
  editable: boolean;
  /** How to render and edit it. Absent reads as text. */
  type?: 'text' | 'number' | 'currency' | 'date' | 'percent' | 'select' | 'textarea';
}

export interface LayoutSection {
  sectionId: string;
  title: string;
  position: LayoutPosition;
  order: number;
  propertyFields: LayoutPropertyField[];
  collapsed: boolean;
  /** Deliberately removed by an admin. Distinct from "not in the stored list". */
  hidden?: boolean;
}

/**
 * The layout every tenant gets until somebody saves one.
 *
 * It is the SHIPPED layout rather than an empty skeleton, so a tenant with no
 * row renders a complete page. That also makes the stored form optional
 * forever: nothing has to be seeded for the feature to work.
 */
export const DEFAULT_LAYOUTS: Record<RecordObjectType, LayoutSection[]> = {
  deals: [
    {
      sectionId: 'deal-header',
      title: 'Deal',
      position: 'header',
      order: 0,
      collapsed: false,
      propertyFields: [
        { field: 'amount', label: 'Amount', editable: true, type: 'currency' },
        {
          field: 'estimatedMonthlyValue',
          label: 'Monthly value',
          editable: true,
          type: 'currency',
        },
        { field: 'expectedCloseDate', label: 'Expected close', editable: true, type: 'date' },
        { field: 'probability', label: 'Probability', editable: true, type: 'percent' },
      ],
    },
    {
      sectionId: 'deal-about',
      title: 'About this deal',
      position: 'left',
      order: 0,
      collapsed: false,
      propertyFields: [
        { field: 'dealType', label: 'Deal type', editable: true },
        { field: 'source', label: 'Source', editable: true },
        { field: 'priority', label: 'Priority', editable: true },
        { field: 'ownerName', label: 'Owner', editable: false },
        { field: 'nextFollowUpDate', label: 'Next step', editable: true, type: 'date' },
        { field: 'productsInterested', label: 'Products', editable: true },
      ],
    },
    {
      sectionId: 'deal-contact',
      title: 'Primary contact',
      position: 'left',
      order: 1,
      collapsed: false,
      propertyFields: [
        { field: 'primaryContactName', label: 'Name', editable: true },
        { field: 'primaryContactEmail', label: 'Email', editable: true },
        { field: 'primaryContactPhone', label: 'Phone', editable: true },
      ],
    },
    {
      sectionId: 'deal-details',
      title: 'Details',
      position: 'left',
      order: 2,
      collapsed: false,
      propertyFields: [],
    },
    {
      sectionId: 'deal-copier',
      title: 'Copier profile',
      position: 'left',
      order: 3,
      collapsed: false,
      propertyFields: [],
    },
    { ...timeline('deal-timeline') },
    { sectionId: 'deal-insights', title: 'Insights', ...side(0) },
    { sectionId: 'deal-forecast', title: 'Forecast', ...side(1) },
    { sectionId: 'deal-competitive', title: 'Competition', ...side(2) },
  ],
  /**
   * COP-M01 corrected two field names here. `estimatedAmount` and `leadSource`
   * are the DRIZZLE field names; the lead endpoint returns raw snake_case rows
   * and LeadDetail normalises them to `estimatedDealValue` and `source`, so
   * both resolved to nothing and the engine reported them as fields the record
   * does not carry. The layout has to name what the PAGE hands it, not what the
   * schema calls the column - the write path maps either spelling
   * (_shared/business-record-write.ts), the read path does not.
   */
  leads: [
    {
      sectionId: 'lead-header',
      title: 'Lead',
      position: 'header',
      order: 0,
      collapsed: false,
      propertyFields: [
        { field: 'estimatedDealValue', label: 'Estimated value', editable: true, type: 'currency' },
        { field: 'leadScore', label: 'Score', editable: false, type: 'number' },
        { field: 'status', label: 'Status', editable: true },
      ],
    },
    {
      sectionId: 'lead-about',
      title: 'About this lead',
      position: 'left',
      order: 0,
      collapsed: false,
      propertyFields: [
        { field: 'companyName', label: 'Company', editable: true },
        { field: 'industry', label: 'Industry', editable: true },
        { field: 'website', label: 'Website', editable: true },
        { field: 'source', label: 'Source', editable: true },
        { field: 'priority', label: 'Priority', editable: true },
      ],
    },
    {
      sectionId: 'lead-contact',
      title: 'Primary contact',
      position: 'left',
      order: 1,
      collapsed: false,
      propertyFields: [
        { field: 'primaryContactName', label: 'Name', editable: true },
        { field: 'primaryContactTitle', label: 'Title', editable: true },
        { field: 'primaryContactEmail', label: 'Email', editable: true },
        { field: 'primaryContactPhone', label: 'Phone', editable: true },
      ],
    },
    {
      sectionId: 'lead-address',
      title: 'Address',
      position: 'left',
      order: 2,
      collapsed: false,
      propertyFields: [
        { field: 'addressLine1', label: 'Street', editable: true },
        { field: 'addressLine2', label: 'Street 2', editable: true },
        { field: 'city', label: 'City', editable: true },
        { field: 'state', label: 'State', editable: true },
        { field: 'postalCode', label: 'Postal code', editable: true },
      ],
    },
    {
      sectionId: 'lead-pipeline',
      title: 'Pipeline',
      position: 'left',
      order: 3,
      collapsed: false,
      propertyFields: [
        { field: 'interestLevel', label: 'Interest', editable: true },
        { field: 'probability', label: 'Probability', editable: true, type: 'percent' },
        { field: 'closeDate', label: 'Expected close', editable: true, type: 'date' },
        { field: 'nextFollowUpDate', label: 'Next follow-up', editable: true, type: 'date' },
        { field: 'lastContactDate', label: 'Last contact', editable: false, type: 'date' },
        { field: 'assignedSalesRep', label: 'Sales rep', editable: true },
        { field: 'territory', label: 'Territory', editable: true },
      ],
    },
    { ...timeline('lead-timeline') },
    // The relational panels - contacts, deals, proposals, quotes - need the
    // WIDE column, not the sidebar, so they sit under the timeline rather than
    // beside it.
    {
      sectionId: 'lead-related',
      title: 'Related records',
      position: 'center',
      order: 1,
      collapsed: false,
      propertyFields: [],
    },
    { sectionId: 'lead-associations', title: 'At a glance', ...side(0) },
  ],
  contacts: [],
  companies: [],
  opportunities: [],
};

/** The centre column is always one section: the timeline plus its compose area. */
function timeline(sectionId: string): LayoutSection {
  return {
    sectionId,
    title: 'Activity',
    position: 'center',
    order: 0,
    collapsed: false,
    propertyFields: [],
  };
}

function side(order: number) {
  return { position: 'right' as const, order, collapsed: false, propertyFields: [] };
}

/**
 * Rule 1. Stored order wins for what it names; anything shipped since is kept.
 *
 * A stored section carrying `hidden` stays hidden - that is the deliberate
 * removal. A DEFAULT section absent from the stored list is appended after the
 * stored ones in its position, because "the admin never saw it" and "the admin
 * removed it" are different facts and only one of them is a reason to hide.
 */
export function mergeLayout(
  stored: LayoutSection[] | null | undefined,
  objectType: RecordObjectType,
): LayoutSection[] {
  const defaults = DEFAULT_LAYOUTS[objectType] ?? [];
  if (!stored || stored.length === 0) return defaults.map((s) => ({ ...s }));

  const byId = new Map(defaults.map((d) => [d.sectionId, d]));
  const seen = new Set<string>();
  const out: LayoutSection[] = [];

  for (const section of stored) {
    if (!section || !section.sectionId) continue;
    seen.add(section.sectionId);
    const fallback = byId.get(section.sectionId);
    out.push({
      ...(fallback ?? {}),
      ...section,
      // A stored section with no fields of its own inherits the shipped ones
      // rather than rendering an empty card.
      propertyFields:
        section.propertyFields && section.propertyFields.length > 0
          ? section.propertyFields
          : (fallback?.propertyFields ?? []),
    });
  }

  // Appended AFTER everything stored in the same position, so a new section
  // never reorders a layout somebody arranged on purpose.
  const maxOrder = new Map<LayoutPosition, number>();
  for (const s of out) {
    maxOrder.set(s.position, Math.max(maxOrder.get(s.position) ?? -1, s.order));
  }
  for (const d of defaults) {
    if (seen.has(d.sectionId)) continue;
    const next = (maxOrder.get(d.position) ?? -1) + 1;
    maxOrder.set(d.position, next);
    out.push({ ...d, order: next });
  }

  return out;
}

export interface ResolvedLayout {
  /** Visible sections per position, already ordered. */
  positions: Record<LayoutPosition, LayoutSection[]>;
  /** Rule 2. Sections the running version has no renderer for. */
  unrenderable: string[];
  /** Rule 3. field names the record does not carry, as "sectionId.field". */
  unknownFields: string[];
}

/**
 * Turn a merged layout into something a page can render, and say what it could
 * not use.
 *
 * `knownSections` is the set of sectionIds the page has a renderer for;
 * `recordFields` the keys the record actually carries. Both are passed in
 * rather than inferred, because the engine must not guess what the page can do.
 */
export function resolveLayout(
  sections: LayoutSection[],
  knownSections: Iterable<string>,
  recordFields: Iterable<string>,
): ResolvedLayout {
  const known = new Set(knownSections);
  const fields = new Set(recordFields);
  const positions: Record<LayoutPosition, LayoutSection[]> = {
    header: [],
    left: [],
    center: [],
    right: [],
  };
  const unrenderable: string[] = [];
  const unknownFields: string[] = [];

  for (const section of sections ?? []) {
    if (section.hidden) continue;
    if (!known.has(section.sectionId)) {
      unrenderable.push(section.sectionId);
      continue;
    }
    const kept: LayoutPropertyField[] = [];
    for (const field of section.propertyFields ?? []) {
      // An empty recordFields set means "do not check" - a page that has not
      // loaded its record yet must not report every field as unknown.
      if (fields.size > 0 && !fields.has(field.field)) {
        unknownFields.push(`${section.sectionId}.${field.field}`);
        continue;
      }
      kept.push(field);
    }
    const bucket = positions[section.position] ?? positions.left;
    bucket.push({ ...section, propertyFields: kept });
  }

  for (const position of LAYOUT_POSITIONS) {
    positions[position].sort((a, b) => a.order - b.order || a.sectionId.localeCompare(b.sectionId));
  }

  return { positions, unrenderable, unknownFields };
}

/** Whether a saved layout is well formed enough to store. */
export function isValidSection(value: unknown): value is LayoutSection {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.sectionId === 'string' &&
    s.sectionId.length > 0 &&
    typeof s.title === 'string' &&
    LAYOUT_POSITIONS.includes(s.position as LayoutPosition) &&
    typeof s.order === 'number' &&
    Array.isArray(s.propertyFields)
  );
}
