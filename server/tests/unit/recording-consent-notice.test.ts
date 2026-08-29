import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The recording-consent notice exists twice: the edge function stores it when
 * the caller supplies no wording of its own, and MeetingTranscription.tsx
 * prefills the upload form with it so the operator can see the exact words they
 * are attesting the participants were given.
 *
 * If those drift, the form shows one notice and the ledger keeps another, and
 * the record stops being evidence of what was actually said. The client copy is
 * plain text rather than an import because the server copy lives in a Deno
 * module the Vite build does not compile.
 */
const repoRoot = join(__dirname, '..', '..', '..');

function extractConcatenatedString(source: string, constName: string): string {
  const start = source.indexOf(`${constName} =`);
  expect(start, `${constName} not found`).toBeGreaterThan(-1);
  const body = source.slice(start, source.indexOf(';', start));
  const parts = [...body.matchAll(/'([^']*)'/g)].map((m) => m[1]);
  expect(parts.length, `${constName} has no string parts`).toBeGreaterThan(0);
  return parts.join('');
}

describe('recording consent notice parity (LEGAL-009 / AUDIT-019)', () => {
  const serverSource = readFileSync(
    join(repoRoot, 'supabase/functions/meeting-transcription/_consent.ts'),
    'utf8',
  );
  const clientSource = readFileSync(
    join(repoRoot, 'client/src/pages/MeetingTranscription.tsx'),
    'utf8',
  );

  it('client prefill matches the server default word for word', () => {
    const server = extractConcatenatedString(serverSource, 'DEFAULT_RECORDING_NOTICE');
    const client = extractConcatenatedString(clientSource, 'DEFAULT_RECORDING_NOTICE');

    expect(client).toBe(server);
    expect(server).toContain('being recorded');
  });

  it('the four consent methods the form offers are the four the server accepts', () => {
    const serverMethods = [
      ...serverSource.matchAll(/const VALID_METHODS: ConsentMethod\[\] = \[([^\]]*)\]/g),
    ][0]?.[1];
    expect(serverMethods, 'VALID_METHODS not found').toBeTruthy();
    const accepted = [...serverMethods.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();

    const offeredBlock = clientSource.slice(
      clientSource.indexOf('const CONSENT_METHODS'),
      clientSource.indexOf('] as const'),
    );
    const offered = [...offeredBlock.matchAll(/value: '([^']+)'/g)].map((m) => m[1]).sort();

    expect(offered).toEqual(accepted);
  });
});
