# PRD: Migrate Scheduling Family (Calendar + Meetings + Transcription) to Edge Function(s)

**Parent:** `prd-edge-functions-migration.md` · **Phase:** 5 · **Week:** 14 (July 22 – July 28) · **Story:** US-022

**Why:** Four Express route files make up the scheduling family: calendar connections (Google/Microsoft), meeting scheduling, advanced scheduling (constraint-based optimization), and meeting transcription. Two cross-cutting challenges define this migration: **porting `googleapis` + `@microsoft/microsoft-graph-client` Node SDKs to fetch-based REST**, and **deciding the transcription provider** flagged as an Open Question in the master PRD.

**Critical finding from code audit:** `meeting-transcription-service.ts` line 256 comment reveals transcription is a **mock today** — "In production, this would use OpenAI Whisper, Google Speech, etc." The endpoint has never been wired to a real STT service. Same stub-port pattern as signatures in Phase 4.

---

## 1. Scope

**Source Express files:**
- `server/routes/calendar-routes.ts` (288 lines, **9 endpoints**) — connections + events CRUD + availability
- `server/routes/meeting-scheduling-routes.ts` (911 lines, **8 endpoints**) — scheduling requests, meetings, types, rooms, analytics, optimization
- `server/routes/advanced-scheduling-routes.ts` (492 lines, **9 endpoints**) — constraint-based optimization, reschedule, patterns, strategies
- `server/routes/meeting-transcription-routes.ts` (851 lines, **9 endpoints**) — recordings, transcription, notes, highlights, content search, speaker profile

**Services:**
- `server/services/calendar-service.ts` (262 lines) — uses `googleapis` + `@microsoft/microsoft-graph-client`
- `server/services/meeting-scheduling-service.ts` (774 lines)
- `server/services/meeting-transcription-service.ts` (828 lines) — **mock transcription only**
- `server/services/constraint-solver.ts` (548 lines) — advanced-scheduling optimization engine

**Existing edge functions:**
- `supabase/functions/scheduling/` (334 lines) — audit overlap
- `supabase/functions/oauth-proxy/` (257 lines) — likely handles Google/Microsoft OAuth flow

**Target layout:** **2 edge functions** (calendar merges with meetings; transcription is separate due to potentially large payloads).

```
supabase/functions/
├── meetings/                         # calendar + meeting-scheduling + advanced-scheduling
│   ├── index.ts
│   ├── handlers/
│   │   ├── connections.ts            # calendar connections CRUD + sync (from calendar-routes)
│   │   ├── events.ts                 # calendar events CRUD
│   │   ├── availability.ts           # /availability + /find-meeting-time
│   │   ├── meetings.ts               # CRUD + schedule-request (from meeting-scheduling)
│   │   ├── types.ts                  # /meetings/types + /rooms
│   │   ├── analytics.ts              # combined from both services
│   │   ├── optimize.ts               # /optimize-schedule + advanced /optimize + /reschedule
│   │   ├── constraints.ts            # advanced-scheduling constraints
│   │   ├── patterns.ts               # user scheduling patterns
│   │   └── strategies.ts             # optimization strategies
│   ├── _google.ts                    # Google Calendar REST wrapper (replaces googleapis)
│   ├── _microsoft.ts                 # Microsoft Graph REST wrapper (replaces SDK)
│   └── _solver.ts                    # constraint solver (ported from constraint-solver.ts)
│
└── meeting-transcription/
    ├── index.ts
    ├── handlers/
    │   ├── recordings.ts             # upload + get
    │   ├── transcription.ts          # get + process
    │   ├── notes.ts
    │   ├── highlights.ts
    │   ├── content.ts                # /content/search + /analytics/content
    │   └── speakers.ts               # /speakers/profile
    └── _stt.ts                       # speech-to-text provider (mock OR real — see §4)
```

**Explicitly out of scope:**
- Adding new calendar providers (e.g., Apple iCloud, CalDAV). Stay on Google + Microsoft.
- Video conferencing integration (Zoom, Meet links) — keep current behavior (usually a field on the meeting row, not an API integration).

---

## 2. Endpoint parity matrix

### `calendar-routes.ts` — 9 endpoints
| Method | Path | Line |
|---|---|---|
| GET    | `/calendar/connections` | 18 |
| POST   | `/calendar/connections` | 45 |
| POST   | `/calendar/sync/:connectionId` | 75 |
| GET    | `/calendar/events` | 101 |
| POST   | `/calendar/events` | 163 |
| PUT    | `/calendar/events/:eventId` | 195 |
| DELETE | `/calendar/events/:eventId` | 218 |
| GET    | `/calendar/availability/:userId` | 234 |
| POST   | `/calendar/find-meeting-time` | 262 |

