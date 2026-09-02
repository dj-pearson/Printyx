# The eighteen blog stages nothing can invoke

AUDIT-025. Every US-BLOG story is marked passing, and eighteen of the
subsystem's thirty-six edge functions cannot be reached from anywhere: no client
tree names their path, none is a `crmProxies` alias target, `server.ts` maps no
segment onto them, and no `drizzle/cron/*.sql` posts to them.

This file answers AC1 — for each one, which way in is missing — and corrects the
hypothesis in AC2.

## AC2 was wrong: these were not meant to be blog_jobs handlers

`supabase/functions/blog-jobs/` runs registered handlers in-process and pings
itself via `POST /blog-jobs/run-due` from a k8s CronJob, so the suggestion was
that a stage shipped as its own function had simply been built in the wrong
shape.

It does not hold. A job handler is

```ts
type Handler = (admin: Admin, job: JobRow, req: Request) => Promise<unknown>;
```

with no routing at all, and `JOB_TYPES` names exactly two: `noop`, a smoke test,
and `retention_cleanup`. Every one of the eighteen is a multi-method HTTP
surface — `GET`/`POST`/`PATCH`/`PUT`/`DELETE`, several with sub-resources — that
authenticates a user, gates on a role and writes an audit row per mutation.
Those are admin consoles. Converting one into a `Handler` would mean discarding
its API, not registering it.

The job runner is worth knowing about for a different reason: with two
registered types, **nothing in this subsystem is scheduled** beyond a cleanup
sweep. Any stage meant to run on a timer needs a `JOB_TYPES` entry as well as a
screen.

## What each one is missing

`kill` marks a function that calls `assertAgentsActive`, which is the agent
entry-point convention — a function carrying it is meant to run on its own, so
it needs a scheduler entry as well as a console.

| Function                     | Lines | Missing                                                   | US-BLOG                      |
| ---------------------------- | ----- | --------------------------------------------------------- | ---------------------------- |
| `blog-ai-costs`              | 532   | admin surface                                             | 078                          |
| `blog-analytics-intel`       | 1807  | admin surface                                             | 061, 065, 067, 068, 069      |
| `blog-audience-variants`     | 516   | admin surface                                             | 072                          |
| `blog-authoring-tools`       | 1694  | admin surface                                             | 029, 032                     |
| `blog-authors`               | 467   | admin surface                                             | 028                          |
| `blog-content-platform`      | 2613  | admin surface                                             | 042, 074, 075, 076, 077      |
| `blog-distribution-engine`   | 2323  | admin surface                                             | 021, 052, 053, 054, 055, 063 |
| `blog-experiments`           | 587   | admin surface                                             | 064                          |
| `blog-outline-variants`      | 469   | admin surface                                             | 030                          |
| `blog-outreach`              | 2316  | admin surface                                             | 056                          |
| `blog-performance-dashboard` | 470   | admin surface                                             | 062                          |
| `blog-pipeline`              | 786   | **scheduler entry + admin surface** (kill)                | 073, 078                     |
| `blog-platform-api`          | 1568  | admin surface for its authenticated half only — see below | 011, 079, 080, 081, 083, 084 |
| `blog-prepublish-qa`         | 544   | admin surface                                             | 027, 040                     |
| `blog-rank-forecast`         | 540   | admin surface                                             | 041                          |
| `blog-serp-monitor`          | 2031  | **scheduler entry + admin surface** (kill)                | 066, 070, 071                |
| `blog-syndication`           | 690   | admin surface                                             | 043                          |
| `blog-topic-intel`           | 2192  | admin surface                                             | 017                          |

Roughly 21,000 lines behind eighteen doors with no handle.

### blog-platform-api is partly headless by design

Its `/public/*` branch sits **before** the auth gate and answers `GET` only, and
`/webhooks` is an inbound receiver. Neither is supposed to have a caller in a
client tree, so counting the whole function as an unreachable stage overstates
it — that half is reachable by anyone with the URL. Its authenticated branches
(`api-keys`, `backup`, `compliance`, `widget`) are in the same position as the
other seventeen.

`docs/unreferenced-edge-fns-baseline.json` should keep listing it; the guard
looks for a caller and there genuinely is none in the repo. The distinction
belongs here, not in the baseline.

## Why the closure record let this happen

None of the 86 US-BLOG stories' acceptance criteria included "something invokes
this". A story that ships an edge function and a passing `deno check` reads as
done. AUDIT-024 records the same shape four other times in this codebase —
CRMX-016's booking surface, PROD-008c billing, PROD-008d documents, AUDIT-023's
calculator — and this is the largest instance.

The check that would have caught it is `npm run check:unreferenced-edge-fns`,
which now exists. It cannot be applied retroactively to a closed story, which is
what AC4 is for: the stories in the table above are reopened, each with a note
naming the function nothing can reach.

## What "resolved" means for an entry here

One of three things, and the table says which:

1. **A screen**, wired into `client/src/pages/platform-admin/blog/` beside the
   eighteen prefixes that page already calls.
2. **A `JOB_TYPES` entry** in `blog-jobs`, for the two that carry the kill
   switch and are meant to run unattended.
3. **A deletion**, if the stage is not wanted. That is a real option here — the
   subsystem shipped fast and some of these may never have had a customer.

Do not resolve one by adding a `crmProxies` entry. That would make dev forward
the prefix to a function no page calls, which changes nothing about whether the
feature exists.
