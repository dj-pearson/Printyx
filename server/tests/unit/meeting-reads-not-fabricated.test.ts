/**
 * The meetings router answers from the database or answers 501 (iteration 9).
 *
 * server/routes/meeting-scheduling-routes.ts is mounted at the /api ROOT
 * (routes-registry asyncRootApiMounts), so it owns /api/meetings, /api/types,
 * /api/rooms, /api/analytics and /api/optimize-schedule. Four of its eight
 * handlers really do call MeetingSchedulingService; the four READS did not touch
 * it, or the database, at all. They returned a "Q4 Planning Session" organised by
 * John Smith with Sarah Johnson and Mike Chen attending, each carrying an
 * aiAttendanceProbability and an aiEngagementScore; /meetings/:id answered with
 * that same meeting whatever id was asked for; /types and /rooms returned four
 * invented rows each.
 *
 * AUDIT-021 had already cleaned the SERVICE beneath this router and locked it with
 * random-metrics-retired.test.ts. The fabrication was one layer above it, in the
 * handlers that never called the service, so that fix went in under the defect.
 * This test sits at the layer where it actually was.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(
  join(process.cwd(), 'server/routes/meeting-scheduling-routes.ts'),
  'utf8',
);

/** Strip comments: the note above quotes every name it describes. */
const CODE = SOURCE.split('\n')
  .map((l) => l.replace(/\/\/.*$/, ''))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');

describe('no fabricated meetings, types or rooms', () => {
  it('none of the invented people or meetings survive', () => {
    for (const literal of [
      'John Smith',
      'Sarah Johnson',
      'Mike Chen',
      'Q4 Planning Session',
      'Conference Room A',
      'Team Standup',
      'aiAttendanceProbability',
      'aiEngagementScore',
      'aiSchedulingScore',
    ]) {
      expect(CODE, `fabricated literal ${literal}`).not.toContain(literal);
    }
  });

  it('carries no mock marker', () => {
    expect(CODE).not.toMatch(/Mock (meeting|detailed|meetings)/i);
  });

  it('the four reads answer 501 rather than an empty 200', () => {
    // An empty array would assert "you have no meetings", which is a different
    // and equally unbacked claim.
    for (const route of ["'/meetings'", "'/meetings/:meetingId'", "'/types'", "'/rooms'"]) {
      const at = CODE.indexOf(`router.get(${route}`);
      expect(at, route).toBeGreaterThan(-1);
      expect(CODE.slice(at, at + 200), route).toContain('notImplemented');
    }
    expect(CODE).toContain('status(501)');
  });
});

describe('the handlers that were always real still are', () => {
  it('still routes through MeetingSchedulingService', () => {
    for (const call of [
      'createSchedulingRequest',
      'scheduleMeeting',
      'getMeetingAnalytics',
      'optimizeExistingSchedule',
    ]) {
      expect(CODE, call).toContain(`MeetingSchedulingService.${call}`);
    }
  });

  it('resolves the tenant through the auth helper, not req.user!', () => {
    expect(CODE).not.toContain('req.user!.tenantId');
    expect(CODE).toContain('getTenantId(req)');
  });
});
