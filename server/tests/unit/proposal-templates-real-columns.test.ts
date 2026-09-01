/**
 * Proposal templates are written against the columns the table has (AUDIT-035).
 *
 * `proposal_templates` is one of the six declarations shared/drizzle-schema.ts
 * SKIPS in favour of shared/schema.ts, so no migration was ever generated for
 * the richer shape in quote-proposal-schema.ts - and the proposals edge function
 * was written against that skipped shape.
 *
 * Read off a real build of the migration chain, the table has: name,
 * description, category, template_content, styling, access_level, team_id,
 * is_active, is_default. The function named ten columns that do not exist, so
 * every POST answered 500, GET with ?templateType= was a 42703, the
 * default-clearing UPDATE filtered on a missing column and swallowed the error,
 * and four client files rendered {t.template_name} - blank, on every row.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(repo, p), 'utf8');
const stripComments = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const fn = stripComments(read('supabase/functions/proposals/index.ts'));

const PHANTOM = [
  'template_name',
  'template_type',
  'header_content',
  'cover_page_template',
  'executive_summary_template',
  'proposal_body_template',
  'terms_conditions_template',
  'footer_template',
];

// branding_colors and font_settings survive as KEYS INSIDE the styling jsonb,
// which is a real column - so they are not phantom column names any more and a
// blanket assertion on the string would report the fix as the defect.
const STYLING_KEYS = ['branding_colors', 'font_settings'];

describe('the edge function names no column the table lacks', () => {
  it('drops all ten phantom column names', () => {
    for (const col of PHANTOM) expect(fn, col).not.toContain(`'${col}'`);
  });

  it('keeps the two styling names only as jsonb keys', () => {
    const at = fn.indexOf('const STYLING_SECTIONS');
    const block = fn.slice(at, fn.indexOf('};', at));
    expect(at).toBeGreaterThan(-1);
    for (const key of STYLING_KEYS) expect(block, key).toContain(`'${key}'`);
    // ...and nowhere else, which would mean a column reference.
    for (const key of STYLING_KEYS) {
      const hits = fn.split(`'${key}'`).length - 1;
      const inBlock = block.split(`'${key}'`).length - 1;
      expect(hits, key).toBe(inBlock);
    }
  });

  it('maps the UI names onto the real ones', () => {
    expect(fn).toMatch(/templateName: 'name'/);
    expect(fn).toMatch(/templateType: 'category'/);
  });

  it('validates against real columns, after normalizing', () => {
    const at = fn.indexOf('const templateCreateSchema = z.object({');
    const schema = fn.slice(at, fn.indexOf('});', at));
    expect(at).toBeGreaterThan(-1);
    expect(schema).toMatch(/name: z\.string\(\)/);
    expect(schema).toMatch(/category: z\.string\(\)/);
  });

  it('filters and scopes defaults on category', () => {
    // ?templateType= used to hit a column that does not exist, so the whole
    // GET 500'd whenever the picker asked for one type.
    expect(fn).toMatch(/query = query\.eq\('category', templateType\)/);
    expect(fn).toMatch(/\.eq\('category', templateType\)/);
  });
});

describe('the richer shape is folded, not discarded', () => {
  it('puts the body sections in template_content and the styles in styling', () => {
    // A caller sending the old field names keeps its content: both are jsonb
    // columns that do exist.
    expect(fn).toMatch(/const CONTENT_SECTIONS/);
    expect(fn).toMatch(/const STYLING_SECTIONS/);
    expect(fn).toMatch(/out\.template_content = \{ \.\.\.content/);
    expect(fn).toMatch(/out\.styling = \{ \.\.\.styling/);
  });

  it('lets an explicit template_content win over the folded sections', () => {
    expect(fn).toMatch(/\.\.\.\(\(out\.template_content as object\) \?\? \{\}\)/);
  });
});

describe('no client renders a column that does not exist', () => {
  it('reads name and category instead', () => {
    for (const file of [
      'client/src/pages/ProposalTemplates.tsx',
      'client/src/pages/ProposalTemplateEditor.tsx',
      'client/src/pages/ProposalBuilder.tsx',
      'client/src/components/proposal-builder/GenerateProposalDialog.tsx',
    ]) {
      const src = stripComments(read(file));
      expect(src, file).not.toMatch(/\btemplate_name\b/);
      expect(src, file).not.toMatch(/\btemplate_type\b/);
    }
  });
});
