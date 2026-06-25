# iOS Payload Contract Testing (IOS-031)

The native iOS app decodes edge-function JSON with `Codable` models. When a
model's keys drift from the real edge-function response shape, the screen still
renders but shows **empty data** — all-zero KPIs, "No Results" search, blank
metrics. These are silent failures: nothing throws, the UI just looks broken.

This class of bug produced IOS-027 (dashboard), IOS-028 (search), IOS-029
(team roll-up) and IOS-030 (invoices). The fix is a CI gate: golden-payload
decode tests in `ios/PrintyxTests/PayloadContractTests.swift`.

## Rule: capture a real payload before changing a model

Before you edit any `*Models.swift` Codable struct (or the endpoint it decodes),
capture the **actual** bytes the production edge function returns and pin them as
a test fixture.

### 1. Capture the real payload

Hit the edge function directly (production goes to `functions.printyx.net`, not
the Express dev shim — a field the dev shim happens to support can still be
missing in prod):

```bash
TOKEN="<a real Supabase access_token for the role you're testing>"
curl -s 'https://functions.printyx.net/today-dashboard' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'x-tenant-id: <tenant>' | jq .
```

Swap the path for `activities`, `search?q=acme`, `team-reports/pipeline`,
`invoices`, etc. For manager-only routes (team-reports) use a manager-role
token — the payload shape can differ by role.

### 2. Pin it as a fixture

Add the captured JSON (trimmed to a representative row or two, secrets removed)
as a string literal test in `PayloadContractTests.swift`, decoded through
`APIClient.makeJSONDecoder()` — the **exact** decoder the live client uses
(`.convertFromSnakeCase` + the PostgreSQL-timestamp date strategy). Assert on the
fields the UI actually reads. If the model can't decode the real payload, or
silently drops a documented field, the test fails.

### 3. Only then change the model

Edit the model to match the captured shape. Prefer a custom `init(from:)` that
maps backend column names to the UI vocabulary (see `ActivityItem`, `Invoice`,
`SearchResponse`) and falls back to legacy spellings so a mid-rollout backend
doesn't regress.

## Gotchas

- **`.convertFromSnakeCase` is active.** Incoming `invoice_status` arrives as
  `invoiceStatus`; your `CodingKeys` raw values must be camelCase.
- **Wrapped arrays.** List endpoints return `{ data: [...], total, page, limit }`,
  not a bare array. Decode `WrappedArrayResponse<T>` (or use
  `APIClient.requestArray`).
- **Keyed-object responses.** `search` returns a keyed object of buckets, not a
  flat array — flatten in a custom decoder.
- **Phantom columns.** Some tables expose both a legacy and a canonical column
  (`status` vs `invoice_status`). Decode the canonical one; keep the legacy as a
  fallback. See the billing notes in `CLAUDE.md`.

## Follow-up

`PayloadContractTests` covers the decode/contract layer where the regressions
originate. Behavioural unit tests for the logic-heavy ViewModels/Services
(filtering, pagination math, optimistic mutation) should be backfilled on top of
`MockURLProtocol`; that work is tracked separately.
