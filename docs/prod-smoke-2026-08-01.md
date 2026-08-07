# Production smoke check — 2026-08-01

Status: **tool delivered and self-verified; NOT YET RUN against production.**

This document contains **no measurements of the live deployment.** Nothing here
confirms or refutes any of the statically-derived prod 404s. It records what was
built, what it will answer, and exactly why it could not be executed from the
session that built it.

## What exists now

`scripts/prod-smoke-check.mjs` (`npm run smoke:prod`) issues one real request per
`/api` prefix against a deployed environment and reports, per domain, whether the
edge function is actually deployed.

Domains are derived from `computeParity()` in `scripts/lib/route-parity.mjs` — the
same source the gap analysis uses — so the check cannot drift from the claims it
is testing. It probes the 182 domains a _reachable_ client file calls; `--all`
widens this to every frontend-referenced domain including orphaned callers.

## Why it needs no credentials

The committed anon keys are rotated/stale (GoTrue `/auth/v1/health` returns 401).
Requiring auth is what kept this analysis unverified in the first place, so the
check is designed to answer the central question without it.

The Coolify dispatcher (`supabase/functions/server.ts`) resolves the function from
URL segment 0 **before** any handler runs, and enforces auth **per handler**:

| Observed response                         | Verdict              | Means                                          |
| ----------------------------------------- | -------------------- | ---------------------------------------------- |
| 404 with `{"error":"Function not found"}` | `missing`            | function not deployed — a real prod 404        |
| 401 / 403                                 | `exists-auth`        | deployed, refused unauthenticated              |
| 2xx                                       | `ok`                 | deployed and serving                           |
| 404 **without** that body                 | `exists-subpath-404` | deployed; `GET /` just isn't one of its routes |
| 5xx                                       | `server-error`       | deployed but erroring                          |

Distinguishing the two kinds of 404 is what makes the result trustworthy. A
status-only check would report every function that simply does not serve `GET /`
as missing.

Supplying `PRINTYX_SMOKE_TOKEN` upgrades the run: authenticated requests reach the
handlers, so 2xx responses become evidence about **response shape** — the failure
mode static parity cannot see, and the one CLAUDE.md calls strictly worse than a
404, because pages fall back to mock data with `|| [...]` and silently render
fabricated numbers.

As a bonus, the dispatcher's not-found body carries `available[]`, so a single
request to a deliberately impossible function name enumerates every deployed
function. That list is reported as corroboration only — the per-domain probe stays
authoritative, because `server.ts` aliases (`accounts-payable` →
`account-payable`, `deployment` → `deployment-readiness`, `integration-hub` →
`integrations`, `public/calculator` → `public-calculator`, …) mean a prefix can
resolve correctly while its literal name is absent from `available`.

## Why it has not been run

Egress from the build sandbox is restricted by network policy. Every request is
refused at the proxy before leaving the host:

```
$ curl https://functions.printyx.net/
curl: (56) CONNECT tunnel failed, response 403

$ curl "$HTTPS_PROXY/__agentproxy/status"
  "recentRelayFailures": [
    { "kind": "connect_rejected",
      "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
      "host": "functions.printyx.net:443" }
  ]
```

This is a policy denial, not an outage or a transient failure: `https://example.com`
is refused identically, so the sandbox has no general egress to compare against.

## The trap this found — read before trusting any smoke output

The first working version of the script **reported a completely fabricated clean
bill of health** against that blocked host, and the run looked entirely normal.

The proxy answers every path with `403`. A status-only classifier reads `403` as
"deployed, refused auth", so all 182 domains came back `exists-auth` — a confident
report that the deployment was healthy, produced without a single packet reaching
production. Any interceptor that answers uniformly — proxy, WAF, CDN, captive
portal, login wall — produces the same lie, and the natural answers (401/403) are
exactly the ones that read as _fine_.

The fix is a **handshake**: before reporting anything, the script probes a function
name that cannot exist and requires the dispatcher's `Function not found` marker.
Only `server.ts` emits it, so receiving it proves the far end is the real
dispatcher rather than something answering on its behalf. Without the marker the
run aborts with exit 1 and states plainly that nothing was measured.

There is deliberately **no override flag**. Every failure mode this catches
produces plausible-looking output, and "wrong but confident" is the exact outcome
this story exists to prevent.

## Verification performed

The tool was exercised against a local mock reproducing the dispatcher's response
shapes (unknown function → marker 404; deployed + auth-required → 401; deployed +
public → 200; deployed + unhandled sub-path → bare 404). All four classified
correctly, including the bare-404 case that must **not** be reported as missing.
Both failure paths were confirmed: the handshake refuses the blocked production
host with exit 1, and `--strict` exits 2 when observations contradict predictions.

That verifies the _classifier_. It does not substitute for a real run.

## To complete PROD-020

From any host with egress to the deployment:

```bash
npm run smoke:prod -- --out docs/prod-smoke-$(date +%F).md
```

Add a token to also exercise response shapes:

```bash
PRINTYX_SMOKE_TOKEN=<current-user-jwt> \
  npm run smoke:prod -- --out docs/prod-smoke-$(date +%F).md
```

Then commit the generated file — `audit-reports/` is gitignored, so a report
written there does not survive. Two acceptance criteria remain open until that
happens: confirming or correcting the 28 statically-derived prod 404s against a
real deploy, and committing the dated output of an actual run.

Credential sources are documented as references (never values) in `.env.example`
under "Production smoke check".
