/**
 * Case conversion helpers.
 *
 * DB columns are snake_case (PostgREST default). Frontend expects camelCase
 * (matches the old Drizzle-rendered shape). Use these to convert at the
 * handler boundary:
 *
 *   // DB → frontend
 *   return jsonResponse({ rows: toCamel(data) }, 200, req);
 *
 *   // Frontend → DB
 *   const { data, error } = await db.from('t').insert(toSnake(body));
 *
 * Values are left alone — only keys are transformed. JSON column contents
 * that are already camelCase (our jsonb columns) pass through unchanged as
 * long as you only convert the top-level row shape.
 */

type AnyRecord = Record<string, unknown>;

function transformKeys(input: unknown, fn: (k: string) => string): unknown {
  if (Array.isArray(input)) return input.map((v) => transformKeys(v, fn));
  if (input && typeof input === 'object' && !(input instanceof Date)) {
    const src = input as AnyRecord;
    const out: AnyRecord = {};
    for (const k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k)) {
        out[fn(k)] = transformKeys(src[k], fn);
      }
    }
    return out;
  }
  return input;
}

/** Convert keys of an object (recursively, through arrays) from snake_case to camelCase. */
export function toCamel<T = unknown>(input: unknown): T {
  return transformKeys(input, (k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())) as T;
}

/** Convert keys of an object (recursively, through arrays) from camelCase to snake_case. */
export function toSnake<T = unknown>(input: unknown): T {
  return transformKeys(input, (k) =>
    k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()).replace(/^_+/, ''),
  ) as T;
}

/**
 * Shallow variant — transforms only the top-level keys. Useful when the values
 * contain JSON we DON'T want traversed (e.g. a jsonb column of arbitrary shape).
 */
export function toCamelShallow(input: AnyRecord): AnyRecord {
  const out: AnyRecord = {};
  for (const k in input) {
    out[k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())] = input[k];
  }
  return out;
}

export function toSnakeShallow(input: AnyRecord): AnyRecord {
  const out: AnyRecord = {};
  for (const k in input) {
    const snake = k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase()).replace(/^_+/, '');
    out[snake] = input[k];
  }
  return out;
}
