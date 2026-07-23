# Compliance Audit — Legal Documents, ADA/WCAG Accessibility, GDPR/CCPA

**Audit date:** 2026-07-23
**Scope:** Required legal/policy documents & pages; ADA / WCAG 2.1 AA accessibility; GDPR & US-equivalent (CCPA/CPRA) data-protection controls.
**Method:** Read-only static review of the Printyx codebase (client, server, shared schemas, Supabase edge functions). No runtime/penetration testing, no manual assistive-technology testing, and no legal-counsel review were performed. Findings are engineering-level and must be validated by qualified privacy/accessibility counsel before any public conformance claim.

---

## Executive Summary

Printyx has invested heavily in compliance scaffolding, and much of it is genuinely well-built: a real consent-records schema, a working data-export (portability) backend, an audit-logging layer, a DPA/subprocessor management service, and a legitimately strong *opt-in* accessibility feature set (accessibility widget, preference engine, live regions, focus traps, colour-blindness filters). **However, the platform cannot currently claim to be "fully compliant" with GDPR, CCPA/CPRA, or WCAG 2.1 AA.** The recurring failure pattern is the same across all three domains: **capabilities are built but not connected** — good backends with no reachable UI, good CSS with no class applied, good schemas the app never writes to — combined with **public statements that overclaim** relative to what the code delivers.

The three highest-risk issues:

1. **The "right to erasure" endpoint deletes nothing.** It marks a request "completed" and logs it, but purges no data (`server/routes-gdpr.ts` ~L270, acknowledged in a code comment). This is a false compliance signal for a right the Privacy Policy explicitly promises.
2. **Cookie consent is cosmetic.** The banner writes `accepted`/`declined` to `localStorage` and gates nothing — no scripts are suppressed, no per-category choice, no server record, no way to change the choice later. This is a non-compliant "accept-style" banner under GDPR/ePrivacy and CPRA.
3. **The app's baseline interactive accessibility fails WCAG 2.1.1 (Keyboard) systemically.** There are 0 uses of `role="button"`, ~2,260 `onClick` handlers against only ~28 keyboard handlers, and clickable `<div>`/`<tr>`/`<Card>` elements with no keyboard support across 57+ files — including the shared CRM data table. The Accessibility Statement's claim of "substantial conformance to WCAG 2.1 AA" is **not supportable** as written.

A prioritized remediation roadmap is at the end of this document.

---

## Overall Compliance Posture

| Domain | Documents / Prose | Technical Implementation | Public Claim Accuracy | Verdict |
|---|---|---|---|---|
| Legal documents | Present, above-average drafting | — | Overclaims (SLA, non-existent DPA) | **Partial** |
| GDPR (EU/UK) | Privacy Policy covers many topics | Export real; erasure/consent/retention broken or unreachable | Promises rights the app can't deliver | **Not compliant** |
| CCPA / CPRA (US) | Basic CCPA section present | No "Do Not Sell/Share", no GPC signal | Overclaims | **Not compliant** |
| ADA / WCAG 2.1 AA | Strong Accessibility Statement | Opt-in features strong; baseline keyboard access fails | "Substantial conformance" not supportable | **Not compliant** |

---

## Part 1 — Legal Documents & Required Pages

### 1.1 Document inventory

| Document | Exists | Routed | Linked (reachable) |
|---|---|---|---|
| Privacy Policy | ✅ `client/src/pages/legal/PrivacyPolicy.tsx` | ✅ `/privacy` | ✅ footer, homepage, cookie banner |
| Terms & Conditions | ✅ `TermsAndConditions.tsx` | ✅ `/terms` | ✅ footer, homepage |
| EULA | ✅ `EndUserLicenseAgreement.tsx` | ✅ `/eula` | ✅ footer, homepage |
| Accessibility Statement | ✅ `AccessibilityStatement.tsx` | ✅ `/accessibility` | ❌ **orphaned — no link anywhere** |
| Cookie Policy (standalone) | ❌ | ❌ | Only Privacy Policy §8 + banner |
| Data Processing Agreement (DPA) | ❌ (no legal doc) | ❌ | — |
| Subprocessor list | ❌ | ❌ | — |
| SLA | ❌ (referenced, absent) | ❌ | — |
| "Do Not Sell/Share" page | ❌ | ❌ | — |
| GDPR self-service dashboard | ✅ `GdprComplianceDashboard.tsx` | ❌ **not routed (dead code)** | ❌ |

