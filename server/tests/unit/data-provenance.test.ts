/**
 * Unit Tests: server/services/data-provenance-service.ts (LEGAL-008)
 *
 * Two obligations, and the tests focus on the one that is easy to get subtly
 * wrong: suppression has to be DURABLE. Deleting a contact row does not stop the
 * next enrichment run re-acquiring the same person from the same provider, so an
 * erasure that only deletes the row quietly undoes itself. That is why
 * suppression is keyed by email rather than contact id, and why the check fails
 * closed.
 */

import { describe, it, expect } from 'vitest';
import {
  ART14_NOTICE_DEADLINE_DAYS,
  normalizeEmail,
  requiresArt14Notice,
} from '../../services/data-provenance-service';
import {
  INDIRECT_SOURCES,
  PROVENANCE_SOURCES,
  ART14_NOTICE_STATUSES,
} from '../../../shared/data-provenance-schema';

describe('normalizeEmail', () => {
  it('lower-cases and trims, because providers are inconsistent about case', () => {
    // A suppression stored as "A@B.com" must still match "a@b.com" coming back
    // from a provider, or the suppression silently fails.
    expect(normalizeEmail('  Dana.Reeves@Example.COM ')).toBe('dana.reeves@example.com');
  });

  it('treats blank input as no identifier rather than an empty match', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('   ')).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(undefined)).toBeNull();
  });
});

describe('requiresArt14Notice', () => {
  it('is true for data bought from a provider, which the subject never gave us', () => {
    expect(requiresArt14Notice('apollo')).toBe(true);
    expect(requiresArt14Notice('zoominfo')).toBe(true);
  });

  it('is false when the subject or the customer supplied the data', () => {
    // Art. 13 applied at collection instead; a second notice is not owed.
    expect(requiresArt14Notice('customer')).toBe(false);
    expect(requiresArt14Notice('web_form')).toBe(false);
    expect(requiresArt14Notice('import')).toBe(false);
  });

  it('does not treat unknown provenance as triggering a notice', () => {
    // 'unknown' means we cannot say, which is a data-quality problem to fix,
    // not a licence to email someone a notice they may not be owed.
    expect(requiresArt14Notice('unknown')).toBe(false);
  });

  it('covers every declared indirect source', () => {
    for (const source of INDIRECT_SOURCES) {
      expect(requiresArt14Notice(source), source).toBe(true);
    }
  });
});

describe('Article 14 deadline', () => {
  it('is the one month the regulation allows', () => {
    expect(ART14_NOTICE_DEADLINE_DAYS).toBe(30);
  });
});

describe('schema vocabulary', () => {
  it('every indirect source is a declared provenance source', () => {
    for (const s of INDIRECT_SOURCES) {
      expect(PROVENANCE_SOURCES).toContain(s);
    }
  });

  it('has a status for a subject who objected, distinct from one who was notified', () => {
    // Collapsing these would mean either notifying someone who objected, or
    // treating an objection as if the notice had been sent.
    expect(ART14_NOTICE_STATUSES).toContain('suppressed');
    expect(ART14_NOTICE_STATUSES).toContain('sent');
    expect(ART14_NOTICE_STATUSES).toContain('pending');
  });

  it('has a status for a claimed exemption, so silence is never the record', () => {
    expect(ART14_NOTICE_STATUSES).toContain('exempt');
  });
});
