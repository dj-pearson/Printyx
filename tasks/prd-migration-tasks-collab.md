# PRD: Consolidate Tasks + Team Collaboration into Edge Function(s)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 4 · **Week:** 11 (July 1 – July 7) · **Story:** US-018

**Why:** Task and team-collaboration code is highly fragmented — 2 Express route files (1,227 lines) partially duplicated by **6 existing edge functions** (`tasks/`, `tasks-enhanced/`, `tasks-bulk/`, `tasks-stats/`, `task-comments/`, `teams/`) totaling ~981 lines. Every new task feature picked a different backend, and the frontend pays for it (TaskHub, MyTasks, AllTasks, Templates, AIInsights, TeamLeadDashboard all hit different paths). This PRD merges into ≤2 canonical edge functions.

---

## 1. Scope

**Express source:**
- `server/routes/task-routes.ts` (447 lines, **9 endpoints**) — list, CRUD, schedule, categories, time-entry, suggestions
- `server/routes/team-collaboration-routes.ts` (780 lines, **13 endpoints**) — teams, projects, capacity, insights, templates, analytics

**Services:**
- `server/services/task-scheduling-service.ts` — scheduling logic (recurring tasks, assignment rules?)

**Existing edge functions (6):**
| Function | Lines | Suspected purpose | Merge? |
|---|---|---|---|
| `tasks/` | 273 | core task CRUD | **becomes canonical `tasks/`** |
| `tasks-enhanced/` | 134 | enhanced list (with aggregations?) | merge into `tasks/` |
| `tasks-bulk/` | 119 | bulk ops | merge into `tasks/` |
| `tasks-stats/` | 100 | stats/aggregates | merge into `tasks/` |
| `task-comments/` | 160 | comments CRUD | merge into `tasks/` |
| `teams/` | 195 | team CRUD | **becomes canonical `teams/`** |

**Target: 2 canonical edge functions** — `tasks/` and `teams/`. Tasks is high-volume CRUD; teams is lower-frequency, org-chart oriented. Splitting keeps deploy blast radius tight on whichever gets more churn.

```
supabase/functions/
├── tasks/                             # canonical — absorbs 5 existing + Express task-routes.ts
│   ├── index.ts
│   ├── handlers/
│   │   ├── tasks.ts                   # CRUD (6 endpoints)
│   │   ├── categories.ts              # GET /categories
│   │   ├── schedule.ts                # POST /schedule
│   │   ├── time-entries.ts            # POST /:taskId/time-entry
│   │   ├── suggestions.ts             # GET /suggestions, POST /suggestions/:id/accept
│   │   ├── comments.ts                # CRUD — merged from task-comments/
│   │   ├── bulk.ts                    # bulk ops — merged from tasks-bulk/
│   │   ├── stats.ts                   # merged from tasks-stats/
│   │   └── enhanced.ts                # if any unique endpoints — merged from tasks-enhanced/
│   └── _scheduling.ts                 # ported from task-scheduling-service.ts
│
└── teams/                             # canonical — absorbs team-collaboration-routes.ts
    ├── index.ts
    ├── handlers/
    │   ├── teams.ts                   # 4 endpoints (CRUD + members + capacity + insights)
    │   ├── projects.ts                # 6 endpoints (CRUD + assignments/optimize + dependencies)
    │   ├── templates.ts               # 1 endpoint (GET /collaboration/templates)
    │   └── analytics.ts               # 1 endpoint (GET /collaboration/analytics)
    └── _optimize.ts                   # project-assignment optimizer (if present)
```

**Explicitly out of scope:**
- Task notifications (if any — look for email/push logic; if present, use Supabase Realtime for in-app + SendGrid for email)
- Integration with external task systems (ClickUp via `routes-clickup-tasks.ts`) — separate domain, out of this PRD

---

## 2. Parity audit (pre-code)

Produce `docs/tasks-collab-parity.md` in the PR body before writing any handler code. For each of the 9 + 13 = 22 Express endpoints AND the ~? endpoints in the 6 edge functions, list:

| Method | Path | Express loc | Edge loc today | Canonical loc | Status | Action |

**Status values:** `only-express`, `only-edge`, `both-match`, `both-diverged`, `duplicate-edge`.

**Action values:** `port-to-canonical`, `merge-edge-into-canonical`, `delete-duplicate`, `delete-express-only`.

---

## 3. Endpoint parity matrix (Express side)

