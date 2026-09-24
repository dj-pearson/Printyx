// Round 214. MobileServiceDispatch was imported by ServiceHub and rendered
// nowhere. It was also a fixture: a hardcoded "Acme Corporation" ticket, and
// status buttons that changed local state and toasted "Status Updated" while
// writing nothing - a fabricated write outcome. Its Add Photo button had no
// handler; wiring it would have attached a real upload to a fake ticket. The
// component is deleted. Real ticket photos go through
// POST /service-tickets/:id/attachments (round 110).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('MobileServiceDispatch', () => {
  it('is gone, and ServiceHub no longer imports it', () => {
    expect(existsSync('client/src/components/mobile/MobileServiceDispatch.tsx')).toBe(false);
    expect(readFileSync('client/src/pages/ServiceHub.tsx', 'utf8')).not.toContain(
      'MobileServiceDispatch',
    );
  });

  it('the real attachment endpoint it would have needed exists', () => {
    const fn = readFileSync('supabase/functions/service-tickets/index.ts', 'utf8');
    expect(fn).toMatch(/subResource === 'attachments'/);
  });
});
