/**
 * Canon imageRUNNER `abook.csv` parser (ABK-004).
 * Source PRD: tasks/prd-address-book-manager.md (US-004).
 *
 * Format shape:
 *   - Leading comment lines begin with `#`, e.g.
 *       # Canon AddressBook CSV version: 0x0207
 *       # CharSet: UTF-8
 *       # Crypto Version: 2
 *       # Crypto Attribute: pwd
 *       # SubAddressBookName: Main
 *   - A CSV header row of column names (Canon exports ~49 columns).
 *   - One data row per entry; `objectclass` discriminates the entry type:
 *       objectclass=email           → canonical email entry
 *       objectclass=remotefilesystem (protocol=smb) → canonical smb entry
 *       objectclass=group           → canonical group entry
 *
 * Every source column is preserved in `source_metadata` for round-trip
 * fidelity. When `# Crypto Attribute: pwd` is present and a password is
 * supplied, the `pwd` column is decrypted; on failure the entry is still
 * emitted (credential unset) and a per-row error is recorded.
 */
import type {
  CanonicalEntry,
  CanonicalEmailEntry,
  CanonicalGroupEntry,
  CanonicalSmbEntry,
  ParseResult,
  ParseRowError,
} from '../../../../../shared/address-book-types';
import { decodeBuffer } from '../_shared/encoding';
import { parseCsv, rowMapper } from '../_shared/csv';
import { CanonCryptoError, decryptCanonPwd } from './crypto';

const COMMENT_PREFIX = '#';

interface CanonHeaderMeta {
  version?: string;
  charset?: string;
  cryptoVersion?: string;
  cryptoAttribute?: string;
  subBookName?: string;
}

function parseHeaderComment(line: string, meta: CanonHeaderMeta): void {
  const body = line.replace(/^#\s*/, '');
  const idx = body.indexOf(':');
  if (idx === -1) return;
  const key = body.slice(0, idx).trim().toLowerCase();
  const value = body.slice(idx + 1).trim();
  if (key.includes('version') && key.includes('canon')) meta.version = value;
  else if (key === 'charset') meta.charset = value;
  else if (key === 'crypto version') meta.cryptoVersion = value;
  else if (key === 'crypto attribute') meta.cryptoAttribute = value;
  else if (key === 'subaddressbookname') meta.subBookName = value;
}

function splitUnc(url: string): { host: string | null; share: string | null } {
  // \\HOST\share\path  or  smb://host/share/path
  const cleaned = url.replace(/^smb:\/\//i, '').replace(/^\\\\/, '');
  const parts = cleaned.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return { host: null, share: null };
  const host = parts[0] ?? null;
  const share = parts.length > 1 ? parts.slice(1).join('/') : null;
  return { host, share };
}

export function parseCanon(buffer: Buffer, password?: string): ParseResult {
  const { text } = decodeBuffer(buffer, 'auto');
  const lines = text.split(/\r\n|\r|\n/);

  const meta: CanonHeaderMeta = {};
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(COMMENT_PREFIX)) {
      parseHeaderComment(line, meta);
    } else if (line.trim().length > 0) {
      dataLines.push(line);
    }
  }

  const errors: ParseRowError[] = [];
  const warnings: string[] = [];
  const entries: CanonicalEntry[] = [];
  const pwdEncrypted =
    (meta.cryptoAttribute ?? '').toLowerCase().includes('pwd') &&
    (meta.cryptoVersion ?? '').length > 0;

  if (dataLines.length === 0) {
    return {
      vendor: 'canon',
      entries,
      errors,
      password_was_required: pwdEncrypted,
      source_subbook_name: meta.subBookName ?? null,
      source_model: meta.version ? `Canon (${meta.version})` : 'Canon',
      warnings,
    };
  }

  const records = parseCsv(dataLines.join('\n'));
  const header = records[0];
  const mapRow = rowMapper(header);

  for (let i = 1; i < records.length; i++) {
    const rowNum = i; // 1-based data row
    const raw = mapRow(records[i]);
    const objectclass = (raw.objectclass ?? raw.objectClass ?? '').toLowerCase();
    const displayName = raw.cn || raw.name || raw.displayname || '';
    const speedDial = raw.indxid ? Number.parseInt(raw.indxid, 10) : undefined;

    try {
      if (objectclass === 'email') {
        const email = raw.mailaddress || raw.mail || '';
        if (!email) {
          errors.push({ row: rowNum, reason: 'email row missing mailaddress', raw });
          continue;
        }
        const entry: CanonicalEmailEntry = {
          entry_type: 'email',
          display_name: displayName || email,
          email,
          speed_dial_index: Number.isFinite(speedDial) ? speedDial! : null,
          source_uuid: raw.uuid || raw.objectUUID || null,
          source_metadata: raw,
        };
        entries.push(entry);
      } else if (objectclass === 'remotefilesystem') {
        const protocol = (raw.protocol || '').toLowerCase();
        if (protocol && protocol !== 'smb') {
          errors.push({
            row: rowNum,
            reason: `unsupported remotefilesystem protocol "${protocol}" (v1 supports smb only)`,
            raw,
          });
          continue;
        }
        const url = raw.url || '';
        const { host, share } = splitUnc(url);
        const md: Record<string, unknown> = { ...raw };
        const entry: CanonicalSmbEntry = {
          entry_type: 'smb',
          display_name: displayName || host || url,
          smb_full_unc: url,
          smb_host: host,
          smb_share_path: raw.path || share,
          smb_username: raw.username || null,
          credential_id: null,
          speed_dial_index: Number.isFinite(speedDial) ? speedDial! : null,
          source_uuid: raw.uuid || null,
          source_metadata: md,
        };
        if (raw.pwd) {
          if (pwdEncrypted && password) {
            try {
              md._password = decryptCanonPwd(raw.pwd, password);
            } catch (err) {
              const reason =
                err instanceof CanonCryptoError ? err.message : 'pwd decryption failed';
              errors.push({ row: rowNum, reason, raw });
            }
          } else if (pwdEncrypted && !password) {
            warnings.push(`row ${rowNum}: encrypted pwd present but no password supplied`);
          } else {
            // plaintext pwd in an unencrypted export
            md._password = raw.pwd;
          }
        }
        entries.push(entry);
      } else if (objectclass === 'group') {
        const members = (raw.members || raw.memberlist || '')
          .split(/[;,]/)
          .map((m) => m.trim())
          .filter(Boolean);
        const entry: CanonicalGroupEntry = {
          entry_type: 'group',
          display_name: displayName,
          member_entry_ids: members,
          source_uuid: raw.uuid || null,
          source_metadata: raw,
        };
        entries.push(entry);
      } else if (objectclass) {
        errors.push({ row: rowNum, reason: `unsupported objectclass "${objectclass}"`, raw });
      } else {
        errors.push({ row: rowNum, reason: 'row missing objectclass', raw });
      }
    } catch (err) {
      errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : 'unknown parse error',
        raw,
      });
    }
  }

  return {
    vendor: 'canon',
    entries,
    errors,
    password_was_required: pwdEncrypted,
    source_subbook_name: meta.subBookName ?? null,
    source_model: meta.version ? `Canon (${meta.version})` : 'Canon',
    warnings,
  };
}