### `meeting-scheduling-routes.ts` — 8 endpoints
| Method | Path | Line |
|---|---|---|
| POST   | `/meeting-scheduling/schedule-request` | 18 |
| POST   | `/meeting-scheduling/schedule/:requestId` | 38 |
| GET    | `/meeting-scheduling/meetings` | 64 |
| GET    | `/meeting-scheduling/meetings/:meetingId` | 362 |
| GET    | `/meeting-scheduling/types` | 597 |
| GET    | `/meeting-scheduling/rooms` | 704 |
| GET    | `/meeting-scheduling/analytics` | 863 |
| POST   | `/meeting-scheduling/optimize-schedule` | 883 |

### `advanced-scheduling-routes.ts` — 9 endpoints
| Method | Path | Line |
|---|---|---|
| POST | `/advanced-scheduling/optimize` | 19 |
| POST | `/advanced-scheduling/reschedule` | 96 |
| GET  | `/advanced-scheduling/constraints` | 128 |
| POST | `/advanced-scheduling/constraints/validate` | 208 |
| GET  | `/advanced-scheduling/patterns/:userId` | 256 |
| POST | `/advanced-scheduling/patterns/:userId/update` | 311 |
| GET  | `/advanced-scheduling/strategies` | 342 |
| POST | `/advanced-scheduling/strategies` | 404 |
| GET  | `/advanced-scheduling/analytics` | 442 |

### `meeting-transcription-routes.ts` — 9 endpoints
| Method | Path | Line | Notes |
|---|---|---|---|
| POST | `/meeting-transcription/upload` | 35 | **audio file upload** |
| GET  | `/meeting-transcription/meetings/:meetingId/recordings` | 79 | |
| GET  | `/meeting-transcription/recordings/:recordingId/transcription` | 166 | |
| GET  | `/meeting-transcription/meetings/:meetingId/notes` | 308 | |
| GET  | `/meeting-transcription/meetings/:meetingId/highlights` | 558 | |
| POST | `/meeting-transcription/content/search` | 736 | |
| GET  | `/meeting-transcription/analytics/content` | 777 | |
| POST | `/meeting-transcription/speakers/profile` | 803 | |
| POST | `/meeting-transcription/recordings/:recordingId/process` | 828 | **STUB — triggers mock "transcription"** |

**Total: 35 endpoints.**

---

## 3. Tables + RLS plan

From `shared/schema.ts` (no dedicated meeting schema found — verify):
- `calendar_connections` — **holds OAuth access + refresh tokens** (sensitive)
- `calendar_events`
- `meeting_requests`
- `meetings`
- `meeting_types`
- `meeting_rooms`
- `scheduling_constraints`
- `scheduling_strategies`
- `user_scheduling_patterns`
- `meeting_recordings` — **may hold audio file URLs or blobs**
- `meeting_transcriptions`
- `meeting_notes`, `meeting_highlights`
- `speaker_profiles`

RLS files:
- `drizzle/rls/meetings.sql`
- `drizzle/rls/meeting-transcription.sql`

**Special: `calendar_connections.accessToken` + `.refreshToken`** must be redacted on all SELECT responses. Same pattern as manufacturer-orders + signatures.

---

## 4. Transcription provider decision

**Current state:** mock — `meeting-transcription-service.ts:256` generates fake transcription text. No real STT call.

**Options:**

| Option | Pros | Cons | Cost |
|---|---|---|---|
| **A. OpenAI Whisper API** | Already have OpenAI key (from AI PRD); good quality; REST-based | 25MB file limit; English-heavy quality | $0.006/min |
| **B. Deepgram Nova-2** | Streaming available; excellent accuracy; good diarization | Another vendor + env var | $0.0043/min (batch) |
| **C. Google Speech-to-Text** | Leverages existing Google API credentials | Complex setup; diarization requires separate API | $0.016/min (premium) |
| **D. AssemblyAI** | Best diarization + speaker labels + chapters | Another vendor | $0.00025-0.0041/min |
| **E. Leave stubbed** | No spend; no new dep | Transcription doesn't work | $0 |

**Recommendation: Option A (Whisper) for initial port, E (stub) as safety net.**

Rationale:
- OpenAI key already in Coolify (from AI features PRD)
- REST API straightforward: `POST https://api.openai.com/v1/audio/transcriptions` with multipart form data
- 25MB limit handles ~20-30 min meetings; longer recordings need chunking (document as follow-up)
- If product deprioritizes transcription, flip `TRANSCRIPTION_PROVIDER=stub` env var

