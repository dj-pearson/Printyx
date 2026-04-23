// TOTP (Time-based One-Time Password) — RFC 6238.
//
// Uses otpauth via esm.sh for spec-compliant HMAC-SHA1 generation. Works in
// Deno. Wraps the minimal surface we need: generate a secret, build an
// otpauth:// URL for the enrollment QR code, verify a 6-digit code with ±1
// time-step tolerance.

import { Secret, TOTP } from 'https://esm.sh/otpauth@9.2.2';

export interface TotpSecret {
  base32: string;
  otpauthUrl: string;
}

export function generateSecret(opts: {
  issuer: string;
  label: string;
  digits?: number;
  period?: number;
}): TotpSecret {
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: opts.issuer,
    label: opts.label,
    algorithm: 'SHA1',
    digits: opts.digits ?? 6,
    period: opts.period ?? 30,
    secret,
  });
  return {
    base32: secret.base32,
    otpauthUrl: totp.toString(),
  };
}

export function verifyCode(
  base32Secret: string,
  code: string,
  opts: { issuer?: string; label?: string; window?: number } = {},
): boolean {
  const totp = new TOTP({
    issuer: opts.issuer ?? 'Printyx',
    label: opts.label ?? 'user',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(base32Secret),
  });
  // ±1 time step (30s on each side) is the standard tolerance.
  const delta = totp.validate({ token: code, window: opts.window ?? 1 });
  return delta !== null;
}
