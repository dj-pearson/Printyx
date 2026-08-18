/**
 * Unit Tests: server/services/qbr-artifact-storage.ts (LEGAL-006)
 *
 * QBR decks carry a customer's fleet, usage and spend, and both code paths used
 * to persist a permanent public URL for them. The fix stores the storage KEY and
 * mints a short-lived signed URL per read, which means the read path has to cope
 * with two shapes: keys written now, and full public URLs written before.
 *
 * If toArtifactKey gets that wrong, historical decks 404 for customers, so the
 * backward-compatibility cases are as load-bearing as the new ones.
 */

import { describe, it, expect } from 'vitest';
import { toArtifactKey, QBR_BUCKET } from '../../services/qbr-artifact-storage';

describe('toArtifactKey', () => {
  it('passes through a bare key, which is what uploads write now', () => {
    expect(toArtifactKey('qbr/t1/cust-2026-Q2.pdf')).toBe('qbr/t1/cust-2026-Q2.pdf');
  });

  it('recovers the key from a legacy public URL for this bucket', () => {
    const legacy = `https://api.printyx.net/storage/v1/object/public/${QBR_BUCKET}/qbr/t1/deck.pdf`;
    expect(toArtifactKey(legacy)).toBe('qbr/t1/deck.pdf');
  });

  it('recovers the key from a public URL naming some other bucket', () => {
    // Rows written while the two halves disagreed about the bucket name.
    const other = 'https://api.printyx.net/storage/v1/object/public/qbr/t1/deck.pdf';
    expect(toArtifactKey(other)).toBe('t1/deck.pdf');
  });

  it('drops a query string so an old signed URL still yields its key', () => {
    expect(toArtifactKey('qbr/t1/deck.pdf?token=abc')).toBe('qbr/t1/deck.pdf');
  });

  it('strips a leading slash', () => {
    expect(toArtifactKey('/qbr/t1/deck.pdf')).toBe('qbr/t1/deck.pdf');
  });

  it('returns null for empty input rather than an empty key', () => {
    expect(toArtifactKey(null)).toBeNull();
    expect(toArtifactKey(undefined)).toBeNull();
    expect(toArtifactKey('')).toBeNull();
    expect(toArtifactKey('   ')).toBeNull();
  });

  it('returns null for an off-site URL it cannot place in a bucket', () => {
    // Signing something we cannot locate would produce a broken link that looks
    // valid. Better to return nothing and let the UI show no artifact.
    expect(toArtifactKey('https://example.com/somewhere/else.pdf')).toBeNull();
  });
});

describe('QBR_BUCKET', () => {
  it('defaults to the name the production edge function uses', () => {
    // The Express route used to default to 'qbr' while the edge function used
    // 'qbr-artifacts'. One canonical default, overridable by env.
    expect(QBR_BUCKET).toBe(process.env.QBR_STORAGE_BUCKET || 'qbr-artifacts');
  });
});
