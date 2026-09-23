// Purchase-order PDF (round 210). Draws the content _po-document.ts decides;
// pdf-lib at the same pin as billing/_pdf.ts and the proposals function.
import { PDFDocument, StandardFonts, degrees, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import type { PoDocument } from './_po-document.ts';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 50;
const DARK = rgb(0.12, 0.16, 0.22);
const GRAY = rgb(0.42, 0.45, 0.5);
const LIGHT = rgb(0.88, 0.9, 0.92);
const money = (n: number) => `$${n.toFixed(2)}`;

export async function renderPurchaseOrderPDF(doc: PoDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([PAGE_W, PAGE_H]);

  const newPage = () => {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    if (doc.watermark) watermark();
    return PAGE_H - MARGIN;
  };
  const watermark = () =>
    page.drawText(doc.watermark!, {
      x: PAGE_W / 2 - bold.widthOfTextAtSize(doc.watermark!, 64) / 2.6,
      y: PAGE_H / 3,
      size: 64,
      font: bold,
      color: rgb(0.93, 0.93, 0.93),
      rotate: degrees(35),
    });
  if (doc.watermark) watermark();

  page.drawRectangle({ x: 0, y: PAGE_H - 90, width: PAGE_W, height: 90, color: DARK });
  page.drawText('Printyx', {
    x: MARGIN,
    y: PAGE_H - 55,
    size: 24,
    font: bold,
    color: rgb(1, 1, 1),
  });
  page.drawText(doc.title, {
    x: PAGE_W - MARGIN - bold.widthOfTextAtSize(doc.title, 20),
    y: PAGE_H - 55,
    size: 20,
    font: bold,
    color: rgb(1, 1, 1),
  });

  let y = PAGE_H - 125;
  let metaY = y;
  for (const [label, value] of doc.meta) {
    page.drawText(label, { x: PAGE_W - MARGIN - 200, y: metaY, size: 9, font: bold, color: GRAY });
    page.drawText(value, { x: PAGE_W - MARGIN - 120, y: metaY, size: 9, font, color: DARK });
    metaY -= 15;
  }
  page.drawText('VENDOR', { x: MARGIN, y, size: 9, font: bold, color: GRAY });
  y -= 16;
  for (const line of doc.vendorLines) {
    page.drawText(line.slice(0, 60), { x: MARGIN, y, size: 10, font, color: DARK });
    y -= 14;
  }
  if (doc.shipTo.length) {
    y -= 8;
    page.drawText('SHIP TO', { x: MARGIN, y, size: 9, font: bold, color: GRAY });
    y -= 16;
    for (const line of doc.shipTo) {
      page.drawText(line.slice(0, 60), { x: MARGIN, y, size: 10, font, color: DARK });
      y -= 14;
    }
  }
  y = Math.min(y, metaY) - 25;

  const cols = { desc: MARGIN, part: 300, qty: 390, unit: 450, total: PAGE_W - MARGIN };
  const header = () => {
    page.drawRectangle({
      x: MARGIN,
      y: y - 4,
      width: PAGE_W - 2 * MARGIN,
      height: 18,
      color: LIGHT,
    });
    page.drawText('Description', { x: cols.desc + 4, y, size: 9, font: bold, color: DARK });
    page.drawText('Part #', { x: cols.part, y, size: 9, font: bold, color: DARK });
    page.drawText('Qty', { x: cols.qty, y, size: 9, font: bold, color: DARK });
    page.drawText('Unit', { x: cols.unit, y, size: 9, font: bold, color: DARK });
    const t = 'Total';
    page.drawText(t, {
      x: cols.total - bold.widthOfTextAtSize(t, 9),
      y,
      size: 9,
      font: bold,
      color: DARK,
    });
    y -= 22;
  };
  header();
  for (const line of doc.lines) {
    if (y < MARGIN + 80) {
      y = newPage();
      header();
    }
    page.drawText(line.description.slice(0, 45), {
      x: cols.desc + 4,
      y,
      size: 9,
      font,
      color: DARK,
    });
    page.drawText(line.partNumber.slice(0, 14), { x: cols.part, y, size: 9, font, color: DARK });
    page.drawText(String(line.quantity), { x: cols.qty, y, size: 9, font, color: DARK });
    page.drawText(money(line.unitPrice), { x: cols.unit, y, size: 9, font, color: DARK });
    const t = money(line.total);
    page.drawText(t, {
      x: cols.total - font.widthOfTextAtSize(t, 9),
      y,
      size: 9,
      font,
      color: DARK,
    });
    y -= 16;
  }

  y -= 10;
  for (const [label, value] of doc.totals) {
    if (y < MARGIN + 20) y = newPage();
    const isTotal = label === 'Total';
    const f = isTotal ? bold : font;
    page.drawText(label, { x: cols.unit - 40, y, size: 10, font: f, color: DARK });
    const t = money(value);
    page.drawText(t, {
      x: cols.total - f.widthOfTextAtSize(t, 10),
      y,
      size: 10,
      font: f,
      color: DARK,
    });
    y -= 16;
  }

  if (doc.notes) {
    if (y < MARGIN + 50) y = newPage();
    y -= 14;
    page.drawText('SPECIAL INSTRUCTIONS', { x: MARGIN, y, size: 9, font: bold, color: GRAY });
    y -= 14;
    for (const chunk of doc.notes.match(/.{1,90}(\s|$)/g) ?? []) {
      if (y < MARGIN) y = newPage();
      page.drawText(chunk.trim(), { x: MARGIN, y, size: 9, font, color: DARK });
      y -= 12;
    }
  }
  return pdf.save();
}
