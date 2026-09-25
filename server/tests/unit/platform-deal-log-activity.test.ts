// Round 211. PlatformDealDetail's Log Activity had no handler. It opens the
// dialog the business record page already used (moved into a shared
// component), posting the deal's account plus the deal id.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { platformActivityBody } from '../../../client/src/components/platform-crm/LogPlatformActivityDialog';

describe('platformActivityBody', () => {
  it('sends the account and the deal, and never an author', () => {
    const body = platformActivityBody({
      businessRecordId: 'br1',
      dealId: 'd1',
      activityType: 'call',
      subject: '  Intro  ',
      description: '',
    });
    expect(body).toEqual({
      businessRecordId: 'br1',
      dealId: 'd1',
      activityType: 'call',
      subject: 'Intro',
      description: undefined,
    });
    expect('createdBy' in body).toBe(false);
  });

  it('omits the deal when there is none', () => {
    const body = platformActivityBody({
      businessRecordId: 'br1',
      activityType: 'note',
      subject: '',
      description: 'x',
    });
    expect(body.dealId).toBeUndefined();
    expect(body.subject).toBeUndefined();
  });
});

describe('PlatformDealDetail', () => {
  const src = readFileSync('client/src/pages/PlatformDealDetail.tsx', 'utf8');

  it('opens the shared dialog with the deal account and the deal id', () => {
    expect(src).toMatch(/onClick=\{\(\) => setActivityOpen\(true\)\}/);
    expect(src).toMatch(/businessRecordId=\{deal\.businessRecordId\}\s*dealId=\{id\}/);
    // Refreshes the timeline the Activities tab reads.
    const key = src.match(/queryKey: \[`(\/api\/platform-activities\?dealId=\$\{id\}&limit=50)`\]/);
    expect(key).not.toBeNull();
    expect(src).toContain(`invalidate={[\`${key![1]}\`]}`);
  });

  it('disables the button when the deal has no account to log against', () => {
    expect(src).toMatch(/disabled=\{!deal\?\.businessRecordId\}/);
  });
});

describe('the activity endpoint takes the deal id', () => {
  it('maps dealId to deal_id', () => {
    const fn = readFileSync('supabase/functions/platform-activities/index.ts', 'utf8');
    expect(fn).toMatch(/dealId: 'deal_id',/);
  });
});
