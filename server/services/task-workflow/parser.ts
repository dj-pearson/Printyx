/**
 * Task Workflow — Upload Parser
 *
 * Turns an uploaded file into a draft list of workflow steps
 * ({ title, assigneeName, stageIndex }), which the creator then confirms/edits
 * before saving. Supports:
 *   - CSV   -> deterministic parse (header-aware)
 *   - XLSX  -> deterministic parse via exceljs (header-aware)
 *   - image -> Claude vision (reads a screenshot of a table)
 *
 * After extracting rows, raw assignee labels are fuzzy-matched to tenant users
 * (assignee-matcher) so the UI can pre-fill assignees with a confidence badge.
 *
 * Steps default to STRICTLY SEQUENTIAL (stageIndex = row order); the builder UI
 * lets the creator merge steps into the same stage to run them in parallel.
 */
import Anthropic from '@anthropic-ai/sdk';
import { createModuleLogger } from '../../lib/logger';
import { loadCandidateUsers, matchAssignee } from './assignee-matcher';
import type { ParsedWorkflowDraft, ParsedWorkflowStep } from '@shared/schema';

const log = createModuleLogger('task-workflow-parser');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
});

const TITLE_HEADER_HINTS = [
  'action',
  'item',
  'task',
  'step',
  'title',
  'note',
  'description',
  'todo',
];
const ASSIGNEE_HEADER_HINTS = [
  'people',
  'person',
  'assignee',
  'owner',
  'who',
  'responsible',
  'assigned',
];

type RawRow = { title: string; assigneeName?: string };

export type SupportedSource = 'csv' | 'xlsx' | 'image';

export function detectSourceType(mimeType: string, fileName: string): SupportedSource | null {
  const lower = (fileName || '').toLowerCase();
  if (mimeType === 'text/csv' || lower.endsWith('.csv')) return 'csv';
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    lower.endsWith('.xlsx') ||
    lower.endsWith('.xls')
  )
    return 'xlsx';
  if (mimeType?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(lower)) return 'image';
  return null;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Minimal RFC-4180-ish CSV parse (handles quoted fields, embedded commas/quotes). */
function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && content[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Column mapping (shared by CSV + XLSX)
// ---------------------------------------------------------------------------

function pickColumns(rows: string[][]): RawRow[] {
  if (rows.length === 0) return [];

  const header = rows[0].map((c) => c.toLowerCase().trim());
  const looksLikeHeader =
    header.some((h) => TITLE_HEADER_HINTS.some((k) => h.includes(k))) ||
    header.some((h) => ASSIGNEE_HEADER_HINTS.some((k) => h.includes(k)));

  let titleCol = 0;
  let assigneeCol = rows[0].length > 1 ? 1 : -1;
  let dataRows = rows;

  if (looksLikeHeader) {
    const ti = header.findIndex((h) => TITLE_HEADER_HINTS.some((k) => h.includes(k)));
    const ai = header.findIndex((h) => ASSIGNEE_HEADER_HINTS.some((k) => h.includes(k)));
    if (ti >= 0) titleCol = ti;
    if (ai >= 0) assigneeCol = ai;
    dataRows = rows.slice(1);
  }

  const out: RawRow[] = [];
  for (const r of dataRows) {
    const title = (r[titleCol] || '').trim();
    if (!title) continue;
    const assigneeName = assigneeCol >= 0 ? (r[assigneeCol] || '').trim() : undefined;
    out.push({ title, assigneeName: assigneeName || undefined });
  }
  return out;
}

// ---------------------------------------------------------------------------
// XLSX
// ---------------------------------------------------------------------------

async function parseXlsx(buffer: Buffer): Promise<RawRow[]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    // row.values is 1-indexed; normalize each cell to a string
    const arr = Array.isArray(row.values) ? row.values.slice(1) : [];
    for (const v of arr) {
      if (v == null) values.push('');
      else if (typeof v === 'object' && 'text' in (v as any)) values.push(String((v as any).text));
      else if (typeof v === 'object' && 'result' in (v as any))
        values.push(String((v as any).result ?? ''));
      else values.push(String(v));
    }
    rows.push(values);
  });
  return pickColumns(rows);
}

