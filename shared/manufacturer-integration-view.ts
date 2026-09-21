/**
 * What a manufacturer integration row is allowed to look like on its way out,
 * and what a connect request is allowed to write.
 *
 * A REDACTION LIST OF COLUMNS THAT DO NOT EXIST REDACTS NOTHING (round 125).
 * SEC-EDGE-001 round 74 added a redactor to the manufacturer-integrations edge
 * function naming seven columns - api_key, api_secret, client_id,
 * client_secret, access_token, refresh_token, webhook_secret - and
 * `manufacturer_integrations` has never had one of them. `column in view` was
 * false every time, so the function deleted nothing, added no `*_set` marker,
 * and returned the row exactly as it had before. The dealer's HP, Canon and
 * Xerox keys live one level down, inside the NOT NULL `credentials` jsonb that
 * `_shared/manufacturer-adapters.ts` reads as `.apiKey`, `.clientSecret`,
 * `.accessToken`, `.username` and `.password` - so every authenticated member
 * of the tenant could still read every credential, on BOTH hosts, because
 * Express returns the raw Drizzle row too.
 *
 * The seven names were not invented. The `POST /:manufacturer/connect` branch
 * upserts exactly those seven columns, so the redactor was copied from a write
 * that had been a guaranteed PGRST204 since the day it shipped. A phantom
 * write taught a security control which columns to hide.
 *
 * FOUR RULES, and the first is the one that would have prevented it.
 *
 * 1. AN ALLOW-LIST OF WHAT LEAVES, NOT A DENY-LIST OF WHAT IS HIDDEN. A deny
 *    list is only as good as its author's memory of the schema, and it fails
 *    OPEN - a column it forgets is a column it publishes. This module names
 *    the fields a caller receives; anything else on the row, today or after
 *    the next migration, does not leave.
 *
 * 2. A KEY NAME IS NOT A SECRET, A KEY VALUE IS. A settings page has to show
 *    which credentials are configured, so the view carries `credentialKeys`
 *    (sorted names) and `credentialsSet`, and never a value.
 *
 * 3. ONE VIEW FOR BOTH HOSTS. The leak was on Express and on the edge
 *    function, and round 74 closed it on neither while appearing to close it
 *    on one. A redactor that exists in a single tree is a fix whose absence
 *    is invisible from the other.
 *
 * 4. THE INTERNAL READ KEEPS THE RAW ROW. The adapter needs the real key to
 *    call the manufacturer. What changes is what leaves the function, which is
 *    the same distinction `_shared/webhook-view.ts` encodes one table over.
 *
 * It also camelises, because that was broken in the same place: the page's
 * own interface reads `integrationName`, `authMethod`, `apiEndpoint`,
 * `collectionFrequency`, `lastSync`, `nextSync` and `isActive`, the edge
 * function answered raw snake_case, and Express answered camelCase - so the
 * production list rendered a row of blanks and dev did not.
 */

/** camelCase field -> the column it comes from. This is the whole public row. */
export const MANUFACTURER_INTEGRATION_VIEW_FIELDS: Record<string, string> = {
  id: 'id',
  tenantId: 'tenant_id',
  manufacturer: 'manufacturer',
  integrationName: 'integration_name',
  status: 'status',
  authMethod: 'auth_method',
  apiEndpoint: 'api_endpoint',
  collectionFrequency: 'collection_frequency',
  lastSync: 'last_sync',
  nextSync: 'next_sync',
  configuration: 'configuration',
  isActive: 'is_active',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

/**
 * Columns that never appear in a view under any name.
 *
 * `configuration` is NOT here and that is a decision rather than an omission:
 * it defaults to `{}`, no adapter reads a secret out of it, and a settings
 * page needs it. If anything ever stores a credential there, it belongs in
 * `credentials` instead of being published from here.
 */
export const REDACTED_COLUMNS = ['credentials'] as const;

export const AUTH_METHODS = ['api_key', 'oauth2', 'basic_auth', 'certificate', 'hmac'] as const;

export const MANUFACTURERS = [
  'canon',
  'xerox',
  'hp',
  'konica_minolta',
  'lexmark',
  'fmaudit',
  'printanista',
] as const;

export type ManufacturerIntegrationView = Record<string, unknown> & {
  credentialKeys: string[];
  credentialsSet: boolean;
};

type Row = Record<string, unknown> | null | undefined;

/** Read a field under either spelling: PostgREST gives snake, Drizzle camel. */
function pick(row: Record<string, unknown>, field: string, column: string): unknown {
  if (column in row) return row[column];
  if (field in row) return row[field];
  return undefined;
}

/**
 * The row a caller is allowed to see.
 *
 * Returns null for a null row so a caller can answer 404 rather than serving
 * an object of undefineds, which is the shape that made the empty production
 * list read as "no integrations configured".
 */
export function toManufacturerIntegrationView(row: Row): ManufacturerIntegrationView | null {
  if (!row || typeof row !== 'object') return null;

  const view: Record<string, unknown> = {};
  for (const [field, column] of Object.entries(MANUFACTURER_INTEGRATION_VIEW_FIELDS)) {
    const value = pick(row, field, column);
    if (value !== undefined) view[field] = value;
  }

  // Rule 2. The keys say what is configured; the values never leave.
  const raw = pick(row, 'credentials', 'credentials');
  const keys =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? Object.keys(raw as Record<string, unknown>)
          .filter(
            (k) =>
              (raw as Record<string, unknown>)[k] !== null &&
              (raw as Record<string, unknown>)[k] !== '',
          )
          .sort()
      : [];

  return { ...view, credentialKeys: keys, credentialsSet: keys.length > 0 };
}

export function toManufacturerIntegrationViews(rows: unknown): ManufacturerIntegrationView[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => toManufacturerIntegrationView(r as Row))
    .filter((v): v is ManufacturerIntegrationView => v !== null);
}

