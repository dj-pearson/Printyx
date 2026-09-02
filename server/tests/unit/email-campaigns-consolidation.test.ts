/**
 * One email-marketing implementation, and the sequences page can see its
 * campaigns (AUDIT-037).
 *
 * supabase/functions/email-marketing/'s header said it absorbed the standalone
 * email-templates and email-campaigns functions and that they would be deleted
 * "in PR 2 after 48h soak". PR 2 never landed, and the standalone that survived
 * was the broken copy: it wrote name, from_name, from_email, reply_to,
 * html_content, text_content and scheduled_at, none of which is a column on
 * email_campaigns, and its /send and /:id/stats used email_campaign_sends and
 * customer_segment_members, neither of which is a table anywhere.
 *
 * The live consequence was on the frontend, not the backend. EmailSequencesPage
 * filters campaigns with ['drip','automated'].includes(c.campaignType), and
 * every campaigns endpoint returns raw snake_case rows, so campaignType was
 * undefined on every row, the filter matched nothing, and the page said "No drip
 * or automated campaigns found" whatever the tenant had. Nobody could enroll
 * anyone into a sequence.
 *
 * Outcome assertions only. Comments are stripped before any absence check - the
 * files here explain the old names in prose, and a test that reads its own
 * explanation as the defect is a trap this repo has hit repeatedly. Line
 * comments first: a doc comment containing /api/* opens a block comment
 * otherwise.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (src: string) =>
  src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the absorbed standalone functions are gone', () => {
  it.each(['supabase/functions/email-campaigns', 'supabase/functions/email-templates'])(
    '%s is deleted',
    (p) => {
      expect(existsSync(join(repo, p))).toBe(false);
    },
  );

  it('email-marketing still serves both sub-prefixes', () => {
    const index = read('supabase/functions/email-marketing/index.ts');
    expect(index).toContain("case 'email-campaigns':");
    expect(index).toContain("case 'email-templates':");
  });

  it('the proxy points at the canonical dispatcher', () => {
    const proxy = stripComments(read('server/middleware/edge-function-proxy.ts'));
    expect(proxy).toContain("'/api/email-marketing': 'email-marketing'");
    expect(proxy).not.toContain("'/api/email-campaigns'");
  });
});

describe('the sequences page can read a campaign', () => {
  const hook = read('client/src/hooks/useEmailSequences.ts');

  it('calls the canonical path', () => {
    expect(stripComments(hook)).toContain("apiRequest('/api/email-marketing/email-campaigns')");
  });

  it('maps the real column names onto what the page reads', () => {
    // The page filters on campaignType and prints name; the row carries
    // campaign_type and campaign_name. Without this mapping the filter is
    // always empty, which is the defect, not a styling detail.
    expect(hook).toMatch(/campaign_name/);
    expect(hook).toMatch(/campaign_type/);
    expect(hook).toMatch(/sequence_steps/);
    expect(hook).toMatch(/current_step/);
  });

  it('the page still filters on campaignType, so the mapping is load-bearing', () => {
    const page = read('client/src/pages/marketing/EmailSequencesPage.tsx');
    expect(page).toMatch(/\['drip',\s*'automated'\]\.includes\(c\.campaignType\)/);
  });
});

describe('the columns the deleted copy invented', () => {
  it('email_campaigns has campaign_name and sender_email, not name and from_email', () => {
    const schema = read('shared/schema.ts');
    const at = schema.indexOf("'email_campaigns',");
    expect(at).toBeGreaterThan(-1);
    const body = schema.slice(at, schema.indexOf('  },\n  (table)', at));
    for (const col of ['campaign_name', 'campaign_type', 'sender_name', 'sender_email']) {
      expect(body).toContain(`'${col}'`);
    }
    for (const col of ['from_name', 'from_email', 'html_content', 'text_content', 'scheduled_at']) {
      expect(body).not.toContain(`'${col}'`);
    }
  });
});
