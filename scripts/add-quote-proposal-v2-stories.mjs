// One-shot: append QUOTE-011..020 + PROP-001..010 (quote/proposal flow overhaul v2) to prd.json.
// Run: node scripts/add-quote-proposal-v2-stories.mjs
import fs from 'node:fs';

const PRD = new URL('../prd.json', import.meta.url);

const stories = [
  // ─────────────────────────── QUOTE FLOW (product search → discounting → structure → flow) ───────────────────────────
  {
    id: 'QUOTE-011',
    title: 'Server-side search + pagination on every product catalog endpoint used by the quote picker',
    description:
      'As a sales rep with a large catalog, I need product lookups to be fast and server-filtered so the quote builder does not download the entire catalog into the browser. Today only /api/product-models and /api/software-products support ?search=; none of the picker endpoints paginate, so ProductTypeSelector fetches everything and filters client-side.',
    acceptanceCriteria: [
      'GET /api/product-accessories, /api/professional-services, /api/service-products, /api/supplies, /api/managed-services each accept ?search= (ILIKE on product name + product code) and ?page=&limit= (default limit 50, max 200), returning { data, pagination: { page, limit, total } } — follow the pattern already used by routes-software-products.ts server-side pagination',
      'GET /api/product-models gains the same ?page=&limit= pagination (it already supports ?search=, category, manufacturer, status — keep those working as server-side filters)',
      'Existing callers that omit page/limit keep working (absent params return the first page with a generous default or the legacy full list — pick one, document in the route file header, and keep ProductTypeSelector working until QUOTE-012 lands)',
      'Every new query path filters by tenantId',
      'npm run check passes',
    ],
    priority: 1,
    passes: false,
    notes:
      'Backend-only story; QUOTE-012 consumes it. Endpoint inventory + current search/pagination matrix: routes-product-models.ts:61, routes-software-products.ts:17, routes-products-crud.ts:567/808. Reuse the response envelope from the software-products pagination work (commit ab73cb94).',
    category: 'quote-module-v2',
  },
  {
    id: 'QUOTE-012',
    title: 'ProductTypeSelector: debounced server-side search with load-more (stop fetching whole catalog)',
    description:
      'As a sales rep, I want the product picker to search the server as I type so finding a product is instant even with thousands of SKUs. Today ProductTypeSelector.tsx:253-299 loads ALL products for the selected type then filters in memory on every keystroke with no debounce.',
    acceptanceCriteria: [
      'ProductTypeSelector uses a 300ms-debounced search term in its TanStack Query key and passes ?search=&page=&limit= to the endpoints from QUOTE-011 (mirror the debounce pattern in CompanyContactSelector)',
      'Initial open shows the first 50 products; a "Load more" control (or infinite scroll) fetches subsequent pages; total match count is displayed',
      'Category/manufacturer filters are passed as server-side query params, not applied client-side',
      'Loading and error states render (skeleton rows while fetching, retry on error)',
      'The "no cost — margin unavailable" badge and New/Upgrade pricing-type behavior still work on paginated results',
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 1,
    passes: false,
    notes: 'Depends on QUOTE-011. Friction source: ProductTypeSelector.tsx:253-270 (full fetch), 284-299 (client filter).',
    category: 'quote-module-v2',
  },
  {
    id: 'QUOTE-013',
    title: 'Fast multi-add: picker stays open, per-row quantity, recently-used products',
    description:
      'As a sales rep building a 10-line quote, I want to add several products without reopening the dialog each time. Today the picker closes after every single add (LineItemManager.tsx:339-362), making multi-item quotes click-heavy.',
    acceptanceCriteria: [
      'Adding a product no longer closes the dialog; an "Added" indicator appears on the row and a running badge shows how many items were added this session; a Done button closes the dialog',
      'Each result row has a quantity stepper (default 1) so the chosen quantity is applied at add time',
      'A "Recent" tab/section lists the last 20 products this user added to any quote (persist per-user in localStorage keyed by tenant+user; newest first; clicking adds with one click)',
      'Keyboard flow: search input auto-focused on open, ArrowUp/Down moves row highlight, Enter adds the highlighted product',
      'Required-accessory auto-add behavior still fires per added model (until QUOTE-014 replaces it)',
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 1,
    passes: false,
    notes: 'Pure frontend. Touches ProductTypeSelector.tsx + LineItemManager.tsx handleProductSelect.',
    category: 'quote-module-v2',
  },
  {
    id: 'QUOTE-014',
    title: 'Required-accessory preview & confirm (replace silent auto-add)',
    description:
      'As a sales rep, when I add a copier model I want to see and approve its required/suggested accessories with prices before they hit the quote. Today LineItemManager.tsx:181-226 silently auto-adds required accessories and the rep must hunt and delete unwanted lines.',
    acceptanceCriteria: [
      'Selecting a product model whose required accessories resolve (via /api/product-accessories?codes=...) opens a confirmation list showing each accessory with name, code, dealer cost (if visible to role), price, and quantity',
      'Required accessories are pre-checked and locked; optional/compatible accessories (if the API distinguishes them) are listed unchecked',
      'One Confirm click adds the model + all checked accessories as parent + sublines (same isSubline/parentLineId structure as today); Cancel adds only the model',
      "Auto-added lines keep the provenance note ('Required accessory for [product]')",
      'If a model has no required accessories, no dialog appears (unchanged single-add)',
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 2,
    passes: false,
    notes: 'Builds on QUOTE-013 (picker stays open). Keep the subline grouping rendering at LineItemManager.tsx:664-893 untouched.',
    category: 'quote-module-v2',
  },
  {
    id: 'QUOTE-015',
    title: 'Equipment packages addable in the quote builder',
    description:
      'As a sales rep, I want to drop a pre-built equipment package (model + accessories + services) into a quote in one action. The equipment_packages table and GET/POST /proposals/equipment-packages endpoints exist (quote-proposal-schema.ts:64-119) but the quote builder never surfaces them.',
    acceptanceCriteria: [
      "ProductTypeSelector gains a 'Packages' product type backed by the equipment-packages endpoint (tenant-filtered), searchable by packageName/packageCode/category",
      'Adding a package expands its equipment/accessories/services JSONB into line items: first equipment row is the parent, remaining rows become sublines, each carrying its own quantity, unit price, and dealer cost (resolved from the catalog when the package row lacks cost)',
      'Package-derived lines are individually editable/deletable after insertion (they become normal lines; no live link back to the package)',
      "Items flagged isOptional in the package JSONB are presented unchecked in a confirm dialog (reuse QUOTE-014's pattern) before insertion",
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 2,
    passes: false,
    notes:
      'Depends on QUOTE-013/014 dialog patterns. Package CRUD management UI is intentionally out of scope (packages can be seeded/created via existing POST endpoint); add a follow-up story if needed.',
    category: 'quote-module-v2',
  },
  {
    id: 'QUOTE-016',
    title: 'Per-line discounts with reason codes, enforced in guardrails and server totals',
    description:
      'As a sales rep, I need to discount individual lines (e.g., 10% off hardware, list price on service) instead of only one quote-level discount, and as a manager I need a recorded reason for every discount. proposal_line_items.discount exists in schema but has no UI, and discounts carry no justification today.',
    acceptanceCriteria: [
      'Line item editor (LineItemManager edit dialog + inline row) exposes a per-line discount as percent or amount; discounted unit price drives totalPrice and the line margin display',
      'Per-line discount persists to proposal_line_items.discount on save and loads back on edit; normalizeLineItem in supabase/functions/proposals/index.ts computes line totals and margin net of the line discount',
      'recalculateProposalTotals rolls up subtotal from discounted line totals; quote-level discount still applies after line discounts; shared/quote-math.ts gains the discounted-line helpers and server/tests/unit/quote-math.test.ts covers them',
      "A discount reason select (competitive_match, volume, promotion, manager_approved, other + free text) is required whenever any discount is set; stored on proposals (add discount_reason varchar + discount_reason_note text via migration, ALTER TABLE ADD COLUMN IF NOT EXISTS)",
      'QUOTE-006 guardrails (min margin, max discount) evaluate the EFFECTIVE discount including per-line discounts in both PricingCalculator warnings and the status=sent 409 gate',
      'Manager PDF shows per-line discount and reason; customer PDF shows discounted prices only',
      'npm run check && npm run build pass',
    ],
    priority: 2,
    passes: false,
    notes:
      'Largest quote story — schema column exists so no line-item migration needed, only the two proposals columns. Guardrail code: QuoteBuilder.tsx:495-512, PricingCalculator.tsx:97-106, proposals/index.ts:257-280.',
    category: 'quote-module-v2',
  },
  {
    id: 'QUOTE-017',
    title: 'Recurring/contract lines in the builder UI with one-time vs monthly totals',
    description:
      'As a sales rep selling service contracts and CPC plans, I need to mark lines as recurring (monthly/quarterly/annual) and show the customer a clear one-time vs recurring split. is_recurring/recurring_frequency/recurring_duration exist on proposal_line_items but the quote builder never exposes them.',
    acceptanceCriteria: [
      'Line item editor exposes a One-time / Recurring toggle; Recurring reveals frequency (monthly, quarterly, annually) and duration (number of periods, blank = ongoing); values persist and reload via the existing line-item endpoints',
      "PricingCalculator and the Review step show split totals: 'One-time total' and 'Recurring (per <frequency>)' with margin computed per bucket; quote-level discount applies to the one-time bucket only (document this rule in shared/quote-math.ts)",
      'Customer PDF (_pdf.ts) renders recurring lines in a separate section with frequency labels; manager PDF includes per-bucket cost/margin',
      'Quote-level guardrail margin (QUOTE-006) is computed across both buckets combined so reps cannot hide low margin in recurring lines',
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 2,
    passes: false,
    notes: 'Schema fields ready: quote-proposal-schema.ts:244-251. Touches QuoteBuilder save payload, proposals edge fn recalc, _pdf.ts.',
    category: 'quote-module-v2',
  },
  {
    id: 'QUOTE-018',
    title: 'Autosave quote drafts + recovery (kill the lost-quote problem)',
    description:
      'As a sales rep, I must never lose a half-built quote. Today nothing persists until the explicit Save at the end of the 4-step wizard (QuoteBuilder.tsx:481-522) — a stray back-button on a 50-line quote loses everything.',
    acceptanceCriteria: [
      'Completing the Customer step on a new quote immediately creates a draft proposal (status=draft) via the existing POST /api/proposals path; the URL updates to the edit route so refresh resumes the draft',
      'Subsequent changes (line items, discount, tax, notes, step fields) autosave via the existing PUT /api/proposals/:id after ~3s of idle, with a visible saving/saved indicator near the wizard header',
      'Reloading or navigating back to the quote restores line items, discounts, and form values from the server with no data loss; the wizard opens on the furthest valid step',
      'Autosave is debounced and serialized (no overlapping PUTs; last write wins) and never fires the margin/discount SEND gate — drafts may violate guardrails, warnings still render',
      'Failed autosaves surface a non-blocking retry toast and do not clobber local state',
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 1,
    passes: false,
    notes: 'Highest-impact UX fix in the quote flow per exploration. Reuse saveQuoteMutation payload shape; watch the unitCost mapping fixed in QUOTE-002.',
    category: 'quote-module-v2',
  },
  {
    id: 'QUOTE-019',
    title: 'Wizard navigation polish: jump-forward, Review edit links, persistent pricing summary bar',
    description:
      'As a sales rep, I want to move freely through the quote wizard and always see where pricing stands. Today forward jumps are blocked (QuoteBuilder.tsx:582-595), Review has no per-section edit links, and margin/guardrail status is invisible until late steps.',
    acceptanceCriteria: [
      'Step headers allow jumping forward when prerequisites are met (customer chosen unlocks all steps; Products no longer blocks reaching Pricing/Review when at least one line exists); invalid jumps show which prerequisite is missing',
      "Review step sections (Customer, Products, Pricing) each get an Edit control that jumps directly to that step",
      'A sticky summary bar renders on the Products and Pricing steps showing subtotal, discount, total, and quote margin % with guardrail coloring (amber/red below policy), respecting usePricingVisibility role gating for cost-derived numbers',
      'Guardrail violations (min margin / max discount) surface as the banner at draft-save time, not only at send (extend the existing PricingCalculator warning to the summary bar)',
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 2,
    passes: false,
    notes: 'Depends on QUOTE-018 (autosave makes free navigation safe). Wizard steps: QuoteWizardProgress.tsx:85-90.',
    category: 'quote-module-v2',
  },
  {
    id: 'QUOTE-020',
    title: 'Line item drag-reorder and type grouping',
    description:
      'As a sales rep, I want to arrange quote lines in the order the customer will read them. Today lines are append-only — reordering requires delete and re-add, and there is no visual grouping beyond parent/accessory sublines.',
    acceptanceCriteria: [
      'Parent line items can be drag-reordered with @dnd-kit (already a dependency, used by ProposalVisualBuilder); sublines move with their parent; touch-friendly drag handles ≥48px on mobile',
      'New order persists via line_number on proposal_line_items and is honored on reload, in PricingCalculator breakdown, and in both PDFs',
      "An optional 'Group by type' view toggle clusters lines by itemType (equipment, accessory, service, supply) with per-group subtotals; the flat custom order remains the default",
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 3,
    passes: false,
    notes: 'Grouping render logic lives at LineItemManager.tsx:306-324.',
    category: 'quote-module-v2',
  },

  // ─────────────────────────── PROPOSAL TEMPLATES + BRANDING (set-template vision) ───────────────────────────
  {
    id: 'PROP-001',
    title: 'Template backend: sections JSONB, full CRUD, clone, per-product-type default',
    description:
      'As a dealer admin, I need proposal templates to be real persisted objects I can manage, so one well-built template per product type is reused on every proposal. proposal_templates exists but only supports GET/POST/PUT of metadata; section content is not editable, there is no delete/clone, and isDefault is not scoped per templateType.',
    acceptanceCriteria: [
      "Migration adds template_content jsonb to proposal_templates storing the visual-builder section array ({ id, type, title, content, styling, order, isVisible }) plus global styling — keep legacy per-section text columns readable for back-compat (use ALTER TABLE ADD COLUMN IF NOT EXISTS)",
      'supabase/functions/proposals template routes gain DELETE /proposal-templates/:id (soft delete via is_active=false) and POST /proposal-templates/:id/clone (copies content, appends “Copy” to name, isDefault=false)',
      "Setting isDefault=true atomically clears isDefault on other templates of the SAME templateType within the tenant (same pattern as blog default-row uniqueness); GET /proposal-templates supports ?templateType= filter",
      'All template routes Zod-validate input, filter by tenant_id, and reject cross-tenant ids',
      'npm run check passes',
    ],
    priority: 1,
    passes: false,
    notes:
      'FOUNDATION for the proposal track — PROP-003..006 depend on it. Existing routes: proposals/index.ts:567-646. Schema: quote-proposal-schema.ts:18-61.',
    category: 'proposal-templates',
  },
  {
    id: 'PROP-002',
    title: 'Company branding backend: CRUD endpoints + persistent logo upload',
    description:
      'As a dealer admin, I need my logo, colors, fonts, and company info stored once and applied to every proposal. company_branding_profiles exists in schema (schema.ts:6038-6083) but has no endpoints, and BrandManager only creates client-side object URLs for logos (BrandManager.tsx:249) that vanish on refresh.',
    acceptanceCriteria: [
      'New routes (server/routes-branding-profiles.ts registered in routes.ts, or a branding section in the proposals edge function — match the Express↔Edge migration direction in docs/route-parity-matrix.md) expose GET list / GET :id / POST / PUT / DELETE / POST :id/set-default for company_branding_profiles, tenant-filtered, Zod-validated, requireAuth + requirePermission',
      'set-default atomically clears isDefault on other profiles in the tenant',
      'POST /api/branding-profiles/:id/logo accepts an image upload (png/jpg/svg, ≤2MB), stores it in Supabase Storage under a tenant-scoped path, and saves the public URL to logoUrl; re-upload replaces; response returns the persistent URL',
      'Seed/default: tenants with zero profiles get a sensible default created on first GET (companyName from tenant record, default colors)',
      'npm run check passes',
    ],
    priority: 1,
    passes: false,
    notes: 'Backend-only; PROP-003 wires the UI. Check for an existing file-upload/storage helper before adding a new one.',
    category: 'proposal-templates',
  },
  {
    id: 'PROP-003',
    title: 'Wire BrandManager UI to the branding backend',
    description:
      'As a dealer admin, I want the existing BrandManager screen to actually load and save my brand. The 997-line component is fully built (colors, fonts, layout, logo slots, live preview) but persists nothing — onSave goes nowhere and logos are temporary object URLs.',
    acceptanceCriteria: [
      'BrandManager loads profiles from the PROP-002 endpoints via TanStack Query (list + selected profile), with loading/error states',
      'Save persists the full profile (colors, typography, layout, contact info, social links) via POST/PUT; Set as default works; a saved/dirty indicator shows unsaved changes',
      'Logo upload calls the PROP-002 upload endpoint and renders the persistent URL afterward (object-URL preview allowed only while the upload is in flight)',
      'BrandManager is reachable from proposal settings navigation (route + sidebar entry where the proposal pages live), gated by an appropriate permission',
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 1,
    passes: false,
    notes: 'Depends on PROP-002. Component: client/src/components/proposal-builder/BrandManager.tsx (logo upload at 238-254, onSave at 789).',
    category: 'proposal-templates',
  },
  {
    id: 'PROP-004',
    title: 'Template editor: visual builder persists templates with a section library and merge tokens',
    description:
      'As a dealer admin, I want to build a proposal template once — sections, copy, layout — and reuse it on every quote of that product type. ProposalVisualBuilder already does drag-drop sections and rich text but never saves (no backend call) and hardcodes its styling instead of using brand profiles.',
    acceptanceCriteria: [
      'New route /proposal-templates and /proposal-templates/:id/edit (lazy page in App.tsx) lists templates (from PROP-001 endpoints) with create/clone/delete/set-default actions, and opens ProposalVisualBuilder as the editor',
      'The editor loads template_content from the backend and saves it back (explicit Save button + dirty indicator); section add/delete/reorder/styling all round-trip',
      "A section library offers insertable starter sections: cover page, executive summary, solution overview, investment summary (pricing table), terms & conditions, next steps, signature block — seeded with the HTML currently hardcoded in QuoteTransformer.tsx:249-427 as starting copy",
      "A merge-token menu in the rich text toolbar inserts tokens rendered as chips: {{customer.name}}, {{customer.companyName}}, {{contact.name}}, {{quote.number}}, {{quote.title}}, {{quote.validUntil}}, {{quote.lineItemsTable}}, {{quote.oneTimeTotal}}, {{quote.recurringTotal}}, {{quote.totalAmount}}, {{branding.logo}}, {{branding.companyName}}, {{branding.address}}, {{branding.phone}}, {{branding.email}} — token list exported from a new shared/proposal-merge-fields.ts",
      "Editor styling defaults come from the tenant's default branding profile (colors, fonts) instead of the hardcoded globalStyling at ProposalVisualBuilder.tsx:595-602; a preview mode renders tokens with sample data",
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 1,
    passes: false,
    notes: 'Depends on PROP-001 + PROP-002. The big UI story of this track — if it overruns one iteration, split the section library into a follow-up.',
    category: 'proposal-templates',
  },
  {
    id: 'PROP-005',
    title: 'Shared merge engine: template + quote + branding → rendered proposal sections',
    description:
      'As an engineer, I need one deterministic renderer that takes a template, a proposal/quote record, and a branding profile and produces final HTML sections — replacing the hardcoded HTML generation in QuoteTransformer. It must run in both the Deno edge runtime (PDF/email) and the browser (preview).',
    acceptanceCriteria: [
      'New shared module (e.g. shared/proposal-merge.ts, no Node-only imports so the Deno edge functions can use it) exports renderTemplate(template, data) resolving every token from shared/proposal-merge-fields.ts',
      '{{quote.lineItemsTable}} renders a customer-facing HTML table (name, description, qty, unit price, line total — discounted prices, NO unit_cost/margin), with recurring lines in a separate labeled block when present; currency/date formatting matches the existing PDF',
      '{{branding.logo}} renders an img tag from the profile logoUrl with sane max dimensions; missing branding values fall back to empty string without breaking layout; unknown tokens render as empty string and are reported in a warnings array',
      'Output is sanitized with the existing sanitizeRichHtml pathway before persistence/display',
      'Unit tests cover token substitution, line-items table (incl. per-line discounts and recurring split), missing-data fallbacks, and unknown-token warnings',
      'npm run check && npm run test pass',
    ],
    priority: 1,
    passes: false,
    notes: 'Depends on PROP-001/002 shapes; pure logic + tests, no UI. PROP-006 and PROP-007 consume it.',
    category: 'proposal-templates',
  },
  {
    id: 'PROP-006',
    title: 'One-click Generate Proposal from a quote using a template',
    description:
      "As a sales rep, after finishing a quote I want one action — pick a template (pre-selected for the product type), generate, review — instead of today's multi-dialog QuoteTransformer flow with hand-edited HTML.",
    acceptanceCriteria: [
      "A 'Generate Proposal' action on the quote Review step and on QuotesManagement rows opens a dialog with template choice (default = the templateType-default template; templateType inferred from the dominant line itemType), branding profile (default profile preselected), and a section checklist",
      'POST /proposals/:id/generate-from-template (proposals edge function) runs the PROP-005 merge engine server-side and writes the rendered sections to proposal_sections rows (sectionType, displayOrder, htmlContent) linked to the proposal; template_id is stored on the proposal',
      'Re-generating after the quote changes refreshes the sections, with a confirm dialog warning that manual section edits will be overwritten',
      'Generated content is customer-facing only (no dealer cost or margin anywhere in rendered HTML)',
      'QuoteTransformer\'s hardcoded generateContentFromQuote path is replaced by this flow (component deleted or reduced to the review/toggle UI over generated sections)',
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 1,
    passes: false,
    notes: 'Depends on PROP-004 + PROP-005. Old flow: QuoteTransformer.tsx:202-777 and ProposalBuilder.tsx steps 1-3.',
    category: 'proposal-templates',
  },
  {
    id: 'PROP-007',
    title: 'Branded PDF export that actually works everywhere',
    description:
      "As a sales rep, every Export PDF button must produce a real, branded document. Today /proposals/:id/export/pdf exists for the quote document, but the proposal-side buttons are dead (ProposalVisualBuilder.tsx:812, QuoteTransformer.tsx:729, ProposalBuilder.tsx:1273, MeetingToProposalDashboard.tsx:379) and the PDF ignores templates and branding.",
    acceptanceCriteria: [
      'supabase/functions/proposals/_pdf.ts renders generated proposal_sections (PROP-006) with the branding profile applied — logo in header, brand colors for headings/accents, brand fonts where the PDF lib allows, footer with company contact info; falls back to the current line-item layout when no sections exist',
      'Section-aware page breaks: each top-level section starts cleanly (no headings orphaned at page bottom); long pricing tables repeat their header row across pages',
      'Every Export/Download PDF button in the proposal flow either downloads the real PDF via the export endpoint or is removed — zero dead buttons remain (audit the four listed plus QuoteProposalGeneration.tsx)',
      'Manager PDF (/export/manager-pdf) keeps its role gating and gains the same branding treatment',
      'Email send (QUOTE-008 path) attaches the new branded PDF unchanged in behavior otherwise',
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 1,
    passes: false,
    notes: 'Depends on PROP-005/006 for sections; branding-only improvements to the existing PDF can land even when a proposal has no template sections.',
    category: 'proposal-templates',
  },
  {
    id: 'PROP-008',
    title: 'Public share link with view tracking and accept/decline',
    description:
      'As a sales rep, I want to send the customer a link to a polished web version of the proposal and know when they viewed it; as a customer, I want to accept online. The analytics fields (open_count, viewedAt, acceptedAt, visitorId) exist but there is no public route — everything requires auth today.',
    acceptanceCriteria: [
      'POST /proposals/:id/share generates a random ≥32-byte url-safe token stored on the proposal (add share_token + share_expires_at via migration; expiry defaults to valid_until); response returns the public URL; re-sharing rotates the token',
      'A public edge route (no requireAuth; token lookup only, constant-time compare, expired/revoked → 404) serves the proposal JSON with customer-safe fields ONLY (no cost, margin, internal notes); a public page client/src/pages/ProposalPublicView.tsx (route /p/:token, no auth wrapper) renders the branded sections',
      "First view sets viewed_at and status draft→viewed where applicable; every view increments open_count and logs an 'opened' proposal_analytics event with a visitorId cookie",
      'Accept / Decline buttons on the public page (with confirm + typed-name field) PATCH status through the existing status handler, triggering the existing deal/contract sync on accept',
      "The 'email proposal' flow can include the share link in the message body",
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 2,
    passes: false,
    notes:
      'SECURITY: public route must be token-gated and field-whitelisted — never expose unit_cost/margin/internal notes. Status handler with deal/contract sync: proposals/index.ts (status PATCH).',
    category: 'proposal-templates',
  },
  {
    id: 'PROP-009',
    title: 'Replace execCommand rich text editor with TipTap; delete mock template/AI data',
    description:
      'As an engineer, the proposal editor must stop relying on the deprecated document.execCommand API (RichTextEditor.tsx:64-67) which browsers are removing, and the proposal pages must stop shipping fake data (in-memory templates at ProposalBuilder.tsx:157-229, mock AI pipeline in MeetingToProposalDashboard).',
    acceptanceCriteria: [
      'RichTextEditor reimplemented on TipTap (@tiptap/react + starter-kit) preserving the current toolbar features (headings, bold/italic/underline, colors, alignment, lists, links, hr, blockquote) and the sanitizeRichHtml output pathway; merge-token chip insertion (PROP-004) works as a TipTap node',
      'Existing stored HTML content loads into the new editor without corruption (round-trip test on representative section HTML)',
      'In-memory template examples in ProposalBuilder.tsx are removed; template pickers read only from the PROP-001 endpoints',
      'MeetingToProposalDashboard either gains a clear “coming soon” gate or is removed from routing/sidebar — no fake pipeline data presented as real',
      'npm run check && npm run build pass',
      'Verify in browser using dev-browser skill',
    ],
    priority: 3,
    passes: false,
    notes: 'Do after PROP-004/006 settle so the editor swap does not churn. TipTap is the shadcn-ecosystem default choice.',
    category: 'proposal-templates',
  },
  {
    id: 'PROP-010',
    title: 'E2E regression: quote → template → proposal → PDF → share/accept',
    description:
      'As the team, we need the full overhauled flow locked in with an automated regression so future loops cannot silently break it.',
    acceptanceCriteria: [
      'Playwright spec (tests/proposal-flow.spec.ts) covers: server-searching and multi-adding products, applying a per-line discount with reason, marking a line recurring, autosave + reload recovery, generating a proposal from the default template, verifying branding (logo url + primary color) appears in the rendered sections, downloading a non-empty PDF, creating a share link, and accepting via the public page',
      'Spec asserts the customer-facing outputs (public page payload + customer PDF request) never include unit_cost, total_dealer_cost, or margin fields',
      'docs/quote-module-architecture.md updated with the v2 flow: catalog search endpoints, per-line discounts, recurring buckets, template/merge pipeline, branding profiles, share links',
      'npm run check && npm run test:e2e pass for the new spec (or the spec is structured to skip gracefully when no dev server is available, matching tests/quote-flow.spec.ts conventions)',
      'npm run check passes',
    ],
    priority: 3,
    passes: false,
    notes: 'Final story of the track — depends on everything above. Mirror the conventions in tests/quote-flow.spec.ts.',
    category: 'proposal-templates',
  },
];

const prd = JSON.parse(fs.readFileSync(PRD, 'utf8'));
const existing = new Set(prd.userStories.map((s) => s.id));
const dupes = stories.filter((s) => existing.has(s.id));
if (dupes.length) {
  console.error('Duplicate IDs, aborting:', dupes.map((s) => s.id).join(', '));
  process.exit(1);
}
prd.userStories.push(...stories);
fs.writeFileSync(PRD, JSON.stringify(prd, null, 2) + '\n');
console.log(`Added ${stories.length} stories. Total now: ${prd.userStories.length}`);
