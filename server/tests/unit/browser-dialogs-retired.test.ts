/**
 * Destructive actions ask in the app, not in a browser modal
 * (UI-BROWSER-DIALOGS-001).
 *
 * WF-S-08 removed every raw `alert()` and deliberately stopped there, saying so
 * in the guard's own header: twenty `confirm()` calls guarded deletes and
 * deactivations and five `prompt()` calls collected a URL or a reason, and
 * replacing those looked like an AlertDialog plus a state machine per call site.
 * A promise-returning provider made it mechanical instead - the call site keeps
 * the shape the browser call had.
 *
 * The decision logic is exercised as FUNCTIONS. The conversions themselves are
 * source assertions, because this repo has no React renderer in its test setup,
 * and the widened guard is run as a process against real probes rather than read
 * as a regex - the difference that has cost this session several mutants.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (rel: string) => readFileSync(join(repo, rel), 'utf8');
const PROVIDER = read('client/src/components/ui/confirm-dialog.tsx');

function runGuard(): number {
  try {
    execFileSync('node', [join(repo, 'scripts/check-browser-dialogs.mjs')], {
      cwd: repo,
      encoding: 'utf8',
    });
    return 0;
  } catch (err) {
    return (err as { status?: number }).status ?? 1;
  }
}

describe('the guard covers all three globals and is not vacuous', () => {
  it('passes on the current tree', () => {
    expect(runGuard()).toBe(0);
  });

  it.each([
    ['a bare confirm', "    if (confirm('really?')) return;"],
    ['a window.confirm', "    if (window.confirm('really?')) return;"],
    ['a window.prompt', "    const x = window.prompt('url');"],
    ['an alert', "    alert('hi');"],
    // The disguise that matters: the replacement IS an awaited call named
    // confirm, so excusing the identifier alone would let a browser dialog
    // back in under an await. The exemption keys on the options OBJECT.
    ['an awaited browser confirm', "    if (await confirm('really?')) return;"],
  ])('catches %s', (_label, probe) => {
    const target = join(repo, 'client/src/pages/Vendors.tsx');
    const original = readFileSync(target, 'utf8');
    const anchor = '  const handleDelete = async (vendor: Vendor) => {';
    expect(original).toContain(anchor);
    try {
      writeFileSync(target, original.replace(anchor, `${anchor}\n${probe}`));
      expect(runGuard()).toBe(1);
    } finally {
      writeFileSync(target, original);
    }
  });

  it('still lets prose through, which is what the original got wrong', () => {
    // AdminHub renders `{n} critical alert(s) need review`.
    const guard = read('scripts/check-browser-dialogs.mjs');
    expect(guard).toContain('critical alert(s) need review');
    expect(runGuard()).toBe(0);
  });
});

describe('the replacements answer safely when nobody answers', () => {
  it('a dismissed confirm resolves false, not undefined', () => {
    // A promise that never settles leaves the caller awaiting forever: a delete
    // button that did nothing and said nothing.
    expect(PROVIDER).toContain('if (!open) settle(false);');
    expect(PROVIDER).toContain('if (!open) settlePrompt(null);');
  });

  it('a second question answers the first rather than dropping it', () => {
    expect(PROVIDER).toContain('pendingRef.current?.resolve(false);');
    expect(PROVIDER).toContain('promptingRef.current?.resolve(null);');
  });

  it('outside a provider the answer is no, not a crash and not a silent yes', () => {
    expect(PROVIDER).toContain('createContext<ConfirmFn>(() => Promise.resolve(false))');
    expect(PROVIDER).toContain('createContext<TextPromptFn>(() => Promise.resolve(null))');
  });

  it('an empty prompt is a cancel unless the caller asked for it', () => {
    expect(PROVIDER).toContain("if (trimmed === '' && !promptingRef.current?.allowEmpty)");
  });

  it('is mounted once, above the router', () => {
    const app = read('client/src/App.tsx');
    expect(app).toContain('<ConfirmDialogProvider>');
    expect(app.indexOf('<ConfirmDialogProvider>')).toBeLessThan(app.indexOf('<Router />'));
  });
});

describe('every converted call site awaits its answer', () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  const files = walk(join(repo, 'client/src'));

  it('looked at enough of the tree to mean something', () => {
    // A walk that stops matching must fail rather than pass over nothing.
    expect(files.length).toBeGreaterThan(400);
  });

  it('no call site calls confirm or textPrompt without awaiting it', () => {
    // Forgetting the await yields a Promise, which is always truthy - so the
    // delete happens whatever the user clicked. That is worse than the browser
    // dialog this replaced.
    const unawaited: string[] = [];
    for (const file of files) {
      if (file.includes('components/ui/confirm-dialog')) continue;
      const src = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      // No optional prefix group: `(\w+\s+)?` swallowed the `await` into the
      // match, so `before` started looking BEFORE it and every correct call
      // site reported itself. Match the identifier alone and read what precedes.
      for (const m of src.matchAll(/\b(confirm|textPrompt)\s*\(\s*\{/g)) {
        const before = src.slice(Math.max(0, m.index - 24), m.index);
        if (!/await\s+$/.test(before)) {
          unawaited.push(`${file.replace(repo, '')}: ${before.trim().slice(-20)}${m[0]}`);
        }
      }
    }
    expect(unawaited).toEqual([]);
  });

  it('the twenty-five conversions are all there', () => {
    const callers = files.filter((f) => {
      if (f.includes('components/ui/confirm-dialog')) return false;
      const src = readFileSync(f, 'utf8');
      return src.includes('useConfirm()') || src.includes('useTextPrompt()');
    });
    expect(callers.length).toBeGreaterThanOrEqual(25);
    for (const file of callers) {
      const src = readFileSync(file, 'utf8');
      // Importing the hook without calling it, or calling it without importing,
      // are both broken in a way tsc catches only for the second.
      expect(src, file).toContain("from '@/components/ui/confirm-dialog'");
    }
  });
});
