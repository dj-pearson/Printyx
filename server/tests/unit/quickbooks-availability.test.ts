/**
 * No QuickBooks endpoint claims work it did not do (round 126).
 *
 * Both hosts reported a sync that persists nothing, and the edge function's
 * status endpoint answered `connected: false` over a table that does not
 * exist, with the error discarded - so every dealer in production was told
 * they had not connected QuickBooks whether or not they had.
 *
 * The properties here are behavioural where they can be (the shared module is
 * pure) and bound to constructs where they cannot, because nothing typechecks
 * the edge tree.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONNECTION_GAP,
  QUICKBOOKS_CONNECTION_NOT_STORED,
  QUICKBOOKS_SYNC_ENTITIES,
  QUICKBOOKS_SYNC_NOT_IMPLEMENTED,
  SYNC_GAP,
  isSyncEntity,
  unavailableStatus,
} from '@shared/quickbooks-availability';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/(?<![:/])\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

const EDGE = read('supabase/functions/quickbooks/index.ts');
const EDGE_CODE = stripComments(EDGE);
const EXPRESS = read('server/routes-quickbooks-integration.ts');
const EXPRESS_CODE = stripComments(EXPRESS);
const PAGE = read('client/src/pages/QuickBooksIntegration.tsx');
const PAGE_CODE = stripComments(PAGE);

describe('the tables this feature read do not exist', () => {
  it('neither `integrations` nor `quickbooks_mappings` is declared or migrated', () => {
    // Read as TEXT rather than through getTableConfig: round 118 records that
    // importing @shared/drizzle-schema inside a unit test broke an unrelated
    // file in the full run, and the declaration is the source of truth either
    // way. Anchored on both sides, or `integrations` matches
    // `platform_integrations` and `system_integrations` (round 93).
    const sources = readdirSync(join(repo, 'shared'))
      .filter((f) => f.endsWith('.ts'))
      .map((f) => read(join('shared', f)))
      .concat(
        readdirSync(join(repo, 'drizzle/migrations'))
          .filter((f) => f.endsWith('.sql'))
          .map((f) => read(join('drizzle/migrations', f))),
      );
    expect(sources.length).toBeGreaterThan(80);
    const corpus = sources.join('\n');
    // The floor: a table that IS real must be found by this same pattern, or
    // the walk proves nothing about the two that are not.
    expect(corpus).toMatch(/pgTable\(\s*'platform_integrations'/);
    for (const table of ['integrations', 'quickbooks_mappings']) {
      const declared = new RegExp(`pgTable\\(\\s*'${table}'`).test(corpus);
      const created = new RegExp(`CREATE TABLE[^;]*?[^a-z_]"?${table}"?\\s*\\(`, 'i').test(corpus);
      expect({ table, declared, created }).toEqual({ table, declared: false, created: false });
    }
  });

  it('and the edge function no longer queries either, so the baseline is clear', () => {
    // Round 126 asserted the two were LISTED in docs/phantom-tables-baseline.json,
    // which was a claim about the defect rather than about the fix - round 127
    // tightened the baseline and the assertion went red on correct code. The
    // property was always that this function does not query a table that does
    // not exist.
    const baseline = JSON.stringify(JSON.parse(read('docs/phantom-tables-baseline.json')));
    for (const table of ['integrations', 'quickbooks_mappings']) {
      expect({
        table,
        listed: baseline.includes(`${table} (supabase/functions/quickbooks/index.ts)`),
      }).toEqual({ table, listed: false });
    }
  });

  it('nothing in the tree writes a quickbooks connection row', () => {
    // The Express callback puts the tokens in req.session and says so.
    expect(EXPRESS).toMatch(/req\.session\.qb_access_token =/);
    expect(EXPRESS_CODE).not.toMatch(/\.insert\(/);
  });
});

describe('the shared contract', () => {
  it('names the two gaps separately', () => {
    expect(CONNECTION_GAP.code).toBe(QUICKBOOKS_CONNECTION_NOT_STORED);
    expect(SYNC_GAP.code).toBe(QUICKBOOKS_SYNC_NOT_IMPLEMENTED);
    expect(CONNECTION_GAP.code).not.toBe(SYNC_GAP.code);
  });

  it('each gap says what has to be built, not just that it is missing', () => {
    for (const gap of [CONNECTION_GAP, SYNC_GAP]) {
      expect(gap.details.length).toBeGreaterThan(80);
      expect(gap.error.length).toBeGreaterThan(10);
    }
    expect(CONNECTION_GAP.details).toMatch(/credential store|no row/);
    expect(SYNC_GAP.details).toMatch(/stores|persist|wrote no row/);
  });

  it('status is null, never false, when nothing can be read', () => {
    const body = unavailableStatus();
    // Asserted as a value, not a shape: `false` here is what produced a red
    // "Not connected" badge for everyone.
    expect(body.connected).toBeNull();
    expect(body.connected).not.toBe(false);
    expect(body.companyId).toBeNull();
    expect(body.tokenValid).toBeNull();
    expect(body.unavailable).toEqual(CONNECTION_GAP);
  });

  it('covers the entity the page asks for as well as the ones it does not', () => {
    // `items` is what QuickBooksIntegration.tsx posts and the only one the edge
    // function had no branch for, so it 404'd while invoices and payments -
    // which nothing calls - were served.
    expect([...QUICKBOOKS_SYNC_ENTITIES].sort()).toEqual([
      'customers',
      'invoices',
      'items',
      'payments',
    ]);
    for (const entity of QUICKBOOKS_SYNC_ENTITIES) {
      expect({ entity, matched: isSyncEntity(entity) }).toEqual({ entity, matched: true });
    }
    expect(isSyncEntity('vendors')).toBe(false);
    expect(isSyncEntity(undefined)).toBe(false);
  });

  it('the page posts an entity the contract covers', () => {
    // Derived from the page rather than pinned, so a fifth button fails here.
    const posted = [...PAGE_CODE.matchAll(/\/api\/quickbooks\/sync\/([a-z]+)/g)].map((m) => m[1]);
    expect(posted.length).toBeGreaterThan(0);
    for (const entity of posted) {
      expect({ entity, covered: isSyncEntity(entity) }).toEqual({ entity, covered: true });
    }
  });
});

describe('the edge function refuses rather than reporting', () => {
  /** A branch slice bounded by the next branch, never by a character count. */
  const branch = (marker: string) => {
    const at = EDGE_CODE.indexOf(marker);
    expect({ marker, found: at > -1 }).toEqual({ marker, found: true });
    const rest = EDGE_CODE.slice(at + marker.length);
    const end = rest.search(/\n {4}if \(/);
    return rest.slice(0, end > -1 ? end : rest.length);
  };

  it('status answers the shared unavailable body and reads no table', () => {
    const body = branch("endpoint === 'status'");
    expect(body).toMatch(/unavailableStatus\(\)/);
    expect(body).not.toMatch(/\.from\(/);
    // The exact literal that made it lie.
    expect(body).not.toMatch(/connected:\s*!!/);
  });

  it('every sync entity answers the sync gap at 501', () => {
    const body = branch("endpoint === 'sync' && isSyncEntity(parts[1])");
    expect(body).toMatch(/SYNC_GAP/);
    expect(body).toMatch(/\b501\b/);
    expect(body).not.toMatch(/\b200\b/);
    expect(body).not.toMatch(/success:\s*true/);
  });

  it('no branch anywhere still claims a sync was initiated', () => {
    expect(EDGE_CODE).not.toMatch(/sync initiated/i);
    expect(EDGE_CODE).not.toMatch(/success:\s*true/);
  });

  it('the phantom tables are gone from the function entirely', () => {
    for (const table of ['integrations', 'quickbooks_mappings']) {
      expect({ table, queried: EDGE_CODE.includes(`from('${table}')`) }).toEqual({
        table,
        queried: false,
      });
    }
    // integration_sync_logs is real, and is unreachable without the phantom
    // one, so it goes too rather than being left as a half-write.
    expect(EDGE_CODE).not.toMatch(/integration_sync_logs/);
  });

  it('the static entity list survives, because it reads nothing', () => {
    const body = branch("endpoint === 'entities'");
    expect(body).toMatch(/supported_entities/);
    expect(body).toMatch(/\b200\b/);
  });

  it('connect still refuses for its own, different reason', () => {
    // Session-bound OAuth state. Collapsing it into the connection gap would
    // lose the prerequisite it names.
    expect(EDGE).toMatch(/OAUTH_STATE_IS_SESSION_BOUND/);
  });
});

