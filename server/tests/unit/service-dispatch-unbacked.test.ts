/**
 * The dispatch endpoints answer with what the schema knows, and name what it
 * does not.
 *
 * /api/dispatch/tracking took real technician rows and gave each a random point
 * within 0.05 degrees of 40.7128/-74.006, an invented ticket id, a customer
 * called "Active Service Call", and the times 2:30 PM and 3:00 PM. Real names on
 * fabricated positions is the worst version of this defect: a map of people that
 * is not where they are, plausible enough to dispatch against. /availability
 * carried four Math.random() performance figures, and /analytics carried
 * thirteen written-in ones including 2,847 miles driven and $425.50 of route
 * optimization savings.
 *
 * A random value is worse than a fixed one, which is why check:no-random-metrics
 * exists: a literal eventually reads as a placeholder, while a number that
 * changes on every refresh is exactly what real telemetry does, so reloading
 * appears to confirm it.
 *
 * These assertions read the source. The handlers need a live Postgres to
 * exercise, and asserting that the fabrications are gone and the `unbacked`
 * lines are present is worth more than nothing until that exists. Comments are
 * stripped first, or the comment explaining each removal would satisfy the
 * assertion about it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const src = stripComments(readFileSync(join(repo, 'server/routes-service-dispatch.ts'), 'utf8'));

describe('dispatch endpoints', () => {
  it('fabricates nothing at random', () => {
    expect(src).not.toMatch(/Math\.random/);
  });

  it('plots no technician, because there are no coordinates to plot', () => {
    expect(src).not.toMatch(/40\.7128/);
    expect(src).not.toMatch(/-74\.006/);
    expect(src).not.toMatch(/\blat:/);
    expect(src).not.toMatch(/\blng:/);
  });

  it('dropped the written-in operational figures', () => {
    for (const value of ['4.2', '78.5', '4.6', '73.2', '18.5', '8.75', '2847', '425.5', '92.3']) {
      expect(src).not.toContain(`: ${value},`);
    }
  });

  it('names every gap instead, with the column that is missing', () => {
    const unbacked = src.match(/unbacked: \[/g) ?? [];
    expect(unbacked.length).toBe(3);
    // Each line has to say what is absent, not merely that something is.
    expect(src).toMatch(/coordinates: technicians records a free-text current_location/);
    expect(src).toMatch(/no rating is captured against a service ticket/);
    expect(src).toMatch(/no first-response timestamp on service_tickets/);
  });

  it('prefers null to zero where there is no data', () => {
    // An average over no closed tickets is not zero hours, and a technician
    // with no closed tickets does not have a 0% completion rate.
    expect(src).toMatch(/closedHours\.length\s*\?[\s\S]{0,200}?:\s*null/);
    expect(src).toMatch(
      /entry\.total > 0 \? Math\.round\(\(entry\.resolved \/ entry\.total\) \* 100\) : null/,
    );
  });

  it('reads current and next assignment from real tickets', () => {
    expect(src).toMatch(/inArray\(serviceTickets\.status, \['assigned', 'in_progress'\]\)/);
    expect(src).toMatch(/assigned\.find\(\(t\) => t\.status === 'in_progress'\)/);
  });
});
