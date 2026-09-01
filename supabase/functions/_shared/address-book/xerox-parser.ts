/**
 * Xerox AltaLink / VersaLink address-book CSV parser (ABK-008).
 * Source PRD: tasks/prd-address-book-manager.md (US-008).
 *
 * The Embedded Web Server (EWS) export is a header-keyed CSV where a single
 * row can carry an e-mail destination and/or an SMB scan destination. We emit
 * one canonical entry per populated destination type:
 *   - "Email Address" populated → email entry
 *   - "(SMB) Server" / scan columns populated → smb entry
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
    if (raw[k]) return raw[k];
  }
  return '';
}

function buildUnc(host: string, share: string, path: string): string {
  const segments = [share, path]
    .filter(Boolean)
    .join('/')
    .replace(/^[\\/]+/, '');
  return `\\\\${host.replace(/^\\\\/, '')}\\${segments}`;
}

export function parseXerox(buffer: Uint8Array, _password?: string): ParseResult {
  const { text } = decodeUint8Array(buffer, 'auto');
  const records = parseCsv(text).filter((r) => r.length > 1 || (r[0] ?? '').trim() !== '');
  const errors: ParseRowError[] = [];
  const warnings: string[] = [];
  const entries: CanonicalEntry[] = [];

  if (records.length === 0) {
    return {
      vendor: 'xerox',
      entries,
      errors,
      password_was_required: false,
      warnings,
      source_model: 'Xerox AltaLink/VersaLink',
    };
  }

  const header = records[0];
  const mapRow = rowMapper(header);

  for (let i = 1; i < records.length; i++) {
    const rowNum = i;
    const raw = mapRow(records[i]);
    const name = pick(raw, ['Display Name', 'Name', 'Friendly Name']);
    const email = pick(raw, ['Email Address', 'E-mail Address', 'Email']);
    const smbServer = pick(raw, ['(SMB) Server', 'SMB Server', 'Server', 'Host']);
    let produced = 0;

    if (email) {
      const entry: CanonicalEmailEntry = {
        entry_type: 'email',
        display_name: name || email,
        email,
        source_metadata: raw,
      };
      entries.push(entry);
      produced++;
    }

    if (smbServer) {
      const share = pick(raw, ['(SMB) Share', 'SMB Share', 'Share']);
      const path = pick(raw, ['(SMB) Document Path', '(SMB) Path', 'Document Path', 'Path']);
      const md: Record<string, unknown> = { ...raw };
      const pwd = pick(raw, ['(SMB) Password', 'SMB Password', 'Password']);
      if (pwd) md._password = pwd;
      const entry: CanonicalSmbEntry = {
        entry_type: 'smb',
        display_name: name || smbServer,
        smb_full_unc: buildUnc(smbServer, share, path),
        smb_host: smbServer,
        smb_share_path: [share, path].filter(Boolean).join('/') || null,
        smb_username:
          pick(raw, ['(SMB) Login Name', 'SMB Login Name', 'Login Name', 'User Name']) || null,
        credential_id: null,
        source_metadata: md,
      };
      entries.push(entry);
      produced++;
    }

    if (produced === 0) {
      errors.push({ row: rowNum, reason: 'row has neither an email nor an SMB destination', raw });
    }
  }

  return {
    vendor: 'xerox',
    entries,
    errors,
    password_was_required: false,
    warnings,
    source_model: 'Xerox AltaLink/VersaLink',
  };
}
