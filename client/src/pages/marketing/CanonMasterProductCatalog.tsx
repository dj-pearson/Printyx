export default function CanonMasterProductCatalog() {
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
      <h1 className="text-3xl font-semibold">Canon Master Product Catalog</h1>
      <p className="text-gray-700">
        Overview of Canon imageRUNNER/imagePRESS models and accessories with enablement and pricing
        strategies for dealers.
      </p>
    </div>
  );
}
