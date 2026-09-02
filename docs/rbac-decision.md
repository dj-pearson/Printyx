# RBAC decision record

Answers the three questions `docs/rbac-landscape.md` leaves open, so the next
reader does not derive the landscape a fifth time. **Decision only — WF-R-01
changes no handler code.** WF-R-02 through WF-R-09 implement it.

Written 2026-09-02 (WF-R-01). Every claim below was re-verified against the
repository at that date; where the landscape doc and the repository disagreed,
the repository won and the difference is noted.

## 1. Which role table survives: `roles` (System A)

Not because it is better. Because it is the one production runs on, and the
alternative is populated by nothing.

|                                     | System A `roles`                                                                         | System B `enhanced_roles`                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Populated for a new tenant          | Yes — `supabase/functions/signup/` requires it and fails `MISSING_ADMIN_ROLE` without it | No. `server/rbac-initializer.ts` is the only thing that would, and it has no importers |
| In the JWT                          | Yes — signup writes the id to `app_metadata.roleId` and `users.role_id`                  | No                                                                                     |
| Read by edge functions              | Yes — `_shared/rbac.ts` resolves level and code from it                                  | No edge function references it                                                         |
| Read by Express `requirePermission` | No                                                                                       | Yes                                                                                    |

Edge functions are what production serves. Choosing System B would mean changing
signup, the JWT claim, `users.role_id` and every consumer of `_shared/rbac.ts`, in
favour of a catalogue that only exists where somebody has hand-run
`npm run seed:rbac`. That is not a migration, it is a rewrite with a lockout in
the middle.

**System B is not deleted by this decision.** `server/database-updater/seeders/rbac-seeder.ts`
holds the best-documented 131-code catalogue in the repository, and it is the
source the surviving vocabulary is drawn FROM (see 2). What it stops being is a
runtime authority: `enhanced-rbac-middleware.ts` reading tables nothing seeds is
what produces the 77 unsatisfiable gates.

## 2. Which vocabulary is canonical: `module.resource.action`

`roles.permissions` is JSONB, so a vocabulary is a decision about its SHAPE, and
one shape is already load-bearing on both sides:

- `supabase/functions/_shared/rbac.ts`'s `flattenPermissions` turns
  `{ sales: { lead: ['view_own'] } }` into `sales.lead.view_own`.
- `client/src/lib/navigation-permissions.ts` gates pages on exactly that form
  (`admin.role.assign`, `admin.settings.view`).
- `server/middleware/rbac-route-helper.ts`'s 132 gates use it too.

So the canonical vocabulary is the three-segment `module.resource.action` form,
stored NESTED in `roles.permissions` so that `flattenPermissions` produces it
without a translation layer.

The two System A seeders do NOT produce it and both have to change:
`server/role-seeder.ts` writes `{ sales: ['*'], admin: ['*'] }`, which flattens to
`sales.*`, and `server/multi-location-role-seeder.ts` writes
`{ modules: ['all'], actions: ['all'] }`, which flattens to `modules.all` — a
permission named after the shape of the blob rather than after anything. Neither
matches a single gate.

**Wildcards are not part of the vocabulary.** `sales.*` matches no gate today and
making the matcher understand it would mean every gate check becomes a pattern
match. A role that should hold everything holds the enumerated codes, which is
also what makes an audit of "who can do X" answerable.

## 3. Migration order

The order matters more than the content: doing step 4 first exports the lockout
to production, which is the failure `docs/rbac-landscape.md` already warns about.

1. **WF-R-02 — seed the surviving table on a fresh database.** One seeder, writing
   the nested three-segment shape, run automatically for a new tenant rather than
   by hand. Until this exists, everything downstream is untestable.
2. **WF-R-03 — put `roleLevel`, the role `code` and the flattened permission list
   into `app_metadata` at every token issuance.** Edge functions cannot enforce
   anything they have to make a database round trip to learn, and today
   `_shared/rbac.ts` is imported by 3 of 284 functions partly for that reason.
3. **WF-R-04 — one Deno-side scope helper**, applied to the nine core list
   endpoints first, so the shape is proven on a small surface.
4. **WF-R-05 to WF-R-07 — the sales, operations and service surfaces**, in that
   order, because sales has the most read paths and will surface the mistakes.
5. **WF-R-08 — the tenant org-structure admin.** Assigning a manager, location and
   region is what makes tier scoping mean anything; before it, every user is
   unscoped by default.
6. **WF-R-09 — close the `/api/me` fail-open default.** Last, deliberately: it is
   the step that starts denying, and it should deny only once the claims it reads
   are being issued and the org structure exists to read.

**Level is the enforcement primitive until step 2 lands.** `roles.level` is 1-8
and `_shared/rbac.ts` already exposes `requireRoleLevel`. A permission-code gate
copied onto an edge function before the codes are seeded denies everyone below
platform admin — SEC-EDGE-002's finding, and the reason CLAUDE.md tells you to
gate new edge functions on level.

Owner tiers, for step 3 onward: L1-2 own work, L3-4 team and location, L5-6
region, L7-8 company and platform.

## What this record does not settle

Still UNVERIFIED from a checkout, unchanged from the landscape doc: how many
tenants exist, which seeder ran for each, and whether `npm run seed:rbac` has ever
been run against production. Those change the effort of step 1, not the decision.
