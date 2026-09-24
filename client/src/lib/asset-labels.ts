/**
 * Printable asset labels (round 227).
 *
 * EquipmentLifecycleHub's "Generate QR Codes" had no handler. The only QR
 * implementation in the tree, server/routes-equipment-qr.ts, is Express-only
 * and answers 503 "QR code generation is temporarily unavailable" on every
 * call, so production had nothing to call and dev had nothing that worked.
 * The `qrcode` package already runs in the browser (TwoFactorCard), so the
 * labels are built client-side. Each QR encodes the equipment ID - the
 * contract that router intended (`qrData = id`) - so whatever resolves a
 * scan can look the machine up by id.
 */

export interface AssetLabelInput {
  id: string;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  assetTag: string | null;
  customerName: string | null;
}

export interface AssetLabel {
  id: string;
  title: string;
  lines: string[];
}

/** What a label says, beside the code. Nothing is invented for a blank field. */
export function assetLabel(a: AssetLabelInput): AssetLabel {
  const title = [a.manufacturer, a.model].filter(Boolean).join(' ') || 'Equipment';
  const lines = [
    a.serialNumber ? `S/N ${a.serialNumber}` : null,
    a.assetTag ? `Asset ${a.assetTag}` : null,
    a.customerName,
  ].filter((l): l is string => Boolean(l));
  return { id: a.id, title, lines };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * A print-ready page. No script: the page is printed with the browser's own
 * print command, and every value is escaped because a model name or customer
 * name is text somebody typed.
 */
export function assetLabelsHtml(labels: AssetLabel[], qrById: Record<string, string>): string {
  const cells = labels
    .map((l) => {
      const src = qrById[l.id];
      const img = src && src.startsWith('data:image/') ? `<img src="${src}" alt="" />` : '';
      const lines = l.lines.map((t) => `<div class="line">${escapeHtml(t)}</div>`).join('');
      return `<div class="label">${img}<div class="text"><div class="title">${escapeHtml(
        l.title,
      )}</div>${lines}<div class="id">${escapeHtml(l.id)}</div></div></div>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Asset labels</title><style>
body{font-family:system-ui,sans-serif;margin:16px}
.hint{margin-bottom:12px;color:#555}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.label{display:flex;gap:8px;align-items:center;border:1px solid #999;padding:8px;break-inside:avoid}
.label img{width:96px;height:96px}
.title{font-weight:600}
.line{font-size:12px}
.id{font-size:9px;color:#666;word-break:break-all}
@media print{.hint{display:none}}
</style></head><body><div class="hint">${labels.length} label${
    labels.length === 1 ? '' : 's'
  }. Print this page to produce them.</div><div class="grid">${cells}</div></body></html>`;
}
