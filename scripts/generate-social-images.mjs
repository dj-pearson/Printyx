/**
 * Renders client/public/og-image.png - the 1200x630 card every social platform
 * and several AI crawlers fetch when a printyx.net link is shared.
 *
 * index.html has pointed og:image at /og-image.png and twitter:image at
 * /twitter-image.png since it was written, and neither file has ever existed.
 * A share of any Printyx URL rendered with a blank or grey placeholder on
 * LinkedIn, Slack, X and iMessage alike. Nothing reports a missing og:image;
 * `npm run check:seo-assets` does now.
 *
 * One card serves both og:image and twitter:image. Two nearly identical assets
 * are two things to keep in sync, and summary_large_image takes the same 1.91:1
 * frame.
 *
 *   npm run seo:social-images
 *
 * Chromium comes from Playwright. Type is Manrope, vendored under assets/fonts
 * and inlined as base64, so the render does not depend on the host's font set
 * or on network access.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'client/public/og-image.png');

const font = (file) => readFileSync(resolve(ROOT, 'assets/fonts', file)).toString('base64');

/** The brand mark, straight out of client/public/favicon.svg. */
const MARK = readFileSync(resolve(ROOT, 'client/public/favicon.svg'), 'utf8')
  .replace('<svg ', '<svg width="112" height="112" ')
  .trim();

const CARD = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Manrope'; font-weight: 500;
    src: url(data:font/ttf;base64,${font('Manrope-Medium.ttf')}) format('truetype'); }
  @font-face { font-family: 'Manrope'; font-weight: 800;
    src: url(data:font/ttf;base64,${font('Manrope-ExtraBold.ttf')}) format('truetype'); }

  :root { --surface: #0a0f1c; --ink: #f5f7fb; --ink-dim: #93a4c4; --rule: #1e2a44; }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; background: var(--surface); color: var(--ink);
    font-family: 'Manrope', sans-serif; -webkit-font-smoothing: antialiased;
    padding: 84px 88px; display: flex; flex-direction: column; justify-content: space-between;
  }
  .mark { display: flex; align-items: center; gap: 20px; }
  .wordmark { font-weight: 800; font-size: 60px; letter-spacing: -0.035em; }
  h1 { font-weight: 800; font-size: 76px; line-height: 1.05; letter-spacing: -0.035em; max-width: 15ch; }
  h1 em { font-style: normal; color: #7aa2ff; }
  p { font-weight: 500; font-size: 28px; line-height: 1.45; color: var(--ink-dim); max-width: 30ch; margin-top: 24px; }
  footer { display: flex; align-items: center; justify-content: space-between;
    border-top: 1px solid var(--rule); padding-top: 28px; font-weight: 500; font-size: 24px; color: var(--ink-dim); }
</style></head>
<body>
  <div class="mark">${MARK}<span class="wordmark">Printyx</span></div>
  <div>
    <h1>Dealer management that <em>sees it coming</em>.</h1>
    <p>Predictive service, automated meter billing and contract profitability for copier dealers.</p>
  </div>
  <footer><span>printyx.net</span><span>Cloud platform for copier dealers &amp; MPS</span></footer>
</body></html>`;

const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
if (chromiumPath && !existsSync(chromiumPath)) {
  console.error(`PLAYWRIGHT_CHROMIUM_PATH points at nothing: ${chromiumPath}`);
  process.exit(1);
}

const browser = await chromium.launch(chromiumPath ? { executablePath: chromiumPath } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(CARD, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: OUT, type: 'png' });
  console.log(`social images: wrote ${OUT} (1200x630)`);
} finally {
  await browser.close();
}
