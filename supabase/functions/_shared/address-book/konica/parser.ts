// Konica Minolta address book CSV parser (ABK-006 / US-006).
//
// Decodes a Konica Minolta bizhub address book CSV (PageScope Data Administrator
// / Web Connection "Import/Export" style) into the vendor-neutral canonical
// shape consumed by the conversion engine.
//
// Scope (v1, matching the PRD): email destinations and SMB scan-to-folder
// destinations. Fax / FTP / WebDAV destinations are reported as row errors so
// nothing is silently dropped — every source column is preserved in
// `source_metadata` for round-trip fidelity.
//
// Encoding: KM exports are commonly Shift-JIS, but i-series firmware can emit
// UTF-8 (with or without BOM). `decodeBuffer` auto-detects: UTF-8 BOM wins,
// otherwise we attempt a strict UTF-8 decode and fall back to Shift-JIS when the
// bytes aren't valid UTF-8 (pure-ASCII content decodes identically either way).
//
// NOTE: KM does not publish a single canonical CSV schema and the column set
// varies by model/firmware/export tool. This parser matches against a tolerant
// set of header aliases (case-insensitive, punctuation-insensitive) rather than
// fixed column positions. See `tests/fixtures/address-book/konica-sample.csv`
// (a representative fixture — TODO: validate against a real PageScope export).

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
 * Decode raw bytes to text, detecting UTF-8 (BOM or valid) vs Shift-JIS.
 * Returns the decoded string with any leading BOM stripped.
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
    // Not valid UTF-8 → assume Shift-JIS (the common KM default). Guard against
    // runtimes lacking the legacy encoding in ICU; fall back to lenient UTF-8.
    try {
      const text = new TextDecoder('shift-jis').decode(bytes);
      return { text, encoding: 'shift-jis' };
    } catch {
      return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8' };
    }
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
  type: ['type', 'registrationtype', 'destinationtype', 'addresstype', 'kind'],
  name: ['name', 'displayname', 'registrationname', 'abbreviation', 'abbr'],
  sortName: ['sortname', 'sortcharacter', 'sort', 'searchkey', 'indexkey'],
  shortName: ['shortname', 'displayshortname', 'onetouch'],
  number: ['no', 'number', 'index', 'registrationno', 'registrationnumber', 'speeddial', 'id'],
  email: ['email', 'emailaddress', 'mailaddress', 'mail', 'address'],
  host: ['host', 'hostaddress', 'hostname', 'serveraddress', 'server', 'smbhost', 'ipaddress'],
  path: ['filepath', 'path', 'folderpath', 'directory', 'sharedfolder', 'sharename', 'share'],
  username: ['userid', 'username', 'user', 'loginname', 'accountname', 'smbuser'],
  password: ['password', 'pass', 'pwd', 'loginpassword'],
};

function findIndex(headerIndex: Map<string, number>, field: string): number {
  for (const alias of FIELD_ALIASES[field] ?? []) {
    const idx = headerIndex.get(alias);
    if (idx !== undefined) return idx;
  }
  return -1;
}

/** Classify a KM "Type" cell into a canonical entry type. */
function classifyType(raw: string): 'email' | 'smb' | 'other' {
  const t = normHeader(raw);
  if (!t) return 'other';
  if (t.includes('email') || t.includes('mail') || t === 'e') return 'email';
  if (t.includes('smb') || t.includes('folder') || t.includes('scantofolder')) return 'smb';
  return 'other';
}

/** Compose a `\\host\share\path` UNC from KM host + path fields. */
function buildUnc(host: string, path: string): string {
  const h = host.replace(/^\\+/, '').replace(/\\+$/, '').trim();
  const p = path
    .replace(/^[\\/]+/, '')
    .replace(/[\\/]+/g, '\\')
    .trim();
  if (!h) return p ? `\\${p}` : '';
  return p ? `\\\\${h}\\${p}` : `\\\\${h}`;
}

