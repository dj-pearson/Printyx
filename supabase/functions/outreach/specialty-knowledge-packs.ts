/**
 * Specialty Knowledge Packs
 *
 * Each pack injects industry-specific domain expertise into AI prompts.
 * Packs are blended by weight when a rep carries multiple specialties.
 *
 * Keep these dense. The AI treats each field as constraint, not suggestion.
 * Add/edit anything here — no migration required, reads at prompt-build time.
 *
 * Source of truth mirror of shared/outreach-schema.ts OUTREACH_SPECIALTIES.
 * When you add a specialty there, add its pack here.
 */

// Inlined from shared/outreach-schema.ts OUTREACH_SPECIALTIES — keep in sync.
export type OutreachSpecialty =
  | 'copier_mfp'
  | 'production_print'
  | 'production_finishing'
  | 'managed_it'
  | 'software'
  | 'managed_print'
  | 'wide_format';

export interface SpecialtyKnowledgePack {
  key: OutreachSpecialty;
  displayName: string;
  shortDescription: string;

  /** What this seller is an expert in. Injected as first-person voice cue. */
  expertisePositioning: string;

  /** Decision maker titles they typically talk to. */
  commonBuyerTitles: string[];

  /** Titles to avoid (gatekeepers, irrelevant). */
  avoidTitles: string[];

  /** Pains the buyer is feeling. These are conversation openers. */
  commonPains: string[];

  /** Insider jargon the rep can drop to signal credibility. Use sparingly in cold — 1 max. */
  industryJargon: string[];

  /** Objections this seller hears and how to preempt them. */
  objectionBank: Array<{ objection: string; reframe: string }>;

  /** Trigger signals that indicate buying intent. Drives angle selection. */
  triggerSignals: string[];

  /** Value props ranked by strength. Used as fallback when no trigger signal exists. */
  valueProps: string[];

  /** ICP shape (industries, company sizes, geographies). */
  idealCustomerShape: {
    industries: string[];
    companySize: string;
    geographies?: string[];
  };

  /** What NOT to talk about in the first email — too salesy, too early. */
  avoidInFirstTouch: string[];
}

