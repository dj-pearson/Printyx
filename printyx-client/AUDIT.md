# Printyx Client Audit & Architecture Notes

A snapshot of how the monitoring client routes data into the Printyx
platform, the security posture as of this review, and the known sharp
edges. This file is for engineering reference — keep it updated when the
ingest topology changes.

## End-to-end data flow

```
+----------------+      TLS 1.2+ / TCP 443       +------------------+
| printyx-client | ----------------------------> | api.printyx.net  |
|  (Node.js)     |   POST /api/client-metrics/   |  Express server  |
+----------------+         submit | heartbeat    +--------+---------+
       ^                          | config                |
       |                                                  v
       |                                       +----------+---------+
       |                                       | Postgres (Drizzle) |
       |                                       |  monitoring_clients|
       |                                       |  device_metrics    |
       |                                       |  ...               |
       |                                       +--------------------+
       |
   SNMP UDP/161 (LAN only)        Optional HTTP/HTTPS (LAN only)
   to printer fleet               to printer web interfaces
```

Every byte that leaves the host that runs the client goes over **TCP 443
HTTPS** to the Printyx API. SNMP and the HTTP printer scrape are intra-LAN
only; they should never traverse a firewall boundary that has external
vulnerability scanning on it.

## Authentication contract

| Header | Value |
| --- | --- |
| `Authorization` | `Bearer <plain api key>` |
| `X-Tenant-ID`   | tenant id from registration |
| `Content-Type`  | `application/json` |
| `User-Agent`    | `Printyx-Client/<package.json version>` |

The plain API key is shown **once** during registration in the Printyx UI
(via `POST /api/monitoring-clients`). The server stores only the SHA-256
hash. Loss of the plain key = rotate.

## Server-side ingest topology

After the consolidation pass everything routes through a single source of
truth: the `monitoring_clients` table with SHA-256 hashed API keys.

| Endpoint                                              | File                          | Auth                  |
| ----------------------------------------------------- | ----------------------------- | --------------------- |
| `POST /api/client-metrics/submit`                     | `routes-client-monitoring.ts` | per-client API key (Bearer + SHA-256) |
| `POST /api/client-metrics/heartbeat`                  | `routes-client-monitoring.ts` | per-client API key    |
| `GET  /api/client-metrics/config`                     | `routes-client-monitoring.ts` | per-client API key    |
| `POST /api/client-metrics/clients` (admin)            | `routes-client-metrics.ts`    | user session + tenant |
| `GET  /api/client-metrics/clients` (admin)            | `routes-client-metrics.ts`    | user session + tenant |
| `POST /api/client-metrics/clients/:id/regenerate-key` | `routes-client-metrics.ts`    | user session + tenant |
| `POST /api/client-metrics/clients/:id/enrollment-token` | `routes-client-metrics.ts`  | user session + tenant |
| `GET  /api/client-metrics/clients/:id/installer.zip`  | `routes-client-metrics.ts`    | user session + tenant |
| `POST /api/client-metrics/enroll`                     | `routes-client-metrics.ts`    | one-time token        |
| `GET  /install/printyx-client.ps1`                    | `routes-registry.ts`          | none (script only)    |

The previously-divergent `client_registrations` table is no longer written
to. The Supabase edge function in
`supabase/functions/client-metrics/index.ts` is marked deprecated and is
not invoked by the current client.

## Enrollment + installer flow

```
Admin in UI -------- POST /clients/:id/enrollment-token ----------> server
                                                                      |
                                                                      v
                                                             monitoring_clients
                                                          + client_enrollment_tokens
                                                                  (tokenHash)
       |
       | et_xxx (shown once)
       v
operator runs installer  --- POST /api/client-metrics/enroll {token} -> server
       |                                                              |
       |                                                              v
       |                                                       new apiKey issued,
       |                                                       client.status='active'
       |                                                              |
       |     <------------ {tenantId, clientId, apiKey, configuration} -+
       v
config.json written, service started, /submit calls authenticated.
```

For the bundled installer (UI → "Download Windows Installer"), the server
returns a zip that pairs the install scripts with a `bootstrap-config.json`
containing a freshly-issued enrollment token (NOT the api key). Same
redemption flow, fewer manual steps.

## Tenant + customer linkage

Every monitoring client carries:

- `tenant_id` — uuid; enforced by `requireTenant` middleware on every
  admin endpoint and by SHA-256 API-key match on the ingest path.
- `customer_id` — optional `varchar` pointer to `business_records.id`.
  Set when an admin picks a customer in the registration dialog. Surfaced
  in the bundled `bootstrap-config.json` and in the `/enroll` response so
  installers and downstream tooling know which account the meter data
  belongs to.