### 1.2 Content gaps by document

**Privacy Policy — weakest document vs. GDPR Art. 13/14 + CCPA/CPRA.** Missing or materially deficient:
- **No legal basis for processing** (GDPR Art. 6 — consent/contract/legitimate interest). Entirely absent.
- **No defined retention periods** — only "as long as necessary" (§5.2). GDPR/CCPA require periods or criteria.
- **No enumerated recipient categories** (hosting, analytics, sub-processors) with purposes.
- **No CCPA/CPRA "Do Not Sell or Share My Personal Information"** mechanism; "sharing" for cross-context behavioural advertising not addressed.
- **No Sensitive Personal Information (CPRA)** handling.
- **No automated-decision-making / profiling disclosure** (Art. 22) — a real gap given the product markets "Predictive Intelligence."
- **No named supervisory authority** for complaints; **no EU representative** (Art. 27); no consent-withdrawal method described.
- **No legal entity address / jurisdiction** — only "Printyx LLC, Privacy Department."
- **Stale/incorrect recipient disclosure:** names "Replit authentication services" (`PrivacyPolicy.tsx:99-100`); the stack is Supabase GoTrue. Discloses a data recipient no longer used.

**Terms & Conditions — strongest document.** Covers governing law (Delaware), liability cap, termination, binding arbitration + class-action waiver, disclaimers, indemnification. Gaps: references availability but **no SLA doc exists**; **no DPA incorporated by reference**; no arbitration opt-out / small-claims carve-out (enforceability risk).

**EULA.** Standard SaaS license; heavily overlaps Terms (minor conflicting-interpretation risk). No material gap beyond the global DPA absence.

**Accessibility Statement.** Best-drafted document (WCAG 2.1 AA, Section 508, ADA Title III, VPAT-on-request, known limitations, feedback channel). Two problems: it is **unreachable** (not linked), and it **overclaims** (see Part 2).

**Cookie Policy.** No standalone policy; only Privacy Policy §8 (3 generic categories) with no cookie inventory (names, providers, durations), no third-party disclosure, no granular toggles.

### 1.3 Missing documents (entirely absent)

1. **Data Processing Agreement (DPA)** — *highest-severity legal gap.* Printyx self-identifies as a GDPR processor of customer business data (Privacy Policy §12.1) but offers no DPA (Art. 28 requirement; blocks EU/UK B2B sales).
2. **Subprocessor list** — required companion to a DPA.
3. **Standalone Cookie Policy** with a cookie inventory.
4. **SLA** — referenced in Terms but does not exist.
5. **CCPA "Do Not Sell/Share" page** and a privacy-rights request portal.

### 1.4 Inconsistencies & placeholder content

- **Contact-domain split:** core legal docs use `@printyx.com` (`PrivacyPolicy.tsx:396,399`; `TermsAndConditions.tsx:478`; `EndUserLicenseAgreement.tsx:309`) while the platform and marketing use **printyx.net** (`accessibility@printyx.net`). The `.com` addresses may be **undeliverable**, breaking data-subject-rights channels.
- **Placeholder phone numbers:** `1-800-PRINTYX` (vanity, only 7 dialable digits) in Privacy/Terms/EULA; `1-800-555-1234` (a 555 placeholder) in the Accessibility Statement. Two different fake numbers.
- **Stale dates:** Privacy/Terms/EULA frozen at "January 1, 2025"; homepage footer shows "© 2026"; Accessibility Statement "January 12, 2026." Inconsistent review cadence.
- **Broken footer link:** footer "Security" → `/security`, which has **no route** (`footer.tsx:31`). Dead link.
- **Orphaned pages:** Accessibility Statement routed but linked nowhere; `GdprComplianceDashboard.tsx` not imported/routed (dead code) though it calls real `/api/gdpr/*` endpoints.