export const SPECIALTY_PACKS: Record<OutreachSpecialty, SpecialtyKnowledgePack> = {
  copier_mfp: {
    key: 'copier_mfp',
    displayName: 'Copier / MFP Sales',
    shortDescription: 'Office imaging, A3/A4 multifunction printers, desktop fleet',
    expertisePositioning:
      'You sell copier/MFP hardware + service contracts to office-based businesses. You understand cost-per-page economics, lease cycles, and the real TCO of a printer fleet.',
    commonBuyerTitles: [
      'Office Manager',
      'Operations Manager',
      'IT Manager',
      'Director of IT',
      'Controller',
      'CFO',
      'Director of Operations',
      'Facilities Manager',
      'Executive Assistant',
    ],
    avoidTitles: ['Receptionist', 'Intern', 'Marketing Coordinator'],
    commonPains: [
      'Surprise overage charges on leases',
      'Techs taking 2+ days to respond to service calls',
      'End-of-lease sticker shock (buyout vs. return negotiation)',
      'Aging fleet producing constant jams',
      'Toner shipments always late',
      'No visibility into per-device costs',
      'Locked into auto-renewal without knowing it',
    ],
    industryJargon: [
      'CPP (cost per page)',
      'A3 vs A4',
      'FMV buyout',
      'lease bumper',
      'overage CPP',
      'dual-tray capacity',
    ],
    objectionBank: [
      {
        objection: 'We just signed a lease',
        reframe:
          'Worth a 10-minute call to document what you have — when your lease ends, you will have negotiating leverage most dealers never see. No switch now.',
      },
      {
        objection: 'We are happy with our current provider',
        reframe:
          'Great. Most happy customers I talk to are still overpaying 15-30% because nobody benchmarks them. Happy to share what fair pricing looks like for your volume.',
      },
      {
        objection: 'Send me info',
        reframe:
          'Generic info is useless without knowing your devices and volume. 10 minutes and I can send you something that actually applies to you.',
      },
    ],
    triggerSignals: [
      'Lease expiring in next 6-12 months',
      'Recent office move or new location',
      'Headcount growth 10%+ in last 12 months',
      'Merger / acquisition (two fleets to consolidate)',
      'New IT director / office manager (100-day window)',
      'Recently ran out of toner (public complaint)',
    ],
    valueProps: [
      'Guaranteed 4-hour response SLA',
      'Flat per-page pricing — no overage surprises',
      'Free fleet audit with CPP benchmark against similar-sized peers',
      'No auto-renewal — we re-earn the business each term',
    ],
    idealCustomerShape: {
      industries: [
        'Legal',
        'Healthcare',
        'Financial Services',
        'Real Estate',
        'Insurance',
        'Manufacturing',
        'Education',
        'Non-profit',
      ],
      companySize: '15-500 employees',
    },
    avoidInFirstTouch: [
      'Don not list feature specs (dpi, ppm, etc.) — buyers do not care',
      'Don not pitch specific models',
      'Don not use the word "solution"',
    ],
  },

  production_print: {
    key: 'production_print',
    displayName: 'Production Print',
    shortDescription: 'High-volume color-critical print (iGen, Versant, AccurioPress class)',
    expertisePositioning:
      'You sell production print equipment and consumables to commercial printers, in-plants, and franchise print shops. You understand click charges at scale, color matching, stock handling, and print run economics.',
    commonBuyerTitles: [
      'Owner',
      'President',
      'General Manager',
      'Production Manager',
      'Pressroom Supervisor',
      'VP Operations',
      'Plant Manager',
    ],
    avoidTitles: ['Graphic Designer', 'CSR', 'Marketing Manager'],
    commonPains: [
      'Click charges eating margin on long runs',
      'Color variance between runs killing reprints',
      'Equipment downtime during peak season',
      'Can not match competitor turnaround times',
      'Losing jobs to digital because offset press is too slow to setup',
      'Aging iGen / Versant with declining uptime',
      'Stock handling limitations on existing press',
    ],
    industryJargon: [
      'click charge',
      'chargeback',
      'impressions',
      'makeready',
      'MICR',
      'variable data',
      'CMYK+',
      'gamut',
      'G7 compliance',
    ],
    objectionBank: [
      {
        objection: 'Our current press is fine',
        reframe:
          'Most production shops I talk to discover they are losing 8-12% margin to click charges they negotiated 5+ years ago. Worth a 15-min benchmark.',
      },
      {
        objection: 'We can not afford new equipment',
        reframe:
          'Not pitching equipment — asking about what your current click rate is versus market. Most shops are shocked.',
      },
    ],
    triggerSignals: [
      'Equipment lease / CPC contract expiring',
      'Recent hire of production manager or GM',
      'Expansion into new service offerings (mailing, wide format)',
      'Competitor closed / merged in their market',
      'Hiring production operators (signals volume growth)',
      'New facility announcement',
    ],
    valueProps: [
      'Lower click charge than their incumbent',
      'Faster makeready time = more jobs per shift',
      'Better media range (heavier stocks, synthetics)',
      'Guaranteed 95%+ uptime with parts-on-site',
    ],
    idealCustomerShape: {
      industries: [
        'Commercial Printing',
        'In-plant (corporate/university)',
        'Franchise print (AlphaGraphics, Minuteman, Allegra, PIP, Sir Speedy)',
        'Direct mail',
        'Packaging',
      ],
      companySize: '10-100 employees (print shop) or larger in-plant',
    },
    avoidInFirstTouch: [
      'Do not mention specific models until discovery',
      'Do not compare Xerox vs Canon vs Konica — they are tribal',
      'Do not pitch clicks without knowing current CPP',
    ],
  },

  production_finishing: {
    key: 'production_finishing',
    displayName: 'Production Finishing',
    shortDescription: 'Folders, booklet makers, stitchers, cutters, binders',
    expertisePositioning:
      'You sell finishing equipment — Duplo, Plockmatic, Morgana, Horizon, Standard. You know where bottlenecks happen on the production floor and how finishing speed impacts total throughput.',
    commonBuyerTitles: ['Production Manager', 'Bindery Supervisor', 'Plant Manager', 'Owner', 'GM'],
    avoidTitles: ['Sales', 'CSR', 'Designer'],
    commonPains: [
      'Bindery is the bottleneck — press finishes, jobs sit',
      'Hand-feeding jobs to older folder or stitcher',
      'Multiple passes on multi-function finisher slowing throughput',
      'Operator-dependent jobs (hard to scale)',
      'Square-back / perfect-bind demand growing but capability gaps',
    ],
    industryJargon: [
      'saddle stitch',
      'perfect bind',
      'PUR',
      'square back',
      'scoring',
      'perfing',
      'creasing',
      'near-line',
      'offline',
    ],
    objectionBank: [
      {
        objection: 'We outsource finishing',
        reframe:
          'Makes sense today. Most shops that outsource are paying 3-5x what in-house would cost at your current volume. Worth a quick ROI look.',
      },
    ],
    triggerSignals: [
      'New press installed (finishing must catch up)',
      'Growing booklet / mailer business',
      'Operator turnover',
      'Outsourcing finishing to another shop',
    ],
    valueProps: [
      'Payback in 9-14 months at their volume',
      'Near-line integration with existing press',
      'Single-operator workflow',
    ],
    idealCustomerShape: {
      industries: ['Commercial Printing', 'In-plant', 'Direct mail', 'Book manufacturing'],
      companySize: '10-100 employees',
    },
    avoidInFirstTouch: [
      'Do not pitch specific model without knowing their finish mix',
      'Do not compare brands unsolicited',
    ],
  },

  managed_it: {
    key: 'managed_it',
    displayName: 'Managed IT Services',
    shortDescription: 'MSP services: helpdesk, patching, backup, security, M365',
    expertisePositioning:
      'You sell managed IT services — monthly-per-seat model covering helpdesk, security, backup, cloud. You understand SMB pain of running IT without full-time staff.',
    commonBuyerTitles: [
      'Owner',
      'President',
      'CEO',
      'CFO',
      'Operations Manager',
      'Office Manager (SMB <50 employees)',
      'IT Manager (50-200 employees)',
      'Director of Operations',
    ],
    avoidTitles: ['Receptionist', 'HR Coordinator', 'Marketing'],
    commonPains: [
      'One overwhelmed internal person doing everything',
      'Ransomware anxiety after competitor got hit',
      'Cyber insurance renewals demanding more controls',
      'M365 licensing confusion and overspend',
      'Backups that nobody has tested in 12+ months',
      'Onboarding/offboarding taking days instead of minutes',
      'Audit prep (SOC 2, HIPAA, CMMC) with no documentation',
    ],
    industryJargon: [
      'RMM',
      'EDR',
      'MDR',
      'MFA',
      'conditional access',
      'BCDR',
      'RPO/RTO',
      'zero-trust',
      'GPO',
      'SIEM',
    ],
    objectionBank: [
      {
        objection: 'We have someone internal',
        reframe:
          'Most internal IT folks are heroes — and single points of failure. What happens to backups and patching when they take a week off? Happy to be their backup.',
      },
      {
        objection: 'We already have an MSP',
        reframe:
          'Good. Most MSPs I displace were good 3 years ago but have not kept up with security. Worth a 20-min look at their EDR, MFA enforcement, and backup test logs.',
      },
      {
        objection: 'Too expensive',
        reframe:
          'One ransomware event averages $180K for a company your size. That is 3-5 years of managed services. What does your cyber insurance deductible look like?',
      },
    ],
    triggerSignals: [
      'Recent data breach in their industry / region',
      'Cyber insurance renewal window',
      'New compliance requirement (CMMC, SOC 2, HIPAA)',
      'IT person left / on leave',
      'Rapid headcount growth',
      'Opened new location',
      'M&A activity',
    ],
    valueProps: [
      'Fully-managed monthly-per-seat pricing, no hourly surprises',
      '15-min response SLA on critical tickets',
      'Quarterly security review in plain English',
      'Built-in cyber insurance readiness (MFA, backups, EDR)',
    ],
    idealCustomerShape: {
      industries: [
        'Legal',
        'Healthcare',
        'Financial Services',
        'Manufacturing',
        'Construction',
        'Professional Services',
        'Non-profit',
      ],
      companySize: '10-250 employees',
    },
    avoidInFirstTouch: [
      'Do not use FUD (fear, uncertainty, doubt) as opener — buyers are numb to it',
      'Do not list acronyms in the first email',
      'Do not mention pricing',
    ],
  },

  software: {
    key: 'software',
    displayName: 'Document / Workflow Software',
    shortDescription: 'ECM, DMS, workflow automation, capture, e-signature',
    expertisePositioning:
      'You sell document management, capture, and workflow software — DocuWare, M-Files, PaperCut, Square 9, Kofax, Laserfiche-class products. You think in terms of processes and time-to-outcome, not features.',
    commonBuyerTitles: [
      'Operations Manager',
      'Director of Operations',
      'Controller',
      'CFO',
      'AP Manager',
      'HR Director',
      'Compliance Officer',
      'IT Director',
      'COO',
    ],
    avoidTitles: ['Staff Accountant', 'HR Coordinator', 'Admin Assistant'],
    commonPains: [
      'AP takes 3-5 days to process a single invoice',
      'Contract approval emails getting lost',
      'Audit trails that are actually an inbox search',
      'Paper files slowing month-end close',
      'Remote workers can not access files from home',
      'HR onboarding using paper forms',
      'Records retention violations (can not find things or can not get rid of them)',
    ],
    industryJargon: [
      'capture',
      'OCR',
      'workflow',
      'routing',
      'retention policy',
      'records management',
      'indexing',
      'metadata extraction',
      'straight-through processing',
    ],
    objectionBank: [
      {
        objection: 'We already use SharePoint',
        reframe:
          'Most SharePoint rollouts become expensive file shares. Are documents actually routing and retaining automatically? That is where things break.',
      },
      {
        objection: 'We do not have budget',
        reframe:
          'AP alone usually justifies this 2-3x. Curious — how long does a typical invoice take from receipt to approval?',
      },
    ],
    triggerSignals: [
      'Recent hire of COO, CFO, or controller',
      'Audit / compliance event',
      'Merger or acquisition (document consolidation pain)',
      'Rapid headcount growth',
      'Remote / hybrid transition announcement',
      'Regulatory change in their industry',
    ],
    valueProps: [
      'AP processing time cut from days to hours',
      'One search bar across every document, everywhere',
      'Automatic retention + deletion = audit-ready',
      'Remote access with full audit trail',
    ],
    idealCustomerShape: {
      industries: [
        'Legal',
        'Healthcare',
        'Financial Services',
        'Manufacturing',
        'Government',
        'Higher Education',
        'Non-profit',
      ],
      companySize: '50-1000 employees',
    },
    avoidInFirstTouch: [
      'Do not pitch "digital transformation"',
      'Do not list features — pitch a specific process win (AP, contracts, HR)',
      'Do not compare to specific competitors unsolicited',
    ],
  },

  managed_print: {
    key: 'managed_print',
    displayName: 'Managed Print Services (MPS)',
    shortDescription: 'Hybrid copier + fleet + service managed program',
    expertisePositioning:
      'You sell MPS — a blended program covering fleet optimization, automated toner replenishment, proactive service, and per-page consolidated billing. You are the fleet strategist.',
    commonBuyerTitles: [
      'IT Manager',
      'Director of IT',
      'CFO',
      'Director of Operations',
      'Procurement Manager',
      'Facilities Manager',
    ],
    avoidTitles: ['Receptionist', 'Desktop Support Tech'],
    commonPains: [
      'No idea what their total print spend actually is',
      'Toner ordered ad-hoc by every department',
      'Mixed fleet (HP, Canon, Brother, Xerox) with mixed contracts',
      'End-of-life printers still being used (security risk)',
      'Can not chargeback print costs to departments',
      'IT tickets flooded with "printer not working"',
    ],
    industryJargon: [
      'TCO',
      'fleet optimization',
      'device rationalization',
      'right-sizing',
      'automated replenishment',
      'usage-based billing',
      'scan-to-workflow',
      'pull printing',
    ],
    objectionBank: [
      {
        objection: 'IT handles printers',
        reframe:
          'Exactly why this matters. MPS removes printers from IT tickets and gives them back 10-15% of helpdesk hours. Worth a 20-min look at current ticket volume.',
      },
    ],
    triggerSignals: [
      'Multiple-brand fleet indicating no strategy',
      'New CFO or COO',
      'IT budget reviews',
      'Security incident involving unmanaged devices',
      'Expansion to new office',
    ],
    valueProps: [
      'Single invoice, single SLA across the whole fleet',
      'Typical 20-30% total cost reduction',
      'Auto-replenishment eliminates toner stockouts',
      'Security hardening across all devices',
    ],
    idealCustomerShape: {
      industries: [
        'Healthcare',
        'Financial Services',
        'Manufacturing',
        'Higher Ed',
        'Legal',
        'Government',
      ],
      companySize: '100-5000 employees (multi-location especially)',
    },
    avoidInFirstTouch: [
      'Do not pitch specific devices',
      'Do not lead with cost savings — lead with visibility',
    ],
  },

  wide_format: {
    key: 'wide_format',
    displayName: 'Wide / Large Format',
    shortDescription: 'Plotter, signage, technical doc printing',
    expertisePositioning:
      'You sell wide-format printers — HP DesignJet, Canon imagePROGRAF, Epson SureColor class. You talk to sign shops, architects, engineers, and in-plant graphic teams.',
    commonBuyerTitles: [
      'Owner',
      'Production Manager',
      'Architect',
      'Engineering Manager',
      'Marketing Director (in-plant)',
      'Facilities / Print Supervisor',
    ],
    avoidTitles: ['CAD Operator', 'Receptionist'],
    commonPains: [
      'Aging plotter with declining color accuracy',
      'Outsourcing large prints that could be in-house',
      'Ink cost unpredictable',
      'Color matching to brand standards is manual / inconsistent',
    ],
    industryJargon: [
      'ICC profile',
      'calibration',
      'PANTONE match',
      'roll handling',
      'dye vs pigment',
      'latex',
      'UV',
    ],
    objectionBank: [
      {
        objection: 'We only print a few large jobs a month',
        reframe:
          'Makes sense today — most in-plant customers find they increase volume 3-5x once production is reliable. Worth exploring what is held back.',
      },
    ],
    triggerSignals: [
      'Architecture/engineering firm growth',
      'Marketing rebrand (signage refresh)',
      'Retail expansion (POP signage)',
      'Trade show presence',
    ],
    valueProps: [
      'Bring outsourced print in-house, fast turn',
      'Color accuracy for brand / technical work',
      'Media flexibility (canvas, vinyl, backlit, etc.)',
    ],
    idealCustomerShape: {
      industries: [
        'Architecture / Engineering',
        'Signage / print shops',
        'Retail (in-plant)',
        'Education',
        'Government',
      ],
      companySize: '10-500 employees',
    },
    avoidInFirstTouch: [
      'Do not lead with specs',
      'Do not pitch vs existing HP DesignJet they already own',
    ],
  },
};

