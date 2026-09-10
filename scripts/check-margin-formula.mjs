#!/usr/bin/env node
/**
 * Margin is measured against the SELLING PRICE. Dividing by cost gives MARKUP,
 * which reads higher for every profitable item: $500 cost at $1000 is 50%
 * margin and 100% markup.
 *
 * Two functions on the server called markup "margin" and were corrected; the
 * two CLIENT components computing the same thing were missed, and one of them
 * fed isMarginLow(), so the minimum-margin guardrail waved through prices that
 * broke the policy it states. Fixing one copy of a wrong formula is not fixing
 * it - which is the whole reason this file exists.
 *
 * The single definitions are lineMarginPct in shared/quote-math.ts and
 * grossMarginPct in supabase/functions/_shared/pricing-math.ts. markupPct and
 * calculateMarkupPercentage are the honest names for the other quantity; rep
 * cost is genuinely derived from a markup, so it is needed - just not under the
 * word margin.
 *
 * The rule: an expression assigned to, or returned as, something named
 * *margin* must not divide by something named *cost* or *dealer*. Hard gate at
 * zero.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['client/src', 'server', 'shared', 'supabase/functions'];
const SKIP = /node_modules|\/tests?\/|\.test\.|_shared\/pricing-math\.ts$/;

const files = [];
for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(p) && !SKIP.test(p)) files.push(p);
    }
  })(root);
}

// (anything - anything) / <cost-ish> — the markup shape.
// The divisor: any identifier whose name contains cost or dealer. The leading
// [\w$.?]* must be allowed to match NOTHING - an earlier version required one
// character before the word, so a bare `dealer` divisor slipped through while a
// compound `dealerCost` was caught. Mutation-testing is the only reason that
// showed up; the guard reported a clean tree either way.
const MARKUP = /\([^()]*-[^()]*\)\s*\/\s*[\w$.?]*(?:[Cc]ost|[Dd]ealer)[\w$.?]*/;
const NAMED_MARGIN = /margin/i;

const findings = [];
for (const file of files) {
  const src = fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const lines = src.split('\n');
  lines.forEach((raw, i) => {
    const line = raw.replace(/\/\/.*$/, '');
    if (!MARKUP.test(line)) return;
    // Named margin on this line, or on the closest declaration above it.
    const context = lines
      .slice(Math.max(0, i - 6), i + 1)
      .map((l) => l.replace(/\/\/.*$/, ''))
      .join('\n');
    if (!NAMED_MARGIN.test(context)) return;
    if (/markup/i.test(context)) return; // named honestly
    findings.push(`${file}:${i + 1}  ${line.trim()}`);
  });
}

if (findings.length) {
  console.error('Markup formula under the name "margin" (divides by cost, not price):\n');
  for (const f of findings) console.error('  ' + f);
  console.error(
    `\n${findings.length} finding(s). Use lineMarginPct from shared/quote-math.ts, or say markup.`,
  );
  process.exit(1);
}
console.log(`check:margin-formula - ${files.length} files, no markup masquerading as margin.`);