---

## Part 2 — ADA / WCAG 2.1 AA Accessibility

### 2.1 What is genuinely implemented and works

The *opt-in* accessibility layer is real, not vaporware:
- `lang="en"` on `<html>` (`client/index.html:3`) — WCAG 3.1.1. ✅
- **AccessibilityProvider** (`hooks/useAccessibility.tsx`) persists prefs and applies real DOM effects (`applyPreferencesToDocument`, L68-109): high-contrast, reduced-motion, colour-blind filters, focus indicators, link underlines, cursor size, font scaling — all backed by `styles/accessibility.css`. All six settings are real.
- **Colour-blindness filters** render via live SVG `feColorMatrix` (`ColorBlindnessFilters.tsx`). ✅
- **AccessibilityWidget** — `role="dialog"`, `aria-modal`, focus trap, Escape-to-close, focus return, proper `role="switch"/"radio"` + `aria-checked`; mounted on public and authenticated trees. High quality. ✅
- **LiveRegion** — real `aria-live` regions + `announceToScreenReader()` (WCAG 4.1.3). ✅
- **shadcn Form** label association is correct (`components/ui/form.tsx` wires `htmlFor`/`aria-describedby`/`aria-invalid`) — any form built on it is properly labeled. ✅
- **All 8 `<img>` tags carry `alt`** (WCAG 1.1.1). ✅
- **Cmd/Ctrl+K command palette** and **`?` shortcuts dialog** are wired. ✅

### 2.2 Systemic violations (block the "WCAG 2.1 AA" claim)

- **WCAG 2.1.1 (Keyboard) / 4.1.2 — clickable non-interactive elements, systemic.** `role="button"` appears **0 times** in `client/src`; **~2,260 `onClick`** vs **~28 keyboard handlers**; clickable `<div>/<Card>/<li>/<tr>/<TableRow>` across **57+ files** with no `role`/`tabIndex`/`onKeyDown`. Canonical case: shared `components/crm/CrmDataTable.tsx:370-373` (clickable rows) and sortable headers (`:314-316`) — fixing the shared components has broad reach. Keyboard-only and screen-reader users cannot operate these controls.
- **WCAG 1.3.1 / 4.1.1 — nested `<main>` + duplicate `id="main-content"`.** `App.tsx:607` wraps authenticated routes in `<main id="main-content">`, and every `MainLayout` page renders a *second* `<main id="main-content">` (`main-layout.tsx:52`). Two `<main>` landmarks + duplicate ID per page.
- **WCAG 2.4.1 — broken skip links.** `SkipNavigation.tsx` defaults target `#main-content`, `#navigation`, `#search`; only `#main-content` exists. Authenticated override targets `#search-input`, which exists nowhere. Two SkipNavigation blocks render simultaneously with conflicting targets.
- **WCAG 3.3.2 / 4.1.2 — unlabeled controls.** Global header search is placeholder-only (`header.tsx:56`). Of 84 `size="icon"` buttons, ~81 have no inline `aria-label` (needs per-file confirmation for `sr-only` children).
- **WCAG 2.4.7 — focus indicators.** `components/ui/navigation-menu.tsx:38` and `HostedFormPage.tsx:147,156,193` use `focus:outline-none` without a visible replacement.

### 2.3 Statement overclaims (accuracy / legal risk)

- **Fictional keyboard shortcuts:** the Statement advertises "G then H → Home", "C → Create New", "Cmd/Ctrl+S → Save Form" (`AccessibilityStatement.tsx:298-320`). None are implemented (the code has `g d`, no bare-`c`, no save shortcut). Only Cmd+K and `?` are real.
- **"Large click targets (44×44px minimum)"** — the `.touch-accessible` min-44px CSS rule is never applied to the app root; not enforced. Many icon buttons are ~32-40px.
- **"All form fields have associated labels"** — true only for shadcn-`Form` pages; raw inputs (e.g. header search) rely on placeholders.
- **VPAT "available upon request"** — no VPAT artifact in repo.

### 2.4 Missing tooling (why the above went undetected)

