/**
 * Six proposals columns existed and the schema did not know (AUDIT-037).
 *
 * Every one of these is on every database and was missing from
 * shared/schema.ts's declaration, so drizzle-kit had never seen them and
 * check:phantom-cols reported each read as a phantom:
 *
 *   total_dealer_cost, total_margin_percentage     0042
 *   share_token, share_expires_at                  0045
 *   discount_reason, discount_reason_note          0047
 *
 * CORRECTED 2026-09-20: a SEVENTH, `customer_feedback`, was added here too and
 * should not have been. Migration 0000 does create it and migration 0002 DROPS
 * it, so the declaration was recording a column that has not existed for
 * ninety-odd migrations - and `check:phantom-cols` validates code against the
 * declaration, so declaring it told the guard that the public accept/decline
 * handler's write was fine. It was a PGRST204 on every acceptance and every
 * decline.
 *
 * The evidence below is why it got through: it grepped the WHOLE of 0000 for
 * the column name, and seven other tables in that file have a
 * `customer_feedback`. The check now reads the `proposals` CREATE TABLE and
 * then replays every later DROP.
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
import { readFileSync, readdirSync } from 'node:fs';
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
    ]) {
      expect(decl, col).toContain(`'${col}'`);
    }
  });

  it('does not declare a column a migration took away', () => {
    expect(decl).not.toContain("'customer_feedback'");
  });

  it('each one is backed by a migration that really ran', () => {
    // The point of declaring them is that they exist; if one did not, this
    // would be inventing a column rather than recording one.
    const migrations = [
      ['drizzle/migrations/0042_quote_cost_margin.sql', 'total_dealer_cost'],
      ['drizzle/migrations/0045_proposal_share_token.sql', 'share_token'],
      ['drizzle/migrations/0047_proposal_discount_reason.sql', 'discount_reason'],
    ] as const;
    for (const [file, col] of migrations) {
      expect(read(file), `${file} ${col}`).toContain(`"${col}"`);
    }
  });

  it('and no declared column was later dropped', () => {
    // The check the original version needed. Grepping a migration FILE for a
    // column name proves nothing about a table: seven other tables in 0000
    // carry a `customer_feedback`, which is how one that `proposals` lost in
    // 0002 was declared as though it still existed.
    const dropped = new Set<string>();
    for (const file of readdirSync(join(repo, 'drizzle/migrations')).sort()) {
      if (!file.endsWith('.sql')) continue;
      for (const m of read(`drizzle/migrations/${file}`).matchAll(
        /ALTER TABLE "proposals" DROP COLUMN "([a-z_]+)"/g,
      )) {
        dropped.add(m[1]);
      }
    }
    expect(dropped.size).toBeGreaterThan(0);
    const stillDeclared = [...dropped].filter((col) => decl.includes(`'${col}'`));
    expect(stillDeclared).toEqual([]);
  });
});

describe('a public accept or decline is recorded before anything acts on it', () => {
  // The write used to set `customer_feedback` and never check its result, so
  // both were a PGRST204 that nothing noticed: the decline did nothing at all,
  // and the accept fell through to creating a WON DEAL and a CONTRACT for a
  // proposal whose status never moved.
  const code = fn;

  it('neither write names the dropped column', () => {
    expect(code).not.toContain('customer_feedback:');
  });

  it('both writes check the error they get back', () => {
    expect(code).toContain('const { error: acceptError }');
    expect(code).toContain('const { error: declineError }');
    expect(code).toContain('if (acceptError) {');
    expect(code).toContain('if (declineError) {');
  });

  it('a failed accept does not go on to create the deal and the contract', () => {
    // The ordering IS the property: a 500 raised after upsertDealForProposal
    // would leave the won deal behind.
    // Scoped to the branch: upsertDealForProposal is DEFINED hundreds of lines
    // above, so an indexOf over the whole file compares the definition to the
    // call and fails whichever way the code is right.
    const branch = code.slice(code.indexOf("if (action === 'accept') {"));
    const acceptAt = branch.indexOf('if (acceptError) {');
    const dealAt = branch.indexOf('await upsertDealForProposal(');
    expect(acceptAt).toBeGreaterThan(0);
    expect(dealAt).toBeGreaterThan(acceptAt);
  });

  it('the signer is still recorded, in the analytics row', () => {
    // Dropping the column loses nothing: event_details already carried it.
    expect(code).toContain('name: signer');
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