### Port for `_stt.ts`:
```typescript
const provider = Deno.env.get('TRANSCRIPTION_PROVIDER') ?? 'stub';

export async function transcribe(audio: Blob): Promise<{ text: string; segments?: Segment[] }> {
  if (provider === 'stub') {
    return { text: 'Mock transcription — TRANSCRIPTION_PROVIDER not set to real provider' };
  }
  if (provider === 'whisper') {
    const form = new FormData();
    form.append('file', audio, 'audio.mp3');
    form.append('model', 'whisper-1');
    form.append('response_format', 'verbose_json');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}` },
      body: form,
    });
    if (!res.ok) throw new Error(`Whisper ${res.status}`);
    const data = await res.json();
    return { text: data.text, segments: data.segments };
  }
  throw new Error(`Unknown transcription provider: ${provider}`);
}
```

---

## 5. External dependencies to port

| Dependency | Express location | Deno port |
|---|---|---|
| `googleapis` SDK | calendar-service.ts L6 | REST fetch — Google Calendar v3 API. Main ops: events list/get/insert/patch/delete, freeBusy |
| `@microsoft/microsoft-graph-client` | calendar-service.ts L7 | REST fetch — Graph API v1.0. Main ops: calendar events, availability |
| OAuth token refresh | both SDKs handled automatically | Manual fetch to token endpoints with refresh token; update row in `calendar_connections` |
| `constraint-solver.ts` (548 lines) | advanced-scheduling | Port as `_solver.ts` — pure algorithm, likely no Node-only deps. **Verify** |
| Mock transcription | meeting-transcription-service.ts | Real Whisper via `_stt.ts` (see §4) |
| Audio file storage | `meeting_recordings` table | Supabase Storage bucket `meeting-recordings/` with tenant-prefixed paths + signed URLs |
| Meeting → document pipeline | unclear today | Cross-links with AI features PRD US-020 (documents/from-meeting) |

---

## 6. Google + Microsoft REST wrappers

### `_google.ts` — Google Calendar v3 essentials
```typescript
async function request<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { ...init?.headers, 'Authorization': `Bearer ${accessToken}` },
  });
  if (res.status === 401) throw new TokenExpiredError();
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function listEvents(accessToken: string, calendarId: string, params: { timeMin?: string; timeMax?: string }) {
  const q = new URLSearchParams(params as Record<string, string>);
  return request<{ items: GoogleEvent[] }>(`/calendars/${encodeURIComponent(calendarId)}/events?${q}`, accessToken);
}

export async function createEvent(accessToken: string, calendarId: string, event: GoogleEvent) {
  return request<GoogleEvent>(`/calendars/${encodeURIComponent(calendarId)}/events`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
}

export async function freeBusy(accessToken: string, items: string[], timeMin: string, timeMax: string) {
  return request<{ calendars: Record<string, { busy: { start: string; end: string }[] }> }>('/freeBusy', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin, timeMax, items: items.map(id => ({ id })) }),
  });
}

// Token refresh
export async function refreshToken(clientId: string, clientSecret: string, refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      grant_type: 'refresh_token', refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Refresh token ${res.status}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}
```

### `_microsoft.ts` — Graph API v1.0 equivalent
Same pattern, base URL `https://graph.microsoft.com/v1.0`, calendar path `/me/calendar/events` or `/users/{id}/calendar/events`.

**Both wrappers are thin** — no state, no interceptors. Handlers call them + handle `TokenExpiredError` by triggering refresh + retry once.

---

## 7. Acceptance criteria

### Functional parity

**Calendar:**
- [ ] Connect Google account via OAuth — `oauth-proxy` edge function exchanges code for tokens, writes to `calendar_connections`
- [ ] Same for Microsoft
- [ ] Sync existing calendar → local events mirror updated
- [ ] Events CRUD via local API propagates to Google/Microsoft
- [ ] `find-meeting-time` queries freeBusy across participants, returns slots

**Meeting scheduling:**
- [ ] Schedule request creates + runs optimizer
- [ ] Meetings CRUD works
- [ ] Room booking prevents double-book
- [ ] Analytics returns per-tenant meeting stats

**Advanced scheduling:**
- [ ] Optimize returns same schedule as Express for fixture input
- [ ] Constraints validate correctly (hard vs. soft)
- [ ] User patterns analysis surfaces meeting habits

**Transcription:**
- [ ] Upload saves audio to Supabase Storage
- [ ] Process endpoint calls Whisper (or stub based on env)
- [ ] Transcription text saved to `meeting_transcriptions`
- [ ] Notes + highlights extraction works (may use Claude — audit)
- [ ] Content search runs against transcription corpus

### Security / RLS
- [ ] RLS on all ~13 tables
- [ ] Calendar tokens redacted on GET
- [ ] OAuth state parameter CSRF protection preserved
- [ ] Two-tenant test passes
- [ ] Audio files in Supabase Storage isolated by tenant path prefix

