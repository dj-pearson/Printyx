import { describe, it, expect } from 'vitest';
import { safeInternalPath } from '../../routes/sso-routes';

describe('safeInternalPath — SAML/OIDC RelayState open-redirect guard (CR-006)', () => {
  it('allows a relative in-app path', () => {
    expect(safeInternalPath('/dashboard', '/login')).toBe('/dashboard');
    expect(safeInternalPath('/settings/profile?tab=sso', '/login')).toBe(
      '/settings/profile?tab=sso',
    );
  });

  it('rejects an absolute off-host URL', () => {
    expect(safeInternalPath('https://evil.com/phish', '/login')).toBe('/login');
    expect(safeInternalPath('http://evil.com', '/login')).toBe('/login');
  });

  it('rejects protocol-relative //host and /\\host tricks', () => {
    expect(safeInternalPath('//evil.com', '/login')).toBe('/login');
    expect(safeInternalPath('/\\evil.com', '/login')).toBe('/login');
  });

  it('rejects javascript: and other schemes (no leading slash)', () => {
    expect(safeInternalPath('javascript:alert(1)', '/login')).toBe('/login');
    expect(safeInternalPath('data:text/html,x', '/dashboard')).toBe('/dashboard');
  });

  it('rejects control-character injection', () => {
    expect(safeInternalPath('/\tevil', '/login')).toBe('/login');
    expect(safeInternalPath('/\nhttp://evil.com', '/login')).toBe('/login');
  });

  it('falls back for empty / non-string values', () => {
    expect(safeInternalPath('', '/login')).toBe('/login');
    expect(safeInternalPath(undefined, '/login')).toBe('/login');
    expect(safeInternalPath(42, '/login')).toBe('/login');
  });
});