describe('express refuses the same way, so dev and prod agree', () => {
  it('the sync handlers are registered from the shared entity list', () => {
    expect(EXPRESS_CODE).toMatch(/for \(const entity of QUICKBOOKS_SYNC_ENTITIES\)/);
    expect(EXPRESS_CODE).toMatch(/res\.status\(501\)\.json\(SYNC_GAP\)/);
  });

  it('no handler still reports a count it did not store', () => {
    expect(EXPRESS_CODE).not.toMatch(/Successfully synced/);
    expect(EXPRESS_CODE).not.toMatch(/real implementation, save to database/);
  });

  it('the transform helpers are kept, since what is missing is the storing', () => {
    expect(EXPRESS).toMatch(/transformQuickBooksData|transformPrintyxData/);
  });
});

describe('the page renders the gap instead of a connect button', () => {
  it('connected is nullable in its own interface', () => {
    expect(PAGE_CODE).toMatch(/connected:\s*boolean \| null/);
  });

  it('an unavailable status suppresses both connection controls', () => {
    expect(PAGE_CODE).toMatch(/qbStatus\?\.unavailable \? null :/);
  });

  it('and explains why, using the reason the server sent', () => {
    expect(PAGE_CODE).toMatch(/qbStatus\.unavailable\.details/);
    expect(PAGE_CODE).toMatch(/qbStatus\.unavailable\.error/);
  });

  it('the badge distinguishes unavailable from disconnected', () => {
    // Three states, not two: "we cannot tell" must not render as "you are not
    // connected", which is the defect this whole round is about.
    const at = PAGE_CODE.indexOf('getStatusText');
    const body = PAGE_CODE.slice(at, PAGE_CODE.indexOf('getStatusVariant'));
    expect(body).toMatch(/Not available/);
    expect(body).toMatch(/Not connected/);
    expect(body.indexOf('Not available')).toBeLessThan(body.indexOf('Not connected'));
  });
});
