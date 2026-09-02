/**
 * The /document-management surface is gone, and the tables it misread are not
 * (AUDIT-037).
 *
 * These assert OUTCOMES, not debt: each one stays true forever once the
 * removal lands, and none of them fails the day someone builds a real document
 * library on document_uploads. The map is docs/document-surfaces.md.
 *
 * Comments are stripped before every absence assertion. A prose reference to a
 * removed path would otherwise match the explanation of its own removal - the
 * trap check:edge-coverage carries in its header, and one this repo has walked
 * into more than once. Line comments go first: a doc comment containing a path
 * like /api/* opens a block comment if you strip block comments first.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');

/** Strip line comments, then block comments. Order matters - see the header. */
function stripComments(src: string): string {
  return src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('the document-management surface is deleted', () => {
  it.each([
    'client/src/pages/DocumentManagement.tsx',
    'server/routes-document-management.ts',
    'supabase/functions/document-management/index.ts',
  ])('%s is gone', (p) => {
    expect(existsSync(join(repo, p))).toBe(false);
  });

  it('no client tree routes or links /document-management', () => {
    for (const p of [
      'client/src/App.tsx',
      'client/src/lib/navigation-permissions.ts',
      'client/src/components/layout/RoleAwareCollapsibleSidebar.tsx',
      'client/src/components/mobile/MobileNavigationDrawer.tsx',
    ]) {
      expect(stripComments(read(p))).not.toMatch(/\/document-management/);
    }
  });

  it('no server file serves /api/document-management', () => {
    for (const p of ['server/routes-sample-data.ts', 'server/routes-registry.ts']) {
      expect(stripComments(read(p))).not.toMatch(/\/api\/document-management/);
    }
  });

  it('the fixture figures are gone from routes-sample-data', () => {
    const sample = stripComments(read('server/routes-sample-data.ts'));
    // Values unique to the deleted library and workflow payloads, so a re-add
    // under any other path is still caught.
    expect(sample).not.toMatch(/complianceScore/);
    expect(sample).not.toMatch(/storageLimit/);
    expect(sample).not.toMatch(/pendingApproval/);
    expect(sample).not.toMatch(/automationSuccessRate/);
  });
});

describe('the tables it misread are still what they are', () => {
  it('documents is a purchase agreement, not a file record', () => {
    const schema = read('shared/schema.ts');
    const at = schema.indexOf("export const documents = pgTable('documents'");
    expect(at).toBeGreaterThan(-1);
    const body = schema.slice(at, schema.indexOf('});', at));

    // What it does hold.
    for (const col of ['agreement_number', 'buyer_name', 'monthly_base', 'black_rate']) {
      expect(body).toContain(`'${col}'`);
    }
    // The twelve columns the deleted code read off it. If a future story adds
    // a file model, it goes on document_uploads - putting it here would give
    // one table two meanings again, which is how this defect happened.
    for (const col of [
      'file_path',
      'file_size',
      'file_type',
      'mime_type',
      'folder',
      'entity_type',
      'entity_id',
      'uploaded_by',
    ]) {
      expect(body).not.toContain(`'${col}'`);
    }
  });

  it('document_uploads holds the real file metadata', () => {
    const schema = read('shared/document-automation-schema.ts');
    const at = schema.indexOf("export const documentUploads = pgTable('document_uploads'");
    expect(at).toBeGreaterThan(-1);
    const body = schema.slice(at, schema.indexOf('});', at));
    for (const col of ['file_name', 'file_type', 'file_size', 'file_path', 'uploaded_by']) {
      expect(body).toContain(`'${col}'`);
    }
  });

  it('document_folders is not a table anywhere, and nothing queries it', () => {
    const files = [
      'shared/schema.ts',
      'shared/document-automation-schema.ts',
      'shared/drizzle-schema.ts',
    ];
    for (const p of files) {
      expect(read(p)).not.toContain("pgTable('document_folders'");
    }
  });
});