// ---------------------------------------------------------------------------
// Image (Claude vision)
// ---------------------------------------------------------------------------

function imageMediaType(
  mimeType: string,
  fileName: string,
): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' {
  if (mimeType === 'image/png' || /\.png$/i.test(fileName)) return 'image/png';
  if (mimeType === 'image/webp' || /\.webp$/i.test(fileName)) return 'image/webp';
  if (mimeType === 'image/gif' || /\.gif$/i.test(fileName)) return 'image/gif';
  return 'image/jpeg';
}

async function parseImage(buffer: Buffer, mimeType: string, fileName: string): Promise<RawRow[]> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_API_KEY) {
    throw new Error('Image parsing requires ANTHROPIC_API_KEY to be configured');
  }
  const mediaType = imageMediaType(mimeType, fileName);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    system:
      'You extract workflow steps from an image of a table or list. The table has rows where each row is a task/action item and (optionally) the person or group responsible. Return ONLY valid JSON, no prose.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
          },
          {
            type: 'text',
            text:
              'Extract every row in top-to-bottom order. Return JSON of the form ' +
              '{"steps":[{"title": "<the action/task text>", "assigneeName": "<the responsible person or group, or empty string>"}]}. ' +
              'Preserve the original wording of each task. Do not invent rows. Ignore header rows like "Action Item" / "People Involved".',
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (!content || content.type !== 'text') throw new Error('Unexpected vision response');

  let jsonText = content.text.trim();
  // Strip markdown fences if the model added them.
  const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonText = fence[1].trim();

  let parsed: { steps?: Array<{ title?: string; assigneeName?: string }> };
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    log.warn('Vision returned non-JSON; no steps extracted');
    return [];
  }

  return (parsed.steps || [])
    .map((s) => ({
      title: (s.title || '').trim(),
      assigneeName: (s.assigneeName || '').trim() || undefined,
    }))
    .filter((s) => s.title.length > 0);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function parseUploadToDraft(params: {
  tenantId: string;
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<ParsedWorkflowDraft> {
  const { tenantId, buffer, mimeType, fileName } = params;
  const source = detectSourceType(mimeType, fileName);
  if (!source) {
    throw new Error(`Unsupported file type: ${mimeType || fileName}`);
  }

  let rawRows: RawRow[] = [];
  if (source === 'csv') {
    rawRows = pickColumns(parseCsvRows(buffer.toString('utf8')));
  } else if (source === 'xlsx') {
    rawRows = await parseXlsx(buffer);
  } else {
    rawRows = await parseImage(buffer, mimeType, fileName);
  }

  // Fuzzy-match assignees against tenant users (one DB load, reused).
  const candidates = await loadCandidateUsers(tenantId);
  const unmatched = new Set<string>();

  const steps: ParsedWorkflowStep[] = rawRows.map((r, i) => {
    let suggestedAssigneeUserId: string | null = null;
    let matchConfidence = 0;
    if (r.assigneeName) {
      const m = matchAssignee(r.assigneeName, candidates);
      suggestedAssigneeUserId = m.userId;
      matchConfidence = m.confidence;
      if (!m.userId) unmatched.add(r.assigneeName);
    }
    return {
      title: r.title,
      stageIndex: i, // strictly sequential by default; UI can group for parallelism
      assigneeName: r.assigneeName,
      suggestedAssigneeUserId,
      matchConfidence,
    };
  });

  return {
    sourceType: source,
    sourceFileName: fileName,
    suggestedName: deriveName(fileName),
    steps,
    unmatchedAssignees: Array.from(unmatched),
  };
}

function deriveName(fileName: string): string {
  const base = (fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return base ? base.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Imported Workflow';
}
