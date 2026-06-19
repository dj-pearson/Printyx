// Xerox address book CSV parser (ABK-008 / US-008).
//
// Decodes a Xerox AltaLink / VersaLink address book CSV exported from the
// Embedded Web Server (EWS) into the vendor-neutral canonical shape consumed by
// the conversion engine.
//
// Scope (v1, matching the PRD): email destinations and scan-to-folder (SMB)
// destinations. Fax / internet-fax / FTP destinations are reported as row errors
// so nothing is silently dropped — every source column is preserved in
// `source_metadata` for round-trip fidelity.
//
// Xerox quirk vs Konica: Xerox separates destinations by TYPE (the EWS "Email"
// tab and the "Scan To" tab export as distinct files with DIFFERENT column sets,
// and there is usually no single "Type" column). This parser therefore supports
// MULTI-FILE input: when several Xerox CSVs are concatenated into one buffer (or
// one export contains multiple header rows), every header row starts a new
// section and the rows beneath it are decoded against that section's columns.
// Xerox marker lines (`XrxAddressBookImportFormat:N`) are treated as metadata.
//
// Encoding: Xerox EWS exports are UTF-8 (often with a BOM). `decodeBuffer`
// auto-detects UTF-8 (BOM or valid) and falls back to a lenient decode so an
// occasional legacy export never aborts the whole file.
//
// NOTE: Xerox publishes no single canonical CSV schema and the column set varies
// by model/firmware. This parser matches a tolerant set of header aliases
// (case-insensitive, punctuation-insensitive) rather than fixed positions. See
// `tests/fixtures/address-book/xerox-sample.csv` (a representative fixture —
// TODO: validate against a real AltaLink/VersaLink EWS export).

import type {
  CanonicalEntry,
  CanonicalEmailEntry,
  CanonicalSmbEntry,
  ParseResult,
  ParseRowError,
} from '../types.ts';

/** Input accepted from edge functions (Deno) and Node test harnesses alike. */
type BufferLike = Uint8Array | ArrayBuffer;

function toUint8(buffer: BufferLike): Uint8Array {
  return buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
}

/**
 * Decode raw bytes to text, detecting UTF-8 (BOM or valid). Xerox exports are
 * UTF-8; we still guard against a malformed file by falling back to a lenient
 * decode rather than throwing. Returns the text with any leading BOM stripped.
 */
export function decodeBuffer(bytes: Uint8Array): { text: string; encoding: string } {
  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8' };
  }
  // Strict UTF-8 attempt — succeeds for ASCII and well-formed UTF-8.
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text, encoding: 'utf-8' };
  } catch {
    // Not valid UTF-8 — lenient decode so a stray byte never aborts the file.
    return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8' };
  }
}

/**
 * Minimal RFC-4180 CSV parser: handles quoted fields, escaped quotes (""),
 * embedded commas/newlines, and CRLF or LF line endings. Returns rows of cells.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      endField();
      i++;
      continue;
    }
    if (c === '\r') {
      // swallow CRLF as a single line break
      if (text[i + 1] === '\n') i++;
      endRow();
      i++;
      continue;
    }
    if (c === '\n') {
      endRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // flush trailing field/row (file without trailing newline)
  if (field.length > 0 || row.length > 0) endRow();
  return rows;
}

/** Normalize a header label for tolerant matching: lowercase, strip non-alnum. */
function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Build a lookup from a normalized header alias → column index. */
function buildHeaderIndex(headers: string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, idx) => {
    const key = normHeader(h);
    if (key && !map.has(key)) map.set(key, idx);
  });
  return map;
}

// Header aliases (normalized) we recognize, grouped by canonical field.
const FIELD_ALIASES: Record<string, string[]> = {
  name: ['displayname', 'name', 'friendlyname', 'addressbookname', 'nickname'],
  firstName: ['firstname', 'givenname'],
  lastName: ['lastname', 'surname', 'familyname'],
  sortName: ['sortname', 'sortcharacter', 'searchname', 'index'],
  email: ['emailaddress', 'email', 'email1address', 'emailaddress1', 'mailaddress', 'mail'],
  unc: ['smbunc', 'unc', 'fullunc', 'networkpath'],
  host: [
    'servername',
    'server',
    'smbservername',
    'host',
    'hostaddress',
    'hostname',
    'ipaddress',
    'serveraddress',
  ],
  share: ['sharename', 'share', 'smbsharename', 'sharedname'],
  path: [
    'documentpath',
    'smbdocumentpath',
    'path',
    'filepath',
    'folderpath',
    'directorypath',
    'directory',
    'savelocation',
  ],
  username: ['loginname', 'smbloginname', 'username', 'userid', 'user', 'accountname'],
  password: ['password', 'smbpassword', 'pass', 'pwd', 'loginpassword'],
  fax: ['faxnumber', 'fax', 'faxno', 'g3faxnumber', 'internetfaxaddress'],
};

