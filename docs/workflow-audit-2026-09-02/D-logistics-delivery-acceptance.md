# Audit D: Logistics -> Delivery -> Acceptance -> Service handoff

Scope: receiving ordered equipment, build/config QA, delivery scheduling, delivery/install, customer
acceptance, handoff into Service (meter/toner monitoring). Read-only audit of /home/user/Printyx.

## Headline finding

The equipment lifecycle pipeline is not a working pipeline with gaps in it. It is several
disconnected fragments, and the one page meant to be its cockpit
(`client/src/pages/EquipmentLifecycleHub.tsx`) is non-functional end to end: every one of its five
primary data queries (metrics, purchase-orders, deliveries, installations, assets) 404s on both
dev and production, because no server anywhere - Express or edge function - implements those
sub-paths. The edge function that would serve it in production
(`supabase/functions/equipment-lifecycle/index.ts`) additionally fails to load at all: it declares
a local `function canTransition` with the same name as an ES-module import of `canTransition`,
which is a JavaScript early SyntaxError (`Identifier 'canTransition' has already been declared`),
confirmed by direct execution (see Defect 1). The Coolify dispatcher's per-function dynamic
`import()` at boot catches the failure, logs it, and never registers the function, so **every**
`/api/equipment-lifecycle/*` request in production - not just the five broken sub-paths, but also
`/stages`, `/:id/status`, `/:id/transition`, `/upcoming`, `/transitions/history` - answers
`404 {"error":"Function not found"}`. This is new: the file was created whole in one commit
(`a27344b`, 2026-09-01) as part of PA-052, which is marked `passes:true` for "porting" the exact two
sub-paths that sit inside this unparseable file.