There is intentionally no SQL-level foreign-key on `customer_id` — the
referenced `business_records.id` column is `varchar` (uuid as text) and
the table is heavily used with soft-delete patterns, so a hard FK would
fail too eagerly. Application code is the integrity boundary.

## Security posture (client side)

Already in place:

- **HTTPS-only** — non-HTTPS endpoints throw at startup
  (`src/api/printyx-client.ts`).
- **TLS 1.2+** — SSLv2/v3, TLS 1.0/1.1 disabled. TLS 1.3 ceiling.
- **Strict cert validation** — `rejectUnauthorized` defaults to true,
  custom CA support, optional SHA-256 / public-key pinning.
- **AES-256-GCM at rest** for `apiKey`, device passwords, and SNMP
  community strings (config-file encryption opt-in).
- **PBKDF2** key derivation, 100k iterations, machine-specific key.
- **Outbound only** — no inbound listener, so vulnerability scanners that
  probe inbound ports find nothing on the host.
- **Persistent buffer** with exponential backoff for offline durability.

Improvements in this revision:

- `User-Agent` now reads the real `package.json` version instead of being
  hardcoded.
- Endpoint URL is parsed and a non-443 port emits a warning (vuln scanners
  often flag non-standard HTTPS ports).
- `CryptoManager.wipeString` was a string-immutability no-op — replaced
  with `wipeBuffer` which actually zeroes a `Buffer`.
- Windows installer pins a firewall rule scoped to `node.exe` →
  TCP/443 only; the client cannot accidentally egress to anything else.

Still worth doing later (not in this PR):

- Pull the active server endpoint into the OpenAPI spec so the contract
  is enforced in CI.

## Alerts — materialised, ack/snooze/resolve

`device_alerts` (added in `0011_device_alerts.sql`) holds one row per
(tenant, device, supply) lifecycle. Status flow:

```
active ──ack──▶ acknowledged ──supply restored──▶ resolved
   │                  │
   └─snooze─▶ snoozed ─┘   (auto-revert to active on snoozed_until)
```

Server side:

- `server/services/alert-materializer.ts` runs on every
  `/api/client-metrics/submit`. Idempotent — re-running on the same
  metric is a no-op. Operator state (acknowledged / snoozed) is
  preserved across submissions; auto-resolution flips status when a
  level crosses back over the warning threshold.
- A partial unique index on `(tenant, device, supply)` for non-resolved
  rows guarantees there's only one open alert per supply.
- `routes-device-monitoring.ts` exposes:
  - `GET  /api/device-monitoring/active-alerts` — open alerts (active +
    acked + snoozed) for the tenant, joined with device info.
  - `GET  /api/device-monitoring/device/:serialNumber/alerts` — per-device,
    pass `?includeResolved=true` for history.
  - `POST /api/device-monitoring/alerts/:id/acknowledge`
  - `POST /api/device-monitoring/alerts/:id/snooze` (body `{hours}`,
    1–168, default 4)
  - `POST /api/device-monitoring/alerts/:id/resolve`
- A snoozed alert whose `snoozed_until` has elapsed is shown as
  "active" by the read decorator immediately, even before the next
  /submit cycle re-runs the materializer.

UI side:

- `DeviceMonitoring.tsx` device-detail Alerts tab renders Acknowledge /
  Snooze 4h / Resolve buttons per row, plus a status badge.
- The fleet `activeAlerts` count (used by `/statistics`) reads from
  `device_alerts` instead of being recomputed from `device_metrics`,
  so the "active" badge in the dashboard header matches the alerts
  list exactly.

## Offline detection

The supply alert pipeline only catches conditions visible inside a
/submit payload — toner/paper/levels/meters. If a device stops talking
entirely (powered off, network unplugged, agent crashed), no /submit
arrives and supply alerts can't fire. Symmetric to that: a periodic
sweep watches `device_registrations.last_seen` and materialises an
`offline` alert (`supply_type='device'`) when it goes stale.

`server/services/offline-detector.ts`:

- **`startOfflineSweep()`** — `setInterval` in the Express process,
  default cadence 5 minutes. Tunable via `OFFLINE_SWEEP_INTERVAL_MS`.
- **Two thresholds**, both env-tunable:
  - `OFFLINE_WARN_MS` (default 30 min) → `severity='warning'` + `alert_type='low'`
  - `OFFLINE_CRIT_MS` (default 2 h) → `severity='critical'` + `alert_type='critical'`
- One DB round-trip per sweep — LEFT JOIN `device_registrations` to
  `device_alerts` (open offline alert, if any), then branch:
  insert / upgrade-to-critical / refresh `last_seen_at`.
- Once an alert hits `critical`, it doesn't downgrade until /submit
  resolves it. Avoids flapping when a device sits exactly at the
  warning threshold.
