/**
 * Round 244: the database-updater CLI's `logs` command did
 * `logs.forEach((log) => { log.info(...) })`. The parameter shadowed the module
 * logger, so `log.info` was a LogEntry method that does not exist and the
 * command threw on its first entry. tsc reported it; nothing else could.
 *
 * The rule, across every server file that declares a module logger: a callback
 * parameter named `log` must not have a logger method called on it inside its
 * own body. Using `log` as a data row (`log.userId`) is fine and common.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'tests' && e.name !== 'node_modules') walk(p, out);
    } else if (e.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** Body of the arrow whose `=>` ends at `from`: a braced block, or an expression up to the unmatched `)`. */
export function arrowBody(src: string, from: number): string {
  let i = from;
  while (/\s/.test(src[i])) i++;
  if (src[i] === '{') {
    let depth = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) return src.slice(i, j + 1);
    }
    return src.slice(i);
  }
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if ('([{'.includes(src[j])) depth++;
    else if (')]}'.includes(src[j])) {
      if (depth === 0) return src.slice(i, j);
      depth--;
    }
  }
  return src.slice(i);
}

export function shadowedLoggerCalls(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/\(\s*log\s*(?::[^)]*)?\)\s*=>|\blog\s*=>/g)) {
    const body = arrowBody(src, m.index! + m[0].length);
    const call = body.match(/\blog\.(info|warn|error|debug)\(/);
    if (call) out.push(body.slice(0, 80));
  }
  return out;
}

describe('a callback parameter named log does not shadow the logger', () => {
  it('catches the round-244 shape and allows log as a data row', () => {
    expect(
      shadowedLoggerCalls('logs.forEach((log) => {\n  log.info(`x ${log.message}`);\n});'),
    ).toHaveLength(1);
    expect(shadowedLoggerCalls('rows.map((log) => ({ ...log, user: log.userId }))')).toEqual([]);
    expect(shadowedLoggerCalls('rows.map((entry) => { log.info(entry.message); })')).toEqual([]);
  });

  it('holds across every server file with a module logger', () => {
    const files = walk('server').filter((f) =>
      /const log = createModuleLogger/.test(readFileSync(f, 'utf8')),
    );
    expect(files.length).toBeGreaterThan(200);
    const offenders = files.flatMap((f) =>
      shadowedLoggerCalls(strip(readFileSync(f, 'utf8'))).map((b) => `${f}: ${b}`),
    );
    expect(offenders).toEqual([]);
  });
});
