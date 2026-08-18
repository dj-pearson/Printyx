# Exposing an AI surface outside authentication

Opened under LEGAL-012 (prd.json). Last updated 2026-08-18.

## Where things stand

Every conversational AI surface in Printyx is authenticated internal B2B. The
chatbot requires `requireAuth`, and the nine edge functions that run without
authentication (`client-metrics`, `csrf-token`, `hello`, `mobile-auth`,
`oauth-proxy`, `public-booking`, `public-calculator`, `public-forms`, `signup`)
do not talk back to anyone.

That is the entire reason crisis handling was a low priority rather than an
urgent one. It stops being true the day a chatbot is put in front of end
customers or a public widget ships, and that is a routing change, not a
redesign. The guardrail exists now so it is not something to remember later.

## The rule

**An AI surface that accepts free text from a person and answers them may not be
exposed without authentication until the prerequisites below are met.**

`npm run check:ai-safety` enforces the mechanical half: it fails the build if
`/api/chatbot/query` loses `requireAuth`, or if a conversational system prompt
stops going through `withCrisisGuardrail()`. It cannot enforce the judgement
half, which is what this page is for.

## Prerequisites for public exposure

1. **Crisis handling is deterministic, not just prompted.** The system-prompt
   directive is a request to a model, and prompt edits, model swaps and long
   conversations all erode it. There must also be a code path that responds with
   resources without asking a model anything.
   `server/lib/crisis-response.ts` is that path.

2. **Resources match the user's locale.** `CRISIS_RESOURCES_US` is US-only.
   Showing a US number to someone in another country is worse than showing
   nothing, because it looks like help and is not. Serving non-US users publicly
   requires locale-aware resources first.

3. **Someone is on the other end.** A public surface will receive disclosures
   that need a human, and abuse that needs a human. Name who, and what their
   response time is, before the surface goes live.

4. **Minors are considered.** A public widget cannot assume its users are
   business buyers. If under-13 use is plausible, COPPA applies and the
   analysis has to happen before launch, not after the first complaint.

5. **Retention is defined.** Conversation logs from a public surface are
   personal data about people with no account and no relationship with Printyx.
   Decide the retention period and get it into the Privacy Policy.

6. **The surface says it is an AI.** Not buried in a footer. A person is
   entitled to know they are not talking to a human, and several jurisdictions
   now require it explicitly.

## What counts as conversational

Free text in, free text out, with a person on the far end. The chatbot, the
customer-support responders, and the deal-desk copilot all qualify and all
carry the guardrail.

Data-processing prompts do not: CSV column mapping, email parsing, document OCR
and deduplication receive records rather than remarks. Adding a crisis directive
to those is noise, and noise trains people to ignore the directive where it
matters. `CONVERSATIONAL` in `scripts/check-ai-safety.mjs` is the list of what
counts, and adding a surface means adding it there.

## If you are exposing one anyway

Read the prerequisites, satisfy them, then update `AUTH_REQUIRED_ROUTES` in the
guard in the same commit, with the review recorded in the commit message. The
guard failing is the prompt to have the conversation, not an obstacle to route
around.