- **Auto-resolve on /submit** via `resolveOfflineFor(tenantId, deviceId)`.
  Hooked into the metric ingest path in `routes-client-monitoring.ts`,
  so the moment a device reports the dashboard clears its offline
  alert without waiting for the next sweep.
- Disable for a deployment with `ENABLE_OFFLINE_SWEEP=false`.
- **Multi-replica deployments**: this runs in-process. For >1 replica,
  gate `startOfflineSweep()` on a leader-election lock — otherwise N
  replicas all sweep concurrently. Single insert/upgrade is idempotent
  thanks to the partial unique index on open `device_alerts`, so the
  worst case is wasted CPU, not duplicate rows.

UI:

- The existing alert list (`DeviceMonitoring.tsx`) renders
  `supply_type='device'` alerts with a "Device offline (severity)"
  label and uses the `message` column for the body, so operators don't
  see a meaningless `DEVICE at NULL%`.
- Acknowledge / Snooze / Resolve all work the same way — same
  materialised table, same endpoints.

## Auto-order on critical alerts

When a NEW critical (or empty) toner alert is materialised — or an
existing `low` alert is upgraded to `critical`/`empty` — the
materialiser calls `server/services/auto-order.ts`. That function:

1. Resolves the device's `customer_id` (denormalised onto
   `device_registrations` from `monitoring_clients.customer_id` at
   ingest time).
2. Verifies the client's `configuration.autoOrderEnabled` is `true`
   (default false — explicit opt-in per agent).
3. Skips if a non-cancelled order already exists for the same
   `(device, supply)` pair (avoids oscillation duplicates).
4. Calls the same toner-product matcher used by the customer-portal
   flow (`supplies` catalog match by manufacturer/model/colour patterns).
5. Inserts a `device_supply_orders` row with `status='pending'` and
   `triggered_by='auto'`, then stamps the alert's `triggered_order_id`.

A separate `device_supply_orders` table — distinct from the
customer-portal `customer_supply_orders` — is the agent-driven order
pipeline. Lifecycle: `pending → approved → ordered → shipped →
delivered` (or `cancelled` from any non-terminal state). Cancelling
clears `device_alerts.triggered_order_id` so a future critical reading
can fire a fresh order.

UI:

- `client/src/pages/SupplyOrders.tsx` — tabular view, Approve / Cancel,
  filter by pending / open / closed, summary cards for pending +
  approved + in-flight.
- `DeviceMonitoring.tsx` alert cards show "Auto-order created" when the
  alert has a `triggered_order_id`.
- `MonitoringClients.tsx` Add-Client dialog has an opt-in checkbox for
  `autoOrderEnabled`.
- `PATCH /api/client-metrics/clients/:id` toggles the flag on existing
  clients without re-creation.

## HTTP collector — vendor coverage

`http-collector.ts` is the fallback for devices with SNMP disabled or
locked behind a community string the operator hasn't shared with us.
Defaults to **HTTPS** with strict TLS validation; per-device override
via `httpRejectUnauthorized: false` for self-signed embedded admin UIs.

`src/collectors/vendor-scrapers.ts` is the dispatch table. Implemented:

| Vendor | Path family | What we read |
| ------ | ----------- | ------------ |
| HP | `/DevMgmt/{ProductConfig,ConsumableConfig,PrinterUsage,ProductStatus}Dyn.xml` | serial, model, toner per CMYK, total/BW/color impressions, status |
| Konica Minolta | `/wcd/{system_device,info_counter,info_supply}.xml` | serial, model, toner per CMYK, total/BW/color/large counters |

Other vendors (Canon, Xerox, Ricoh, Brother, Lexmark, Sharp, Toshiba,
Epson, Kyocera, OKI, Samsung) are recognised by `detectVendor()` but
don't yet have dedicated scrapers — the HP and KM scrapers are tried
as a fallback because their endpoints rarely exist on other vendors,
so a 404 there is harmless.

To add a vendor: drop a new `scrapeXxx` function next to `scrapeHp` in
`vendor-scrapers.ts`, register it in `VENDOR_SCRAPERS`, and add a test
fixture against canned XML.

## SNMP collector — vendor coverage

`src/collectors/vendor-oids.ts` is the single source of truth for:

- IANA enterprise prefix → vendor mapping (used for **sysObjectID-based**
  detection — much more reliable than parsing sysDescr free-text).
- Vendor counter OIDs for total / B&W / colour / large impressions.

Currently supported vendors with vendor-specific counter OIDs: HP,
Canon, Xerox, Ricoh, Konica Minolta, Lexmark, Brother, Sharp, Toshiba,
Epson, Kyocera, OKI, Samsung. For any other vendor — and for vendor
models whose counters aren't in the map — the collector falls back to a
walk of `prtMarkerLifeCount` (RFC 3805).

