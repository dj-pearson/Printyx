/**
 * Round 253: the team-alert chain (team-alert-service, which AUDIT-024 kept
 * with the two reporting services it calls) could not have sent anything.
 * It imported `default` from email-service, which has no default export, and
 * called emailSvc.sendEmail(...) where the service's method is send(...). It
 * read userContext.userId where EnhancedUserContext has `id`, and the
 * warehouse service selected users.name, which is not a column.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const read = (f: string) => strip(readFileSync(f, 'utf8'));

describe('team alert chain', () => {
  const alert = read('server/services/team-alert-service.ts');
  const email = read('server/services/email-service.ts');

  it('loads the email service by the name it exports and calls its real method', () => {
    expect(email).toMatch(/export const emailService = new EmailService\(\)/);
    expect(email).not.toMatch(/export default/);
    expect(alert).toMatch(/\(await import\('\.\/email-service'\)\)\.emailService/);
    expect(alert).not.toMatch(/\.sendEmail\(/);
    expect(alert).toMatch(/emailSvc\.send\(\{/);
    expect(email).toMatch(/async send\(message: EmailMessage\)/);
  });

  it('reads the user id field EnhancedUserContext has', () => {
    for (const f of [
      'server/services/team-alert-service.ts',
      'server/services/warehouse-reporting-service.ts',
      'server/services/service-supervisor-reporting-service.ts',
    ]) {
      expect(read(f), f).not.toMatch(/userContext\.userId/);
    }
  });

  it('names technicians from first and last name, not a users.name column', () => {
    const wh = read('server/services/warehouse-reporting-service.ts');
    expect(wh).not.toMatch(/users\.name\b/);
    expect(wh).toMatch(/firstName: users\.firstName, lastName: users\.lastName/);
  });
});
