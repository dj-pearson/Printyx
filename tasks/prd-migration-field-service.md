# PRD: Migrate Field Service (5 files) to Edge Function(s)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 4 · **Week:** 9 (June 17 – June 23) · **Story:** US-016

**Why:** Field service is the largest single-domain migration in the plan — 5 Express route files totaling **~97 endpoints across 3,060 lines**, plus the real-time technician-location WebSocket flow. It's the one domain where edge-function cold start + Realtime subscription latency actually matter for UX (technicians in the field on mobile). The master PRD flags this as the "does Supabase Realtime replace WebSockets?" spike.

---

## 1. Scope

**Source Express files:**
- `server/routes/field-service-routes.ts` (421 lines, **16 endpoints**) — installations, service-signatures, installation-checklists
- `server/routes/geofence-alerts-routes.ts` (743 lines, **20 endpoints**) — rules, alerts, dwell-sessions, subscriptions, statistics, process-event
- `server/routes/gps-tracking-routes.ts` (1,078 lines, **39 endpoints**) — technician locations, routes, deviations, ETAs, geofences, geofence-events
- `server/routes/mileage-routes.ts` (595 lines, **17 endpoints**) — records, summary, reports, rates, IRS log, vehicles
- `server/routes/route-optimization-routes.ts` (223 lines, **5 endpoints**) — optimize, create, reoptimize, analytics, multi-technician

**Services:**
- `server/services/route-optimization-service.ts` — **no external routing API found** (no Mapbox/Google Maps/OSRM imports). Likely pure TSP-style algorithm. Port as-is.

**Existing adjacent edge functions (may partially overlap):**
- `supabase/functions/mobile-field/` (314 lines) — mobile app bundle endpoints
- `supabase/functions/technicians/` (338 lines) — technician CRUD
- `supabase/functions/technician-management/` (294 lines) — management layer
- Three together: audit for overlap with gps-tracking's `/technicians/*` endpoints

**Target layout:**

**Decision — split into 3 edge functions** rather than one monolith. 97 endpoints + Realtime subscription traffic in a single Deno function risks cold-start bloat and deploy-blast-radius issues. Split along access patterns:

```
supabase/functions/
├── field-service/                  # Office-side operations (low-frequency, CRUD)
│   ├── index.ts
│   ├── handlers/
│   │   ├── installations.ts        # 5 endpoints (installations CRUD)
│   │   ├── service-signatures.ts   # 5 endpoints (separate from e-signature — on-site tech sign-off)
│   │   ├── checklists.ts           # 6 endpoints (installation-checklists)
│   │   ├── mileage.ts              # 17 endpoints
│   │   ├── geofence-rules.ts       # 9 endpoints (geofence-alerts: rules + stats + subs)
│   │   └── routes.ts               # 8 endpoints (route CRUD + route-optimization)
│   └── _optimize.ts                # route optimization algorithm
│
├── field-service-tracking/         # High-frequency writes from mobile techs (location updates, events)
│   ├── index.ts
│   ├── handlers/
│   │   ├── locations.ts            # 7 endpoints (technicians/locations, put location, nearby, history, distance)
│   │   ├── geofence-events.ts      # 11 endpoints (process-event, dwell-sessions, geofence-events, alerts)
│   │   ├── etas.ts                 # 6 endpoints
│   │   ├── deviations.ts           # 6 endpoints
│   │   └── route-progress.ts       # 4 endpoints (start/complete/progress)
│   └── _matcher.ts                 # geofence hit-testing (point-in-polygon)
│
└── field-service-alerts/           # (existing? or new) — alert read model + acknowledge/resolve/escalate
    ├── index.ts
    └── handlers/alerts.ts          # 5 endpoints
```

**Rationale:** the high-frequency path (location updates every 30-60s per tech) benefits from a dedicated function with a tuned DB pool. The office-side CRUD can tolerate cold starts. Alerts are a separate read model that dashboards watch via Realtime.

**Explicitly out of scope:**
- Mobile app bundling — `mobile-field/` stays as-is (no merge in this PRD).
- New route optimization algorithms — port whatever's there today. If it's insufficient, that's a product decision post-migration.

