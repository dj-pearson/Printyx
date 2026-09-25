/**
 * Round 252: document upload stored targetEntityId, workflowId and taskId
 * through parseInt - varchar columns holding uuids, so '550e8400-...' became
 * '550' and an upload linked itself to a record that does not exist. The
 * generation service typed every context id and the user id as number when all
 * of them are uuid strings.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const strip = (s: string) =>
  s.replace(/(?<![:/])\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
const route = strip(readFileSync('server/routes-document-automation.ts', 'utf8'));
const svc = strip(readFileSync('server/services/document-generation-service.ts', 'utf8'));

describe('document automation ids', () => {
  it('never parseInts an id that is a uuid', () => {
    expect(route).not.toMatch(/parseInt\((targetEntityId|workflowId|taskId)\)/);
  });

  it('types context ids and the user id as strings', () => {
    expect(svc).not.toMatch(
      /(businessRecordId|quoteId|dealId|serviceCallId|invoiceId|workflowId|taskId)\?: number/,
    );
    expect(svc).not.toMatch(/\buserId: number\b/);
  });

  it('refuses an anonymous caller before writing a NOT NULL generated_by / uploaded_by', () => {
    for (const path of ["'/api/documents/generate'", "'/api/documents/batch-generate'"]) {
      const at = route.indexOf(path);
      const body = route.slice(at, route.indexOf('router.', at + 10));
      expect(body.indexOf('if (!userId)'), path).toBeGreaterThan(-1);
      expect(body.indexOf('if (!userId)')).toBeLessThan(body.indexOf('DocumentGenerationService.'));
    }
  });
});
