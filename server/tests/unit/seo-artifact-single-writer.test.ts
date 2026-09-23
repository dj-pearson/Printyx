// Round 169 (route-divergence: seo). SEO-006 made client/public/{sitemap.xml,
// robots.txt,llms.txt} the one source, served from disk by routes-seo-core.ts.
// routes-seo.ts still generated sitemap.xml and robots.txt per request on
// https://printyx.com (shadowed only by mount order) plus a live
// /image-sitemap.xml on that same wrong domain, and it duplicated
// /api/seo/settings, which routes-seo-core.ts also registers first.
//
// The property: across server/, exactly one file registers each of these
// paths, and it is routes-seo-core.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (e === 'tests' || e === 'node_modules') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (e.endsWith('.ts')) out.push(p);
  }
  return out;
}

const FILES = walk('server');
const SOURCES = new Map(FILES.map((f) => [f, strip(readFileSync(f, 'utf8'))]));

function registrants(path: string): string[] {
  const esc = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\.(get|post|put)\\(\\s*['"\`]${esc}['"\`]`);
  return [...SOURCES].filter(([, src]) => re.test(src)).map(([f]) => f);
}

describe('SEO artifacts and settings have one Express writer', () => {
  it('walks the server tree (floor)', () => {
    expect(FILES.length).toBeGreaterThan(200);
  });

  for (const path of ['/sitemap.xml', '/robots.txt', '/llms.txt', '/api/seo/settings']) {
    it(`${path} is registered only by routes-seo-core.ts`, () => {
      expect(registrants(path)).toEqual(['server/routes-seo-core.ts']);
    });
  }

  it('nothing generates an image sitemap per request', () => {
    expect(registrants('/image-sitemap.xml')).toEqual([]);
  });
});
