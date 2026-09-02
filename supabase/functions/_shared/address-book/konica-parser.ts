/**
 * Konica Minolta (PageScope / bizhub) address-book CSV parser (ABK-006).
 * Source PRD: tasks/prd-address-book-manager.md (US-006).
 *
 * PageScope exports a header-keyed CSV. Encoding is frequently Shift-JIS on
 * older bizhub firmware and UTF-8 (with BOM) on i-series; `decodeUint8Array` auto-
 * detects both. A `Type` column discriminates destinations:
 *   Type=E-mail → canonical email entry
 *   Type=SMB    → canonical smb entry
 */
import type {
  CanonicalEntry,
  CanonicalEmailEntry,
  CanonicalSmbEntry,
  ParseResult,
  ParseRowError,
} from './types.ts';
import { decodeUint8Array } from './encoding.ts';
import { parseCsv, rowMapper } from './csv.ts';

function num(value: string): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function buildUnc(host: string, path: string): string {
  const h = host.replace(/^\\\\/, '');
  const p = path.replace(/^[\\/]+/, '');
  return `\\\\${h}\\${p}`;
}

export function parseKonica(buffer: Uint8Array, _password?: string): ParseResult {
  const { text } = decodeUint8Array(buffer, 'auto');
  const records = parseCsv(text).filter((r) => r.length > 1 || (r[0] ?? '').trim() !== '');
  const errors: ParseRowError[] = [];
  const warnings: string[] = [];
  const entries: CanonicalEntry[] = [];

  if (records.length === 0) {
    return {
      vendor: 'konica',
      entries,
      errors,
      password_was_required: false,
      warnings,
      source_model: 'Konica Minolta bizhub',
    };
  }

  const header = records[0];
  const mapRow = rowMapper(header);

  for (let i = 1; i < records.length; i++) {
    const rowNum = i;
    const raw = mapRow(records[i]);
    const type = (raw['Type'] || raw['type'] || '').toLowerCase();
    const name = raw['Name'] || raw['name'] || '';
    const speed = num(raw['Index'] || raw['No.'] || '');

    if (type.includes('mail')) {
      const email = raw['E-mail Address'] || raw['Email Address'] || raw['E-mail'] || '';
      if (!email) {
        errors.push({ row: rowNum, reason: 'e-mail row missing address', raw });
        continue;
      }
      const entry: CanonicalEmailEntry = {
        entry_type: 'email',
        display_name: name || email,
        email,
        speed_dial_index: speed,
        source_metadata: raw,
      };
      entries.push(entry);
    } else if (type.includes('smb')) {
      const host = raw['Host Address'] || raw['Host'] || raw['Server'] || '';
      const path = raw['File Path'] || raw['Path'] || '';
      const md: Record<string, unknown> = { ...raw };
      const pwd = raw['Password'] || '';
      if (pwd) md._password = pwd;
      const entry: CanonicalSmbEntry = {
        entry_type: 'smb',
        display_name: name || host,
        smb_full_unc: host ? buildUnc(host, path) : '',
        smb_host: host || null,
        smb_share_path: path || null,
        smb_username: raw['User ID'] || raw['User Name'] || raw['Login Name'] || null,
        credential_id: null,
        speed_dial_index: speed,
        source_metadata: md,
      };
      entries.push(entry);
    } else if (type) {
      errors.push({ row: rowNum, reason: `unsupported Konica Type "${type}"`, raw });
    } else {
      errors.push({ row: rowNum, reason: 'row missing Type column', raw });
    }
  }

  return {
    vendor: 'konica',
    entries,
    errors,
    password_was_required: false,
    warnings,
    source_model: 'Konica Minolta bizhub',
  };
}
