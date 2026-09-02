/**
 * check:phantom-cols reads a payload built as a named variable (AUDIT-037).
 *
 * It used to read inline object literals only, which is not how most handlers
 * build an insert. `const poData = { … }` followed by `.insert(poData)` was
 * invisible, and that hid the larger half of the purchase-order cluster plus a
 * user-creation insert writing three columns CLAUDE.md already records as
 * absent from `users`.
 *
 * Two wrong versions of the resolution came first, and the rules that replaced
 * them are the point of this test. Pooling declarations by name across a file
 * attributed one table's payload to another table's insert - 39 phantom columns
 * reported on a ten-key row. Then taking the nearest preceding LITERAL reached
 * past `const insertRow = normalizeLineItem(...)` to an unrelated older literal
 * and invented eighteen more. The rule is: nearest preceding BINDING of any
 * kind, used only if it is a literal.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const guard = read('scripts/check-phantom-columns.ts');

describe('it resolves named payloads', () => {
  it('matches .insert(ident) and .update(ident)', () => {
    expect(guard).toMatch(/\\\.\(insert\|update\)\\\(\\s\*\(\[A-Za-z_\$\]/);
  });

  it('collects every binding, not only the literals', () => {
    // The non-literal bindings are what stop the reach-back.
    expect(guard).toMatch(/keys: string\[\] \| null/);
    expect(guard).toMatch(/source\[rhs\] === '\{' \? topLevelKeys/);
  });

  it('uses the nearest preceding binding, and only if it is a literal', () => {
    expect(guard).toMatch(/\.sort\(\(a, b\) => b\.at - a\.at\)\[0\]/);
    expect(guard).toMatch(/if \(!decl \|\| !decl\.keys\) continue;/);
  });

  it('counts a later bare re-assignment as invalidating', () => {
    expect(guard).toMatch(/A later bare re-assignment invalidates the literal too/);
  });

  it('picks up keys assigned between the declaration and the call', () => {
    // How a handler builds a partial update: `updateData.status = ...`.
    expect(guard).toMatch(/a\.at > decl\.at && a\.at < callAt/);
  });
});

describe('the header no longer claims this as a blind spot', () => {
  it('describes what is still unresolvable instead', () => {
    expect(guard).toMatch(/assembled at runtime/);
    expect(guard).not.toMatch(/payloads built as a named variable rather than an inline/);
  });
});

describe('the baseline records the growth honestly', () => {
  const baseline = JSON.parse(read('docs/phantom-columns-baseline.json'));

  it('says the additions were already broken', () => {
    expect(baseline.note).toMatch(/262 -> 383/);
    expect(baseline.note).toMatch(/GROWN TWICE BY SEEING MORE, NOT BY CODE GETTING WORSE/);
  });

  it('records the two confirmed true positives in the note, not the list', () => {
    // They were the evidence that named payloads are a real class; both are
    // fixed now, so asserting they are still listed would assert the debt.
    expect(baseline.note).toMatch(/phone, job_title and department/);
    expect(baseline.note).toMatch(/purchase-order cluster/);
    expect(JSON.stringify(baseline.allowed)).not.toMatch(/users\.job_title/);
  });
});
