/**
 * Public booking link derivation (COP-B14 AC5).
 *
 * A booking link is not a UI string. It is pasted into an email sequence
 * template that is stored in the database and sent weeks later to somebody
 * outside the company, so the origin it carries has to be one a stranger can
 * reach. `window.location.origin` is the obvious source and is wrong on every
 * developer machine: a rep composing a sequence against localhost would store
 * `http://localhost:5173/book/dana-30min` in a template and every prospect who
 * clicked it would get nothing. The link is silently dead and the sequence
 * keeps reporting sends.
 *
 * So the rule is: use the current origin when it is one someone else could
 * open, and otherwise fall back to the canonical site origin AND SAY SO. The
 * caller gets `usedCanonicalOrigin` precisely so the UI can tell the rep that
 * the link it just inserted does not point at the host they are looking at -
 * a silent substitution would be its own quiet defect, one host over.
 *
 * What this does NOT decide: whether the slug resolves to a live page. That is
 * the picker's job (it lists active pages) and the public function's (it 404s
 * an unknown slug). This module only answers "what URL spells this slug".
 */

/** Where the deployed app serves /book/:slug. Matches SITE_URL in lib/seo/seoConfig. */
export const CANONICAL_BOOKING_ORIGIN = 'https://printyx.net';

export interface BookingLink {
  url: string;
  /** The given origin was not reachable from outside, so the canonical one was used. */
  usedCanonicalOrigin: boolean;
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

/**
 * Could somebody who is not sitting at this machine open a link on this origin?
 *
 * Private ranges count as local: a 192.168 address is reachable from the next
 * desk and from nowhere a prospect will ever be.
 */
export function isShareableOrigin(origin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const host = parsed.hostname.toLowerCase();
  if (LOCAL_HOSTNAMES.has(host)) return false;
  if (host.endsWith('.local') || host.endsWith('.localhost')) return false;
  if (/^127\./.test(host)) return false;
  if (/^10\./.test(host)) return false;
  if (/^192\.168\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  return true;
}

/**
 * The public URL for a booking page slug, or null when there is no slug to
 * build one from. A page row with a blank slug is not a link to `/book/` - it
 * is a page nobody can reach, and offering it would put a 404 in an email.
 */
export function bookingLink(slug: string, origin: string): BookingLink | null {
  const cleanSlug = slug.trim().replace(/^\/+|\/+$/g, '');
  if (!cleanSlug) return null;

  const shareable = isShareableOrigin(origin);
  const base = (shareable ? origin : CANONICAL_BOOKING_ORIGIN).replace(/\/+$/, '');
  return { url: `${base}/book/${cleanSlug}`, usedCanonicalOrigin: !shareable };
}
