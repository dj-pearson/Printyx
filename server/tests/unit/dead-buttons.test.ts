/**
 * An action-labelled button must do something (UI-DEAD-BUTTONS-001).
 *
 * The scan that opened this story excluded a button within 15 LINES of a form
 * or a Dialog trigger, which is a window and not a scope - a submit button in a
 * form declared thirty lines up reads as dead, and a button merely following a
 * `</form>` reads as alive. The guard walks a tag stack instead, so the
 * exclusion is real ancestry.
 *
 * `findButtons` and `isDead` are exercised as FUNCTIONS against JSX fixtures,
 * because the property is about nesting and a source assertion cannot tell a
 * correct walk from one that happens to contain the right regex.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findButtons, isDead, TRIGGER_TAGS } from '../../../scripts/check-dead-buttons.mjs';

const repo = join(__dirname, '../../..');

/** The guard as a PROCESS: exit codes and messages are its contract. */
function runGuard(args: string[] = []) {
  try {
    return {
      code: 0,
      out: execFileSync('node', [join(repo, 'scripts/check-dead-buttons.mjs'), ...args], {
        cwd: repo,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      }),
    };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}
const read = (rel: string) => readFileSync(join(repo, rel), 'utf8');

const dead = (jsx: string) =>
  findButtons(jsx)
    .filter(isDead)
    .map((b) => b.label);

describe('ancestry is resolved, not guessed by a line window', () => {
  it('a submit button in a form declared far above is NOT dead', () => {
    const jsx = `<form onSubmit={x}>\n${'  <div>\n'.repeat(30)}<Button>Save</Button>\n</form>`;
    expect(dead(jsx)).toEqual([]);
  });

  it('a button just AFTER a closed form IS dead', () => {
    // The line window called this alive because a `<form>` was nearby.
    expect(
      dead('<form onSubmit={x}><Button type="submit">Save</Button></form><Button>Export</Button>'),
    ).toEqual(['Export']);
  });

  it('a button inside a trigger is driven by the trigger', () => {
    for (const tag of ['DialogTrigger', 'DropdownMenuTrigger', 'PopoverTrigger', 'SheetTrigger']) {
      expect(dead(`<${tag} asChild><Button>Create</Button></${tag}>`), tag).toEqual([]);
    }
  });

  it('a self-closing tag does not desynchronise the stack', () => {
    // A self-closing tag must not be treated as an OPEN element, or everything
    // after it reads as nested inside it. The fixture names a self-closing
    // TRIGGER on purpose: with a plain <Separator /> the mutant that pushes
    // anyway is indistinguishable from the fix, because neither the div nor the
    // separator excludes anything.
    expect(dead('<div><Separator /><Button>Delete</Button></div>')).toEqual(['Delete']);
    expect(dead('<DialogTrigger /><Button>Create</Button>')).toEqual(['Create']);
  });

  it('a closing tag pops to its own name, so an unbalanced fragment is contained', () => {
    expect(dead('<div><span></div><Button>Send</Button>')).toEqual(['Send']);
  });
});

describe('what counts as doing something', () => {
  it.each([
    ['onClick', '<Button onClick={go}>Save</Button>'],
    ['type=submit', '<Button type="submit">Save</Button>'],
    ['href', '<Button href="/x">Export</Button>'],
    ['form', '<Button form="f">Submit</Button>'],
  ])('%s is a handler', (_label, jsx) => {
    expect(dead(jsx)).toEqual([]);
  });

  it('asChild counts as a BARE attribute, which is how this codebase writes it', () => {
    // `<Button asChild variant="outline">` wrapping an <a> - requiring `=` or
    // `{` after asChild missed every one, and BlogCalendar's "Export .ics"
    // read as dead.
    expect(dead('<Button asChild variant="outline"><a href="/x">Export .ics</a></Button>')).toEqual(
      [],
    );
  });

  it('a label with no action verb is not reported', () => {
    expect(dead('<Button>Details</Button>')).toEqual([]);
    expect(dead('<Button>Save</Button>')).toEqual(['Save']);
  });

  it('a disabled button with no handler is still reported', () => {
    // A control permanently disabled with nothing behind it is a feature
    // nobody built, which is exactly what this looks for.
    expect(dead('<Button disabled>Generate</Button>')).toEqual(['Generate']);
  });
});

describe('the guard reports and does not pass vacuously', () => {
  it('passes on the current tree and says how it is split', () => {
    const { code, out } = runGuard();
    expect(code).toBe(0);
    expect(out).toMatch(/\d+ baselined/);
  });

  it('exits 2 rather than passing if the walk stops seeing the tree', () => {
    const src = read('scripts/check-dead-buttons.mjs');
    expect(src).toContain('if (files.length < 300)');
    expect(src).toContain('process.exit(2)');
  });

  it('reads its own source without clearing its own worked examples', () => {
    // AC3. The guard walks client/src only, so scripts/ is out of scope by
    // construction - the failure this guards against is a scanner whose corpus
    // includes its own header, which quietly clears whatever the header names.
    expect(src()).not.toMatch(/scripts\//);
    function src() {
      const s = read('scripts/check-dead-buttons.mjs');
      return s.slice(s.indexOf('const SRC ='), s.indexOf('const BASELINE ='));
    }
  });

  it('is wired into CI, not merely runnable', () => {
    expect(read('.github/workflows/ci.yml')).toContain('npm run check:dead-buttons');
    expect(read('package.json')).toContain('"check:dead-buttons"');
  });
});

describe('the baseline is a triage file, not a list', () => {
  const baseline = JSON.parse(read('docs/dead-buttons-baseline.json'));
  const entries = Object.values(baseline.triage) as Array<{
    file: string;
    label: string;
    verdict: string;
    reason: string;
  }>;

  it('counts match the entries', () => {
    expect(entries.length).toBe(baseline.count);
    // Round 220: a `> 10` floor here failed the moment the worklist reached
    // 10, on work that shrank it. A worklist is allowed to empty; the walk's
    // own floor lives in the guard.
  });

  it('carries file and label as FIELDS, not only inside the key', () => {
    // A label can contain a colon ("Schedule 1: follow up"), so a composite
    // key cannot be parsed back into its parts by anything reading this file.
    for (const e of entries) {
      expect(e.file, JSON.stringify(e)).toMatch(/^client\/src\/.+\.tsx$/);
      expect(e.label.length).toBeGreaterThan(0);
    }
  });

  it('every verdict other than unexamined carries a reason', () => {
    const silent = entries.filter((e) => e.verdict !== 'unexamined' && !e.reason.trim());
    expect(silent).toEqual([]);
  });

  it('the GUARD refuses a verdict with no reason, not just this file', () => {
    // Asserting it over the committed data proves nothing while every entry is
    // `unexamined` - the filter is empty either way, so the enforcement itself
    // has to be exercised.
    const path = join(repo, 'docs/dead-buttons-baseline.json');
    const original = readFileSync(path, 'utf8');
    try {
      const doc = JSON.parse(original);
      doc.triage['client/src/pages/Nowhere.tsx::Save'] = {
        file: 'client/src/pages/Nowhere.tsx',
        label: 'Save',
        verdict: 'by-design',
        reason: '',
      };
      writeFileSync(path, JSON.stringify(doc, null, 2));
      const { code, out } = runGuard();
      expect(code).toBe(1);
      expect(out).toMatch(/verdict with no reason/);
    } finally {
      writeFileSync(path, original);
    }
  });

  it('the WRITER keeps file and label as fields', () => {
    // The mutant that drops them only changes --update-baseline output, which
    // reading the committed file cannot see.
    //
    // Round 227: the worklist reached zero, so there was no entry to sample.
    // A probe file carrying one dead button gives the writer something to
    // record, and is removed whatever happens.
    const path = join(repo, 'docs/dead-buttons-baseline.json');
    const probe = join(repo, 'client/src/__dead_button_probe__.tsx');
    const original = readFileSync(path, 'utf8');
    try {
      writeFileSync(
        probe,
        "import { Button } from '@/components/ui/button';\n" +
          'export const Probe = () => <Button variant="outline">Delete Probe</Button>;\n',
      );
      runGuard(['--update-baseline']);
      const written = JSON.parse(readFileSync(path, 'utf8'));
      const sample = Object.values(written.triage).find(
        (e) => (e as { file?: string }).file === 'client/src/__dead_button_probe__.tsx',
      ) as { file?: string; label?: string } | undefined;
      expect(sample?.file).toBe('client/src/__dead_button_probe__.tsx');
      expect(sample?.label).toBe('Delete Probe');
    } finally {
      rmSync(probe, { force: true });
      writeFileSync(path, original);
    }
  });

  it('the note says what unexamined means, rather than implying the list is settled', () => {
    expect(baseline.note).toMatch(/WORKLIST|worklist/);
    expect(baseline.note).toMatch(/unexamined/);
  });
});

describe('the two buttons this round resolved', () => {
  it('Add Task links to the create dialog, and TaskHub reads the parameter', () => {
    // AUDIT-014's finding was nine quick-action links carrying `?action=new`
    // that NO page read - so wiring the link without the reader would have
    // reproduced it exactly.
    const today = read('client/src/pages/TodayDashboard.tsx');
    expect(today).toContain('href="/tasks?action=new"');
    const hub = read('client/src/pages/TaskHub.tsx');
    expect(hub).toContain('useActionParam()');
    expect(hub).toMatch(/if \(action === 'new'\) setIsCreateTaskOpen\(true\);/);
  });

  it('Log Activity is gone rather than repointed at what its card already does', () => {
    const today = read('client/src/pages/TodayDashboard.tsx')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(today).not.toContain('Log Activity');
  });

  it('neither is in the baseline any more', () => {
    const labels = (Object.values(baselineTriage()) as Array<{ file: string; label: string }>)
      .filter((e) => e.file.endsWith('TodayDashboard.tsx'))
      .map((e) => e.label);
    expect(labels).not.toContain('Add Task');
    expect(labels).not.toContain('Log Activity');
    function baselineTriage() {
      return JSON.parse(read('docs/dead-buttons-baseline.json')).triage;
    }
  });
});