Underneath that, receiving never produces a trackable, serialized unit. `POST
/purchase-orders/:id/receive` only bumps generic `inventory_items` quantities and
`purchase_order_line_items.quantity_received`; it never creates an `equipment` row. The only
endpoint that creates one (`POST /equipment` in `supabase/functions/equipment/index.ts`) has zero
callers anywhere in `client/src` - the "Add Equipment" dialog on the Customer Detail Equipment tab
literally renders "Equipment registration form would go here...". Build, serial-number tracking and
delivery scheduling on `/warehouse-operations` are three more literal placeholder panes ("...interface
will be implemented here"). A real, tested build/QA/first-pass-yield backend exists
(`server/routes-warehouse-fpy.ts`, `warehouse_kitting_operations` + `fpy_metrics` tables) and has no
caller either - it just isn't the one the placeholder panes point at.

Acceptance has a real, unreachable backend too: `supabase/functions/field-service/handlers/
signatures.ts` is a complete CRUD surface over `service_signatures` (signer name/email/role,
signature image, tied to `installation_id`), and the whole `field-service` function has zero
callers in any client tree (confirmed).

The handoff into Service does not exist as code. `EquipmentLifecycleStateMachine`'s
`INSTALLED -> ACTIVE` transition (the story that is supposed to "activate monitoring") only calls
`log.info('Equipment monitoring activated')` inside a try/catch - no device registration, no
`device_registrations` insert, nothing. That side-effect code path is also Express-only (dev only);
production's broken edge function does not run it at all. And even where equipment IS captured with
real network detail during onboarding (`onboarding_equipment.target_ip_address/hostname/mac_address`),
that table has only a nullable, unenforced `equipment_id` link back to the real `equipment` table and
nothing ever populates it - so a fully-onboarded device is invisible to the equipment/meter-billing/
service-ticket system that actually drives Service.

---

## 1. Page-by-page table

| Route                                                                    | Page file                                                          | Status                                                                                                                                                                                                                                                                                                                                                                                                                                      | Backend                                                                                                                                                                                                                                                      | Tables                                                                                                                                                                              | Evidence                                                                                                                                                                                                                                                                                                                                                                             | RBAC gate                                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `/equipment-lifecycle`, `/equipment-lifecycle-management`                | `client/src/pages/EquipmentLifecycleHub.tsx` (1934 lines)          | **broken-everywhere** for metrics/PO/deliveries/installations/assets (dead in dev AND prod, no handler on either host); **broken-in-prod** for stages/transitions (edge fn fails to load); phantom field shapes throughout                                                                                                                                                                                                                  | `equipment-lifecycle` edge fn (unloadable, see Defect 1) + `server/routes-equipment-lifecycle-state-machine.ts` (Express, transitions only)                                                                                                                  | `equipment_lifecycle`, `equipment_lifecycle_transitions`; no backend for `purchase_orders`/`delivery_schedules`/`installation_schedules`/asset rows despite the page expecting them | `EquipmentLifecycleHub.tsx:297-421` (6 queries + 3 mutations, none but `stages` has any handler); `docs/edge-path-coverage-baseline.json:40` already lists `assets,deliveries,installations,metrics,purchase-orders` as gaps; zero server matches confirmed via `grep -rn "equipment-lifecycle/metrics\|.../purchase-orders\|.../deliveries\|.../installations\|.../assets" server/` | `navigation-permissions.ts:347,359` — `operations.inventory.view`+`service.equipment.view` (no minLevel) |
| `/warehouse-operations`                                                  | `client/src/pages/WarehouseOperations.tsx` (1101 lines)            | **broken-in-prod** for the core list/create/status-update of warehouse operations (bare `GET/POST /warehouse-operations`, `PATCH /:id/status` have no branch in the edge fn); **honestly-stubbed** for Serial Numbers, Build, Delivery tabs (placeholder text, no dialogs wired)                                                                                                                                                            | `warehouse-operations` edge fn (implements `warehouses`,`inventory`,`transfers`,`bin-locations`,`picking-list`,`stats` — a _different_ domain nobody calls — but not the bare CRUD this page needs) + Express `routes-warehouse.ts` (dev-only, has the CRUD) | `warehouse_operations`; separately-schemad `warehouse_kitting_operations`/`fpy_metrics` never referenced by this page                                                               | `supabase/functions/warehouse-operations/index.ts:1-394` has no `!endpoint` branch and no `PATCH`; `WarehouseOperations.tsx:204-273` (queryKey `/api/warehouse-operations`, `/stats`, mutations); tab stubs at `WarehouseOperations.tsx:774,809,876` ("...interface will be implemented here")                                                                                       | `navigation-permissions.ts:353` — `operations.warehouse.receive`/`.manage`                               |
| `/inventory`                                                             | `client/src/pages/inventory.tsx`                                   | not deep-audited this pass (separate domain, calls `/api/inventory`, "both-divergent" per context.md) — UNVERIFIED beyond query key                                                                                                                                                                                                                                                                                                         | `inventory` edge fn (both-divergent)                                                                                                                                                                                                                         | `inventory_items` (inferred)                                                                                                                                                        | `inventory.tsx:65-67`                                                                                                                                                                                                                                                                                                                                                                | `navigation-permissions.ts:356`                                                                          |
| `/asset-management`                                                      | `client/src/pages/AssetManagement.tsx` (752 lines)                 | **fabricated data** — zero `useQuery`/`fetch`/`apiRequest` in the whole file; a hardcoded `Asset[]` array under a `// Mock data` comment (demo Canon/HP/Dell units with invented serials, purchase prices, condition)                                                                                                                                                                                                                       | none                                                                                                                                                                                                                                                         | none                                                                                                                                                                                | `AssetManagement.tsx:95` comment `// Mock data`; no query/mutation hooks found (`grep useQuery` empty)                                                                                                                                                                                                                                                                               | `navigation-permissions.ts:257` — `service.equipment.view`, no minLevel                                  |
| `/vehicle-management`                                                    | `client/src/pages/VehicleManagement.tsx` (647 lines)               | **fabricated data** — same shape as AssetManagement: hardcoded `Vehicle[]`/`MaintenanceRecord[]` under `// Mock data`, no backend calls at all                                                                                                                                                                                                                                                                                              | none                                                                                                                                                                                                                                                         | none                                                                                                                                                                                | `VehicleManagement.tsx:83` comment `// Mock data`                                                                                                                                                                                                                                                                                                                                    | `navigation-permissions.ts:253` — `service.equipment.view`, minLevel 3                                   |
| `/mobile-field-service`                                                  | `client/src/pages/MobileFieldService.tsx` (479 lines)              | partially working — real queries to `/api/mobile/sessions`, `/api/mobile/photos` (mobile session/photo capture during a service call, not delivery-specific)                                                                                                                                                                                                                                                                                | `mobile` edge fn (not verified against these two sub-paths this pass)                                                                                                                                                                                        | UNVERIFIED tables                                                                                                                                                                   | `MobileFieldService.tsx:114,120`                                                                                                                                                                                                                                                                                                                                                     | `navigation-permissions.ts:283`                                                                          |
| `/mobile-field-operations`                                               | `client/src/pages/MobileFieldOperations.tsx` (1507 lines)          | **broken-everywhere** — already documented in this repo's own CLAUDE.md (AUDIT-033): a fixture page over tables that never existed, 404s on both hosts                                                                                                                                                                                                                                                                                      | none functional                                                                                                                                                                                                                                              | none real                                                                                                                                                                           | CLAUDE.md AUDIT-033 note (cited, not independently re-verified this pass); query keys confirmed present at `MobileFieldOperations.tsx:191-244` matching `docs/edge-path-coverage-baseline.json:46` `mobile-field: [metrics,technicians,voice-notes,work-orders]`                                                                                                                     | `navigation-permissions.ts:286`                                                                          |
| `/mobile-service-app`                                                    | `client/src/pages/MobileServiceApp.tsx` (782 lines)                | likely broken — calls `/api/mobile/dashboard` (per CLAUDE.md AUDIT-033, this is "a FIXTURE... 1247 completed jobs... $2,340.50 revenue today" served on both hosts, i.e. fabricated-but-live, not 404) and `/api/mobile/route-optimization` (in `docs/edge-path-coverage-baseline.json:45` gap list)                                                                                                                                        | `mobile` edge fn (fixture)                                                                                                                                                                                                                                   | none real for dashboard; UNVERIFIED for route-optimization                                                                                                                          | `MobileServiceApp.tsx:172,186`; CLAUDE.md AUDIT-033                                                                                                                                                                                                                                                                                                                                  | `navigation-permissions.ts:289`                                                                          |
| `/oid-management`                                                        | `client/src/pages/OidManagement.tsx` (840 lines)                   | not deep-audited — real queries to `/api/oid-mappings`, `/api/oid-mappings/manufacturers`; **not wired into the pre-delivery build/config step** (zero references to `oid-mappings` from onboarding/warehouse/equipment-lifecycle code)                                                                                                                                                                                                     | `oid-mappings` edge fn                                                                                                                                                                                                                                       | `oid_mappings` (inferred)                                                                                                                                                           | `OidManagement.tsx:104-269`; `grep -rn "oid-mappings" supabase/functions/onboarding supabase/functions/warehouse-operations` = empty                                                                                                                                                                                                                                                 | `navigation-permissions.ts:796` — `service.equipment.configure`, minLevel 4                              |
| `/service/address-books`                                                 | (address-books page, not opened this pass)                         | not deep-audited — **not wired into pre-delivery build/config step** either (zero references from onboarding)                                                                                                                                                                                                                                                                                                                               | `address-books` edge fn                                                                                                                                                                                                                                      | `address_books`+ (per CLAUDE.md)                                                                                                                                                    | `grep -rn "address-books" supabase/functions/onboarding client/src/pages/EnhancedOnboardingForm.tsx` = empty                                                                                                                                                                                                                                                                         | `navigation-permissions.ts:344` region (not opened)                                                      |
| `/onboarding/new`, `/onboarding/enhanced` (equipment-install parts only) | `client/src/pages/EnhancedOnboardingForm.tsx`                      | **partially working** — the checklist itself, and `onboarding_equipment` rows with basic network fields (IP/hostname/MAC), persist correctly (post-AUDIT-037 fix); the richer `networkConfig`/`printManagement` wizard steps collect data that is never normalized into `onboarding_network_config`/`onboarding_print_management` (dead tables, zero writers) — it is buried in a jsonb blob (`equipment_details`) on the checklist instead | `onboarding` edge fn (`supabase/functions/onboarding/index.ts`) + Express `routes-onboarding.ts`                                                                                                                                                             | `equipment_onboarding_checklists`, `onboarding_equipment`; `onboarding_network_config`/`onboarding_print_management` declared, never written                                        | `supabase/functions/onboarding/index.ts:330-420` (checklist create, `equipment_details` jsonb) and `:450-524` (equipment sub-resource, only 4 network columns); `server/storage.ts:5459-5463,5497-5501` (`createOnboardingNetworkConfig`/`createOnboardingPrintManagement` defined, zero callers via `grep -rn` across `server/`)                                                    | not opened this pass                                                                                     |
| Customer Detail -> Equipment tab                                         | `client/src/components/customer/CustomerEquipment.tsx` (625 lines) | **partially working** — list + meter-history reads are correctly bound to real columns (already fixed post-PA-052/PA-020); **create is a stub**: "Add Equipment" dialog body is literally `Equipment registration form would go here...`                                                                                                                                                                                                    | `customers` edge fn sub-resource (`/api/customers/:id/equipment`) for reads; nothing for create                                                                                                                                                              | `equipment`, `meter_readings`                                                                                                                                                       | `CustomerEquipment.tsx:83-97` (correct real-column `MeterReading` shape), `:295-308` (stub dialog)                                                                                                                                                                                                                                                                                   | inherited from customer detail page gate (not re-checked)                                                |

---

## 2. Workflow-stage gaps

**Ordered -> Received.** No handoff exists. `POST /purchase-orders/:id/receive`
(`supabase/functions/purchase-orders/index.ts:497-640`) is real and does update
`purchase_order_line_items.quantity_received` and generic `inventory_items` quantities, but it
never creates an `equipment` row, never asks for a serial number, and has no concept of "this line
is a serialized asset." The only equipment-create endpoint (`POST /equipment`,
`supabase/functions/equipment/index.ts:184-236`) is called by nothing in `client/src` (confirmed:
`grep -rn "/api/equipment'" client/src` finds only GET callers). The one UI element literally
labeled for this ("Add Equipment" on Customer Detail) is an unimplemented stub
(`CustomerEquipment.tsx:302-307`). **A PO can be marked fully received and no equipment for it will
ever exist in the system this app actually uses for meter billing, service tickets or the
lifecycle/warehouse UI.**

