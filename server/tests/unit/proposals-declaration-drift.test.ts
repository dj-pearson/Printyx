/**
 * Six proposals columns existed and the schema did not know (AUDIT-037).
 *
 * Every one of these is on every database and was missing from
 * shared/schema.ts's declaration, so drizzle-kit had never seen them and
 * check:phantom-cols reported each read as a phantom:
 *
 *   customer_feedback                              migration 0000
 *   total_dealer_cost, total_margin_percentage     0042
 *   share_token, share_expires_at                  0045
 *   discount_reason, discount_reason_note          0047
 *
 * That is four hand-written migrations, each added when a feature needed the
 * column, and none of them ever came back to the schema. The pattern is worth
 * recognising: a column added by hand is invisible to every tool that reads the
 * declaration, which is all of them.
 *
 * The other two findings on this function were genuine - posting a comment and
 * recording an accept both 42703'd.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const schema = read('shared/schema.ts');
const fn = read('supabase/functions/proposals/index.ts')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

describe('the declaration catches up with the database', () => {
  const decl = (() => {
    const at = schema.indexOf('export const proposals = pgTable(');
    return schema.slice(at, at + 6000);
  })();

  it('declares all six', () => {
    for (const col of [
      'total_dealer_cost',
      'total_margin_percentage',
      'discount_reason',
      'discount_reason_note',
      'share_token',
      'share_expires_at',
      'customer_feedback',
    ]) {
      expect(decl, col).toContain(`'${col}'`);
    }
  });

  it('each one is backed by a migration that really ran', () => {
    // The point of declaring them is that they exist; if one did not, this
    // would be inventing a column rather than recording one.
    const migrations = [
      ['drizzle/migrations/0042_quote_cost_margin.sql', 'total_dealer_cost'],
      ['drizzle/migrations/0045_proposal_share_token.sql', 'share_token'],
      ['drizzle/migrations/0047_proposal_discount_reason.sql', 'discount_reason'],
      ['drizzle/migrations/0000_fuzzy_blizzard.sql', 'customer_feedback'],
    ] as const;
    for (const [file, col] of migrations) {
      expect(read(file), `${file} ${col}`).toContain(`"${col}"`);
    }
  });
});

describe('the two genuine phantoms are rebound', () => {
  it('a comment writes content and author_id', () => {
    // `comment` and `user_id` are not columns, and author_id was already being
    // set right beside the duplicate.
    expect(fn).toMatch(/content: body\.comment \|\| body\.commentText/);
    expect(fn).not.toMatch(/comment: body\.comment/);
    expect(fn).not.toMatch(/user_id: ctx\.userId/);
  });

  it('the visitor cookie goes into event_details, not a column of its own', () => {
    // proposal_analytics has no visitor_id, and a column for a value that
    // identifies nobody is not worth adding.
    expect(fn).not.toMatch(/visitor_id:/);
    expect(fn).toMatch(/visitorId: readCookie\(req, 'pxv'\)/);
  });
});
