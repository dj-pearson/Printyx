import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import {
  renderHeadersFile,
  cspDirectives,
  serializeCsp,
  staticSecurityHeaders,
  EMBEDDABLE_PATH_PREFIXES,
} from '../../../shared/security-headers';

const require = createRequire(import.meta.url);
const repoRoot = resolve(__dirname, '../../..');
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

const guard = require(resolve(repoRoot, 'scripts/check-security-headers.mjs'));

/**
 * SEC-003 marked itself COMPLETE with a correct Helmet configuration that no
 * user-facing response ever carried: in production Cloudflare Pages serves the
 * document off `dist`, and `client/public/_headers` did not exist, so
 * printyx.net answered with no CSP, no frame policy, no HSTS and no nosniff.
 * These tests hold the file that closes it, and the reasoning that decided its
 * contents.
 */
describe('client/public/_headers reaches Cloudflare Pages (SEC-003)', () => {
  it('exists and is exactly what the shared policy renders', () => {
    const path = resolve(repoRoot, 'client/public/_headers');
    expect(existsSync(path), 'client/public/_headers must be committed').toBe(true);
    expect(readFileSync(path, 'utf8')).toBe(renderHeadersFile());
  });

  it('is on the path Vite copies and Cloudflare Pages serves', () => {
    // Derived rather than assumed: publicDir -> outDir -> pages_build_output_dir.
    const vite = read('vite.config.ts');
    expect(vite).toContain("publicDir: path.resolve(import.meta.dirname, 'client/public')");
    expect(vite).toMatch(/outDir:\s*'\.\.\/dist'/);
    expect(read('wrangler.toml')).toMatch(/pages_build_output_dir\s*=\s*"dist"/);
  });

  it('carries every non-varying header on /*', () => {
    const file = renderHeadersFile();
    const globalBlock = file.slice(file.indexOf('\n/*\n'), file.indexOf('\n/f/*\n'));
    for (const [name, value] of staticSecurityHeaders()) {
      expect(globalBlock).toContain(`  ${name}: ${value}`);
    }
    expect(globalBlock).toContain(
      `  Content-Security-Policy: ${serializeCsp(cspDirectives({ pathname: '/' }))}`,
    );
  });

  it('puts the /f/* exception after /*, because a later rule is what wins', () => {
    const file = renderHeadersFile();
    expect(file.indexOf('\n/*\n')).toBeGreaterThan(-1);
    expect(file.indexOf('\n/f/*\n')).toBeGreaterThan(file.indexOf('\n/*\n'));
  });

  it('drops both frame controls on the embeddable surface and nowhere else', () => {
    const file = renderHeadersFile();
    const formBlock = file.slice(file.indexOf('\n/f/*\n'));
    expect(formBlock).toContain('! X-Frame-Options');
    expect(formBlock).toContain('frame-ancestors *');

    const globalBlock = file.slice(file.indexOf('\n/*\n'), file.indexOf('\n/f/*\n'));
    expect(globalBlock).toContain('X-Frame-Options: DENY');
    expect(globalBlock).toContain("frame-ancestors 'none'");
    expect(globalBlock).not.toContain('frame-ancestors *');
  });

  it('says out loud that the Cloudflare ordering and ! syntax are unverified', () => {
    // A claim about another system that nothing here executed must read as one.
    expect(renderHeadersFile()).toMatch(/not executed against a deploy|curl -I/);
  });
});

describe('check:security-headers rules, against fixtures (SEC-003)', () => {
  it('passes on the repo as it stands', () => {
    const { findings, corpus } = guard.findings();
    expect(findings, JSON.stringify(findings, null, 2)).toEqual([]);
    expect(corpus).toBeGreaterThan(200);
  });

  it('walks the whole client tree, so a clean run is not a broken walk', () => {
    expect(guard.clientFiles().length).toBeGreaterThan(200);
  });

  describe('a refused capability the app uses', () => {
    const sources = [{ file: 'a.tsx', src: 'navigator.geolocation.watchPosition(cb)' }];

    it('is reported when the feature is refused', () => {
      const out = guard.capabilityFindings({ geolocation: '()' }, sources);
      expect(out.map((f: { kind: string }) => f.kind)).toEqual(['refused-capability']);
    });

    it('is not reported when the feature is permitted', () => {
      expect(guard.capabilityFindings({ geolocation: '(self)' }, sources)).toEqual([]);
    });

    it('is not reported when nothing uses the feature', () => {
      expect(guard.capabilityFindings({ geolocation: '()' }, [{ file: 'b.tsx', src: '' }])).toEqual(
        [],
      );
    });
  });

  describe('an embeddable surface with no exemption', () => {
    const snippet = [{ file: 'X.tsx', src: '`<iframe src="${window.location.origin}/book/${s}"`' }];

    it('is reported when the path is not exempt', () => {
      const out = guard.embedFindings(['/f/'], snippet);
      expect(out).toHaveLength(1);
      expect(out[0].detail).toContain('/book/');
    });

    it('is not reported once the path is exempt', () => {
      expect(guard.embedFindings(['/f/', '/book/'], snippet)).toEqual([]);
    });

    it('ignores an origin-relative path with no iframe beside it', () => {
      // BookingPages builds a copy-to-clipboard link, not an embed.
      const copyLink = [{ file: 'B.tsx', src: '`${window.location.origin}/book/${slug}`' }];
      expect(guard.embedFindings(['/f/'], copyLink)).toEqual([]);
    });
  });

  describe('an executable inline script in the document', () => {
    it('reports a classic inline script', () => {
      const out = guard.inlineScriptFindings([{ file: 'i.html', html: '<script>x()</script>' }]);
      expect(out.map((f: { kind: string }) => f.kind)).toEqual(['inline-script']);
    });

    it('reports an inline module', () => {
      expect(
        guard.inlineScriptFindings([
          { file: 'i.html', html: '<script type="module">import "x"</script>' },
        ]),
      ).toHaveLength(1);
    });

    it('ignores a JSON-LD data block, which CSP never reaches', () => {
      expect(
        guard.inlineScriptFindings([
          { file: 'i.html', html: '<script type="application/ld+json">{"a":1}</script>' },
        ]),
      ).toEqual([]);
    });

    it('ignores an external script, which the origin governs', () => {
      expect(
        guard.inlineScriptFindings([
          { file: 'i.html', html: '<script type="module" src="/assets/a.js"></script>' },
        ]),
      ).toEqual([]);
    });
  });
});

describe('the document the policy was written for (SEC-003)', () => {
  it('has one executable script and it is same-origin', () => {
    // Proven against the source document; the guard re-proves it against
    // dist/index.html whenever a build is present.
    const html = read('client/index.html');
    const scripts = [...html.matchAll(/<script([^>]*)>/g)].map((m) => m[1]);
    const executable = scripts.filter((attrs) => !/type\s*=\s*"application\/ld\+json"/.test(attrs));
    expect(executable).toHaveLength(1);
    expect(executable[0]).toContain('src="/src/main.tsx"');
  });

  it('exempts exactly one path prefix from the frame policy', () => {
    expect([...EMBEDDABLE_PATH_PREFIXES]).toEqual(['/f/']);
  });
});
