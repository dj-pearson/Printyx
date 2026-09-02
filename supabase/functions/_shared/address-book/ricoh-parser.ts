/**
 * Ricoh "Address Book Import Helper" CSV parser (ABK-010).
 * Source PRD: tasks/prd-address-book-manager.md (US-010).
 *
 * The Import Helper schema is a header-keyed CSV. A single row may carry an
 * e-mail address and/or an SMB scan folder; we emit one canonical entry per
 * populated destination:
 *   - "mail address" populated → email entry
 *   - "folder path" / "folder protocol"=SMB populated → smb entry
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

function pick(raw: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const found = Object.keys(raw).find((h) => h.toLowerCase() === k.toLowerCase());
    if (found && raw[found]) return raw[found];
  }
  return '';
}

function num(value: string): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseRicoh(buffer: Uint8Array, _password?: string): ParseResult {
  const { text } = decodeUint8Array(buffer, 'auto');
  const records = parseCsv(text).filter((r) => r.length > 1 || (r[0] ?? '').trim() !== '');
  const errors: ParseRowError[] = [];
  const warnings: string[] = [];
  const entries: CanonicalEntry[] = [];

  if (records.length === 0) {
    return {
      vendor: 'ricoh',
      entries,
      errors,
      password_was_required: false,
      warnings,
      source_model: 'Ricoh',
    };
  }

  const header = records[0];
  const mapRow = rowMapper(header);

  for (let i = 1; i < records.length; i++) {
    const rowNum = i;
    const raw = mapRow(records[i]);
    const name = pick(raw, ['name', 'key display', 'display name']);
    const speed = num(pick(raw, ['index', 'registration no.', 'no.']));
    const email = pick(raw, ['mail address', 'email address', 'e-mail address']);
    const folderPath = pick(raw, ['folder path', 'path']);
    const folderProtocol = pick(raw, ['folder protocol', 'protocol']).toLowerCase();
    let produced = 0;

    if (email) {
      const entry: CanonicalEmailEntry = {
        entry_type: 'email',
        display_name: name || email,
        email,
        speed_dial_index: speed,
        source_metadata: raw,
      };
      entries.push(entry);
      produced++;
    }

    if (folderPath && (!folderProtocol || folderProtocol === 'smb')) {
      const md: Record<string, unknown> = { ...raw };
      const pwd = pick(raw, ['folder password', 'password']);
      if (pwd) md._password = pwd;
      const cleaned = folderPath.replace(/^smb:\/\//i, '').replace(/^\\\\/, '');
      const parts = cleaned.split(/[\\/]+/).filter(Boolean);
      const entry: CanonicalSmbEntry = {
        entry_type: 'smb',
        display_name: name || folderPath,
        smb_full_unc: folderPath,
        smb_host: parts[0] ?? null,
        smb_share_path: parts.length > 1 ? parts.slice(1).join('/') : null,
        smb_username:
          pick(raw, ['folder user name', 'folder login user name', 'user name']) || null,
        credential_id: null,
        speed_dial_index: speed,
        source_metadata: md,
      };
      entries.push(entry);
      produced++;
    } else if (folderPath && folderProtocol && folderProtocol !== 'smb') {
      errors.push({
        row: rowNum,
        reason: `unsupported folder protocol "${folderProtocol}" (v1 supports smb only)`,
        raw,
      });
    }

    if (produced === 0 && !(folderPath && folderProtocol !== 'smb')) {
      errors.push({ row: rowNum, reason: 'row has neither a mail address nor an SMB folder', raw });
    }
  }

  return {
    vendor: 'ricoh',
    entries,
    errors,
    password_was_required: false,
    warnings,
    source_model: 'Ricoh',
  };
}