### `task-routes.ts` — 9 endpoints
| Method | Path | Line | Notes |
|---|---|---|---|
| GET    | `/tasks/` | 19 | list (big handler — 118 lines) |
| POST   | `/tasks/` | 118 | create |
| PUT    | `/tasks/:taskId` | 188 | update |
| DELETE | `/tasks/:taskId` | 211 | |
| POST   | `/tasks/schedule` | 227 | recurring/scheduled |
| GET    | `/tasks/categories` | 308 | enum list or DB-backed? |
| POST   | `/tasks/:taskId/time-entry` | 331 | time tracking |
| GET    | `/tasks/suggestions` | 362 | **AI-assisted?** — audit for Claude call |
| POST   | `/tasks/suggestions/:id/accept` | 414 | |

### `team-collaboration-routes.ts` — 13 endpoints
| Method | Path | Line | Notes |
|---|---|---|---|
| POST | `/team-collaboration/teams` | 18 | |
| GET  | `/team-collaboration/teams` | 38 | |
| GET  | `/team-collaboration/teams/:teamId` | 124 | |
| POST | `/team-collaboration/teams/:teamId/members` | 213 | |
| GET  | `/team-collaboration/teams/:teamId/capacity` | 230 | |
| GET  | `/team-collaboration/teams/:teamId/insights` | 246 | |
| POST | `/team-collaboration/projects` | 262 | |
| GET  | `/team-collaboration/projects` | 282 | |
| GET  | `/team-collaboration/projects/:projectId` | 403 | |
| POST | `/team-collaboration/projects/:projectId/assignments/optimize` | 574 | **algorithm** |
| GET  | `/team-collaboration/projects/:projectId/dependencies` | 598 | |
| GET  | `/team-collaboration/collaboration/templates` | 615 | |
| GET  | `/team-collaboration/collaboration/analytics` | 707 | |

---

## 4. Tables + RLS plan

From `shared/task-schema.ts` + `shared/team-alerts-schema.ts`:
- `tasks`
- `task_comments`
- `task_categories`
- `task_time_entries`
- `task_suggestions` (AI-generated?)
- `task_schedules`
- `teams`
- `team_members`
- `projects`
- `project_assignments`
- `project_dependencies`
- `collaboration_templates`
- `team_alerts` (from `team-alerts-schema.ts`)

RLS files:
- `drizzle/rls/tasks.sql` — standard template on all task-related tables
- `drizzle/rls/teams.sql` — standard template on team-related tables

---

## 5. AI suggestions endpoint