### External API readiness
- [ ] `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in Coolify
- [ ] `MICROSOFT_CLIENT_ID` + `MICROSOFT_CLIENT_SECRET` in Coolify
- [ ] `TRANSCRIPTION_PROVIDER` env var set (`stub` or `whisper`)
- [ ] Token refresh automatic on 401 response

### Frontend compatibility
- [ ] Calendar page loads + shows connections
- [ ] Meeting scheduler flow works end-to-end
- [ ] Transcription UI loads (if stubbed, show "coming soon" banner)
- [ ] Playwright MCP pass on each flow

### Deletion
- [ ] 4 Express route files deleted
- [ ] 4 services deleted (ported to `_*.ts` helpers)
- [ ] `googleapis` removed from package.json
- [ ] `@microsoft/microsoft-graph-client` removed
- [ ] Route registry entries removed

### Quality gates
- [ ] `deno check` passes on both edge functions
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

---

## 8. Test plan

### Unit (Deno)
- `_google.test.ts` — mock fetch; verify request shape for events list, create, freeBusy
- `_microsoft.test.ts` — equivalent
- `_solver.test.ts` — constraint solver on fixture (3 participants, 5 constraints)
- `_stt.test.ts` — stub mode returns placeholder; whisper mode mocks fetch

### Integration
- Local: full OAuth → sync → event CRUD round-trip with real Google test account
- Scheduling: 5-participant meeting with conflicting availability; verify optimizer output
- Transcription: upload 30s audio, process, verify transcript row

### Production smoke
- Connect a real Google account in prod
- Create a meeting, verify syncs to Google Calendar
- Upload a meeting recording, process with Whisper, verify accurate transcript

---

## 9. Rollback

Calendar integration is user-facing — breakage is highly visible but recoverable.

**Rollback plan:**
1. Keep OAuth tokens intact across rollback (no schema changes)
2. Revert edge function PR → Express 404s → users see "calendar not available"
3. Re-deploy with fixes

**Transcription rollback:** flip `TRANSCRIPTION_PROVIDER=stub`; processing endpoint returns placeholder. No data loss.

---

## 10. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `googleapis` feature used that has no REST equivalent (batch requests, server-side events) | Medium | Medium | Audit every calendar-service.ts call before porting; most features have REST v3 support |
| OAuth refresh token expires mid-migration | Low | Medium | Test refresh path; calendar connections degrade until user re-auth |
| `constraint-solver.ts` uses a solver library (e.g., javascript-lp-solver) | Medium | Medium | Read before porting; if solver-based, verify it runs in Deno or replace with heuristic |
| Whisper 25MB limit hits long meetings | Medium | Medium | Chunk audio client-side (already a follow-up) or switch to Deepgram (streaming) |
| Audio file storage cost balloons in Supabase Storage | Low | Medium | Retention policy: delete recordings > 90 days; document in Phase 6 cron |
| Graph API rate limits under bulk sync | Low | Medium | Respect `Retry-After` header; queue sync via pg_cron for large accounts |
| Meeting-transcription stub status mistaken for live by users | High | Low | Banner in UI: "Transcription processing — results within 24h" when in stub mode |

---

## 11. Open questions

1. **Is `constraint-solver.ts` algorithm-based or library-based?** Read file; affects port.
2. **Does the current `oauth-proxy/` edge function handle Google + Microsoft OAuth?** Audit before building calendar connection flow — may just need to route to existing proxy.
3. **Whisper vs. Deepgram final choice** — Whisper recommended, but if Dan has a preference or prior integration, defer.
4. **Audio file upload — current max size?** Affects chunking strategy.
5. **Notes + highlights extraction — does it use Claude today?** If yes, reuse `_shared/anthropic.ts`.
6. **Meeting → AI document pipeline** — how tightly coupled? Cross-reference with AI features PRD US-020 open questions.
7. **Calendar sync frequency** — on-demand only, or periodic? If periodic, move to `pg_cron` Phase 6.
8. **Speaker profile feature** — voice-based ID (requires audio embeddings) or name-based (just a label)?

---

## 12. Definition of done

- [ ] `meetings/` + `meeting-transcription/` edge functions live
- [ ] Google + Microsoft OAuth flows work end-to-end
- [ ] Calendar sync + events CRUD works in prod
- [ ] Constraint solver produces matching output vs. Express fixtures
- [ ] Transcription via Whisper verified with one real recording OR stub mode explicitly documented
- [ ] `googleapis` + `@microsoft/microsoft-graph-client` removed
- [ ] RLS on all scheduling tables + Storage bucket
- [ ] 4 Express files + 4 services deleted
- [ ] Type checks + build pass
- [ ] Phase 5 complete → proceed to Phase 6 (Admin, Reports, Sunset)
