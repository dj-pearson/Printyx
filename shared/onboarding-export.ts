/**
 * The CSV an installation checklist exports, over columns that exist.
 *
 * THREE THINGS WERE WRONG WITH WHAT THIS REPLACES (round 133), and the first
 * two are the same defect wearing different content types. `server/
 * routes-export.ts` set `Content-Type: application/pdf` and a `.pdf` filename
 * on a body that was HTML, under its own comment "in production use puppeteer";
 * and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with
 * a `.xlsx` filename on `JSON.stringify(data, null, 2)`. A user clicking
 * "Export as PDF" downloaded a file no reader opens, and "Export as Excel" one
 * Excel refuses. A declared type is not evidence (SEC-SVG-002 records the same
 * rule pointed at an upload); here the server was the one declaring it.
 *
 * THIRD: the CSV named two columns the table does not have. `equipmentType` and
 * `location` are not on `onboarding_equipment` - the real columns are
 * `manufacturer`, `model`, `serial_number`, `asset_tag`, `building_location`,
 * `room_location`, `specific_location`, `mac_address`, `is_replacement` - so
 * both were blank on every row ever exported. tsc could not see it because the
 * generators took `any`, which that file's own header warns about for a
 * different reason.
 *
 * WHAT IS DELIBERATELY ABSENT: there is no xlsx writer in this tree, so the
 * Excel option is gone rather than shipped as JSON under a spreadsheet's name
 * (AUDIT-016: delete a claim with nothing behind it). The PDF goes through the
 * function's own `generate-pdf` branch, which renders a real PDF with pdf-lib
 * and hands back a signed, time-limited link - a second PDF implementation is
 * how the two drift.
 */

export type ChecklistExportRow = Record<string, unknown>;

/** The columns this export emits, in order, each backed by a real column. */
export const ONBOARDING_EXPORT_HEADERS = [
  'Checklist Title',
  'Status',
  'Customer Company',
  'Primary Contact',
  'Installation Type',
  'Scheduled Install Date',
  'Manufacturer',
  'Model',
  'Serial Number',
  'Asset Tag',
  'Building',
  'Room',
  'Specific Location',
  'MAC Address',
  'Is Replacement',
  'Installed',
] as const;

/**
 * Empty for a null, always - never the string "null", never "N/A". An empty
 * cell is an absence and a placeholder is a value somebody will filter on
 * (the rule export-utils already applies on the client).
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** A jsonb blob's field, tolerating either spelling the writers use. */
function fromBlob(blob: unknown, ...keys: string[]): unknown {
  if (!blob || typeof blob !== 'object') return null;
  const record = blob as Record<string, unknown>;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return null;
}

/**
 * One row per equipment item; a checklist with no equipment still exports ONE
 * row carrying its own details, because a checklist raised and not yet filled
 * in is a real state and an empty file reads as a failed export.
 */
export function buildChecklistExportRows(
  checklist: ChecklistExportRow,
  equipment: readonly ChecklistExportRow[],
): string[][] {
  const head = [
    cell(checklist.checklist_title ?? checklist.checklistTitle),
    cell(checklist.status),
    cell(
      fromBlob(checklist.customer_data ?? checklist.customerData, 'companyName', 'company_name'),
    ),
    cell(
      fromBlob(
        checklist.customer_data ?? checklist.customerData,
        'primaryContact',
        'primary_contact',
      ),
    ),
    cell(checklist.installation_type ?? checklist.installationType),
    cell(checklist.scheduled_install_date ?? checklist.scheduledInstallDate),
  ];

  if (equipment.length === 0) {
    return [[...head, '', '', '', '', '', '', '', '', '', '']];
  }

  return equipment.map((item) => [
    ...head,
    cell(item.manufacturer),
    cell(item.model),
    cell(item.serial_number ?? item.serialNumber),
    cell(item.asset_tag ?? item.assetTag),
    cell(item.building_location ?? item.buildingLocation),
    cell(item.room_location ?? item.roomLocation),
    cell(item.specific_location ?? item.specificLocation),
    cell(item.mac_address ?? item.macAddress),
    cell(item.is_replacement ?? item.isReplacement ?? false),
    cell(item.is_installed ?? item.isInstalled ?? false),
  ]);
}