/** Credential keys the adapters read, in the spellings they read them under. */
const CREDENTIAL_FIELDS: Record<string, string[]> = {
  apiKey: ['apiKey', 'api_key'],
  apiSecret: ['apiSecret', 'api_secret'],
  clientId: ['clientId', 'client_id'],
  clientSecret: ['clientSecret', 'client_secret'],
  accessToken: ['accessToken', 'access_token'],
  refreshToken: ['refreshToken', 'refresh_token'],
  tokenExpiresAt: ['tokenExpiresAt', 'token_expires_at'],
  username: ['username'],
  password: ['password'],
};

/** Body fields the connect request accepts that no column and no adapter reads. */
export const CONNECT_FIELDS_WITHOUT_COLUMNS = ['connectedAt', 'connectedBy', 'dealerId'] as const;

export type ConnectPlan = {
  row: Record<string, unknown>;
  ignoredFields: string[];
  error?: string;
};

/**
 * Build the row a connect request writes.
 *
 * NOTHING IS INVENTED TO SATISFY A NOT NULL (COP-B00). `credentials` and
 * `auth_method` are both NOT NULL with no default, and a request carrying no
 * recognisable credential is REFUSED rather than given an empty blob and a
 * guessed method - an integration row whose credentials are `{}` is one the
 * sync job will keep trying and failing with, reported as an auth error at the
 * manufacturer rather than as a setup that never happened.
 *
 * `integration_name` is NOT NULL too and falls back to the manufacturer name,
 * which is a label rather than a fact about the dealer's account.
 *
 * WHAT IT CANNOT STORE IS NAMED, NOT DROPPED (COP-B06): connectedAt,
 * connectedBy and dealerId are fields the old phantom upsert accepted and no
 * column holds.
 */
export function buildManufacturerConnect(
  manufacturer: string,
  body: Record<string, unknown>,
  tenantId: string,
): ConnectPlan {
  const empty: Record<string, unknown> = {};

  if (!(MANUFACTURERS as readonly string[]).includes(manufacturer)) {
    // `manufacturer` is a pgEnum, so an unrecognised value is 22P02 - a 500
    // rather than a 400 - if it is allowed to reach the column (PA-052).
    return { row: empty, ignoredFields: [], error: `Unknown manufacturer: ${manufacturer}` };
  }

  const credentials: Record<string, unknown> = {};
  for (const [key, spellings] of Object.entries(CREDENTIAL_FIELDS)) {
    for (const spelling of spellings) {
      const value = body[spelling];
      if (value !== undefined && value !== null && value !== '') {
        credentials[key] = value;
        break;
      }
    }
  }

  if (Object.keys(credentials).length === 0) {
    return { row: empty, ignoredFields: [], error: 'No credentials supplied' };
  }

  const declared = String(body.authMethod ?? body.auth_method ?? '');
  if (declared && !(AUTH_METHODS as readonly string[]).includes(declared)) {
    // A declared intent that is silently replaced by a derived one is COP-B06's
    // shape: the caller asked for something the store cannot represent and
    // would be told it succeeded.
    return { row: empty, ignoredFields: [], error: `Unknown auth method: ${declared}` };
  }

  const authMethod = resolveAuthMethod(body, credentials);
  if (!authMethod) {
    return { row: empty, ignoredFields: [], error: 'Could not determine an auth method' };
  }

  const ignoredFields = CONNECT_FIELDS_WITHOUT_COLUMNS.filter(
    (f) => body[f] !== undefined || body[snake(f)] !== undefined,
  );

  const row: Record<string, unknown> = {
    tenant_id: tenantId,
    manufacturer,
    integration_name: String(body.integrationName ?? body.integration_name ?? manufacturer),
    auth_method: authMethod,
    credentials,
    is_active: true,
    status: 'active',
    updated_at: new Date().toISOString(),
  };

  const endpoint = body.apiEndpoint ?? body.api_endpoint;
  if (endpoint) row.api_endpoint = endpoint;

  const frequency = body.collectionFrequency ?? body.collection_frequency;
  if (frequency) row.collection_frequency = frequency;

  return { row, ignoredFields: [...ignoredFields] };
}

function snake(field: string): string {
  return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/**
 * An explicit auth_method wins; otherwise it is derived from what was sent.
 * Order matters: a request carrying a client id AND an api key is an OAuth
 * client that also holds a key, and treating it as api_key would send the
 * wrong header.
 */
function resolveAuthMethod(
  body: Record<string, unknown>,
  credentials: Record<string, unknown>,
): string | null {
  const declared = String(body.authMethod ?? body.auth_method ?? '');
  if ((AUTH_METHODS as readonly string[]).includes(declared)) return declared;

  if (credentials.clientId && credentials.clientSecret) return 'oauth2';
  if (credentials.username && credentials.password) return 'basic_auth';
  if (credentials.apiKey) return 'api_key';
  return null;
}
