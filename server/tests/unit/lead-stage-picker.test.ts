/**
 * CRM-008 AC8, on the lead side.
 *
 * DealDetail has had the stage picker since the story shipped. LeadDetail
 * rendered `status` as a read-only Badge, so a rep could not advance a lead
 * from its own record page - they had to find it on a board. That is the half
 * of AC8 that was missing, and it is easy to miss because the story's AC10
 * ("use RecordPageLayout") was done on both pages.
 *
 * The assertions that matter are about the VOCABULARY. COP-E02's original
 * defect was comparing two different stage models: `pipeline_stages.id` is a
 * uuid belonging to the deals board, while `business_records.status` is a
 * lifecycle word, and `findIndex` across them yields -1 which `+ 1` turns into
 * index 0 - so "move to next stage" advanced every record to the first stage.
 * This page asks the server for the list rather than hardcoding one, which is
 * what keeps it and the board on the same nine words.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const stripComments = (s: string) =>
  s.replace(/(?<!:)\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const LEAD = stripComments(read('client/src/pages/LeadDetail.tsx'));
const LAYOUT = read('client/src/components/crm/RecordPageLayout.tsx');

describe('the lead record page can change stage', () => {
  it('has a corpus to check', () => {
    expect(LEAD).toContain('RecordPageLayout');
    expect(LEAD.length).toBeGreaterThan(3000);
  });

  it('renders the stage bar in the header', () => {
    expect(LEAD).toContain('<RecordStageBar');
    expect(LEAD).toContain('headerContent=');
    expect(LEAD).toMatch(/currentStageId=\{lead\.status\}/);
  });

  it('writes the chosen stage through the same per-field path as every other edit', () => {
    // Not a second endpoint: COP-M01 whitelists what PUT /leads/:id can store
    // and reports what it dropped, and this reuses that.
    expect(LEAD).toMatch(/saveField\.mutate\(\{ status: stageId \}\)/);
  });

  it('takes the vocabulary from the server, not a literal in the page', () => {
    expect(LEAD).toContain("'/api/sales-pipeline/stages'");
    // A hardcoded list here is how the page and the board drift apart.
    for (const literal of ['demo_scheduled', 'proposal_sent', 'closed_won']) {
      expect(LEAD).not.toContain(`'${literal}'`);
    }
  });

  it('keeps a status the vocabulary does not contain visible', () => {
    // An unknown status leaves currentStageId matching nothing, and a bar with
    // nothing highlighted reads as "not started" rather than "this word is not
    // one of ours".
    expect(LEAD).toMatch(/known\.some\(\(s\) => s\.id === current\)/);
    expect(LEAD).toMatch(/known\.push\(\{ id: current, name: current \}\)/);
  });
});

describe('the stage bar asks before it moves', () => {
  it('confirms, because the change fires the same automation as a board drag', () => {
    expect(LAYOUT).toContain('setPending(stage)');
    expect(LAYOUT).toContain('Stage automation runs on the change');
    // The confirm step has to call onChange, not the button that opens it.
    const bar = LAYOUT.slice(LAYOUT.indexOf('export function RecordStageBar'));
    expect(bar).toMatch(/onClick=\{\(\) => setPending\(stage\)\}/);
    expect(bar).toMatch(/onChange\(pending\.id\)/);
  });

  it('never offers the stage the record is already in', () => {
    const bar = LAYOUT.slice(LAYOUT.indexOf('export function RecordStageBar'));
    expect(bar).toMatch(/disabled=\{disabled \|\| isCurrent\}/);
  });
});
