/**
 * Formats the GDPR export service can actually produce (round 240).
 *
 * `export_format` also allows 'pdf' and 'zip', and formatExportData falls
 * through to plain JSON for both - so a request for a PDF was recorded as a
 * PDF export and handed back JSON. Any other string failed at the enum insert
 * and surfaced as a 500. Only what formatExportData implements is accepted.
 */
export const GDPR_EXPORT_FORMATS = ['json', 'csv', 'xml'] as const;
export type GdprExportFormat = (typeof GDPR_EXPORT_FORMATS)[number];

/** The requested format, 'json' when none was asked for, null when unsupported. */
export function parseExportFormat(raw: unknown): GdprExportFormat | null {
  if (raw === undefined || raw === null || raw === '') return 'json';
  if (typeof raw !== 'string') return null;
  const f = raw.trim().toLowerCase();
  return (GDPR_EXPORT_FORMATS as readonly string[]).includes(f) ? (f as GdprExportFormat) : null;
}