**Received -> Staged/Build (mechanical + network config QA).** Three separate, non-integrated
attempts exist:

1. `WarehouseOperations.tsx`'s "Build" and "Inventory" (serial-number) tabs are labeled UI with no
   dialog wired (`showBuildDialog`/`showSerialDialog` state is set and never rendered;
   `buildForm`/`serialForm` are constructed via `useForm` and never given an `onSubmit`).
2. A real backend for exactly this (`warehouse_kitting_operations`, kit `quality_status` enum,
   `POST/PATCH/complete /api/warehouse-kitting-operations`, plus `fpy_metrics` for first-pass-yield)
   is fully implemented in `server/routes-warehouse-fpy.ts:24-181` and has zero callers in
   `client/src` (confirmed by grep).
3. Onboarding's network-config step (`EnhancedOnboardingForm.tsx`, `networkConfig`/
   `printManagement` schema objects at lines 173,198) collects IP assignment, DNS, gateway, and
   print-management settings, but this data is never split into the dedicated
   `onboarding_network_config`/`onboarding_print_management` tables — those tables have zero
   writers anywhere in the tree (`server/storage.ts:5459,5497` define the insert methods; nothing
   calls them). The data that does survive lands as an opaque jsonb blob on the checklist
   (`equipment_details`), unqueryable and unreportable.

None of these three surfaces reference each other. There is no single "build/QA/network-config
complete" gate a technician can check off before an item is allowed to move toward delivery.

