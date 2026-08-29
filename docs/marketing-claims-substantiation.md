# Marketing claims substantiation

Every quantified public claim about what Printyx does for a dealer needs a
written basis recorded here before it ships. A claim with no row in this file
does not go on the site.

Opened under LEGAL-002 (prd.json) after an audit found fabricated testimonials,
fabricated named case studies, and fabricated review ratings across the
marketing surface. Last reviewed 2026-08-18.

## Why this file exists

The FTC Rule on the Use of Consumer Reviews and Testimonials (16 CFR Part 465,
effective October 2024) carries civil penalties up to $53,088 per violation.
Fabricated results attributed to named companies is the clearest violation
category in it, and a named business also has its own claim against us for the
use of its name. Structured data counts: an `aggregateRating` in JSON-LD is a
claim to the public, and search engines render it as stars.

The practical test before publishing a number: **who measured this, when, and
across how many dealers?** If you cannot answer all three, it does not ship.

## What was removed

Printyx has no measured customer outcomes yet. Every figure below was invented
and has been deleted. None of it may be reintroduced, including as an
"illustrative", "representative" or "composite" example.

### Fabricated testimonials and customers

| Removed                                                                                                                          | Where                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Three anonymous 5-star testimonials with metric badges, under a heading reading "Real feedback from copier dealers who switched" | `client/src/pages/marketing/Homepage.tsx`                                                                                          |
| MidAtlantic Office Solutions, quoted by "Sarah Johnson, VP of Operations"                                                        | `client/src/pages/marketing/CaseStudies.tsx`                                                                                       |
| Pacific Print Services, quoted by "Michael Chen, CFO"                                                                            | `client/src/pages/marketing/CaseStudies.tsx`                                                                                       |
| Southern Business Systems, quoted by "David Martinez, Owner"                                                                     | `client/src/pages/marketing/CaseStudies.tsx`                                                                                       |
| "Case Study: Mid-Sized Dealer" - the MidAtlantic figures with the name filed off                                                 | `client/src/pages/marketing/PredictiveIntelligence.tsx`, `client/src/pages/blog/ai-predictive-maintenance-vs-reactive-service.tsx` |
| "Case Study: 40-Technician Dealer" with before/after margins                                                                     | `client/src/pages/blog/dynamic-pricing-ai-copier-dealers.tsx`                                                                      |
| A sales script telling reps to cite Southern Business Systems' migration and offer a reference call with them                    | `client/src/pages/marketing/CompetitiveBattleCard.tsx`                                                                             |
| "Pacific Print Services: $1.2M additional annual profit" in outbound nurture email copy                                          | `client/src/data/emailCampaigns.ts`                                                                                                |

### Fabricated review ratings in structured data

| Removed                                                                                        | Where                                     |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `aggregateRating` 4.8 from 150 ratings, emitted on every page using SoftwareApplication schema | `client/src/lib/seo/SEOProvider.tsx`      |
| `aggregateRating` 4.9 from 127 ratings                                                         | `client/src/pages/marketing/Homepage.tsx` |

The two disagreed with each other, which is its own evidence that neither was
measured.

### Fabricated aggregate performance claims

Each of these appeared across marketing pages, blog posts, SEO config and email
copy. All removed.

| Claim                                                                   | Note                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------- |
| 30-40% reduction in emergency service calls                             | No measurement exists                             |
| 15-25% profitability / margin increase                                  | No measurement exists                             |
| 80%+ (and separately 94%) failure prediction accuracy                   | Two different invented figures for the same thing |
| 4-7 month payback period                                                | No measurement exists                             |
| $47,000 annual service cost savings                                     | Attributed to a dealer that does not exist        |
| $1.2M additional annual profit                                          | Attributed to a dealer that does not exist        |
| 147 contracts repriced at renewal                                       | No measurement exists                             |
| 92% technician satisfaction, 4.8/5 mobile app rating, 90%+ satisfaction | No survey was run                                 |
| Customer satisfaction 3.8 to 4.4, renewal rate 82% to 91%               | No measurement exists                             |
| 6-8 week migration timeline, "dozens of dealers migrated"               | No migrations to draw on                          |
| 20% decrease in total service costs                                     | No measurement exists                             |
| "Most dealers see 15-25% total cost savings compared to E-Automate"     | No measurement exists                             |

## What replaced them

Mechanism, not outcome. "Service history, meter velocity and error codes flag
machines heading for a failure, so the visit is planned rather than urgent" is
checkable by anyone on a trial. "30-40% fewer emergency calls" is not.

Where a number genuinely helps the reader, the ROI calculator is the place for
it: the visitor supplies the inputs, the output is visibly a projection of
their own figures, and it is not presented as anyone's measured result.

## Claims reviewed and left in place

| Claim                                                                                          | Where                                                 | Basis                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Predictive deal scoring can improve win rates by 15-25%" and a similar line on quote building | `client/src/components/contextual/ContextualHelp.tsx` | In-app help text framed as a general capability average, not a Printyx customer result. Lower risk than advertising, but it is still an unsourced number: either cite the industry study it comes from or drop the figure. Flagged, not fixed, in LEGAL-002. |
| "Industry benchmark: 15-25%"                                                                   | `client/src/pages/CrmGoalsDashboard.tsx`              | An in-product benchmark label, not a claim about Printyx. Should still carry its source.                                                                                                                                                                     |
| "2-3 year technical advantage / technical lead" over legacy systems                            | Several marketing pages                               | Comparative architecture claim rather than a performance outcome, so outside LEGAL-002's scope. It is unfalsifiable as written and should be reviewed separately.                                                                                            |
| "The first AI-native dealer management platform"                                               | `client/src/pages/marketing/Homepage.tsx`             | "The first" is a factual claim, not puffery. Not addressed by LEGAL-002; verify or soften it.                                                                                                                                                                |
| 14-day free trial, no payment method required to begin                                         | Marketing pages, `CaseStudies.tsx`                    | Matches the implemented trial: `server/services/trial-management-service.ts` sets a 14-day window. Keep this row in sync if the trial length changes.                                                                                                        |

## Adding a claim

1. Record it here first: the exact wording, where it will appear, who measured
   it, when, and across how many dealers.
2. Name the customer only with written permission covering that specific use.
3. If the figure is modeled rather than measured, say so at the point of the
   claim, not in a footer, and state the assumptions.
4. If it is a typical result, it must actually be typical. Quoting a best case
   as though it were representative is its own violation.
