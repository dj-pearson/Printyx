// Round 215. The technician workflow's quick actions had no handlers. Call
// Customer is a tel: link, Take Photo posts to the attachments endpoint, and
// Add Notes APPENDS to the ticket's work-order notes; Request Parts and
// Equipment Info had nowhere to go and are removed.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  appendWorkOrderNote,
  base64FromDataUrl,
  telHref,
} from '../../../client/src/lib/ticket-quick-actions';

describe('appendWorkOrderNote', () => {
  const at = new Date('2026-09-24T09:05:00Z');
  it('appends with a date stamp and keeps what was there', () => {
    expect(appendWorkOrderNote('Replaced fuser.', 'Customer signed off', at)).toBe(
      'Replaced fuser.\n[2026-09-24 09:05] Customer signed off',
    );
  });
  it('starts the record when there is none, and refuses an empty note', () => {
    expect(appendWorkOrderNote(null, '  first  ', at)).toBe('[2026-09-24 09:05] first');
    expect(appendWorkOrderNote('x', '   ', at)).toBeNull();
  });
});

describe('base64FromDataUrl and telHref', () => {
  it('extracts the payload the attachments endpoint takes', () => {
    expect(base64FromDataUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('iVBORw0KGgo=');
    expect(base64FromDataUrl('not a data url')).toBeNull();
    expect(base64FromDataUrl('data:image/png;base64,')).toBeNull();
  });
  it('dials a stored number and refuses one with no digits', () => {
    expect(telHref('(602) 555-0123')).toBe('tel:6025550123');
    expect(telHref('+44 20 7946 0000')).toBe('tel:+442079460000');
    expect(telHref('n/a')).toBeNull();
    expect(telHref(null)).toBeNull();
  });
});

describe('TechnicianTicketWorkflow', () => {
  const src = readFileSync('client/src/components/service/TechnicianTicketWorkflow.tsx', 'utf8');
  it('posts photos to the attachments endpoint in the shape it reads', () => {
    expect(src).toMatch(
      /`\/api\/service-tickets\/\$\{ticket\.id\}\/attachments`, 'POST', \{\s*base64,\s*filename: file\.name,/,
    );
    const fn = readFileSync('supabase/functions/_shared/ticket-attachment.ts', 'utf8');
    expect(fn).toContain('body.base64');
    expect(fn).toMatch(/body\.filename/);
  });
  it('saves notes as an append, through the field the PATCH maps', () => {
    expect(src).toMatch(/appendWorkOrderNote\(ticket\.workOrderNotes, noteDraft, new Date\(\)\)/);
    expect(src).toMatch(
      /apiRequest\(`\/api\/service-tickets\/\$\{ticket\.id\}`, 'PATCH', \{ workOrderNotes \}\)/,
    );
    expect(readFileSync('supabase/functions/service-tickets/_dispatch.ts', 'utf8')).toContain(
      "workOrderNotes: 'work_order_notes'",
    );
  });
  it('removes the two actions with no target', () => {
    // Bound to rendered text: the comment explaining the removal names both.
    expect(src).not.toMatch(/\n\s*(Request Parts|Equipment Info)\s*\n\s*<\/Button>/);
  });
});