/**
 * Get knowledge packs for a rep's specialties, ordered by weight desc.
 * Weights do not need to sum to 100 — they will be normalized downstream.
 */
export function getPacksForSpecialties(
  specialties: Array<{ specialty: string; weight: number }>,
): Array<{ pack: SpecialtyKnowledgePack; normalizedWeight: number }> {
  const totalWeight = specialties.reduce((sum, s) => sum + (s.weight || 0), 0) || 1;
  return specialties
    .filter((s) => SPECIALTY_PACKS[s.specialty as OutreachSpecialty])
    .map((s) => ({
      pack: SPECIALTY_PACKS[s.specialty as OutreachSpecialty],
      normalizedWeight: (s.weight || 0) / totalWeight,
    }))
    .sort((a, b) => b.normalizedWeight - a.normalizedWeight);
}

export function listSpecialties(): Array<{
  key: OutreachSpecialty;
  displayName: string;
  shortDescription: string;
}> {
  return Object.values(SPECIALTY_PACKS).map((p) => ({
    key: p.key,
    displayName: p.displayName,
    shortDescription: p.shortDescription,
  }));
}

export const OUTREACH_SPECIALTIES: readonly OutreachSpecialty[] = [
  'copier_mfp',
  'production_print',
  'production_finishing',
  'managed_it',
  'software',
  'managed_print',
  'wide_format',
];
