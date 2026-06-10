// PROP-007: lightweight HTML → pdf-lib renderer for proposal sections.
//
// pdf-lib has no HTML engine, so this draws a constrained block model from the
// limited markup our merge engine + template editor emit: headings, paragraphs
// (with <br>), lists, the line-items table, images (logo), and rules. Unknown
// inline tags degrade to their text content. It is NOT a general HTML/CSS engine
// — it covers the proposal section vocabulary with clean pagination.

import { PDFDocument, PDFFont, PDFImage, PDFPage, RGB, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { parse, HTMLElement, Node } from 'https://esm.sh/node-html-parser@6.1.13';

export interface PdfTheme {
  font: PDFFont;
  bold: PDFFont;
  bodyColor: RGB;
  accentColor: RGB; // brand primary — headings + table header
  lineColor: RGB;
  tableHeaderBg: RGB;
}

export interface FlowCtx {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  pageWidth: number;
  pageHeight: number;
  marginX: number;
  marginTop: number; // y value a fresh page starts at (below any header band)
  marginBottom: number; // do not draw below this y
  theme: PdfTheme;
  // Called after a new page is added (e.g. to paint a header band / footer).
  onNewPage?: (page: PDFPage) => void;
}

const HEADING_SIZE: Record<string, number> = {
  h1: 22,
  h2: 17,
  h3: 14,
  h4: 12,
  h5: 11,
  h6: 10,
};

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

// Block text with <br> → newlines, tags stripped, entities decoded, runs collapsed.
function blockLines(el: HTMLElement): string[] {
  const withBreaks = el.innerHTML.replace(/<br\s*\/?>/gi, '\n');
  return decodeEntities(stripTags(withBreaks))
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l, i, arr) => l.length > 0 || (i > 0 && i < arr.length - 1));
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function ensure(ctx: FlowCtx, needed: number) {
  if (ctx.y - needed < ctx.marginBottom) newPage(ctx);
}

function newPage(ctx: FlowCtx) {
  ctx.page = ctx.pdf.addPage([ctx.pageWidth, ctx.pageHeight]);
  ctx.y = ctx.marginTop;
  ctx.onNewPage?.(ctx.page);
}

function contentWidth(ctx: FlowCtx): number {
  return ctx.pageWidth - ctx.marginX * 2;
}

function drawParagraph(
  ctx: FlowCtx,
  text: string,
  opts: { size?: number; bold?: boolean; color?: RGB; indent?: number; gapAfter?: number } = {},
) {
  const size = opts.size ?? 10;
  const font = opts.bold ? ctx.theme.bold : ctx.theme.font;
  const color = opts.color ?? ctx.theme.bodyColor;
  const indent = opts.indent ?? 0;
  const lineH = size * 1.4;
  const maxW = contentWidth(ctx) - indent;
  for (const ln of wrap(text, font, size, maxW)) {
    ensure(ctx, lineH);
    ctx.page.drawText(ln, {
      x: ctx.marginX + indent,
      y: ctx.y - size,
      size,
      font,
      color,
    });
    ctx.y -= lineH;
  }
  ctx.y -= opts.gapAfter ?? 4;
}

async function drawImage(ctx: FlowCtx, src: string) {
  try {
    if (/^data:image\/svg|\.svg(\?|$)/i.test(src)) return; // pdf-lib can't embed SVG
    const res = await fetch(src);
    if (!res.ok) return;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const ct = res.headers.get('content-type') ?? '';
    let img: PDFImage;
    if (ct.includes('png') || /\.png(\?|$)/i.test(src)) img = await ctx.pdf.embedPng(bytes);
    else if (ct.includes('jpeg') || ct.includes('jpg') || /\.jpe?g(\?|$)/i.test(src))
      img = await ctx.pdf.embedJpg(bytes);
    else return;
    const maxW = Math.min(contentWidth(ctx), 240);
    const maxH = 90;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    ensure(ctx, h + 8);
    ctx.page.drawImage(img, { x: ctx.marginX, y: ctx.y - h, width: w, height: h });
    ctx.y -= h + 8;
  } catch {
    /* logo is best-effort; never fail the whole PDF on a bad image */
  }
}

