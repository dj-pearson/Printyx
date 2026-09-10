import { GEOFaqSection } from '@/lib/seo/GEOFaqSection';

export default function PrintServiceDispatchMobile() {
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
      <h1 className="text-3xl font-semibold">Print Service Dispatch & Mobile</h1>
      <p className="text-gray-700">
        Optimize ticketing, dispatch, preventive maintenance and mobile field operations for print
        service teams.
      </p>

      <GEOFaqSection
        title="Frequently Asked Questions About Service Dispatch for Print Dealers"
        className="mt-12"
        faqs={[
          {
            question:
              'How does AI-powered service dispatch reduce travel time for copier technicians?',
            answer:
              'Printyx uses AI route optimization to group nearby service calls, prioritize by urgency, and assign the closest qualified technician. This reduces average travel time by 40% and increases daily completed calls by 30%. The system re-routes in real time when emergency calls come in.',
          },
          {
            question: 'Does the Printyx mobile app work offline for field service technicians?',
            answer:
              'Yes. The Printyx offline-first mobile app stores work orders, equipment history, and parts inventory locally for up to 72 hours without connectivity. Technicians complete service calls, capture signatures, and log parts offline. All data syncs automatically when the device reconnects.',
          },
          {
            question:
              'How does Printyx handle preventive maintenance scheduling for copier fleets?',
            answer:
              'Printyx combines meter-based triggers, time-based intervals, and AI failure predictions to schedule preventive maintenance automatically. The system creates PM work orders, assigns technicians based on skill and location, and pre-orders required parts to ensure first-visit resolution rates above 85%.',
          },
          {
            question:
              'Can Printyx dispatch integrate with our existing ticketing and help desk system?',
            answer:
              'Printyx integrates with ConnectWise, Autotask, ServiceNow, and Zendesk via REST API and webhooks. Tickets created in external systems automatically generate dispatch work orders. Status updates sync bi-directionally so customers and help desk agents see real-time technician progress.',
          },
        ]}
      />
    </div>
  );
}