The supplies walk now reads the entire `prtMarkerSuppliesEntry` table,
so the `rawData.supplies` field on every submission carries every
supply unit reported by the device — drum life, fuser life, waste-toner
bottle, maintenance kits — not just CMYK toners.

## SNMPv3

Wired through `snmp.createV3Session()`:

- `level` is auto-derived from which keys are present (`authKey + privKey`
  → `authPriv`, `authKey` only → `authNoPriv`, neither → `noAuthNoPriv`).
- Auth protocols: MD5, SHA, SHA-224/256/384/512 (per RFC 7860).
- Priv protocols: DES, AES.
- Per-device config maps onto the runtime via `scheduler.ts` —
  `snmpUsername`, `snmpAuthProtocol`, `snmpAuthKey`, `snmpPrivProtocol`,
  `snmpPrivKey`, optional `snmpVersion: '3'`.

CLI test command takes the same flags — see `docs/SNMP-TESTING.md`.

## Windows install

`scripts/install-windows.ps1` performs the full setup:

- builds the client
- copies it to `%ProgramFiles%\Printyx\Client`
- writes config to `%ProgramData%\Printyx\config.json` with NTFS ACL
  restricted to **Administrators + SYSTEM** (and read-only for
  `NetworkService`, the service account)
- downloads NSSM and installs the `PrintyxClient` service
  (auto-start, auto-restart, 10 MB log rotation)
- adds an outbound firewall rule restricted to `node.exe` → TCP 443
- validates the endpoint over TCP/443 before committing config

Uninstall: `scripts/uninstall-windows.ps1` (`-KeepConfig` to retain data).

Bootstrap: `scripts/Install-FromWeb.ps1` is a one-liner suitable for
`irm <url> | iex` deployments — it pulls the source archive then hands
off to `install-windows.ps1`.

## Ports summary (firewall planning)

| Port  | Direction | Required? | Note |
| ----- | --------- | --------- | ---- |
| 443/TCP   | outbound        | yes | Printyx API. The only port that crosses a public boundary. |
| 161/UDP   | outbound (intra-LAN) | for SNMP printers | Not exposed to internet. |
| 80/TCP, 443/TCP | outbound (intra-LAN) | for HTTP scrape | Not exposed to internet. |
| 5353/UDP  | in + out (intra-LAN) | for mDNS discovery (opt-in) | Multicast `224.0.0.251`. Domain/Private profiles only. |
| 3702/UDP  | in + out (intra-LAN) | for WSD discovery (opt-in) | Multicast `239.255.255.250`. Domain/Private profiles only. |

The discovery ports are off by default. Pass `-EnableDiscoveryFirewall`
to `install-windows.ps1`, or add them by hand later. The agent itself
binds to ephemeral UDP ports — the multicast packets are intra-LAN and
the multicast TTL is set to 1, so they cannot route out of the subnet.

If your enterprise uses a TLS-inspecting proxy, install its CA into the
config via `api.security.customCA` and certificate validation will
continue to pass.

## Discovery methods

`NetworkScanner.discoverDevices(ranges, methods)` accepts any
combination of three methods, run in parallel and merged by IP:

| Method | What it does | When it shines |
| ------ | ------------ | -------------- |
| `mdns` | Listens for printer service types (`_ipp._tcp`, `_pdl-datastream._tcp`, `_printer._tcp`, `_uscan._tcp`, `_ipps._tcp`) on UDP 5353. | HP / Brother / Canon / Xerox / Konica / Kyocera fleets. Near-instant (default 5s window). |
| `wsd`  | Sends a single WS-Discovery `Probe` SOAP message to UDP `239.255.255.250:3702` and parses `ProbeMatches` responses. | Any printer with a Windows-class WSD driver — typical office MFPs. |
| `cidr` | Sequentially SNMP-probes every host in the supplied CIDR range. The legacy method. | Networks where mDNS/WSD are firewalled off, or as a gap-filler. |

Default for the running agent: `['mdns', 'wsd']` — cheap, intra-LAN
multicast, near-instant, no CPU burn on a /24 sweep. Only operators
who explicitly want a CIDR scan supply `discoveryMethods: ['mdns',
'wsd', 'cidr']` plus `networkRanges`.

CLI:

```bash
printyx-client discover                              # mDNS + WSD
printyx-client discover --method mdns                # mDNS only
printyx-client discover --method wsd                 # WSD only
printyx-client discover 192.168.1.0/24 --method cidr # legacy CIDR sweep
printyx-client discover 192.168.1.0/24 --method all  # all three, merged
```

`discoveredVia` is preserved on each result so the UI can show why a
device showed up.