function parseSpeedDial(raw: string): number | null {
  if (!raw) return null;
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a Konica Minolta address book CSV into canonical form.
 *
 * @param buffer Raw file bytes (Uint8Array or ArrayBuffer).
 * @param _password Optional source password. KM scan-to-folder passwords are not
 *   typically encrypted in the export (cleartext column or omitted), so v1 does
 *   not use a password to decode; the parameter exists for signature parity with
 *   vendors that do (Canon). SMB passwords are never persisted by this parser.
 */
export function parseKonica(buffer: BufferLike, _password?: string): ParseResult {
  const entries: CanonicalEntry[] = [];
  const errors: ParseRowError[] = [];
  const warnings: string[] = [];

  const { text, encoding } = decodeBuffer(toUint8(buffer));
  warnings.push(`Decoded as ${encoding}`);

  // Drop blank lines and KM comment/metadata lines (some exports prefix '#').
  const allRows = parseCsv(text).filter(
    (r) => r.length > 0 && !(r.length === 1 && r[0].trim() === ''),
  );

  if (allRows.length === 0) {
    return {
      vendor: 'konica',
      entries,
      errors,
      password_was_required: false,
      warnings: ['Empty file — no rows found'],
    };
  }

  // Locate the header row: the first row containing a recognizable "Type" or
  // "Name" + ("Email" | "Host") column. Rows above it are treated as metadata.
  let headerRowIdx = -1;
  let headers: string[] = [];
  let headerIndex = new Map<string, number>();
  for (let r = 0; r < allRows.length; r++) {
    const candidate = allRows[r];
    const idx = buildHeaderIndex(candidate);
    const hasName = findIndex(idx, 'name') >= 0;
    const hasDest = findIndex(idx, 'email') >= 0 || findIndex(idx, 'host') >= 0;
    const hasType = findIndex(idx, 'type') >= 0;
    if (hasName && (hasDest || hasType)) {
      headerRowIdx = r;
      headers = candidate;
      headerIndex = idx;
      break;
    }
  }

  if (headerRowIdx < 0) {
    return {
      vendor: 'konica',
      entries,
      errors,
      password_was_required: false,
      warnings: [
        ...warnings,
        'Could not locate a header row (expected Name + Email/Host/Type columns)',
      ],
    };
  }

  const col = {
    type: findIndex(headerIndex, 'type'),
    name: findIndex(headerIndex, 'name'),
    sortName: findIndex(headerIndex, 'sortName'),
    shortName: findIndex(headerIndex, 'shortName'),
    number: findIndex(headerIndex, 'number'),
    email: findIndex(headerIndex, 'email'),
    host: findIndex(headerIndex, 'host'),
    path: findIndex(headerIndex, 'path'),
    username: findIndex(headerIndex, 'username'),
    password: findIndex(headerIndex, 'password'),
  };

  let passwordSeen = false;

  const cell = (cols: string[], idx: number): string =>
    idx >= 0 && idx < cols.length ? (cols[idx] ?? '').trim() : '';

  for (let r = headerRowIdx + 1; r < allRows.length; r++) {
    const cols = allRows[r];
    const rowNum = r + 1; // 1-based for human-facing errors

    // Preserve every source column keyed by its header label — but NEVER
    // persist a cleartext password. The password column is redacted to '' here;
    // credential handling is the vault layer's job, not the parser's.
    const sourceMetadata: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      sourceMetadata[h] = idx === col.password ? '' : (cols[idx] ?? '');
    });

    const name = cell(cols, col.name);
    const typeRaw = cell(cols, col.type);
    const email = cell(cols, col.email);
    const host = cell(cols, col.host);
    const path = cell(cols, col.path);

    // Decide entry type: explicit Type column wins; otherwise infer from which
    // destination field is populated.
    let kind: 'email' | 'smb' | 'other';
    if (col.type >= 0 && typeRaw) {
      kind = classifyType(typeRaw);
    } else if (email) {
      kind = 'email';
    } else if (host || path) {
      kind = 'smb';
    } else {
      kind = 'other';
    }

    const base = {
      display_name: name,
      sort_name: cell(cols, col.sortName) || null,
      short_name: cell(cols, col.shortName) || null,
      speed_dial_index: parseSpeedDial(cell(cols, col.number)),
      source_metadata: sourceMetadata,
    };

    if (kind === 'email') {
      if (!email) {
        errors.push({
          row: rowNum,
          reason: 'Email destination missing address',
          raw: sourceMetadata,
        });
        continue;
      }
      if (!name) base.display_name = email;
      const entry: CanonicalEmailEntry = { entry_type: 'email', email, ...base };
      entries.push(entry);
      continue;
    }

    if (kind === 'smb') {
      const unc = buildUnc(host, path);
      if (!unc) {
        errors.push({
          row: rowNum,
          reason: 'SMB destination missing both host and path',
          raw: sourceMetadata,
        });
        continue;
      }
      if (cell(cols, col.password)) passwordSeen = true;
      const entry: CanonicalSmbEntry = {
        entry_type: 'smb',
        smb_full_unc: unc,
        smb_host: host || null,
        smb_share_path: path || null,
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

    // Unsupported destination type (fax, FTP, WebDAV, group, …) — report, never
    // silently drop.
    errors.push({
      row: rowNum,
      reason: `Unsupported destination type${typeRaw ? ` '${typeRaw}'` : ''} (v1 supports email + SMB)`,
      raw: sourceMetadata,
    });
  }

  return {
    vendor: 'konica',
    entries,
    errors,
    password_was_required: passwordSeen,
    source_model: null,
    source_subbook_name: null,
    warnings,
  };
}