- **No automated a11y testing** — no `axe-core`, `jest-axe`, `@axe-core/playwright`, `pa11y`, or `lighthouse-ci` in `package.json`.
- **No `eslint-plugin-jsx-a11y`** — exactly why the `div onClick` / `0×role="button"` problem accumulated.
- **No runtime contrast checking** — a `getContrastRatio()` utility exists (`lib/accessibility/utils.ts`) but is never invoked. Contrast conformance (WCAG 1.4.3) is a **manual-testing gap**; heavy `text-gray-400`/`text-muted-foreground` usage on tinted backgrounds is a likely-offender area.

---

## Part 3 — GDPR & CCPA/CPRA Technical Controls

### 3.1 Implemented and working
- **DSAR / access & portability (backend):** `GET /api/gdpr/export/:userId` (`server/routes-gdpr.ts:35`) → `gdpr-data-export-service.ts` collects personal data across tables, strips credentials, and serializes to machine-readable JSON/CSV/XML (Art. 20). **Caveat: no reachable UI.**
- **Consent ledger (schema & service):** `shared/gdpr-core-schema.ts` `consent_records` stores timestamp, version, scope, legal basis, source, IP, proof; `consent_audit_trail` records changes. Well-designed. **Caveat: the app never writes to it from the cookie banner.**
- **Audit logging of personal-data access:** `server/security-compliance.ts` (`logDataAccess` → `dataAccessLogs`); viewer at `/admin/audit-logs`. ✅
- **DPA/subprocessor tracking (backend):** `dpa-management-service.ts` + routes (create/renew/sign, subprocessor add/remove, expiry alerts). **Caveat: admin-only, UI unreachable.**
- **Email-marketing opt-out (edge):** `supabase/functions/email-marketing/handlers/unsubscribes.ts`. ✅

### 3.2 Partial / mock / dead code
- **GDPR dashboard orphaned:** `GdprComplianceDashboard.tsx` calls real endpoints but is **not routed**; its sub-page targets (`/gdpr/data-export`, `/gdpr/consent`, `/gdpr/dpa`, `/gdpr/deduplication`) don't exist. Compliance score hardcoded 85%.
- **Right to erasure is a stub:** `DELETE /api/gdpr/execute-deletion/:requestId` (`routes-gdpr.ts:196`) enforces admin-only + confirm + 30-day grace, but **performs no deletion** — flips status to `completed` and logs (code comment admits it, ~L270). Backups (K8s `pg_dump`) would resurrect any real deletion anyway.
- **Retention automation is dead code:** `data-retention-service.ts` is a complete engine (policies, batched purge, legal hold, `runScheduledRetention`, default policies) with **no callers** — not routed, no cron invokes it; `archiveRecords` is itself a stub. Retention exists in prose only at runtime.

### 3.3 Missing controls (required or promised, absent)
1. **Cookie consent is cosmetic and non-granular** (`components/CookieConsent.tsx`): Accept/Decline → `localStorage` only; no per-category choice; gates no scripts; never writes to `consent_records`; no way to change the choice later.
2. **No "Do Not Sell or Share My Personal Information"** control (CCPA/CPRA) — prose only.
3. **No Global Privacy Control (GPC) honoring** — no `Sec-GPC` handling; CPRA requires treating GPC as a valid opt-out.
4. **No Records of Processing Activities (RoPA)** — Art. 30 (DPA tracking ≠ RoPA).
5. **No self-service account/data deletion** for end users — the only self-reachable path is a no-op request.
6. **Right to restriction / objection / rectification** — not implemented despite being promised.
7. **Erasure ↔ backup interaction** — unaddressed.

### 3.4 Privacy Policy promises vs. code reality
| Promise (`PrivacyPolicy.tsx`) | Reality |
|---|---|
| "Delete or deactivate your account" (:241) | No self-service deletion; erasure is a no-op stub. |
| "Export your business data" (:242) | Backend works; **no reachable UI**. |
| "Right to withdraw consent" (:250) | API exists; banner records nothing; no consent center routed. |
| "Restrict or object to processing" (:243) | Not implemented. |
| CCPA opt-out / delete (:259-260) | No Do-Not-Sell control, no GPC, deletion stub. |
| "Respond within 30 days" (:409) | Grace window tracked; fulfillment never occurs. |
| Cookie control via browser (:302) | Banner doesn't gate analytics; "declining" changes nothing. |