`GET /tasks/suggestions` (line 362) is flagged for audit. If it uses Claude:
- Reuse `_shared/anthropic.ts` from Outreach
- Move prompt-building logic to `_scheduling.ts` or a new `_ai.ts`
- Cache responses where reasonable (suggestions don't need to be real-time-fresh)

Read the endpoint implementation during audit; if it's rule-based (no external API), port as pure TS.

---

## 6. Project-assignment optimizer

`POST /projects/:projectId/assignments/optimize` (line 574) suggests an algorithm — assign team members to project tasks based on capacity / skill / availability. Port the algorithm to `_optimize.ts` as a pure function.

**Complexity check:** if it uses ILP (integer linear programming) or any external solver library, that's a Node-only dependency risk. Read before porting. Expect it's greedy/heuristic, not solver-based.

---

## 7. Acceptance criteria

### Audit
- [ ] `docs/tasks-collab-parity.md` published — all 22 Express endpoints + all edge-function endpoints classified
- [ ] Duplicates resolved, canonical location assigned to each

### Functional
- [ ] All Express endpoints ported or reconciled
- [ ] Existing edge-function endpoints preserved (no frontend regression)
- [ ] Bulk task updates atomic (transaction)
- [ ] Task time-entry appends to time log
- [ ] Scheduled task generator produces same rows as Express for fixture inputs
- [ ] Project optimizer output matches Express for fixture inputs
- [ ] Team insights aggregates match Express numbers

### Security / RLS
- [ ] RLS on all task + team tables
- [ ] Two-tenant test: task in tenant A invisible to tenant B
- [ ] Cross-tenant project access forbidden even with valid projectId guess

### Frontend compatibility
- [ ] `TaskHub.tsx` loads
- [ ] `my-tasks.tsx` + `TaskManagement.tsx` + `BasicTaskManagement.tsx` all functional
- [ ] Task components (`TemplatesView`, `TaskTimeTracker`, `AIInsightsView`, `AllTasksView`, `MyTasksView`) all functional
- [ ] `TeamLeadDashboardNew.tsx` loads team insights + capacity
- [ ] `TeamStatsWidget` + `TeamLeaderboard` populate
- [ ] Playwright MCP pass on TaskHub, TeamLeadDashboard

### Deletion
- [ ] `server/routes/task-routes.ts` deleted
- [ ] `server/routes/team-collaboration-routes.ts` deleted
- [ ] `server/services/task-scheduling-service.ts` deleted (logic in `_scheduling.ts`)
- [ ] Duplicate edge functions removed from deploy: `tasks-enhanced/`, `tasks-bulk/`, `tasks-stats/`, `task-comments/` (merged into `tasks/`)
- [ ] Route registry entries removed
- [ ] `grep -r "task-routes\|team-collaboration-routes\|task-scheduling-service" server/ client/` returns zero matches

### Quality gates
- [ ] `deno check` passes
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

---

## 8. Test plan

### Unit (Deno)
- `_scheduling.test.ts` — recurring task generator on fixture (weekly, monthly, custom)
- `_optimize.test.ts` — project assignment on fixture team + tasks
- Comment CRUD with nested replies (if supported)

### Integration
- Local: create task, comment, log time, mark complete
- Bulk: update 50 tasks in one request, verify atomicity
- Scheduled: create a weekly recurring task, simulate Phase 6 pg_cron trigger (or API trigger), verify instances appear

### Production smoke
- TaskHub + all task views, verify no regressions
- Team Lead dashboard, verify capacity + insights

---

## 9. Rollback

Complex due to 6-function consolidation:

1. **PR 1:** canonical `tasks/` + `teams/` absorb all endpoints; existing 6 edge functions remain deployed
2. **Stability soak:** 48h, verify canonical handles traffic
3. **PR 2:** delete the 5 duplicate functions (`tasks-enhanced/`, `tasks-bulk/`, `tasks-stats/`, `task-comments/`, plus Express files)
4. If canonical regresses after PR 2, revert; existing 5 functions can't come back easily without git restore + Coolify redeploy

Keep PR 1 and PR 2 as separate merges.

---

## 10. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Duplicate endpoints diverge silently; canonical chooses wrong one | High | Medium | Require line-by-line diff in audit doc for every `both-diverged` row |
| AI suggestions endpoint uses Claude with expensive prompts | Medium | Medium | Audit during port; add per-tenant rate limit; cache suggestions for 15 min |
| Project optimizer uses a Node-only solver lib | Low | High | Read service before porting; if solver-based, decide: port to WASM or simplify to heuristic |
| `task-scheduling-service.ts` has cron-triggered methods (recurring generator) | High | Medium | The cron trigger moves to `pg_cron` Phase 6; edge function exposes the run-once endpoint |
| Frontend still calls deprecated edge-function paths during soak | Medium | Low | Keep old functions live during soak; sunset only after frontend verified |
| Large-tenant "list all tasks" paginates inefficiently and times out | Medium | Medium | Add cursor-based pagination during port if not already present |

---

## 11. Open questions

1. **What does `tasks-enhanced/` do that `tasks/` doesn't?** Audit reveals the distinction; maybe it's just a newer version and `tasks/` should be deleted instead.
2. **Are task suggestions AI-generated?** If yes, what model + prompt?
3. **Project assignment optimizer — algorithm type?** Greedy, heuristic, ILP?
4. **Team capacity calculation** — real-time aggregation or materialized view?
5. **Recurring task schedules** — stored as RRULE strings (iCal) or as discrete schedule records? Affects port of scheduling service.
6. **Team-alerts schema** — is that surfaced via WebSocket today? If yes, needs Realtime swap (Phase 6 US-027).
7. **`routes-clickup-tasks.ts`** — separate ClickUp integration. Intentionally out of this PRD; flag if it touches `tasks` table.

---

## 12. Definition of done

- [ ] Canonical `tasks/` + `teams/` cover all former Express + edge endpoints
- [ ] 5 duplicate edge functions deleted
- [ ] 2 Express route files + 1 service deleted
- [ ] RLS on all task + team tables
- [ ] All task/team frontend pages functional
- [ ] Type checks + build pass
- [ ] 72 hours stable before Phase 4 moves to US-019
