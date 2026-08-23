import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAllowedAudioHost as allow } from '../../../supabase/functions/_shared/voice-ticket-close-logic';

// PROD-008b: this guarded server/routes-voice-ticket-close.ts, now retired. The
// DEFECT CLASS it covers — an unvetted audioUrl reaching fetch() — belongs to
// whichever backend transcribes, so the test follows the surviving one instead
// of dying with its first subject. The shared helper takes the configured
// storage origin as an argument (Deno.env is not reachable from a module the
// Node suite loads), so the env plumbing below is preserved as the caller.
const isAllowedAudioHost = (url: string) => allow(url, process.env.SUPABASE_URL);

// CR-005: voice-ticket audioUrl must be restricted to expected storage hosts
// before being fetched (defense-in-depth alongside safeFetch's SSRF blocklist).
describe('isAllowedAudioHost (CR-005 audioUrl storage allowlist)', () => {
  const origEnv = process.env.SUPABASE_URL;
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://api.printyx.net';
  });
  afterEach(() => {
    if (origEnv === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = origEnv;
  });

  it('allows the configured Supabase host', () => {
    expect(isAllowedAudioHost('https://api.printyx.net/storage/v1/object/audio.webm')).toBe(true);
  });

  it('allows *.supabase.co / *.printyx.net storage domains', () => {
    expect(isAllowedAudioHost('https://xyz.supabase.co/storage/audio.webm')).toBe(true);
    expect(isAllowedAudioHost('https://files.printyx.net/audio.webm')).toBe(true);
  });

  it('rejects an arbitrary external host (SSRF vector)', () => {
    expect(isAllowedAudioHost('https://evil.example.com/x.webm')).toBe(false);
    expect(isAllowedAudioHost('http://169.254.169.254/latest/meta-data/')).toBe(false);
    expect(isAllowedAudioHost('http://127.0.0.1:5432/')).toBe(false);
  });

  it('rejects a look-alike domain that only contains the suffix mid-string', () => {
    expect(isAllowedAudioHost('https://printyx.net.evil.com/x.webm')).toBe(false);
    expect(isAllowedAudioHost('https://supabase.co.attacker.io/x.webm')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isAllowedAudioHost('not a url')).toBe(false);
    expect(isAllowedAudioHost('')).toBe(false);
  });
});
