// Row -> response shape for outbound webhook subscriptions (PA-046 / PROD-008b).
//
// The `webhooks` table is real - drizzle/migrations/0007 creates it and
// shared/platform-integrations-schema.ts:166 declares it - but the edge function
// reads it through PostgREST, which hands back snake_case and an `is_active`
// boolean, while the consuming page (SystemIntegrations.tsx) reads camelCase and
// a `status` string. The raw row therefore rendered a blank status badge on
// every row and an always-off toggle. This maps one to the other in one place.
//
// It also drops `secret`. The edge function used to return `select('*')`
// straight to the client, which put every subscription's HMAC signing secret in
// the list response - the value an attacker needs to forge a delivery this
// tenant would accept. It is issued once at create time and once on
// regenerate-secret, and never again.
//
// PA-046's guarantee is carried over rather than dropped with the Express
// handler that used to hold it: lastTriggered and successRate are explicitly
// null and deliveryStatsTracked is false, so the UI renders "Delivery stats not
// tracked". Do not fill these with plausible numbers - the whole point of PA-046
// was that invented 98.5% success rates read as real.
//
// A `webhook_logs` table does exist and has the columns a success rate would
// need, but the only thing that writes to it is the manual POST /:id/test ping.
// Nothing dispatches these subscriptions on a real event, so a rate computed
// from those rows would describe button presses, not deliveries. Deriving one
// becomes honest when an outbound dispatcher exists, not before.

export interface WebhookRow {
  id?: unknown;
  name?: unknown;
  url?: unknown;
  events?: unknown;
  is_active?: unknown;
  headers?: unknown;
  retry_count?: unknown;
  created_by?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  [key: string]: unknown;
}

export interface WebhookView {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: 'active' | 'inactive';
  isActive: boolean;
  headers: Record<string, unknown>;
  retryCount: number;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastTriggered: null;
  lastDelivery: null;
  successRate: null;
  deliveryStatsTracked: false;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function asNullableString(value: unknown): string | null {
  return value == null ? null : asString(value);
}

/** events is jsonb; a malformed value must not break the list render. */
function asEventList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((e): e is string => typeof e === 'string');
}

export function toWebhookView(row: WebhookRow): WebhookView {
  return {
    id: asString(row.id),
    name: asString(row.name),
    url: asString(row.url),
    events: asEventList(row.events),
    status: row.is_active === false ? 'inactive' : 'active',
    isActive: row.is_active !== false,
    headers:
      row.headers && typeof row.headers === 'object' && !Array.isArray(row.headers)
        ? (row.headers as Record<string, unknown>)
        : {},
    // Number(null) is 0 and Number('') is 0, both finite - so test the raw
    // value for absence first or a missing column reads as "never retry".
    retryCount:
      row.retry_count == null || row.retry_count === '' || !Number.isFinite(Number(row.retry_count))
        ? 3
        : Number(row.retry_count),
    createdBy: asNullableString(row.created_by),
    createdAt: asNullableString(row.created_at),
    updatedAt: asNullableString(row.updated_at),
    lastTriggered: null,
    lastDelivery: null,
    successRate: null,
    deliveryStatsTracked: false,
  };
}

export function toWebhookViews(rows: WebhookRow[] | null | undefined): WebhookView[] {
  return (rows ?? []).map(toWebhookView);
}
