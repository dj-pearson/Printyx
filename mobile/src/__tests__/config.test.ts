import { config, getApiUrl } from '@/config';

describe('config', () => {
  it('has required fields', () => {
    expect(config.appName).toBe('Printyx');
    expect(config.appScheme).toBe('printyx');
    expect(config.supabase.url).toBeTruthy();
    expect(config.edgeFunctionsUrl).toBeTruthy();
  });

  it('defaults to printyx.net URLs', () => {
    expect(config.supabase.url).toContain('printyx.net');
    expect(config.edgeFunctionsUrl).toContain('printyx.net');
  });
});

describe('getApiUrl', () => {
  it('strips /api/ prefix for Edge Functions', () => {
    const url = getApiUrl('/api/tasks');
    expect(url).not.toContain('/api/');
    expect(url).toContain('/tasks');
  });

  it('handles paths without /api/ prefix', () => {
    const url = getApiUrl('/tasks');
    expect(url).toContain('/tasks');
  });

  it('handles paths without leading slash', () => {
    const url = getApiUrl('tasks');
    expect(url).toContain('/tasks');
  });

  it('produces a full URL with base', () => {
    const url = getApiUrl('/api/equipment');
    expect(url).toMatch(/^https?:\/\/.+\/equipment$/);
  });
});
