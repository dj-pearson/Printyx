# Which project model survives (WF-P-07)

Decided 2026-09-02. **`projects` survives. `implementation_projects` is dropped.**

## The two models

This repo carried two tables for the same idea, and neither knew about the other.

|                            | `projects` (shared/schema.ts)                                                | `implementation_projects` (shared/sales-handoff-schema.ts)                                    |
| -------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Reached from a browser     | Yes — TaskHub's Projects tab (`/api/projects`, six routes land on that page) | No                                                                                            |
| Edge function              | `supabase/functions/projects/`                                               | `supabase/functions/implementation-projects/` — in `docs/unreferenced-edge-fns-baseline.json` |
| Express router             | `server/routes-tasks.ts` (registered, serves dev)                            | `server/routes-sales-handoff.ts` — registered, but no client tree named the prefix            |
| Referenced by other tables | `tasks.project_id`                                                           | nothing                                                                                       |
| Rows written by            | TaskHub's create-project dialog                                              | nothing reachable                                                                             |

`implementation_projects` had the richer column list — `handoff_id`, `project_manager_id`,
`team_members`, `milestones`, `risks`, `issues`, `current_phase`, `customer_satisfaction`,
`lessons_learned`. That is what made it look like the better model. But every one of those
columns was written by a code path no user could reach, and choosing it would have meant
repointing `tasks.project_id`, TaskHub, the task edge function's `projectId` filter and the
templates view at a table with no rows.

## What moved across

`projects` gained the three things the losing model had that it actually needed:

- `contract_id` — the contract the work is delivering. Migration 0002 had dropped an earlier
  `contract_id` from this table; this is not that column back, it is a fresh nullable one with
  a tenant-scoped index.
- `handoff_id` — the `sales_handoff_checklists` row the project came out of.
- `project_type` — installation, migration, expansion, training. Same vocabulary the handoff
  types use.
- `milestones` — jsonb, the same `{name, description, dueDate, completedDate, status}` shape
  the losing model declared.

Deliberately **not** carried across, because nothing wrote or read them and a column with no
writer is the `docs/unwritten-tables-baseline.json` problem one level down: `project_manager_id`
(`created_by` and the task assignees are who is actually on it), `team_members`, `risks`,
`issues`, `current_phase`, `last_customer_update`, `next_customer_update`,
`customer_satisfaction`, `budgeted_hours`, `lessons_learned`. If a risk register is wanted it
is a story, not a column.

## Equipment serials

A project does not link to equipment directly and no new column was added for it. The serials
a project covers are **derived**: `projects.contract_id` -> `purchase_orders.source_contract_id`
-> `equipment.purchase_order_id`, which is the chain WF-L-04 built when receiving a PO started
creating equipment rows. A project with no contract has no serials to show and says so rather
than showing an empty list that reads like "none ordered".

## What was deleted

- `supabase/functions/implementation-projects/` (186 lines)
- `server/routes-sales-handoff.ts` — by then it held nothing else; WF-C-06 had already moved
  the handoff, task and template handlers to their edge functions
- the `implementationProjects` declaration, its insert schema and its two exported types
- migration `0080` drops the table, renaming it to `implementation_projects_retired_wf_p_07`
  instead if it turns out to hold rows