function drawTable(ctx: FlowCtx, table: HTMLElement) {
  const rows = table.querySelectorAll('tr');
  if (!rows.length) return;

  // Header = a row containing <th>, else the first row.
  const headerRow = rows.find((r) => r.querySelector('th')) ?? rows[0];
  const bodyRows = rows.filter((r) => r !== headerRow);
  const headerCells = headerRow.querySelectorAll('th,td').map((c) => decodeEntities(c.text).trim());
  const colCount = Math.max(1, headerCells.length);
  const w = contentWidth(ctx);
  // First column wider (item name); the rest share the remainder.
  const firstW = colCount > 1 ? w * 0.4 : w;
  const restW = colCount > 1 ? (w - firstW) / (colCount - 1) : 0;
  const colWidth = (i: number) => (i === 0 ? firstW : restW);
  const colX = (i: number) => ctx.marginX + (i === 0 ? 0 : firstW + restW * (i - 1));
  const rowH = 16;
  const size = 9;

  const drawHeader = () => {
    ensure(ctx, rowH);
    ctx.page.drawRectangle({
      x: ctx.marginX,
      y: ctx.y - rowH,
      width: w,
      height: rowH,
      color: ctx.theme.tableHeaderBg,
    });
    headerCells.forEach((cell, i) => {
      ctx.page.drawText(cell.slice(0, 60), {
        x: colX(i) + 3,
        y: ctx.y - rowH + 5,
        size,
        font: ctx.theme.bold,
        color: ctx.theme.bodyColor,
      });
    });
    ctx.y -= rowH;
  };

  drawHeader();

  for (const r of bodyRows) {
    const cells = r.querySelectorAll('th,td').map((c) => decodeEntities(c.text).trim());
    if (!cells.length) continue;
    if (ctx.y - rowH < ctx.marginBottom) {
      newPage(ctx);
      drawHeader(); // repeat header on each page
    }
    ctx.page.drawLine({
      start: { x: ctx.marginX, y: ctx.y - rowH },
      end: { x: ctx.marginX + w, y: ctx.y - rowH },
      thickness: 0.5,
      color: ctx.theme.lineColor,
    });
    cells.forEach((cell, i) => {
      const align = i === 0 ? 'left' : 'right';
      const cw = colWidth(i);
      const text = cell.length > 80 ? cell.slice(0, 79) + '…' : cell;
      const tw = ctx.theme.font.widthOfTextAtSize(text, size);
      const x = align === 'right' ? colX(i) + cw - tw - 3 : colX(i) + 3;
      ctx.page.drawText(text, {
        x,
        y: ctx.y - rowH + 5,
        size,
        font: ctx.theme.font,
        color: ctx.theme.bodyColor,
      });
    });
    ctx.y -= rowH;
  }
  ctx.y -= 8;
}

async function renderNode(ctx: FlowCtx, node: Node) {
  // Text node at block level → paragraph.
  if (!(node instanceof HTMLElement)) {
    const t = decodeEntities((node as { text?: string }).text ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (t) drawParagraph(ctx, t);
    return;
  }
  const tag = node.rawTagName?.toLowerCase() ?? '';

  if (HEADING_SIZE[tag]) {
    ctx.y -= 4;
    for (const ln of blockLines(node)) {
      drawParagraph(ctx, ln, {
        size: HEADING_SIZE[tag],
        bold: true,
        color: ctx.theme.accentColor,
        gapAfter: 2,
      });
    }
    ctx.y -= 4;
    return;
  }

  switch (tag) {
    case 'p':
      for (const ln of blockLines(node)) drawParagraph(ctx, ln, { gapAfter: 2 });
      ctx.y -= 4;
      return;
    case 'ul':
    case 'ol': {
      const items = node.querySelectorAll('li');
      items.forEach((li, i) => {
        const marker = tag === 'ol' ? `${i + 1}.` : '•';
        const text = decodeEntities(li.text).replace(/\s+/g, ' ').trim();
        drawParagraph(ctx, `${marker} ${text}`, { indent: 12, gapAfter: 1 });
      });
      ctx.y -= 4;
      return;
    }
    case 'table':
      drawTable(ctx, node);
      return;
    case 'img': {
      const src = node.getAttribute('src');
      if (src) await drawImage(ctx, src);
      return;
    }
    case 'hr':
      ensure(ctx, 10);
      ctx.page.drawLine({
        start: { x: ctx.marginX, y: ctx.y - 4 },
        end: { x: ctx.pageWidth - ctx.marginX, y: ctx.y - 4 },
        thickness: 0.5,
        color: ctx.theme.lineColor,
      });
      ctx.y -= 12;
      return;
    case 'br':
      ctx.y -= 8;
      return;
    case 'div':
    case 'section':
    case 'header':
    case 'footer':
    case 'span': {
      // Container: recurse into children. If it has no element children, treat as paragraph.
      const hasElementChild = node.childNodes.some((c) => c instanceof HTMLElement);
      if (!hasElementChild) {
        for (const ln of blockLines(node)) drawParagraph(ctx, ln, { gapAfter: 2 });
        return;
      }
      for (const child of node.childNodes) await renderNode(ctx, child);
      return;
    }
    default: {
      // Unknown block: render its text content.
      const lines = blockLines(node);
      for (const ln of lines) drawParagraph(ctx, ln, { gapAfter: 2 });
    }
  }
}

/** Render an array of {title, html} sections into the flow context. */
export async function renderSectionsToPdf(
  ctx: FlowCtx,
  sections: Array<{ title?: string; html: string }>,
) {
  for (let s = 0; s < sections.length; s++) {
    const section = sections[s];
    if (s > 0) ctx.y -= 10; // breathing room between sections
    const root = parse(section.html ?? '');
    for (const node of root.childNodes) {
      await renderNode(ctx, node);
    }
  }
}