---

## Remediation Roadmap

Severity: **P0** = active legal exposure / false compliance signal; **P1** = promised capability not deliverable; **P2** = completeness; **P3** = hardening.

### P0 — Do first
1. **Make erasure actually erase** — implement per-table purge/anonymization in `routes-gdpr.ts`, with a documented backup-exclusion/anonymization strategy. Until then, do not represent erasure as available. *(GDPR Art. 17)*
2. **Replace the cookie banner with a real CMP** — per-category toggles, default-deny for non-essential, conditionally load analytics/tracking on consent, persist to `consent_records`, add a persistent "Cookie settings" re-entry link. *(GDPR/ePrivacy, CPRA)*
3. **Fix baseline keyboard accessibility** — convert clickable `<div>/<tr>/<Card>` to real `<button>`/`<a>` or add `role`+`tabIndex`+`onKeyDown`; start with shared components (`CrmDataTable`, dashboard widgets, responsive tables) for maximum reach. *(WCAG 2.1.1, 4.1.2)*
4. **Add "Do Not Sell or Share" + honor `Sec-GPC`** header as an opt-out. *(CCPA/CPRA)*
5. **Correct overclaiming statements** — fix the Accessibility Statement's keyboard-shortcut table and downgrade "substantially conforms" until baseline issues are resolved; fix the Privacy Policy's stale "Replit" disclosure. *(misrepresentation risk)*
6. **Fix contact channels** — correct `@printyx.com` → `@printyx.net` (or register/route the .com) and replace placeholder phone numbers, so rights requests are actually deliverable.

### P1 — Make promised rights reachable
7. **Route (or remove) the GDPR self-service UI** — register `/gdpr` and sub-pages, and expose "Export my data" + "Delete my account" in user settings; or delete the dead dashboard.
8. **Remove duplicate/nested `<main id="main-content">`** — exactly one landmark per page. *(WCAG 1.3.1/4.1.1)*
9. **Fix skip links** — add `id="search-input"` to header search, drop dead `#navigation`/`#search` defaults, render only one SkipNavigation. *(WCAG 2.4.1)*
10. **Label controls** — header search + audit the ~81 unlabeled icon buttons. *(WCAG 3.3.2/4.1.2)*
11. **Wire the retention engine** — schedule `runScheduledRetention()` via the existing cron pattern and finish `archiveRecords` before enabling destructive purge.
12. **Author the DPA + subprocessor list**, add a standalone Cookie Policy, and either create the SLA or drop the Terms reference.

### P2 — Completeness
13. Implement restriction/objection endpoints + a processing-restriction flag.
14. Add a RoPA (Art. 30) register (table + admin UI).
15. Connect cookie/marketing/unsubscribe consent into the unified `consent_records` ledger.
16. Add Privacy Policy content: legal basis, retention periods, recipient categories, sensitive-PI handling, automated-decision-making, supervisory authority, entity address.
17. Apply `.touch-accessible` / bake 44px minimums into `Button`; add `focus-visible:ring` to the offenders.

### P3 — Guardrails (prevent regression)
18. Add **`eslint-plugin-jsx-a11y`** (recommended ruleset) to `eslint.config.js`.
19. Add **`@axe-core/playwright`** smoke tests over top routes in `tests/`.
20. Wire `getContrastRatio()` into a CI/Storybook contrast check.
21. Establish a legal-document review cadence (dates, entity info, contact channels) and a VPAT artifact.

---

## Caveats & Limitations of This Audit

- Static code review only — **no** live assistive-technology testing, screen-reader passes, colour-contrast measurement at scale, or penetration testing.
- **Not legal advice.** GDPR/CCPA/CPRA and ADA conformance are legal determinations; engage qualified privacy and accessibility counsel before publishing any conformance claim or VPAT.
- Line numbers reflect the repository state on the audit date and may drift.
