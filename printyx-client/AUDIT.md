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

- Replace HTTP printer scraping fallback with HTTPS where the device
  supports it; today `http-collector.ts` defaults to `http://:80`.
- Pull the active server endpoint into the OpenAPI spec so the contract
  is enforced in CI.
- Wire a UI surface in **Monitoring → Monitoring Clients** that calls
  `POST /clients/:id/enrollment-token` and offers the bundled installer
  download (`installer.zip`).

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
| 443/TCP | outbound  | yes | Printyx API. The only port that crosses a public boundary. |
| 161/UDP | outbound (intra-LAN) | for SNMP printers | Not exposed to internet. |
| 80/TCP, 443/TCP | outbound (intra-LAN) | for HTTP scrape | Not exposed to internet. |
| any | inbound | no | The client never listens. |

If your enterprise uses a TLS-inspecting proxy, install its CA into the
config via `api.security.customCA` and certificate validation will
continue to pass.
