/**
 * Round 236: two pages coloured Progress bars with `indicatorClassName`, a
 * prop the component did not take, so it landed on the root as an unknown
 * DOM attribute and every bar was bg-primary - a toner at 5% drew the same
 * colour as one at 90%. One page hid the type error with @ts-ignore.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { Progress } from '../../../client/src/components/ui/progress';

describe('Progress indicatorClassName', () => {
  const html = renderToStaticMarkup(
    React.createElement(Progress, { value: 5, indicatorClassName: 'bg-red-500' }),
  );

  it('colours the indicator, replacing the default fill', () => {
    const indicator = html.match(/<div[^>]*translateX[^>]*>/)?.[0] ?? '';
    expect(indicator).toContain('bg-red-500');
    expect(indicator).not.toContain('bg-primary');
  });

  it('is not spread onto the DOM as an attribute', () => {
    expect(html.toLowerCase()).not.toContain('indicatorclassname');
  });

  it('keeps the default fill when no class is passed', () => {
    const plain = renderToStaticMarkup(React.createElement(Progress, { value: 50 }));
    expect(plain).toContain('bg-primary');
  });

  it('no caller suppresses the prop type', () => {
    const src = readFileSync('client/src/pages/ProactiveServiceDashboard.tsx', 'utf8');
    const at = src.indexOf('indicatorClassName');
    expect(src.slice(Math.max(0, at - 120), at)).not.toMatch(/@ts-ignore|@ts-expect-error/);
  });
});
