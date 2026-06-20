// UTM tagging + optimal-time helpers for distribution (US-BLOG-052, 053, 054)
//
// Pure functions — deterministic and testable without external services. GA4
// verification (US-BLOG-053) and short-link providers are layered on top by the
// edge function; the tagging itself lives here.

export interface UtmTemplate {
  /** utm_source value — defaults to the platform key. */
  source?: string;
  /** Map platform → utm_medium (social/email/community). Falls back to MEDIUM_BY_PLATFORM. */
  medium_by_platform?: Record<string, string>;
  /** utm_campaign strategy: 'post_slug' (default) or a literal campaign string. */
  campaign?: string;
}

// Sensible defaults so a workspace with no template still gets correct mediums.
export const MEDIUM_BY_PLATFORM: Record<string, string> = {
  x: 'social',
  twitter: 'social',
  linkedin: 'social',
  facebook: 'social',
  instagram: 'social',
  tiktok: 'social',
  pinterest: 'social',
  newsletter: 'email',
  email: 'email',
  reddit: 'community',
  hackernews: 'community',
  medium: 'referral',
  substack: 'email',
  slack: 'community',
  discord: 'community',
};

export interface BuildUtmArgs {
  baseUrl: string;
  platform: string;
  slug: string;
  template?: UtmTemplate | null;
}

/** Append utm_source/medium/campaign params to a URL without clobbering existing query. */
export function buildUtmUrl(args: BuildUtmArgs): { url: string; params: Record<string, string> } {
  const t = args.template ?? {};
  const source = (t.source && t.source !== 'platform' ? t.source : args.platform).toLowerCase();
  const medium =
    t.medium_by_platform?.[args.platform] ?? MEDIUM_BY_PLATFORM[args.platform] ?? 'referral';
  const campaign =
    !t.campaign || t.campaign === 'post_slug' ? args.slug : t.campaign;

  const params: Record<string, string> = {
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
  };

  let url: URL;
  try {
    url = new URL(args.baseUrl);
  } catch {
    // Fall back to string concat if baseUrl isn't absolute.
    const qs = new URLSearchParams(params).toString();
    return { url: `${args.baseUrl}${args.baseUrl.includes('?') ? '&' : '?'}${qs}`, params };
  }
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return { url: url.toString(), params };
}

export interface TimeSlot {
  dow: number; // 0=Sunday .. 6=Saturday
  hour: number; // 0..23 (UTC)
  weight: number; // engagement weight
}

/**
 * Compute the best day-of-week × hour slots for a platform from historical
 * engagement samples. Each sample = { publishedAt ISO, engagement number }.
 */
export function optimalSlots(
  samples: Array<{ publishedAt: string; engagement: number }>,
  topN = 3,
): TimeSlot[] {
  const buckets = new Map<string, { weight: number; dow: number; hour: number }>();
  for (const s of samples) {
    const d = new Date(s.publishedAt);
    if (Number.isNaN(d.getTime())) continue;
    const dow = d.getUTCDay();
    const hour = d.getUTCHours();
    const key = `${dow}-${hour}`;
    const b = buckets.get(key) ?? { weight: 0, dow, hour };
    b.weight += Math.max(s.engagement, 1);
    buckets.set(key, b);
  }
  return Array.from(buckets.values())
    .map((b) => ({ dow: b.dow, hour: b.hour, weight: b.weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, topN);
}

/**
 * Next future Date matching a target day-of-week + hour (UTC), at least
 * `minLeadMinutes` from now.
 */
export function nextSlotDate(slot: TimeSlot, from = new Date(), minLeadMinutes = 30): Date {
  const d = new Date(from.getTime() + minLeadMinutes * 60_000);
  d.setUTCMinutes(0, 0, 0);
  // Advance to the target hour today, then walk to the target weekday.
  d.setUTCHours(slot.hour);
  let guard = 0;
  while ((d.getUTCDay() !== slot.dow || d.getTime() < from.getTime()) && guard < 14) {
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(slot.hour, 0, 0, 0);
    guard++;
  }
  return d;
}

// US-BLOG-054 default re-share cadence.
export const DEFAULT_CADENCE: Array<{ offset_days: number; platforms: string[]; label: string }> = [
  { offset_days: 0, platforms: ['x', 'linkedin', 'facebook', 'newsletter'], label: 'Launch' },
  { offset_days: 3, platforms: ['x'], label: 'Re-hook on X' },
  { offset_days: 7, platforms: ['linkedin'], label: 'LinkedIn fresh angle' },
  { offset_days: 30, platforms: ['reddit', 'slack'], label: 'Community resurface' },
  { offset_days: 90, platforms: ['x', 'linkedin'], label: 'Quarterly resurface' },
  { offset_days: 180, platforms: ['x'], label: 'Semi-annual resurface' },
];