**Staged -> Scheduled for delivery / Delivered / Installed.** `delivery_schedules` and
`installation_schedules` (the schema tables named in the task) are almost entirely dead:
`delivery_schedules` has exactly one write path
(`server/routes-warehouse.ts:358-388`, Express-only, dev-only, zero callers in any client tree —
confirmed) and one read path (`EquipmentLifecycleHub.tsx:326-333`, which calls an endpoint,
`/api/equipment-lifecycle/deliveries`, that doesn't exist anywhere). `installation_schedules` has
**no writer at all** and its only reference in the whole repo
(`server/services/predictive-service-dispatch-service.ts:9`) is an unused import. The "Schedule
Delivery" and "Schedule Installation" buttons on `WarehouseOperations.tsx:823-846` open dialogs
that are declared (`deliveryForm` via `useForm`) but never rendered or submitted — the whole
Delivery tab is the stub text "Delivery scheduling interface will be implemented here."

**Delivered -> Accepted (customer sign-off).** A real, schema-backed capability exists —
`service_signatures` table with signer name/email/role, signature image/data, tied optionally to
`installation_id`, served by `supabase/functions/field-service/handlers/signatures.ts:1-39` via a
generic CRUD helper — and it is unreachable: the whole `field-service` function (154 lines +
7 handler files: installations, checklists, signatures, gps, geofence, mileage, route-optimization)
has zero callers in any client tree (web, mobile-app, ios). There is no delivery/installation
acceptance signature capture anywhere else in the app; the only signature capture that IS wired up
(`mobile-app/src/services/api.ts:93-107`, `POST /mobile/tickets/:id/complete`) is for closing a
_service ticket_, a different workflow entirely.

**Accepted -> Active/In-Service (the handoff into Service).** This transition exists as a state
name (`equipment_lifecycle.current_stage = 'active'`) but the side effects that should make it real
do not:

- `EquipmentLifecycleStateMachine`'s `INSTALLED -> ACTIVE` handler (`server/services/
equipment-lifecycle-state-machine.ts:568-580`) logs `"Equipment monitoring activated"` inside a
  bare try/catch and does nothing else — no `device_registrations` insert, no call into
  `monitoring-clients`, no printer-monitoring wiring of any kind. The symmetric
  `ACTIVE -> RETIRED` "Deactivate monitoring" (`:683-690`) is the same shape.
- Warranty registration (`:582-618`) and the customer welcome email (`:628-676`) in the _same_
  handler ARE real, so this is not a wholesale stub — "monitoring" specifically was never finished
  while the surrounding side effects were.
- This entire side-effect chain is Express-only (fired only from `POST /api/equipment-lifecycle/
:equipmentId/transition` in dev). Production's edge function equivalent
  (`supabase/functions/equipment-lifecycle/index.ts:POST .../transition`) does not call any of
  it — even before accounting for Defect 1, it only flips `current_stage` and writes a transition
  row. So in production, activating equipment has never sent a warranty registration or a welcome
  email either, on top of not registering monitoring.
- `device_registrations` (the table `device-monitoring`/`monitoring-clients` actually read from)
  is written only by `supabase/functions/manufacturer-integrations/index.ts:542` (vendor-API bulk
  discovery). Nothing in the lifecycle/onboarding/warehouse path ever inserts into it.
- The structural reason a fix is hard: onboarding captures real device network identity
  (`onboarding_equipment.target_ip_address/hostname/mac_address`,
  `shared/schema.ts:3742-3778`) in a **separate table** from the `equipment` table everything else
  in the app (billing, meter readings, service tickets, the lifecycle machine) reads.
  `onboarding_equipment.equipment_id` is a nullable, unenforced, uncommented-on "links to main
  equipment table if exists" column that nothing ever sets. A fully-onboarded, network-configured
  device is therefore invisible to Service unless someone separately, manually, re-enters it
  through `POST /equipment` — which, as established above, no UI does.
- No "first meter reading" / baseline capture step exists anywhere in the activation path
  (UNVERIFIED beyond the absence found in the state machine and the edge fn transition handler —
  `meter_readings` inserts were not found tied to any lifecycle transition).

**Net:** every arrow in "ordered -> received -> build/QA -> scheduled -> delivered -> installed ->
accepted -> active/in-service" is either missing a backend, missing a UI, or connected to the wrong
table. The only arrows that reliably work today are the raw stage-transition state machine itself
(dev-only) and warranty/welcome-email (dev-only, riding on that same transition).

---

## 3. Defects found

**Defect 1 — `supabase/functions/equipment-lifecycle/index.ts` is unparseable and never loads in
production. Severity: CRITICAL. Not covered by any open story; contradicts a passing one.**
The file imports `canTransition`, `getAvailableTransitions`, `getValidationRequirements` from
`../_shared/equipment-lifecycle-transitions.ts` (lines 6-10) and then re-declares local
`function canTransition/getAvailableTransitions/getValidationRequirements` at module scope
(lines 93-104) — an import binding and a function declaration with the same name in the same
module scope, which is a JavaScript early SyntaxError, not merely a TypeScript-checker complaint.
Verified three independent ways:

1. `tsc --noEmit` on the isolated file reports `TS2440: Import declaration conflicts with local
declaration of 'canTransition'` (and the same for the other two names).
2. A minimal reproduction executed directly under Node's native ESM loader throws
   `SyntaxError: Identifier 'canTransition' has already been declared` at load time — this is an
   engine-level parse error common to V8 (Node and Deno both run on V8), not a TypeScript-specific
   diagnostic, so Deno's runtime hits the identical failure.
3. `supabase/functions/server.ts:82-99` loads every function with a per-directory dynamic
   `await import(entry)` inside a `try { ... } catch (e) { console.error(...) }` at process boot,
   and never registers the failed one in the `functions` map. Every request to
   `functionName === 'equipment-lifecycle'` then falls into the `!functions[functionName]` branch
   (`server.ts:268-278`) and returns `404 {"error":"Function not found", "available": [...]}`.
   **This means every endpoint in the file — `/stages`, `/:id/status`, `/:id/transition`,
   `/transitions/history`, `/upcoming`, `/:id/available-transitions`,
   `/:id/can-transition/:toStage` — 404s in production**, not just the two PA-052 added.
   The file was introduced whole in commit `a27344b` ("Record PA-052 progress: 22 of 23"),
   `git show a27344b -- supabase/functions/equipment-lifecycle/index.ts` shows `new file mode
100644` — this bug has existed since the file's creation.
   `prd.json` story **PA-052** marks `[x] /api/equipment-lifecycle/:id/available-transitions` and
   `[x] .../can-transition/:id` as done at commit `9880b02` and the whole story `passes:true`.
   The regression test meant to guard this exact code
   (`server/tests/unit/lifecycle-transitions-parity.test.ts:16-27`) only `readFileSync`s
   `_shared/equipment-lifecycle-transitions.ts` and `equipment-lifecycle-state-machine.ts` as text
   for a data-shape comparison; it never imports or executes
   `supabase/functions/equipment-lifecycle/index.ts`, so it cannot see this. **`equipment-lifecycle`
   is not in `crmProxies`** (context.md's both-divergent list), so dev is unaffected (served by
   `server/routes-equipment-lifecycle-state-machine.ts`), which is exactly why this shipped
   undetected — nobody exercised the file that production actually runs.
   Fix: delete the duplicate local `function canTransition/getAvailableTransitions/
getValidationRequirements` declarations (lines ~93-104) and the now-unused local
   `VALID_TRANSITIONS`/`VALIDATIONS` constants they read from, relying solely on the `_shared`
   import already present.

**Defect 2 — `EquipmentLifecycleHub.tsx`'s five primary queries and three mutations have no
backend on either host. Severity: CRITICAL. Partially known (baselined as a coverage gap), but the
baseline understates it — this is not a prod-only gap, it is dead everywhere.**
`metrics`, `purchase-orders`, `deliveries`, `installations`, `assets` under `/api/equipment-lifecycle`
are called by `EquipmentLifecycleHub.tsx:297-421` and matched by no branch in either
`supabase/functions/equipment-lifecycle/index.ts` (confirmed by reading the full 658-line file —
only `stages`, `transitions/history`, `upcoming`, and the `:equipmentId/*` branches exist) or
`server/routes-equipment-lifecycle-state-machine.ts` (confirmed by reading all of its route
declarations — only `:equipmentId/transition`, `:equipmentId/transitions`,
`:equipmentId/can-transition/:toStage`, `:equipmentId/available-transitions`,
`transitions/:transitionId/rollback`, `transitions/:transitionId/can-rollback`, `stages`).
`docs/edge-path-coverage-baseline.json:40` records this as `"equipment-lifecycle":
["assets","deliveries","installations","metrics","purchase-orders"]`, but that guard's own design
(per its header) only measures whether the **edge function** covers a sub-path a client calls — it
implicitly assumes Express (dev) already works for a both-divergent domain. It does not, here.
The types the page expects (`EquipmentLifecycleStage` with `progress_percentage`/
`next_action_required`, `PurchaseOrder` with `po_number`/`vendor_name`/`line_items_count`,
`DeliverySchedule` with `driver_name`, `Installation` with `customer_satisfaction_rating`,
`AssetTracking` with `current_bw_count`/`current_color_count` — `EquipmentLifecycleHub.tsx:76-148`)
also match no real Drizzle table, so this is a phantom-shape page on top of being unbacked; fixing
the routes will still require a field-shape rewrite.

**Defect 3 — `WarehouseOperations.tsx`'s core CRUD (`GET/POST /api/warehouse-operations`,
`PATCH /api/warehouse-operations/:id/status`) is missing from the edge function; the edge function
instead implements an entirely different, uncalled domain. Severity: HIGH. Not covered by any open
story — EDGE-002h (passes:false) audited this exact function and only found `/stats` missing (now
fixed, evidenced by the `EDGE-002h` comment at `warehouse-operations/index.ts:340`), because its
audit methodology compares named sub-path segments and a bare list/create call has none.**
`supabase/functions/warehouse-operations/index.ts` (394 lines) implements `warehouses`,
`inventory`, `inventory/adjust`, `transfer`, `transfers`, `bin-locations`, `picking-list`, `stats` —
zero of which are called by any client file (`grep -rn "warehouse-operations/warehouses\|
.../inventory\|.../transfer\|.../bin-locations\|.../picking-list" client/src ...` = empty). It has
no `if (!endpoint)` branch for GET/POST and no `PATCH` branch at all, so `WarehouseOperations.tsx`'s
list (`queryKey: ['/api/warehouse-operations']`), create (`createOperationMutation`), and
status-update (`updateStatusMutation`, `PATCH /api/warehouse-operations/${id}/status`) all fall
through to the terminal `return createCorsResponse({ error: 'Endpoint not found' }, 404, req)`
(`warehouse-operations/index.ts:380`) in production. Dev works today only because Express
(`server/routes-warehouse.ts:100-256`) implements the matching routes.

**Defect 4 — Three placeholder UI stubs on the receiving/build pipeline. Severity: HIGH (blocks
the workflow entirely, independent of any backend fix). Not covered by any open story found by
keyword search.**

- `client/src/components/customer/CustomerEquipment.tsx:302-307` — "Add Equipment" dialog body:
  `<p>Equipment registration form would go here...</p>`.
- `client/src/pages/WarehouseOperations.tsx:774-780` — Serial Number tab: "Serial number management
  interface will be implemented here."
- `client/src/pages/WarehouseOperations.tsx:809-815` — Build tab: "Build process management
  interface will be implemented here."
- `client/src/pages/WarehouseOperations.tsx:882-888` — Delivery tab: "Delivery scheduling interface
  will be implemented here."
  In all four cases the corresponding `useForm` schema (`serialNumberSchema`, `buildProcessSchema`,
  `deliveryScheduleSchema`) and dialog-open state (`showSerialDialog`, `showBuildDialog`,
  `showDeliveryDialog`) exist in the file but are never wired to a rendered `<Dialog>` or an
  `onSubmit` handler (confirmed: `grep -n "showBuildDialog\|showDeliveryDialog\|buildForm\.\|
handleSubmit" WarehouseOperations.tsx` shows only the `useState`/`useForm` declarations and the one
  unrelated `form.handleSubmit(onSubmit)` for the top-level create-operation dialog).

**Defect 5 — `AssetManagement.tsx` and `VehicleManagement.tsx` are fully fabricated pages with no
backend call of any kind. Severity: MEDIUM (these are internal-asset trackers, not the
customer-equipment lifecycle, but both are routed, gated pages a manager could act on). Not in
`docs/static-posture-baseline.json` or `docs/no-mocks-baseline.json` — missed by both existing
guards.**
Both files declare a hardcoded array (`const assets: Asset[] = [...]`,
`const vehicles: Vehicle[] = [...]`) under an explicit `// Mock data` comment
(`AssetManagement.tsx:95`, `VehicleManagement.tsx:83`) with zero `useQuery`/`useMutation`/
`apiRequest`/`fetch` anywhere in either file (confirmed by grep). `check:no-mocks` misses this
because the variables are named `assets`/`vehicles`, not `mockAssets`/`mockVehicles`.
`check:no-static-posture` misses it because the data lives in a typed array literal assigned to a
`const`, not as bare JSX text nodes or `<Progress value={N}>` — outside that guard's documented
shape vocabulary.

**Defect 6 — `field-service` edge function (installations, checklists, signatures, gps, geofence,
mileage, route-optimization — 154 lines + 7 handler files) has zero callers anywhere. Severity:
HIGH for this scope specifically (`handlers/signatures.ts` is the only acceptance-signature
capability in the repo). Already generally tracked by AUDIT-024 (98-of-285-no-caller, passes:false)
but not called out by name there — worth surfacing explicitly since it is this scope's answer to
"is there customer sign-off."** Confirmed zero matches for `/api/field-service` across
`client/src`, `printyx-client`, `printyx-desktop`, `mobile-app`, `mobile`, `ios`,
`browser-extensions`, `printyx-extension`.

**Defect 7 — `onboarding_network_config` and `onboarding_print_management` are written by nothing;
data the onboarding wizard collects for exactly these tables is instead buried in an opaque jsonb
blob. Severity: MEDIUM-HIGH. Not in `docs/unwritten-tables-baseline.json` (that guard's scope is
edge-function reads specifically; this is an Express-storage dead-write-path, a related but
distinct shape).**
`server/storage.ts:5459-5463` (`createOnboardingNetworkConfig`) and `:5497-5501`
(`createOnboardingPrintManagement`), plus their `update*` counterparts, are fully implemented and
called by nothing (`grep -rn "createOnboardingNetworkConfig\|updateOnboardingNetworkConfig\|
createOnboardingPrintManagement\|updateOnboardingPrintManagement" server/` matches only the
definitions). `EnhancedOnboardingForm.tsx` collects a `networkConfig` step (IP assignment, DNS
servers, gateway — schema at line 173) and a `printManagement` step (line 198), but
`POST /api/onboarding/checklists` (`supabase/functions/onboarding/index.ts:347-437`) only persists
the whole nested payload into `equipment_details` jsonb on the checklist row — never splitting it
into the two dedicated tables. Only `POST /onboarding/:id/equipment`
(`onboarding/index.ts:450-524`) writes structured columns, and only four network fields
(`target_ip_address`, `hostname`, `mac_address`, `network_assignment`) landing directly on
`onboarding_equipment` — nothing about print/scan/SNMP/address-book configuration, which is what
`onboarding_print_management` exists for.

**Defect 8 — `installation_schedules` has zero readers and zero writers anywhere in the repo.
Severity: MEDIUM.** Its only reference outside its own schema declaration
(`shared/equipment-schema.ts:112`) is an unused import at
`server/services/predictive-service-dispatch-service.ts:9`. `delivery_schedules` is one step less
dead — it has exactly one writer (`server/routes-warehouse.ts:358-388`, Express `POST
/api/delivery-schedules`) with zero callers in `client/src` (confirmed) and one reader
(`EquipmentLifecycleHub.tsx:326-333`, calling an endpoint that doesn't exist). Neither table
participates in any working flow today.

**Defect 9 — "Activate monitoring" / "Deactivate monitoring" lifecycle side effects are log
statements, not real actions; the whole side-effect chain they sit in is Express-only (dev-only)
because production runs a different, thinner transition handler. Severity: HIGH. Story US-050 is
marked `passes:true` ("Implemented all TODO side effects... All wrapped in try/catch") — this
finding contradicts that closure for the monitoring half specifically.**
`server/services/equipment-lifecycle-state-machine.ts:568-580` (`INSTALLED -> ACTIVE`) and
`:683-690` (`ACTIVE -> RETIRED`) each contain only `log.info('...monitoring activated/deactivated')`
inside a `try { } catch { }` with no database write, no call to any monitoring/registration
function. Warranty registration (`:582-618`, real: updates `equipmentLifecycle.warrantyStartDate/
EndDate/warrantyRegistered`) and the welcome email (`:628-676`, real: calls `sendEmail` with a
templated message) in the same handler prove the surrounding code is not a stub pattern generally —
monitoring specifically was left as a log line. This state machine is invoked only from
`server/routes-equipment-lifecycle-state-machine.ts`'s `POST .../transition` (Express/dev). The
production edge function's own `POST .../transition` handler
(`supabase/functions/equipment-lifecycle/index.ts`, lines ~430-540) does not call this state
machine or reproduce any of its three side effects — it only updates `current_stage` and inserts an
`equipment_lifecycle_transitions` row. So in production, activating equipment has never registered
monitoring, warranty, or sent a welcome email, independent of Defect 1's total outage.

**Defect 10 — No structural link from onboarding's device capture to the `equipment` table that
Service, billing and meter-reading actually use. Severity: HIGH (root cause of the Service handoff
gap). Not tracked anywhere by keyword search.**
`onboarding_equipment.equipment_id` (`shared/schema.ts:3750`, comment: "Links to main equipment
table if exists") is nullable, has no foreign-key constraint, and is set only if a caller already
happens to pass an existing equipment id — nothing in `EnhancedOnboardingForm.tsx` or the
`onboarding` edge function ever creates the corresponding `equipment` row or back-fills this
column. Combined with Defect (b) above (no UI creates `equipment` rows at all), the practical
result is: a device can be fully onboarded with real IP/hostname/serial data and never appear in
the `equipment` table that `meter-reads`, `service` tickets, `toner-replenish`, and the
lifecycle/warehouse UI all query.

**Defect 11 — `server/routes-warehouse-fpy.ts` (build QA / first-pass-yield, real tables
`warehouse_kitting_operations` + `fpy_metrics` + `auto_invoice_generation`, real Zod-validated
Express CRUD including a `.../complete` action) has zero UI callers, and would additionally 404 in
production even if a UI called it (mounted bare at `/api`, no matching edge function directory, no
`crmProxies` entry). Severity: MEDIUM — a complete, unconnected feature (AUDIT-024 shape), the
answer to "is any UI writing a build checklist / QA result." It is not.** Confirmed via
`grep -rn "warehouse-kitting-operations\|fpy-metrics\|auto-invoice" client/src` = empty.

**Defect 12 — No edge function in this scope enforces any role/permission check beyond
auth+tenant.** Confirmed for `equipment`, `equipment-lifecycle`, `warehouse-operations`,
`purchase-orders` (no `requireRoleLevel`/role-table query in any of the four). **This is the
already-tracked general pattern** (SEC-EDGE-001, passes:false; all four function names already
listed in `docs/edge-rbac-baseline.json`), not a new finding — cited here because it directly
answers audit question (g): WAREHOUSE_ASSOCIATE (L1) and OPERATIONS_MANAGER (L4) have byte-identical
API-level access to receive POs, create/edit equipment, and transition lifecycle stages; the only
differentiation today is client-side nav visibility (`navigation-permissions.ts`) plus a
System-B RBAC permission model that, per this repo's own `docs/rbac-landscape.md` (cited in
context.md), is not actually seeded per tenant in production.

---

## 4. Proposed stories

**S1 — Fix the equipment-lifecycle edge function's fatal duplicate declaration (Defect 1).**
As a technician or operations user, I need `/api/equipment-lifecycle/*` to actually respond in
production instead of 404ing on every request. Remove the locally-redeclared
`canTransition`/`getAvailableTransitions`/`getValidationRequirements` functions and their backing
`VALID_TRANSITIONS`/`VALIDATIONS` constants from `supabase/functions/equipment-lifecycle/index.ts`,
relying solely on the existing import from `_shared/equipment-lifecycle-transitions.ts`.
Acceptance criteria:

- `node`/`tsc` (or a deno-equivalent parse check) confirms the file has no duplicate top-level
  identifier between an import and a local declaration.
- A new regression test actually imports and invokes
  `supabase/functions/equipment-lifecycle/index.ts`'s default export (not just the `_shared` file
  as text) and asserts a 200/expected-shape response for `GET /stages`.
- Add a CI check (or extend `check:server-orphans`/a new lightweight script) that dynamically
  imports every `supabase/functions/*/index.ts` and fails the build if any throws at import time —
  this exact failure mode (silently omitted from the boot-time function registry) should never
  reach production undetected again.
- Manual/curl verification against a running instance of `supabase/functions/server.ts` shows
  `equipment-lifecycle` in the `available` functions list.
  Priority: 1. dependsOn: [].

**S2 — Build the missing `equipment-lifecycle` sub-resources (metrics, purchase-orders,
deliveries, installations, assets) or repoint the page at what exists (Defect 2).**
As an operations manager, I need the Equipment Lifecycle Hub's dashboard, PO tracker, delivery
list, installation list and asset list to show real data instead of permanently-empty/erroring
panels. This requires a decision: build five new endpoints backed by real tables (`purchase_orders`,
`delivery_schedules`, `installation_schedules`, `equipment_lifecycle`) with camelCase-matched field
shapes, OR rewrite the page's types to match what a consolidated set of existing endpoints
(`/api/purchase-orders`, a fixed `/api/warehouse-operations`, `/api/equipment`) already returns.
Acceptance criteria:

- Every query in `EquipmentLifecycleHub.tsx:297-421` resolves to a real endpoint on both dev and
  production hosts (verified via `npm run check:edge-coverage` clearing the
  `equipment-lifecycle` entry in `docs/edge-path-coverage-baseline.json`).
- The three mutations (`createPOMutation`, `scheduleDeliveryMutation`,
  `scheduleInstallationMutation`) succeed end-to-end against a real database and create rows a
  human can find again (via the list queries above).
- `EquipmentLifecycleStage`/`PurchaseOrder`/`DeliverySchedule`/`Installation`/`AssetTracking`
  TypeScript types (`EquipmentLifecycleHub.tsx:76-148`) are re-bound to real Drizzle columns; no
  field is invented.
- `npm run check` passes with no new phantom-column/phantom-table findings introduced.
  Priority: 1. dependsOn: [S1] (S1 must land first so the `stages`/`transition` half of the page
  also works once the rest is fixed).

**S3 — Give `warehouse-operations`'s edge function its own missing base CRUD, and decide the fate
of its unrelated `warehouses`/`inventory`/`transfers` branches (Defect 3).**
As a warehouse associate, I need `GET/POST /api/warehouse-operations` and
`PATCH /api/warehouse-operations/:id/status` to work in production, matching what Express already
serves in dev. Also determine whether the edge function's existing `warehouses`/`inventory`/
`transfer`/`bin-locations`/`picking-list` branches (394 lines, zero callers) belong to a different,
unbuilt page and should be left annotated, or should be deleted as dead code.
Acceptance criteria:

- `GET /warehouse-operations` (bare) returns a paginated list of `warehouse_operations` rows
  scoped to `tenant_id`.
- `POST /warehouse-operations` creates a row from the `operationType`/`status`/`assignedTo`/
  `scheduledDate`/`notes`/`qualityControlChecks`/`photos` shape `WarehouseOperations.tsx` already
  sends.
- `PATCH /warehouse-operations/:id/status` updates status and (per the existing dev behavior at
  `routes-warehouse.ts`) auto-advances the UI to the next tab on `completed`.
- `npm run check:unreferenced-edge-fns` and a manual grep confirm whether `warehouses`/`inventory`/
  `transfers`/`bin-locations`/`picking-list` gain a real caller or get removed with their tables
  annotated.
- `docs/route-ownership-baseline.json`'s `warehouse-operations` entry is re-verified against the
  corrected sub-path parity.
  Priority: 1. dependsOn: [].

**S4 — Build the equipment/asset receiving flow: create an `equipment` row (with serial number)
directly from a PO receipt, and implement the "Add Equipment" dialog (Defect 4, part b/c).**
As a warehouse associate receiving a shipment against a purchase order, I need to record each
physical unit's serial number as I unbox it, creating a trackable `equipment` row tied to the PO
and, once the customer is known, the `business_records` customer. Replace the "Equipment
registration form would go here..." stub on Customer Detail's Equipment tab, and add an equivalent
action to the PO receiving flow.
Acceptance criteria:

- `CustomerEquipment.tsx`'s "Add Equipment" dialog collects the fields `POST /api/equipment`
  already accepts (`equipment/index.ts:184-236`) and calls it; the new row appears in the list
  query without a page reload.
- `POST /purchase-orders/:id/receive` (or a new sibling endpoint) optionally accepts a list of
  serial numbers per line item flagged as serialized/equipment-type, and creates one `equipment`
  row per serial, linked to `purchase_order_id` (new nullable column or a join table, whichever
  fits the existing schema without breaking `purchase_order_line_items`).
- A receiving associate can go from "PO approved" to "N equipment rows exist with real serial
  numbers" without touching the API directly.
- `npm run check:phantom-cols` and `check:spread-insert-keys` stay clean on the new code.
  Priority: 1. dependsOn: [].

**S5 — Implement the Build / Serial-Number tracking tabs on Warehouse Operations, wired to the
existing (currently orphaned) `warehouse_kitting_operations`/`fpy_metrics` backend (Defect 4 part
a, Defect 11).**
As a warehouse associate, I need to record the mechanical build steps, accessory matching, and
quality-control result for a unit before it can move to staging, and I need that to show up in
first-pass-yield reporting. Wire `WarehouseOperations.tsx`'s Build tab (currently a stub) to
`POST/PATCH/complete /api/warehouse-kitting-operations` instead of building a new backend.
Acceptance criteria:

- The Build tab's "New Build Process" button opens a real dialog backed by `buildProcessSchema`
  (already defined at `WarehouseOperations.tsx:107-123`) and posts to
  `/api/warehouse-kitting-operations`.
- Completing a build calls `POST /api/warehouse-kitting-operations/:id/complete` and the resulting
  `kit_quality_status` is visible on the operation.
- `/api/warehouse-kitting-operations`, `/api/fpy-metrics` gain either a `crmProxies` entry (if kept
  Express-only in dev with a matching edge function) or a proper edge-function port — pick one and
  make dev and prod agree, per this repo's own "don't add a crmProxies entry for an unmigrated
  prefix" rule.
- `WarehouseTeamStatsWidget.tsx` (existing FPY-aware component) is checked for whether it can now
  surface real numbers instead of whatever it renders today.
  Priority: 2. dependsOn: [S3].

**S6 — Implement delivery and installation scheduling end-to-end (Defect 4 part c, Defect 8).**
As a dispatcher, I need to schedule a delivery date/window and, separately, an installation
appointment for received/staged equipment, and see both on a calendar or list a delivery/install
crew can work from. This requires deciding whether `delivery_schedules`/`installation_schedules`
are the tables to build on (they exist, are nearly unused, and already have Drizzle types) or
whether to converge onto the `scheduling` edge function's `appointments` table — but `appointments`
is confirmed to exist in no schema or migration (context.md; independently confirmed: no
`pgTable('appointments'...)` in `shared/*.ts`, no `CREATE TABLE ... appointments` in any migration),
so building on `delivery_schedules`/`installation_schedules` is the lower-risk path.
Acceptance criteria:

- `WarehouseOperations.tsx`'s "Schedule Delivery" button creates a `delivery_schedules` row via a
  real endpoint (dev AND prod), replacing the "Delivery scheduling interface will be implemented
  here" placeholder.
- A new, equivalent create path exists for `installation_schedules` (which currently has none at
  all).
- `EquipmentLifecycleHub.tsx`'s `deliverySchedules`/`installations` queries (currently 404) resolve
  against the same tables.
- A basic delivery-crew view (list or calendar, scoped to the crew's assigned deliveries for the
  day) exists somewhere reachable from `/warehouse-operations` or `/equipment-lifecycle`.
  Priority: 2. dependsOn: [S1, S2].

**S7 — Wire up delivery/installation acceptance signature capture (Defect 6).**
As a customer receiving a delivered/installed unit, I need to sign off that I've accepted it, and
that signature needs to be recorded against the specific installation. Connect the existing,
unreachable `field-service` edge function's `service_signatures` CRUD
(`handlers/signatures.ts`) to a real UI — most naturally a step at the end of whatever
install-completion flow S6 produces, or a page a technician opens on-site (tablet/mobile) at
delivery/install completion.
Acceptance criteria:

- A technician-facing screen (web responsive or the mobile app) captures signer name, role, and a
  signature image/data blob, and posts to `service_signatures` via the `field-service` function.
- The signature is retrievable from the equipment/installation's detail view afterward.
- `docs/unreferenced-edge-fns-baseline.json`'s `field-service` entry is resolved (wired, not just
  annotated) — per AUDIT-024's own acceptance criteria template.
- Capturing a signature is one of the `equipment_lifecycle`'s documented `INSTALLED -> ACTIVE`
  validation requirements (`acceptance_signed`, per `_shared/equipment-lifecycle-transitions.ts`)
  and this story should make that requirement checkable, not just named.
  Priority: 2. dependsOn: [S1].

**S8 — Make "activate monitoring" a real action, and make it run in production (Defect 9,
Defect 10).**
As an operations user, when equipment transitions to `active`, I need the system to actually
register that unit for meter/toner monitoring — not just log a sentence — and I need that to
happen regardless of which host (dev/Express or prod/edge-function) processes the transition.
Acceptance criteria:

- `EquipmentLifecycleStateMachine`'s `INSTALLED -> ACTIVE` handler creates (or ensures) a
  `device_registrations` row (or calls the real `monitoring-clients`/`device-monitoring`
  registration path used elsewhere) instead of `log.info(...)`, wrapped in the same try/catch
  discipline as the surrounding warranty/email code.
- The symmetric `ACTIVE -> RETIRED` "deactivate monitoring" path actually deactivates/removes the
  registration.
- The production edge function's `POST /equipment-lifecycle/:id/transition` handler calls the same
  shared side-effect logic as the Express state machine (or a `_shared/` port of it), so this does
  not remain a dev-only behavior the way warranty registration and the welcome email are today.
- A test exercises the full `INSTALLED -> ACTIVE` transition against a test database and asserts a
  `device_registrations` row exists afterward.
  Priority: 1. dependsOn: [S1].

**S9 — Bridge `onboarding_equipment` to the canonical `equipment` table (Defect 10).**
As an operations user, I need a device that was fully onboarded (with real IP/hostname/serial data
captured during installation) to actually become the same row the rest of the app — billing, meter
readings, service tickets, the lifecycle hub — reads. Today these are two disconnected tables with
an unused link column between them.
Acceptance criteria:

- Completing (or a defined milestone within) an onboarding checklist creates the corresponding
  `equipment` row if one does not already exist, populating `onboarding_equipment.equipment_id`.
- The reverse direction — starting from an existing `equipment` row and generating an onboarding
  checklist for it — is at least considered/documented even if not built in this story.
- A test seeds an onboarding checklist with equipment, completes it, and asserts a matching
  `equipment` row exists and is queryable via `GET /api/equipment` and
  `GET /api/customers/:id/equipment`.
- `check:phantom-cols` / `check:spread-insert-keys` stay clean.
  Priority: 1. dependsOn: [].

**S10 — Normalize onboarding's network-config and print-management steps into their dedicated
tables instead of a jsonb blob (Defect 7).**
As an operations/IT admin, I need the network and print-management settings a technician enters
during onboarding to be queryable and reportable (e.g., "which of our customers still have SNMP
disabled"), not buried inside `equipment_details` jsonb.
Acceptance criteria:

- `POST /onboarding/checklists` (or a new `POST /onboarding/:id/network-config` /
  `.../print-management` sibling to the existing `.../equipment` endpoint) calls
  `storage.createOnboardingNetworkConfig`/`createOnboardingPrintManagement` (already implemented,
  currently orphaned) with the data `EnhancedOnboardingForm.tsx`'s `networkConfig`/
  `printManagement` steps already collect.
- The PDF checklist generator (`_pdf.ts`, per PA-052) and the checklist detail view read from the
  structured tables, not (only) the jsonb blob.
- `npm run check:unwritten-tables` / an equivalent orphaned-method check confirms
  `onboardingNetworkConfig`/`onboardingPrintManagement` gain a real caller.
  Priority: 2. dependsOn: [].

**S11 — Delete or genuinely connect `AssetManagement.tsx`/`VehicleManagement.tsx` (Defect 5).**
As a company admin, I should not see fake demo data (specific fabricated VINs, purchase prices,
lease payments) on a routed, permission-gated page and mistake it for real records. Either build
minimal real backends for internal-asset and vehicle tracking (there may be none intended — these
look like they were speculative scaffolding) or delete the pages and their nav/route entries, per
this repo's own AUDIT-016 rule ("delete a claim with no backing data rather than fake it").
Acceptance criteria:

- A decision is recorded (build vs. delete) and executed.
- If deleted: routes, `navigation-permissions.ts` entries, and any sidebar links are removed
  together; `check:orphans`/`check:nav` stay clean.
- If built: real `useQuery`/`useMutation` hooks replace the hardcoded arrays, backed by a real
  table and edge function, following this scope's schema conventions.
- Add these two files (or their resolution) to `docs/static-posture-baseline.json` explicitly so
  the guard's coverage gap (typed array literals vs. JSX text nodes) is documented even if not
  immediately widened.
  Priority: 3. dependsOn: [].

**S12 — Extend `check:no-static-posture` (or add a sibling guard) to catch hardcoded array-literal
mock data, not just inline JSX values (Defect 5, tooling gap).**
As the team maintaining these guards, I need `const foo: Type[] = [...]` mock data under a page
component to be caught the same way inline JSX numbers already are, since naming the variable
something other than `mock*` currently evades both `check:no-mocks` and `check:no-static-posture`.
Acceptance criteria:

- The guard flags a page-level `const` array/object literal assigned realistic-looking domain data
  (multiple records, each with 5+ fields including at least one currency/date/serial-like value)
  when the same file has zero `useQuery`/`useMutation`/`fetch`/`apiRequest` calls.
- `AssetManagement.tsx` and `VehicleManagement.tsx` are the two known cases baselined at
  introduction (do not fail CI on landing this guard).
- False-positive check: legitimate constant lookup tables (e.g. `statusColors`, `meterTypeLabels`
  seen throughout this scope) do not trip it — the heuristic should key off record-count and field
  diversity, not "any array literal."
  Priority: 3. dependsOn: [].

**S13 — Tie OID mappings and address-book configuration into the pre-delivery build/config
checklist.**
As a technician performing the mechanical + network functional check before an item is marked
ready to ship, I should be prompted to confirm OID mappings (for meter-read scraping) and an
address book (for scan-to-email) are set up for the device model/customer, rather than these being
two entirely separate, unlinked admin surfaces (`/oid-management`, `/service/address-books`)
nobody is directed to during onboarding.
Acceptance criteria:

- The onboarding equipment-add flow (or the warehouse build step, once S5 exists) surfaces whether
  an OID mapping exists for the device's manufacturer/model and links to `/oid-management` to add
  one if missing.
- Same for address-book association where the device or customer requires scan-to-email.
- No new tables required — this is a UI cross-linking + a read-only existence check against
  `oid_mappings`/`address_books`.
- Confirmed via manual walkthrough that a technician completing onboarding for a new
  manufacturer/model is not silently left without OID coverage.
  Priority: 3. dependsOn: [S9].

**S14 — Add a boot-time "did every edge function actually load" CI/production check
(tooling gap generalized from Defect 1).**
As the team, I need a bare-minimum guarantee that no edge function silently fails to load in
production the way `equipment-lifecycle` did, since the existing dispatcher swallows the error and
merely 404s forever with no alert. This generalizes S1's narrow test into a standing guard.
Acceptance criteria:

- A script (CI-runnable, and ideally runnable against the live Coolify deployment) dynamically
  imports every `supabase/functions/*/index.ts` the same way `server.ts` does and fails if any
  throws.
- The live deployment exposes (or the script separately checks) the `available` functions list
  `server.ts:268-278`'s 404 response already includes, and diffs it against the on-disk function
  directory list — any function present on disk but absent from `available` is a hard CI failure.
- This is added to the same CI job family as `check:edge-coverage`/`check:phantom-cols` so a future
  regression of this exact shape is caught before merge, not after a production incident.
  Priority: 1. dependsOn: [].

---

## Notes on verification confidence

- Everything under Defects 1-11 and the page-by-page table's "evidence" column was verified by
  reading the cited files directly in this session (not inferred from comments or docs), except
  where explicitly marked UNVERIFIED (inventory.tsx's deeper behavior, oid-management's and
  address-books' full backend correctness, mobile-field-service's session/photo endpoints,
  mobile-field-operations beyond citing this repo's own CLAUDE.md).
- Defect 1 (the TS2440 duplicate declaration) was independently executed against Node's native ESM
  loader and against `tsc`, not just read — this is the highest-confidence finding in the report.
- `prd.json` (772 stories) was searched by keyword for every proposed story's subject before
  writing it up; overlaps found (PA-052, EDGE-002h, US-050, AUDIT-024, AUDIT-028, SEC-EDGE-001) are
  cited by ID in the relevant defect/story rather than duplicated.
