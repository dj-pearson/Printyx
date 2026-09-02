# RBAC landscape

Written 2026-08-20 (SEC-EDGE-002) because four consecutive investigation rounds
each corrected the previous one's model. Every claim below is derived from the
repository; anything not verifiable from here is marked UNVERIFIED.

Regenerate the counts with:

```bash
npm run check:permission-vocab -- --vocabularies   # the permission namespaces
npm run check:permission-vocab -- --triage         # impact of the unsatisfiable gates
npm run check:permission-vocab                     # the CI ratchet
```

## There are two role systems, not one

They share no tables and neither reads the other.

**System A — `roles`** (`shared/schema.ts:842`). One flat table. `roles.permissions`
is a JSONB blob; `roles.level` is 1-8; `roles.canAccessAllTenants` and friends are
capability booleans. There is **no `tenant_id` column** — a fact the phantom-column
baseline already records for two edge functions that filter on it.

- Written by: `server/auth-setup.ts` (demo tenant only), `server/role-seeder.ts`
  (12 roles, via the unimported `server/initialize-roles.ts`),
  `server/multi-location-role-seeder.ts` (33 roles, **no importer at all**), and
  the `roles` / `role-management` edge functions at runtime.
- Read by: `supabase/functions/signup/index.ts`, which looks up
  `code = 'COMPANY_ADMIN'` and puts that id in `app_metadata.roleId` and
  `users.role_id`; `supabase/functions/_shared/rbac.ts`; and the hand-rolled gate
  in `monitoring-clients`.
- **This is the system production uses.** Signup fails loudly without it
  (`MISSING_ADMIN_ROLE`).

**System B — `enhancedRoles` + `permissions` + `rolePermissions` + `userRoleAssignments`**
(`server/enhanced-rbac-schema.ts`). A normalised catalogue.

- Written by: `server/database-updater/seeders/rbac-seeder.ts` (`npm run seed:rbac`,
  35 roles, 131 permission codes, documented in that directory's README) and
  `server/enhanced-rbac-seeder.ts` (26 roles, 38 codes, no documentation).
- Read by: `server/middleware/enhanced-rbac-middleware.ts`, which is what
  `requirePermission` on an Express route consults.
- Nothing in production populates it per tenant — see the next section.

## The bridge between them is dead code

`server/rbac-initializer.ts` is the only thing that would seed System B for a new
tenant. It **has no importers** — nothing in `server/`, `client/` or `supabase/`
references it. It also would not work if called: `tsc` reports that
`rbacSeeder.seedEnterpriseRoles` and `rbacService.assignUserRole` do not exist
(`server/rbac-initializer.ts:63,71`), and the role id it assigns,
`company-admin-${tenantId}`, is not an id either seeder creates. Those errors sit
inside the typecheck baseline, which is why they are invisible.

So System B is populated only by running `npm run seed:rbac` by hand.

## Five permission vocabularies

| Vocabulary                   | Where                                            | Size     | Shape                                    |
| ---------------------------- | ------------------------------------------------ | -------- | ---------------------------------------- |
| Route gates                  | `server/middleware/rbac-route-helper.ts`         | 132      | `inventory.item.view`                    |
| `npm run seed:rbac`          | `server/database-updater/seeders/rbac-seeder.ts` | 131      | `operations.inventory.view`              |
| New-tenant seeder            | `server/enhanced-rbac-seeder.ts`                 | 38       | `lead.view_own`                          |
| `role-seeder`                | `server/role-seeder.ts`                          | 12 roles | `{ sales: ['*'], admin: ['*'] }`         |
| `multi-location-role-seeder` | `server/multi-location-role-seeder.ts`           | 33 roles | `{ modules: ['all'], actions: ['all'] }` |

The first three are flat code lists and can be compared directly: the gates and
`seed:rbac` share **39** codes; the gates and the new-tenant seeder share **2**.
The last two are JSONB blobs in System A with different internal shapes again;
`_shared/rbac.ts`'s `flattenPermissions` would turn `{ sales: ['*'] }` into
`sales.*`, which matches no gate.

## What that produces

- **77 Express route gates** name a code no seeded role can hold, so they pass
  only on the platform-admin bypass. 67 are live, 43 of those are called by the
  frontend.
- All 43 sit on prefixes that have an edge function but are **not proxied**, so:
  dev serves Express and denies every non-admin; production serves the edge
  function, which has no permission check at all. Nine of the 43 are DELETEs.
- **3 of 284 edge functions** import `_shared/rbac.ts`. The other 281 enforce
  authentication and tenant scoping and nothing else.

Tenant isolation is intact throughout — every function filters by `tenant_id`.
What is missing is intra-tenant privilege separation.

## Decision

**Settled 2026-09-02 (WF-R-01): see `docs/rbac-decision.md`.** In short: the `roles`
table (System A) survives because it is the one signup, the JWT and
`_shared/rbac.ts` already use and the only one anything populates; the canonical
vocabulary is the three-segment `module.resource.action` form stored nested in
`roles.permissions`, because `flattenPermissions` and `navigation-permissions.ts`
already speak it; and `roles.level` is the enforcement primitive until WF-R-03 puts
the claims in the token. The migration order is WF-R-02 through WF-R-09, in that
order, and the record explains why each step cannot move earlier.

The section below is the question as it stood before that decision, kept because it
records why the question was hard.

## What had to be decided before any code changes

1. **Which role system survives.** System A is what production uses and what
   signup depends on. System B is richer and better documented and is what every
   Express gate is written against. They cannot both be right.
2. **Which vocabulary the surviving system uses**, and how the JSONB blobs in
   System A map onto it.
3. Only then: rewrite the gate constant, verify against a non-admin role that the
   43 routes open, and carry the same codes onto the edge functions
   (SEC-EDGE-001). Doing that last step first exports the lockout to production.

UNVERIFIED from here: how many tenants exist, which seeder ran for each, and
whether `npm run seed:rbac` has ever been run against production. Those change
migration effort, not the decisions above.
