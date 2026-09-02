/**
 * The technicians function writes columns the tables have (AUDIT-037).
 *
 * Eight references, and they broke three separate things: creating a technician,
 * recording availability, and the performance panel.
 *
 * The availability one is worth stating on its own. The code sent is_available;
 * the column is is_booked, which is its INVERSE. If the name had been right and
 * the sense wrong, a free slot would have been stored as booked and the
 * scheduler would have hidden every available technician. It was saved from that
 * by being broken outright - the insert 42703'd, so no availability was ever
 * recorded at all.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
// Comments stripped: the file now explains the old names in prose.
const fn = read('supabase/functions/technicians/index.ts')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

describe('creating a technician', () => {
  it('writes skills, certifications and is_active', () => {
    expect(fn).toMatch(/skills: body\.skillSet/);
    expect(fn).toMatch(/certifications:\s*\n?\s*body\.certifications/);
    expect(fn).toMatch(/is_active:\s*\n?\s*\(body\.employmentStatus/);
  });

  it('turns a single certification level into a one-element list', () => {
    // certifications is a list and certification_level was a string; dropping
    // the value would lose what the caller sent.
    expect(fn).toMatch(/\? \[body\.certificationLevel \|\| body\.certification_level\]/);
  });

  it('does not invent a home for hire_date', () => {
    // The table records what a technician can do, not their employment history.
    expect(fn).not.toMatch(/hire_date/);
  });

  it('filters on the columns that exist', () => {
    expect(fn).toMatch(/eq\('is_active', status === 'active'\)/);
    expect(fn).toMatch(/contains\('skills', \[skillSet\]\)/);
  });
});

describe('availability is stored as is_booked, and inverted', () => {
  it('writes is_booked, not is_available', () => {
    expect(fn).toMatch(/is_booked:/);
    expect(fn).not.toMatch(/is_available:/);
  });

  it('inverts the sense when the caller sends availability', () => {
    // The whole point: is_booked is the opposite of is_available.
    expect(fn).toMatch(/!\(body\.isAvailable \?\? body\.is_available \?\? true\)/);
  });
});

describe('the performance panel reports a number it can compute', () => {
  it('stops averaging a column that does not exist', () => {
    // first_response_time is recorded nowhere, so the average was always 0 -
    // printed as a response time on a technician's record.
    expect(fn).not.toMatch(/first_response_time/);
  });

  it('reports resolution time under its own name, and says what is missing', () => {
    // created_at to resolved_at is a RESOLUTION time. Reporting it as a
    // response time would be a different wrong number.
    expect(fn).toMatch(/avgResolutionHours/);
    expect(fn).toMatch(/unbacked: \['avgResponseTime/);
  });

  it('answers null rather than zero when nothing has been resolved', () => {
    expect(fn).toMatch(/resolved\.length > 0/);
    expect(fn).toMatch(/: null;/);
  });
});