function findIndex(headerIndex: Map<string, number>, field: string): number {
  for (const alias of FIELD_ALIASES[field] ?? []) {
    const idx = headerIndex.get(alias);
    if (idx !== undefined) return idx;
  }
  return -1;
}

/**
 * A row is a header row when it carries a name/display-name column AND at least
 * one destination column (email, server/host, share, path, or UNC). Data rows
 * never literally contain those header labels, so this cleanly separates
 * concatenated Xerox sections.
 */
function isHeaderRow(row: string[]): boolean {
  const idx = buildHeaderIndex(row);
  const hasName = findIndex(idx, 'name') >= 0 || findIndex(idx, 'firstName') >= 0;
  const hasDest =
    findIndex(idx, 'email') >= 0 ||
    findIndex(idx, 'host') >= 0 ||
    findIndex(idx, 'share') >= 0 ||
    findIndex(idx, 'path') >= 0 ||
    findIndex(idx, 'unc') >= 0;
  return hasName && hasDest;
}

/** True for Xerox metadata marker lines (`XrxAddressBookImportFormat:1`, …). */
function isMarkerRow(row: string[]): boolean {
  if (row.length === 0) return false;
  const first = (row[0] ?? '').trim().toLowerCase();
  return first.startsWith('xrxaddressbook') || first.startsWith('xrxapi');
}

/** Compose a `\\host\share\path` UNC from Xerox server + share + path fields. */
function buildUnc(host: string, share: string, path: string): string {
  const h = host.replace(/^\\+/, '').replace(/\\+$/, '').trim();
  const segments = [share, path]
    .map((s) =>
      s
        .replace(/^[\\/]+/, '')
        .replace(/[\\/]+$/, '')
        .replace(/[\\/]+/g, '\\')
        .trim(),
    )
    .filter((s) => s.length > 0);
  const p = segments.join('\\');
  if (!h) return p ? `\\${p}` : '';
  return p ? `\\\\${h}\\${p}` : `\\\\${h}`;
}

