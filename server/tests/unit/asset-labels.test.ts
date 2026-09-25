import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assetLabel, assetLabelsHtml } from '@/lib/asset-labels';

const root = resolve(__dirname, '../../..');
const strip = (s: string) => s.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const PAGE = strip(
  readFileSync(resolve(root, 'client/src/pages/EquipmentLifecycleHub.tsx'), 'utf8'),
);

const asset = {
  id: 'eq-1',
  manufacturer: 'Canon',
  model: 'C5540i',
  serialNumber: 'SN123',
  assetTag: null,
  customerName: 'Acme <Printing> & Co',
};

describe('asset labels (round 227)', () => {
  it('says what is recorded and invents nothing for a blank field', () => {
    expect(assetLabel(asset)).toEqual({
      id: 'eq-1',
      title: 'Canon C5540i',
      lines: ['S/N SN123', 'Acme <Printing> & Co'],
    });
    expect(
      assetLabel({
        id: 'x',
        manufacturer: null,
        model: null,
        serialNumber: null,
        assetTag: null,
        customerName: null,
      }),
    ).toEqual({ id: 'x', title: 'Equipment', lines: [] });
  });

  it('escapes typed text and carries no script', () => {
    const html = assetLabelsHtml([assetLabel(asset)], { 'eq-1': 'data:image/png;base64,AAAA' });
    expect(html).toContain('Acme &lt;Printing&gt; &amp; Co');
    expect(html).not.toContain('<Printing>');
    expect(html).not.toMatch(/<script/i);
    expect(html).toContain('<img src="data:image/png;base64,AAAA"');
    expect(html).toContain('1 label.');
  });

  it('refuses an image source that is not a data image', () => {
    const html = assetLabelsHtml([assetLabel(asset)], { 'eq-1': 'javascript:alert(1)' });
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<img');
  });

  it('the page builds a QR of each asset id, in the browser', () => {
    expect(PAGE).toMatch(/onClick=\{handleGenerateLabels\}/);
    expect(PAGE).toMatch(/await import\('qrcode'\)/);
    expect(PAGE).toMatch(/toDataURL\(a\.id,/);
    expect(PAGE).not.toContain('Warranty Registration');
  });
});
