# Renewal model decision (AUDIT-026, round 182)

## Decision

The **autopilot model** survives: `contract_renewal_tracking`,
`renewal_auto_quotes`, `renewal_proposals`, `renewal_analytics`,
`renewal_automation_rules`, `renewal_autoquote_settings` and
`renewal_suppressions`, served by `supabase/functions/contract-renewal/` and
`supabase/functions/renewal-autoquote/`, and used by the two routed renewal
pages, `ContractRenewalDashboard` (`/contract-renewal-autopilot`) and
`RenewalAutoQuote` (`/renewals`).

The **unwired model** is retired: `contract_renewals`, `renewal_activities`,
`renewal_playbooks` and `expansion_opportunities` (declared in
`shared/renewal-management-schema.ts`).

## Why

- **Nothing reaches it.** WF-S-11 checked all eight client trees: there are
  zero references to `/api/contract-renewals`, `/api/renewal-activities`,
  `/api/renewal-playbooks` or `/api/expansion-opportunities`, no `crmProxies`
  entry, no `server.ts` alias and no `pg_cron` post. Its 18 Express handlers
  and four edge functions have never had a caller.
- **It models the same domain as a model that does have one.** Keeping both
  means two answers to "which contracts are up for renewal", and the one users
  see is the autopilot's.
- **Neither candidate capability justifies the 18 endpoints.** AUDIT-026 named
  playbooks and expansion tracking as the two things the unwired model adds.
  - Expansion tracking overlaps the opportunity radar (COP-B04), which
    detects plays from the installed base (`lease_expiring`,
    `contract_ending`, `volume_over_tier`, `service_burden`) and converts one
    to a deal on the canonical `deals` table in a click. An expansion
    opportunity is a deal in all but name; a second, hand-entered list of them
    beside `deals` would be a second pipeline.
  - Playbooks are real product value, but a playbook screen would be a new
    feature built on the autopilot's renewals, not a reason to keep a parallel
    renewal model. If it is built, it should be scoped as its own story over
    `contract_renewal_tracking`.

## What was done (round 182)

- `server/routes-renewal-management.ts` (18 handlers) is deleted and unmounted.
- `supabase/functions/contract-renewals/`, `renewal-activities/`,
  `renewal-playbooks/` and `expansion-opportunities/` are deleted, which takes
  all four out of `docs/unreferenced-edge-fns-baseline.json` (AUDIT-026 AC4).

## What is deliberately NOT done yet: dropping the four tables

AUDIT-026's retire branch asks for a migration that drops the four tables. That
is irreversible and loses whatever rows a deployed database holds, and nothing
in this repository can tell whether production holds any. The code retirement
is reversible from git; the drop is not. **The drop migration needs an explicit
go-ahead from the owner**, ideally after a row count on production:

```sql
select 'contract_renewals', count(*) from contract_renewals
union all select 'renewal_activities', count(*) from renewal_activities
union all select 'renewal_playbooks', count(*) from renewal_playbooks
union all select 'expansion_opportunities', count(*) from expansion_opportunities;
```

If every count is zero, drop them with a generated migration
(`npm run db:generate` after removing the four declarations from
`shared/renewal-management-schema.ts`). If any is non-zero, export first.
