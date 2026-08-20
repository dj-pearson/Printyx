/**
 * Modular dashboard card configuration (PROD-014).
 *
 * ModularDashboard.tsx reads /api/dashboard/modules and /card-config. The two
 * backends disagreed about everything: Express computes real per-tenant
 * aggregates and answers { modules, userRole, roleConfig }, while the edge
 * function returned a bare ARRAY of four hardcoded modules ('$125,430',
 * 'Active Deals 48') under card ids no other part of the system uses.
 *
 * The page destructures `modules` off the response, so the array arrived as
 * undefined and the default [] applied — in production the dashboard rendered
 * its "no modules" empty state. The fabricated numbers were never shown, which
 * is the one mercy in it, but nothing else worked either.
 *
 * The role -> cards map and the per-card presentation live here so both
 * backends emit the same card ids, titles and categories; only the queries
 * differ. server/tests/unit/dashboard-cards-parity.test.ts fails on drift.
 *
 * Node copy — kept textually identical to
 * supabase/functions/_shared/dashboard-cards.ts.
 */

export interface RoleCards {
  defaultCards: string[];
  availableCards: string[];
}

/** Cards a role sees by default, and cards it may switch on. */
export const ROLE_CARDS: Record<string, RoleCards> = {
  sales: {
    defaultCards: ['personal_revenue', 'personal_deals', 'personal_leads'],
    availableCards: ['team_revenue', 'company_customers', 'inventory_alerts', 'service_overview'],
  },
  sales_rep: {
    defaultCards: ['personal_revenue', 'personal_deals', 'personal_leads'],
    availableCards: ['team_revenue', 'company_customers', 'inventory_alerts'],
  },
  technician: {
    defaultCards: ['personal_tickets', 'response_time', 'completion_rate'],
    availableCards: ['team_tickets', 'company_customers', 'inventory_alerts', 'revenue_overview'],
  },
  service_manager: {
    defaultCards: ['team_tickets', 'response_time', 'completion_rate', 'technician_performance'],
    availableCards: ['company_revenue', 'company_customers', 'inventory_alerts'],
  },
  manager: {
    defaultCards: ['business_overview', 'revenue_summary', 'customer_summary', 'service_summary'],
    availableCards: [],
  },
  admin: {
    defaultCards: ['business_overview', 'revenue_summary', 'customer_summary', 'service_summary'],
    availableCards: [],
  },
};

/** Unknown roles get the sales layout, which is what Express has always done. */
export function roleCards(role: string | null | undefined): RoleCards {
  return ROLE_CARDS[role ?? ''] ?? ROLE_CARDS.sales;
}

/**
 * The cards to build for this request.
 *
 * An optional card counts only if the role is allowed to switch it on —
 * otherwise a caller could name any card id and be served data its role does
 * not get.
 */
export function resolveActiveCards(
  role: string | null | undefined,
  enabled: string[] | null | undefined,
): { config: RoleCards; enabledCards: string[]; activeCards: string[] } {
  const config = roleCards(role);
  const enabledCards = (enabled ?? []).map((c) => c.trim()).filter(Boolean);
  const activeCards = [
    ...config.defaultCards,
    ...enabledCards.filter((card) => config.availableCards.includes(card)),
  ];
  return { config, enabledCards, activeCards };
}

/**
 * Parse the `enabled` query parameter.
 *
 * Accepts a comma-separated list. Empty and absent both mean "no optional
 * cards", not "all of them".
 */
export function parseEnabledParam(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
}

export interface CardMeta {
  category: string;
  title: string;
  subtitle?: string;
  icon: string;
  cardType: string;
}

/**
 * Presentation for each card id.
 *
 * Titles and categories are here rather than at each call site because the page
 * groups by `category` — a card that says 'management' on one backend and
 * 'sales' on the other lands in a different section of the dashboard.
 */
export const CARD_META: Record<string, CardMeta> = {
  personal_revenue: {
    category: 'sales',
    title: 'Monthly Revenue',
    subtitle: 'This month',
    icon: 'DollarSign',
    cardType: 'personal',
  },
  personal_deals: {
    category: 'sales',
    title: 'My Deals',
    subtitle: 'Active opportunities',
    icon: 'Target',
    cardType: 'personal',
  },
  personal_leads: {
    category: 'sales',
    title: 'My Leads',
    subtitle: 'New prospects',
    icon: 'Users',
    cardType: 'personal',
  },
  personal_tickets: {
    category: 'service',
    title: 'My Tickets',
    subtitle: 'Assigned to me',
    icon: 'Wrench',
    cardType: 'personal',
  },
  team_revenue: {
    category: 'sales',
    title: 'Team Revenue',
    subtitle: 'This month - all team',
    icon: 'DollarSign',
    cardType: 'team',
  },
  company_customers: {
    category: 'management',
    title: 'Total Customers',
    subtitle: 'Company-wide',
    icon: 'Users',
    cardType: 'company',
  },
  inventory_alerts: {
    category: 'operations',
    title: 'Low Stock Items',
    subtitle: 'Need reordering',
    icon: 'AlertCircle',
    cardType: 'operational',
  },
  service_overview: {
    category: 'service',
    title: 'Service Overview',
    icon: 'Wrench',
    cardType: 'departmental',
  },
  revenue_overview: {
    category: 'management',
    title: 'Company Revenue',
    subtitle: 'This month',
    icon: 'DollarSign',
    cardType: 'company',
  },
  business_overview: {
    category: 'management',
    title: 'Business Overview',
    icon: 'BarChart3',
    cardType: 'executive',
  },
  // A manager's other three default cards. The role config has always promised
  // them and no branch ever built one, so three quarters of a manager's
  // dashboard was blank on Express too. They read the same aggregates
  // business_overview already computes.
  revenue_summary: {
    category: 'management',
    title: 'Revenue (30 days)',
    subtitle: 'Invoiced',
    icon: 'DollarSign',
    cardType: 'executive',
  },
  customer_summary: {
    category: 'management',
    title: 'Customers',
    subtitle: 'Company-wide',
    icon: 'Users',
    cardType: 'executive',
  },
  service_summary: {
    category: 'service',
    title: 'Open Tickets',
    subtitle: 'Awaiting resolution',
    icon: 'Wrench',
    cardType: 'executive',
  },
};

/** US dollars, no cents — the format the cards have always used. */
export function formatCurrency(value: number): string {
  return `$${Number(value || 0).toLocaleString('en-US')}`;
}

/** Sum a numeric column that may arrive as a string (PostgREST) or a number. */
export function sumNumeric(values: Array<unknown>): number {
  let total = 0;
  for (const v of values) {
    const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

/** One card, given its computed value. Returns null for an unknown id. */
export function buildCard(
  id: string,
  value: string | number,
  overrides: { subtitle?: string; data?: Record<string, unknown>; enabled?: boolean } = {},
): Record<string, unknown> | null {
  const meta = CARD_META[id];
  if (!meta) return null;
  const card: Record<string, unknown> = {
    id,
    category: meta.category,
    title: meta.title,
    icon: meta.icon,
    cardType: meta.cardType,
  };
  if (overrides.data) card.data = overrides.data;
  else card.value = value;
  const subtitle = overrides.subtitle ?? meta.subtitle;
  if (subtitle !== undefined) card.subtitle = subtitle;
  if (overrides.enabled !== undefined) card.enabled = overrides.enabled;
  return card;
}