function parseSpeedDial(raw: string): number | null {
  if (!raw) return null;
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function composeDisplayName(name: string, first: string, last: string): string {
  if (name) return name;
  const full = [first, last]
    .filter((s) => s)
    .join(' ')
    .trim();
  return full;
}

/**
 * Parse a Xerox AltaLink / VersaLink address book CSV into canonical form.
 *
 * Accepts a single export or several concatenated exports (email + scan tabs)
 * in one buffer; each header row starts a new section.
 *
 * @param buffer Raw file bytes (Uint8Array or ArrayBuffer).
 * @param _password Optional source password. Xerox scan-to-folder passwords are
 *   not recoverable from the export (the EWS exports them blank/masked), so v1
 *   does not use a password to decode; the parameter exists for signature parity
 *   with vendors that do (Canon). SMB passwords are never persisted here.
 */
export function parseXerox(buffer: BufferLike, _password?: string): ParseResult {
  const entries: CanonicalEntry[] = [];
  const errors: ParseRowError[] = [];
  const warnings: string[] = [];

  const { text, encoding } = decodeBuffer(toUint8(buffer));
  warnings.push(`Decoded as ${encoding}`);

  // Drop blank lines and Xerox marker/metadata lines.
  const allRows = parseCsv(text).filter(
    (r) => r.length > 0 && !(r.length === 1 && r[0].trim() === '') && !isMarkerRow(r),
  );

  if (allRows.length === 0) {
    return {
      vendor: 'xerox',
      entries,
      errors,
      password_was_required: false,
      warnings: ['Empty file — no rows found'],
    };
  }

  // Walk the rows, switching the active header/column map every time a new
  // header row appears (supports concatenated email + scan exports).
  let headers: string[] = [];
  let col: Record<string, number> | null = null;
  let passwordSeen = false;
  let sawAnyHeader = false;

  const cell = (cols: string[], idx: number): string =>
    idx >= 0 && idx < cols.length ? (cols[idx] ?? '').trim() : '';

  for (let r = 0; r < allRows.length; r++) {
    const cols = allRows[r];
    const rowNum = r + 1; // 1-based for human-facing errors

    if (isHeaderRow(cols)) {
      headers = cols;
      const headerIndex = buildHeaderIndex(cols);
      col = {
        name: findIndex(headerIndex, 'name'),
        firstName: findIndex(headerIndex, 'firstName'),
        lastName: findIndex(headerIndex, 'lastName'),
        sortName: findIndex(headerIndex, 'sortName'),
        email: findIndex(headerIndex, 'email'),
        unc: findIndex(headerIndex, 'unc'),
        host: findIndex(headerIndex, 'host'),
        share: findIndex(headerIndex, 'share'),
        path: findIndex(headerIndex, 'path'),
        username: findIndex(headerIndex, 'username'),
        password: findIndex(headerIndex, 'password'),
        fax: findIndex(headerIndex, 'fax'),
      };
      sawAnyHeader = true;
      continue;
    }

    if (!col) {
      // Rows before the first header are pre-header metadata — skip silently.
      continue;
    }

    // Preserve every source column keyed by its header label — but NEVER persist
    // a cleartext password (redacted to ''). Credential handling is the vault
    // layer's job, not the parser's.
    const sourceMetadata: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      sourceMetadata[h] = idx === col!.password ? '' : (cols[idx] ?? '');
    });

    const name = composeDisplayName(
      cell(cols, col.name),
      cell(cols, col.firstName),
      cell(cols, col.lastName),
    );
    const email = cell(cols, col.email);
    const uncRaw = cell(cols, col.unc);
    const host = cell(cols, col.host);
    const share = cell(cols, col.share);
    const path = cell(cols, col.path);
    const fax = cell(cols, col.fax);

    // Infer destination type from populated fields (Xerox has no Type column).
    let kind: 'email' | 'smb' | 'other';
    if (email) {
      kind = 'email';
    } else if (uncRaw || host || share || path) {
      kind = 'smb';
    } else if (fax) {
      kind = 'other';
    } else {
      kind = 'other';
    }

    const base = {
      display_name: name,
      sort_name: cell(cols, col.sortName) || null,
      short_name: null,
      speed_dial_index: parseSpeedDial(cell(cols, col.sortName)),
      source_metadata: sourceMetadata,
    };

    if (kind === 'email') {
      if (!name) base.display_name = email;
      const entry: CanonicalEmailEntry = { entry_type: 'email', email, ...base };
      entries.push(entry);
      continue;
    }

    if (kind === 'smb') {
      const unc = uncRaw || buildUnc(host, share, path);
      if (!unc) {
        errors.push({
          row: rowNum,
          reason: 'SMB destination missing server, share, and path',
          raw: sourceMetadata,
        });
        continue;
      }
      if (cell(cols, col.password)) passwordSeen = true;
      const sharePath = [share, path].filter((s) => s).join('\\') || null;
      const entry: CanonicalSmbEntry = {
        entry_type: 'smb',
        smb_full_unc: unc,
        smb_host: host || null,
        smb_share_path: sharePath,
        smb_username: cell(cols, col.username) || null,
        // SMB passwords are never persisted by the parser; credential handling
        // happens in the credential vault layer, not here.
        credential_id: null,
        ...base,
      };
      if (!name) entry.display_name = unc;
      entries.push(entry);
      continue;
    }

    // Unsupported destination type (fax, internet-fax, FTP, …) or a row with no
    // recognizable destination — report, never silently drop.
    errors.push({
      row: rowNum,
      reason: fax
        ? 'Unsupported destination type Fax (v1 supports email + SMB)'
        : 'Row has no recognizable email or SMB destination',
      raw: sourceMetadata,
    });
  }

  if (!sawAnyHeader) {
    warnings.push('Could not locate a header row (expected Display Name + Email/Server columns)');
  }

  return {
    vendor: 'xerox',
    entries,
    errors,
    password_was_required: passwordSeen,
    source_model: null,
    source_subbook_name: null,
    warnings,
  };
}
