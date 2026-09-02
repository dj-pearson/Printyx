// Onboarding checklist PDF — Deno / edge-function compatible.
//
// PA-052: POST /onboarding/checklists/:id/generate-pdf was Express-only, so the
// button worked in dev and 404'd in production. The Express implementation
// renders a 251-line HTML template through puppeteer, which needs a headless
// Chrome binary and cannot run here.
//
// The template was NOT ported. supabase/functions/proposals/_html-to-pdf.ts
// draws a constrained block model - headings, paragraphs, lists, tables, rules -
// and degrades unknown tags to their text content, and the Express template is
// built from `display:flex` label/value divs and CSS-bordered boxes. Feeding it
// that markup produces a wall of text. The checklist is emitted as headings and
// TABLES instead, which is what the data is: field/value pairs and row sets.
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { renderSectionsToPdf, type FlowCtx } from '../proposals/_html-to-pdf.ts';

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 40;
const MARGIN_Y = 48;

type Row = Record<string, any>;

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** A blank value renders as an em space, not as the word "null". */
const cell = (v: unknown) =>
  v === null || v === undefined || String(v).trim() === '' ? '—' : esc(v);

function fieldTable(pairs: Array<[string, unknown]>): string {
  const rows = pairs
    .map(
      ([label, value]) => `<tr><td><strong>${esc(label)}</strong></td><td>${cell(value)}</td></tr>`,
    )
    .join('');
  return `<table>${rows}</table>`;
}

function listTable(headers: string[], rows: string[][]): string {
  const head = `<tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>`;
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${cell(c)}</td>`).join('')}</tr>`).join('');
  return `<table>${head}${body}</table>`;
}

export interface ChecklistPdfInput {
  checklist: Row;
  equipment: Row[];
  networkConfigs: Row[];
  printConfigs: Row[];
  dynamicSections: Row[];
  tasks: Row[];
}

export async function renderChecklistPdf(input: ChecklistPdfInput): Promise<Uint8Array> {
  const { checklist, equipment, networkConfigs, printConfigs, dynamicSections, tasks } = input;
  const customer = (checklist.customer_data as Row) || {};
  const site = (checklist.site_information as Row) || {};

  const sections: Array<{ title?: string; html: string }> = [];

  sections.push({
    html:
      `<h1>Equipment Installation &amp; Onboarding Checklist</h1>` +
      `<h2>${esc(checklist.checklist_title ?? 'Checklist')}</h2>` +
      `<p>Generated ${new Date().toISOString().slice(0, 10)}</p><hr/>`,
  });

  sections.push({
    html:
      `<h3>Checklist</h3>` +
      fieldTable([
        ['Status', checklist.status],
        ['Installation Type', checklist.installation_type],
        ['Scheduled Install', checklist.scheduled_install_date],
        ['Completed', checklist.completed_at],
        ['Assigned Technician', checklist.assigned_technician],
      ]),
  });

  if (Object.keys(customer).length) {
    sections.push({
      html:
        `<h3>Customer</h3>` +
        fieldTable(
          Object.entries(customer)
            .filter(([, v]) => typeof v !== 'object')
            .slice(0, 25) as Array<[string, unknown]>,
        ),
    });
  }

  if (Object.keys(site).length) {
    sections.push({
      html:
        `<h3>Site</h3>` +
        fieldTable(
          Object.entries(site)
            .filter(([, v]) => typeof v !== 'object')
            .slice(0, 25) as Array<[string, unknown]>,
        ),
    });
  }

  // An empty set says so rather than leaving a heading with nothing under it,
  // which reads as a rendering failure.
  sections.push({
    html:
      `<h3>Equipment</h3>` +
      (equipment.length
        ? listTable(
            ['Manufacturer', 'Model', 'Serial', 'Location'],
            equipment.map((e) => [
              e.manufacturer,
              e.model_number ?? e.model,
              e.serial_number,
              e.location ?? e.installation_location,
            ]),
          )
        : `<p>No equipment recorded.</p>`),
  });

  sections.push({
    html:
      `<h3>Network Configuration</h3>` +
      (networkConfigs.length
        ? listTable(
            ['IP Address', 'Subnet', 'Gateway', 'Hostname'],
            networkConfigs.map((n) => [n.ip_address, n.subnet_mask, n.gateway, n.hostname]),
          )
        : `<p>No network configuration recorded.</p>`),
  });

  sections.push({
    html:
      `<h3>Print Management</h3>` +
      (printConfigs.length
        ? listTable(
            ['Software', 'Server', 'Authentication'],
            printConfigs.map((p) => [
              p.print_management_software ?? p.software_name,
              p.server_name ?? p.print_server,
              p.authentication_method,
            ]),
          )
        : `<p>No print management recorded.</p>`),
  });

  sections.push({
    html:
      `<h3>Tasks</h3>` +
      (tasks.length
        ? listTable(
            ['Task', 'Status', 'Assigned To', 'Completed'],
            tasks.map((t) => [t.task_title ?? t.title, t.status, t.assigned_to, t.completed_at]),
          )
        : `<p>No tasks recorded.</p>`),
  });

  for (const section of dynamicSections) {
    const fields = (section.section_data as Row) || {};
    sections.push({
      html:
        `<h3>${esc(section.section_title ?? section.title ?? 'Additional Section')}</h3>` +
        (Object.keys(fields).length
          ? fieldTable(
              Object.entries(fields)
                .filter(([, v]) => typeof v !== 'object')
                .slice(0, 25) as Array<[string, unknown]>,
            )
          : `<p>No values recorded.</p>`),
    });
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const ctx: FlowCtx = {
    pdf,
    page,
    y: PAGE_HEIGHT - MARGIN_Y,
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    marginX: MARGIN_X,
    marginTop: PAGE_HEIGHT - MARGIN_Y,
    marginBottom: MARGIN_Y,
    theme: {
      font,
      bold,
      bodyColor: rgb(0.13, 0.15, 0.18),
      accentColor: rgb(0.05, 0.4, 0.75),
      lineColor: rgb(0.85, 0.87, 0.9),
      tableHeaderBg: rgb(0.95, 0.96, 0.97),
    },
  };

  await renderSectionsToPdf(ctx, sections);
  return await pdf.save();
}