---

## 2. Endpoint parity matrix (condensed)

### `field-service-routes.ts` — 16 endpoints
Installations (5): GET /installations, GET /installations/:id, POST /installations, PATCH /installations/:id, DELETE /installations/:id
Service-signatures (5): GET /service-signatures, GET /service-signatures/:id, POST /service-signatures, PATCH /service-signatures/:id, DELETE /service-signatures/:id
Installation-checklists (6): GET /installations/:installationId/checklists, GET /installation-checklists/:id, POST /installation-checklists, POST /installation-checklists/bulk, PATCH /installation-checklists/:id, DELETE /installation-checklists/:id

### `geofence-alerts-routes.ts` — 20 endpoints
Rules (5): GET/POST/PUT/DELETE /rules, GET /rules/:id
Alerts (6): GET /alerts, GET /alerts/unacknowledged, GET /alerts/:id, POST /alerts/:id/(acknowledge|resolve|escalate)
Event processing (2): POST /process-event, POST /check-dwell
Dwell sessions (3): GET /dwell-sessions, POST /dwell-sessions/start, POST /dwell-sessions/end
Subscriptions (3): GET /subscriptions, POST /subscriptions, DELETE /subscriptions/:id
Statistics (1): GET /statistics

### `gps-tracking-routes.ts` — 39 endpoints
Technicians + locations (8): list locations, get/put/status-filter/nearby/history/distance, POST location-history
Ticket timeline (1): GET /tickets/:ticketId/activity-timeline
Routes (8): GET list, GET :id, POST, PUT, DELETE, POST start, POST complete, PATCH progress
Deviations (6): GET list, GET unresolved, GET :id, POST, POST :id/acknowledge, POST :id/resolve
ETAs (6): GET list, GET :id, POST, GET /tickets/:id/eta, PATCH :id/arrival, GET technicians/:id/eta-accuracy
Geofences (6): GET/POST/PUT/DELETE, GET :id, POST check
Geofence-events (4): GET list, POST, GET technicians/:id/events, GET tickets/:id/events

### `mileage-routes.ts` — 17 endpoints
Records (3): GET /records, POST /records, POST /auto-generate
Summary (1): GET /summary
Reports (5): GET /reports, POST /reports, GET /reports/:id, POST /reports/:id/submit/approve/reject
Rates (2): GET /rates, POST /rates
IRS log (3): GET /irs-log, GET /irs-log/export, POST /irs-log
Vehicles (2): GET /vehicles, POST /vehicles

### `route-optimization-routes.ts` — 5 endpoints
POST /optimize, POST /create, POST /routes/:id/reoptimize, GET /technicians/:id/analytics, POST /multi-technician

---

## 3. Tables + RLS plan

From schemas:
- `shared/gps-tracking-schema.ts` → `technician_locations`, `location_history`, `technician_routes`, `route_stops`, `route_deviations`, `technician_etas`, `geofences`, `geofence_events`
- `shared/geofence-alerts-schema.ts` → `geofence_alert_rules`, `geofence_alerts`, `geofence_dwell_sessions`, `geofence_alert_subscriptions`
- `shared/mileage-tracking-schema.ts` → `mileage_records`, `mileage_reports`, `mileage_rates`, `irs_mileage_log`, `mileage_vehicles`
- Field service (in `shared/schema.ts` or related) → `installations`, `installation_checklists`, `service_signatures`

**RLS file `drizzle/rls/field-service.sql`** applies the standard 4-policy template to all ~17 tables. **One exception:** `technician_locations` is read by dashboards + mobile apps at high frequency — keep RLS on, but add a read-specific policy for the `authenticated` role that covers all techs in the tenant (not just self). The standard template already does this.

---

## 4. Real-time technician location (WebSocket → Realtime)

**Current state:** `server/websocket-service.ts` + `/ws/reporting` channel pushes location updates. This is one of the `wss://printyx.net/ws/*` endpoints that has been failing in prod.

**Target:** Supabase Realtime `postgres_changes` subscription on the `technician_locations` table. Frontend swap:

```typescript
// Before (dies with Express WS)
useWebSocket('wss://printyx.net/ws/technician-locations', ...);

// After
import { supabase } from '@/lib/supabase';
useEffect(() => {
  const channel = supabase
    .channel('technician-locations')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'technician_locations',
      filter: `tenant_id=eq.${tenantId}`,
    }, (payload) => setLocation(payload.new))
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [tenantId]);
```

**Prerequisite:** Realtime must be enabled on `technician_locations`:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.technician_locations;
```
(included in `drizzle/rls/field-service.sql`).

**Row-level filtering via RLS:** the Realtime subscription reuses the authenticated JWT, so RLS filters payloads automatically. Cross-tenant updates are never delivered.

**Write path:** `PUT /technicians/:id/location` (from gps-tracking-routes.ts L85) is ported as a normal edge function endpoint. The Realtime broadcast happens automatically when the row is updated. **No additional publish step** — `postgres_changes` watches the WAL.

---

## 5. External dependencies to port

| Dependency | Express location | Deno port |
|---|---|---|
| `IStorage` methods for installations, checklists, service signatures | `server/storage.ts` | Direct Drizzle calls |
| Route optimization algorithm | `server/services/route-optimization-service.ts` | Copy to `field-service/_optimize.ts` — verify no Node-only imports first |
| Mileage rate lookup (IRS) | likely hardcoded or DB-backed | Port as-is |
| WebSocket location push | `server/websocket-service.ts` | **Delete.** Replace with Realtime subscription (see §4) |

**No external routing APIs (Mapbox, Google, OSRM)** currently. If route optimization is trivial (nearest-neighbor TSP), that's fine — post-migration we can consider a routing API if accuracy matters.

---

## 6. Acceptance criteria

### Functional parity
- [ ] All 97 endpoints ported across the 3 edge functions (or whatever split is chosen)
- [ ] Technician location PUT writes to `technician_locations` successfully
- [ ] Realtime subscription delivers location updates to the dashboard in < 2s p95
- [ ] Geofence `process-event` correctly identifies enter/exit events and writes to `geofence_events`
- [ ] Route optimization returns same ordering as Express for fixture input
- [ ] Mileage auto-generate from GPS history produces same records as Express for same date range
- [ ] Installation checklist bulk insert handles 50+ items atomically (transaction)

### Security / RLS
- [ ] RLS on all ~17 tables in `drizzle/rls/field-service.sql`
- [ ] `technician_locations` added to `supabase_realtime` publication
- [ ] Cross-tenant Realtime payload test: subscribe with tenant-A JWT, verify tenant-B inserts don't arrive
- [ ] Mileage IRS log cannot be cross-tenant queried even with forged `/irs-log?tenantId=X` query param

### Frontend compatibility
- [ ] Field service dispatch dashboard loads (whichever page shows live tech locations)
- [ ] Tech mobile web view can submit location updates
- [ ] Geofence-alert dashboard displays unacknowledged alerts + allows acknowledge/resolve/escalate
- [ ] Mileage report submission + approval flow works
- [ ] Route dashboard shows deviations + ETAs
- [ ] Playwright MCP pass on dispatch dashboard; **manual device test** for mobile tech flow

### WebSocket sunset
- [ ] `useWebSocket` hook usage for location tracking removed from frontend
- [ ] `/ws/technician-locations` (or equivalent) no longer referenced in frontend
- [ ] `server/websocket-service.ts` usages for location removed (file may stay if other domains still use it — deleted wholly in Phase 6 US-027)

### Deletion
- [ ] All 5 Express route files deleted
- [ ] `server/services/route-optimization-service.ts` deleted (ported to `_optimize.ts`)
- [ ] Route registry entries removed
- [ ] `grep -r "field-service-routes\|geofence-alerts-routes\|gps-tracking-routes\|mileage-routes\|route-optimization-routes" server/ client/` returns zero matches

### Quality gates
- [ ] `deno check` passes on all 3 edge functions
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

---

## 7. Test plan

### Unit (Deno)
- `_optimize.test.ts` — route optimization on fixture (5 stops, verify output order)
- `_matcher.test.ts` — point-in-polygon for geofence hit-testing (include edge cases: exact boundary, near-boundary, polygon with hole if supported)

### Integration
- Local: seed 3 technicians, 5 geofences; simulate 50 location pings; verify geofence events fire correctly
- Dwell session: tech enters geofence, holds 10 min, exits — verify session start + end + duration
- Realtime smoke: open 2 browser tabs with different tenants; confirm tenant A only sees tenant A's tech movements

### Performance
- **Measure cold start** on `field-service-tracking/` — target < 700ms (higher tolerance than office-side function due to complexity)
- **Measure Realtime p95 latency** — target < 2s from DB write to browser callback
- **Load test**: 100 simultaneous location PUTs from simulated techs; verify no DB connection pool exhaustion

### Mobile smoke (critical)
Must be tested on an actual mobile device, not just desktop browser:
- Open mobile tech app on iOS + Android
- Start a route, confirm location pings succeed
- Verify checklist items can be completed offline-then-synced (if that's a thing today — check)

---

## 8. Rollback

Multi-layer:

1. **Edge function regression** — revert PR; the 5 Express files are already non-functional in prod, so rollback is to 404 baseline.
2. **Realtime subscription regression** — if dashboards stop updating, revert the frontend hook change; dashboards degrade to polling every 30s as fallback.
3. **`supabase_realtime` publication change** — cannot be rolled back trivially (ALTER PUBLICATION REMOVE TABLE works, but re-adding requires the edge function code to handle both paths). Deploy publication add in PR 1, code that depends on it in PR 2.

No schema changes in this PRD (RLS only).

---

## 9. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Realtime p95 latency worse than WebSocket | Medium | Medium | Measure before sunset of WS code; if > 3s, keep WS in place until Phase 6 US-027 |
| `technician_locations` write rate overwhelms WAL (Supabase Realtime) | Low | High | Rate-limit mobile client to 1 update / 30s; document as product decision |
| Mobile offline sync assumptions broken by switch to direct edge function calls | Medium | High | Test offline flow before sunsetting Express; if client relied on WS reconnect semantics, build equivalent retry in mobile client |
| Route optimization algorithm depends on a Node-specific lib not caught by grep | Low | Medium | Read `route-optimization-service.ts` end-to-end before porting |
| Geofence point-in-polygon has floating-point drift bugs in Deno vs. Node | Low | Medium | Unit tests with boundary fixtures; if PostGIS is available, prefer `ST_Contains` server-side |
| 97 endpoints across 3 functions is a big review surface | High | Low | Split into 5 sub-PRs (one per Express file being ported), merge to shared branch, final merge to main |

---

## 10. Open questions

1. **Is `server/websocket-service.ts` still sending location pushes today?** If it's broken in prod already, the migration is "rebuild functionality" not "swap implementation." Clarify current baseline.
2. **Mobile app offline mode** — does the tech app queue location pings while offline and flush on reconnect? If yes, make sure edge function accepts backdated timestamps.
3. **PostGIS availability** — `geofences` table likely stores polygons. Verify `postgis` extension enabled in Supabase; if not, enable or fall back to bounding-box hit testing.
4. **Existing `mobile-field/`, `technicians/`, `technician-management/` edge functions** — is any endpoint there a duplicate of something in the 97-list? Audit before the split decision is finalized.
5. **Route-optimization service — does it use a genetic algorithm / simulated annealing that'd blow past Deno's 60s edge timeout for large tenants?** Time it locally on 50-stop input; cap or chunk if slow.
6. **IRS mileage log export** — returns a CSV or PDF? PDF pushes us into the Phase 4 PDF decision (pdf-lib vs. Browserless).

---

## 11. Definition of done

- [ ] All 97 endpoints live across 3 canonical edge functions
- [ ] Realtime subscription proven in production with live tech data
- [ ] WebSocket location push removed from frontend
- [ ] All 5 Express files deleted
- [ ] RLS on all tables
- [ ] Mobile device smoke test recorded (video or Loom)
- [ ] 72 hours stable before Phase 4 moves to US-017
