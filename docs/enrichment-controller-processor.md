# Enrichment data: who is the controller?

Opened under LEGAL-008 (prd.json). Drafted 2026-08-18. **Not legal advice and
not signed off. The conclusion below is the working position implemented in
code; counsel should confirm or correct it.**

## The question

When a Printyx customer enriches a contact from Apollo or ZoomInfo, who is the
GDPR controller of the resulting record: the customer, Printyx, or both?

It matters because the controller owes the Article 14 notice, answers the
objection, and carries the liability if neither happens.

## The working position

**The customer is the controller. Printyx is the processor.**

The reasoning: the customer decides to enrich, decides which contacts, and
decides what to do with the result. Printyx supplies the mechanism and holds the
provider credentials. Deciding the purposes and means is what makes a
controller, and the customer is making those decisions.

This matches how the rest of the platform is framed: the Subprocessors page says
customer-connected integrations act under the customer's direction, and the DPA
treats Printyx as processor throughout.

## Where that position is uncomfortable

Worth stating plainly, because a position with no weaknesses is usually one
nobody examined.

- **The provider relationship may be ours, not theirs.** If Printyx holds the
  Apollo or ZoomInfo contract and the customer merely consumes it through our
  UI, we look more like a joint controller for the acquisition step, even if the
  customer controls what happens next. Which entity holds each provider contract
  is a fact to check, not a matter of interpretation.
- **A processor that chooses the source is doing more than processing.** The
  customer clicks "enrich" without choosing a provider. Selecting who to buy
  personal data from is closer to determining the means than a pure processor
  usually gets.
- **The data subject does not care about the distinction.** Someone objecting to
  a cold email will contact whoever emailed them, or whoever the software is
  branded as. Being technically the processor does not make the request go away,
  which is why the implementation routes requests regardless of who is
  responsible for answering.

## What the code assumes

- Provenance is recorded per tenant, so the record of where data came from
  belongs to the customer, consistent with them being controller.
- The Article 14 notice at `/data-sources` names the customer as controller and
  Printyx as processor, and gives a route to reach either.
- Suppression is per tenant, not global. A person who objects to one customer is
  not suppressed for every other customer, because those are separate
  controllers with separate relationships. **This is the assumption most worth
  challenging**: a data subject may reasonably expect one objection to be
  enough, and would find a per-tenant boundary they cannot see an odd answer.

## What to confirm

1. Which entity holds the Apollo and ZoomInfo contracts, and what those contracts
   say about controller status.
2. Whether the DPA's processor framing survives the fact that Printyx selects
   the enrichment providers.
3. Whether suppression should be per tenant or platform-wide.
4. Whether Article 14(5)(b) disproportionate-effort applies to bulk enrichment,
   and if so, what the required alternative public notice looks like. The
   `exempt` status exists in the schema for exactly this, and it requires a
   written reason, so the claim is recorded rather than assumed.
