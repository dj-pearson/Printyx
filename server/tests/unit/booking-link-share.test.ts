/**
 * COP-B14 AC5: a booking link is shareable from a record and from a sequence.
 *
 * Two properties are locked here and they fail differently.
 *
 * The first is arithmetic on the URL and is unit-testable: `bookingLink`
 * refuses a blank slug and refuses to hand back a localhost origin, because
 * the second half of AC5 stores the link inside an email template that is sent
 * later to somebody outside the building. A link that works on the machine
 * that composed it and nowhere else is the whole defect this module exists to
 * stop, and it fails silently - the sequence still reports a send.
 *
 * The second is wiring, and it is asserted by reading source because nothing
 * else can: a component that is written but never rendered is CRMX-016's loss
 * (a whole booking feature behind three missing Route lines) and this story's
 * own AC5 has been half-open for exactly that reason.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  bookingLink,
  isShareableOrigin,
  CANONICAL_BOOKING_ORIGIN,
} from '../../../client/src/lib/booking-link';

const root = path.resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');

/** Absence assertions must not match the comment explaining the absence. */
function stripComments(src: string): string {
  return src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('bookingLink', () => {
  it('uses the current origin when a stranger could open it', () => {
    const link = bookingLink('dana-30min', 'https://printyx.net');
    expect(link).toEqual({
      url: 'https://printyx.net/book/dana-30min',
      usedCanonicalOrigin: false,
    });
  });

  it('keeps a non-canonical but public origin, so a second deployment still works', () => {
    const link = bookingLink('dana-30min', 'https://crm.acme-copiers.com');
    expect(link?.url).toBe('https://crm.acme-copiers.com/book/dana-30min');
    expect(link?.usedCanonicalOrigin).toBe(false);
  });

  it('falls back to the canonical origin on localhost AND reports the substitution', () => {
    const link = bookingLink('dana-30min', 'http://localhost:5173');
    expect(link?.url).toBe(`${CANONICAL_BOOKING_ORIGIN}/book/dana-30min`);
    // The flag is the point: a silent swap is its own defect, one host over.
    expect(link?.usedCanonicalOrigin).toBe(true);
  });

  it.each([
    'http://127.0.0.1:3000',
    'http://192.168.1.14:5173',
    'http://10.0.0.7',
    'http://172.20.3.9',
    'http://dana-laptop.local:5173',
  ])('treats %s as unreachable from outside', (origin) => {
    expect(isShareableOrigin(origin)).toBe(false);
    expect(bookingLink('x', origin)?.usedCanonicalOrigin).toBe(true);
  });

  it('does not mistake a public host that merely starts with a private-looking octet', () => {
    // 172.32 is outside 172.16-172.31, and 1.10.x is not 10.x.
    expect(isShareableOrigin('http://172.32.0.1')).toBe(true);
    expect(isShareableOrigin('http://1.10.0.1')).toBe(true);
  });

  it('refuses a non-http scheme and an unparseable origin', () => {
    expect(isShareableOrigin('file:///Users/dana/app')).toBe(false);
    expect(isShareableOrigin('not a url')).toBe(false);
  });

  it('returns null for a page with no slug rather than linking to /book/', () => {
    expect(bookingLink('', 'https://printyx.net')).toBeNull();
    expect(bookingLink('   ', 'https://printyx.net')).toBeNull();
    expect(bookingLink('/', 'https://printyx.net')).toBeNull();
  });

  it('does not double the slash when the origin carries a trailing one', () => {
    expect(bookingLink('dana', 'https://printyx.net/')?.url).toBe('https://printyx.net/book/dana');
  });
});

describe('AC5: the link is reachable from a record and from the sequence composer', () => {
  const picker = read('client/src/components/booking/BookingLinkPicker.tsx');
  const leadDetail = read('client/src/pages/LeadDetail.tsx');
  const studio = read('client/src/pages/outreach/SequenceStudio.tsx');

  it('the picker offers only active pages and builds its URL through booking-link', () => {
    expect(picker).toContain("from '@/lib/booking-link'");
    expect(picker).toContain('filter((p) => p.is_active)');
    // No hand-rolled `${origin}/book/` anywhere - that is the copy that would
    // drift away from the localhost rule above.
    expect(stripComments(picker)).not.toContain('/book/');
  });

  it('the record page renders the picker, not merely imports it', () => {
    expect(leadDetail).toContain(
      "import { BookingLinkPicker } from '@/components/booking/BookingLinkPicker'",
    );
    expect(leadDetail).toContain('<BookingLinkPicker');
    expect(leadDetail).toContain("label: 'Booking link'");
  });

  it('the sequence composer renders the picker and inserts into the body template', () => {
    expect(studio).toContain('<BookingLinkPicker');
    expect(studio).toContain('onInsert={insertBookingLink}');
    // The insert has to write the body state, or the dialog is decoration.
    const fn = studio.slice(
      studio.indexOf('function insertBookingLink'),
      studio.indexOf('function insertBookingLink') + 600,
    );
    expect(fn).toContain('setBody(next)');
    expect(fn).toContain('el.selectionStart');
  });

  it('an empty state points at page creation instead of showing a link with no page', () => {
    expect(picker).toContain('pages.length === 0');
    expect(picker).toContain('/booking-pages');
  });
});
