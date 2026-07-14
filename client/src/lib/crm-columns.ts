/**
 * CRMX-012: customizable list columns.
 *
 * Pure helpers for resolving, ordering, and mutating the per-view column
 * configuration that persists into saved_views.columnConfig. Shared by the
 * CRM table view (CrmDataTable) and the column picker so the two never drift.
 */
import type { CrmFieldDef } from './crm-object-registry';
import type { CustomFieldDefinition } from '@/hooks/useCustomFields';

/** One column's persisted state — matches the saved_views.columnConfig jsonb shape. */
export interface ColumnConfigEntry {
  field: string;
  label: string;
  visible: boolean;
  width?: number;
  order: number;
}

/** A column available to the table — a registry field or a custom field. */
export interface TableFieldDef {
  field: string;
  label: string;
  type?: CrmFieldDef['type'];
  sortable?: boolean;
  width?: string;
  /** Set for custom fields — read the value from record.customFields[customKey]. */
  customKey?: string;
}

function mapCustomFieldType(fieldType: CustomFieldDefinition['fieldType']): CrmFieldDef['type'] {
  switch (fieldType) {
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    case 'email':
      return 'email';
    case 'boolean':
    case 'select':
    case 'multiselect':
      return 'badge';
    default:
      return 'text';
  }
}

/** Convert active custom field definitions into table columns (prefixed cf_). */
export function customFieldsToTableFields(defs: CustomFieldDefinition[]): TableFieldDef[] {
  return defs
    .filter((d) => d.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((d) => ({
      field: `cf_${d.key}`,
      label: d.label,
      type: mapCustomFieldType(d.fieldType),
      sortable: false,
      customKey: d.key,
    }));
}

/** The full catalog of columns available for an object: registry + custom. */
export function buildColumnCatalog(
  registryFields: CrmFieldDef[],
  customDefs: CustomFieldDefinition[],
): TableFieldDef[] {
  return [
    ...registryFields.map((f) => ({
      field: f.field,
      label: f.label,
      type: f.type,
      sortable: f.sortable,
      width: f.width,
    })),
    ...customFieldsToTableFields(customDefs),
  ];
}

/**
 * The columns to actually render, in order. Uses the saved columnConfig when
 * present (visible + order); otherwise falls back to the object's default
 * columns. Columns that no longer exist in the catalog are dropped.
 */
export function resolveVisibleColumns(
  catalog: TableFieldDef[],
  columnConfig: ColumnConfigEntry[] | null | undefined,
  defaultColumns: string[],
): TableFieldDef[] {
  if (columnConfig && columnConfig.length > 0) {
    return columnConfig
      .filter((c) => c.visible)
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((c) => catalog.find((f) => f.field === c.field))
      .filter((f): f is TableFieldDef => Boolean(f));
  }
  return defaultColumns
    .map((field) => catalog.find((f) => f.field === field))
    .filter((f): f is TableFieldDef => Boolean(f));
}

/**
 * A complete, ordered working set covering EVERY catalog column (for the picker).
 * Seeds visibility/order from the saved config; when there is none, defaults to
 * the object's default columns (visible, in default order) then the rest.
 */
export function buildWorkingColumnConfig(
  catalog: TableFieldDef[],
  saved: ColumnConfigEntry[] | null | undefined,
  defaultColumns: string[],
): ColumnConfigEntry[] {
  if (saved && saved.length > 0) {
    const savedFields = new Set(saved.map((c) => c.field));
    const inSaved = saved
      .filter((c) => catalog.some((f) => f.field === c.field))
      .slice()
      .sort((a, b) => a.order - b.order);
    const missing = catalog.filter((f) => !savedFields.has(f.field));
    const merged: ColumnConfigEntry[] = [
      ...inSaved,
      ...missing.map((f) => ({ field: f.field, label: f.label, visible: false, order: 0 })),
    ];
    return merged.map((c, i) => ({
      ...c,
      order: i,
      label: catalog.find((f) => f.field === c.field)?.label ?? c.label,
    }));
  }

  const sorted = [...catalog].sort((a, b) => {
    const ai = defaultColumns.indexOf(a.field);
    const bi = defaultColumns.indexOf(b.field);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return 0;
  });
  return sorted.map((f, i) => ({
    field: f.field,
    label: f.label,
    visible: defaultColumns.includes(f.field),
    order: i,
  }));
}

/** Toggle a column's visibility, returning a new re-indexed config. */
export function toggleColumnVisible(
  working: ColumnConfigEntry[],
  field: string,
): ColumnConfigEntry[] {
  return working.map((c) => (c.field === field ? { ...c, visible: !c.visible } : c));
}

/** Move a column up (-1) or down (+1) in order, returning a new re-indexed config. */
export function moveColumn(
  working: ColumnConfigEntry[],
  field: string,
  direction: -1 | 1,
): ColumnConfigEntry[] {
  const idx = working.findIndex((c) => c.field === field);
  if (idx === -1) return working;
  const target = idx + direction;
  if (target < 0 || target >= working.length) return working;
  const next = [...working];
  const [moved] = next.splice(idx, 1);
  next.splice(target, 0, moved);
  return next.map((c, i) => ({ ...c, order: i }));
}
