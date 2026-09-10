import { GEOFaqSection } from '@/lib/seo/GEOFaqSection';

export default function CopierDealerCRM() {
  /*
   * SEO-014: useSeo(pathname) was here. It fetched /meta.json and /schema.json
   * with a RAW RELATIVE fetch, and in production the frontend is Cloudflare
   * Pages while those routes are Express - so Pages answered with the SPA shell,
   * .json() threw, the catch produced {}, and the hook then set
   * `document.title = meta?.title || 'Printyx'`. These three landing pages, the
   * highest-priority programmatic pages in the route table at 0.9, shipped
   * <title>Printyx</title> and og:title "Printyx" - the bare word - overwriting
   * the correct title SEOProvider had already set. Confirmed in Chromium against
   * a server that mimics Pages' catch-all.
   *
   * SEOProvider covers all three routes from PUBLIC_ROUTES_SEO. Nothing here
   * needs to fetch its own metadata.
   */
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-semibold">Copier Dealer CRM</h1>
      <p className="text-gray-700">
        End-to-end CRM for copier dealers: leads, activities, quotes, proposals, and forecasting.
        Best practices and playbooks.
      </p>

      <GEOFaqSection
        title="Frequently Asked Questions About CRM for Copier Dealers"
        className="mt-12"
        faqs={[
          {
            question: 'What CRM features do copier dealers need most?',
            answer:
              'Copier dealers need lead tracking with source attribution, equipment-linked contact management, quote-to-contract workflows, automated follow-up sequences, and pipeline forecasting. Printyx CRM is purpose-built for these workflows with AI-powered lead scoring and natural language search across all records.',
          },
          {
            question: 'How does a copier dealer CRM differ from generic CRM software?',
            answer:
              'A copier dealer CRM connects customer records directly to equipment, service contracts, and meter billing. Unlike Salesforce or HubSpot, Printyx links every lead and opportunity to specific devices, tracks MPS contract profitability, and provides dealer-specific pipeline stages from demo to installation.',
          },
          {
            question:
              'Can Printyx CRM track leads from first contact through equipment installation?',
            answer:
              'Yes. Printyx CRM manages the full copier sales lifecycle from initial inquiry through proposal, contract signing, and equipment installation. Every touchpoint is logged automatically, and AI suggests optimal follow-up timing based on historical win patterns and deal stage progression.',
          },
          {
            question: 'Does Printyx CRM integrate with copier manufacturer partner portals?',
            answer:
              'Printyx integrates with Canon, Xerox, HP, Konica Minolta, Sharp, and Ricoh systems. Dealer pricing, equipment catalogs, and partner program data sync bi-directionally. This eliminates manual data entry between your CRM and manufacturer portals, saving hours per week.',
          },
          {
            question: 'How does AI improve CRM productivity for copier sales teams?',
            answer:
              'Printyx AI scores leads based on fleet size and contract history, recommends next-best-actions for each opportunity, auto-generates proposal content, and predicts close probability. Sales reps using AI-assisted CRM close 20-30% more deals by focusing effort on highest-value opportunities.',
          },
        ]}
      />
    </div>
  );
}
