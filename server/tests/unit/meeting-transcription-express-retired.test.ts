/**
 * The Express meeting-transcription surface is gone (iteration 10).
 *
 * server/routes/meeting-transcription-routes.ts (851 lines, 9 endpoints) and
 * server/services/meeting-transcription-service.ts (828 lines) were deleted.
 * Both were fabrications: four of the nine handlers returned a hardcoded
 * "Q4 Planning Session Recording" with invented transcripts, notes and
 * highlights, and the service generated transcript segments itself and stamped
 * tenantId: 'mock-tenant' on what it built.
 *
 * Deleting rather than emptying them was safe for the reason PROD-008c gives:
 * supabase/functions/meeting-transcription/ covers all nine endpoints one for
 * one - its own header names both deleted files - and adds
 * /recordings/:id/consent, which the Express version never had (LEGAL-009). No
 * client tree called the Express paths; MeetingTranscription.tsx goes to
 * /api/meeting-transcription, which the proxy sends to the edge function.
 *
 * This test is designed to FAIL if either file comes back, which is the point:
 * the next person to port a transcription endpoint should port it to the edge
 * function.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = process.cwd();
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
/** Strip comments: the registry note quotes the mock tenant id it removed. */
const stripComments = (s: string) =>
  s
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

describe('the mock transcription surface stays deleted', () => {
  it('neither file exists', () => {
    expect(existsSync(join(repo, 'server/routes/meeting-transcription-routes.ts'))).toBe(false);
    expect(existsSync(join(repo, 'server/services/meeting-transcription-service.ts'))).toBe(false);
  });

  it('the registry does not mount it', () => {
    expect(stripComments(read('server/routes-registry.ts'))).not.toContain(
      'meeting-transcription-routes',
    );
  });
});

describe('the edge function that replaced it still serves every endpoint', () => {
  const index = read('supabase/functions/meeting-transcription/index.ts');

  it('routes each of the nine paths plus consent', () => {
    for (const segment of [
      'upload',
      'meetings',
      'recordings',
      'content',
      'analytics',
      'speakers',
    ]) {
      expect(index, segment).toContain(`case '${segment}':`);
    }
    for (const sub of ['recordings', 'notes', 'highlights']) {
      expect(index, sub).toContain(`pathParts[2] === '${sub}'`);
    }
  });

  it('is what the only client page calls', () => {
    expect(read('client/src/pages/MeetingTranscription.tsx')).toContain(
      "const API = '/api/meeting-transcription'",
    );
  });
});
