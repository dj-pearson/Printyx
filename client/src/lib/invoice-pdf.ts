// Invoice PDF download helper (EDGE-002a).
//
// Mirrors lib/quote-pdf.ts: edge functions require a Bearer JWT + x-tenant-id,
// and a plain fetch(credentials:'include') only sends cookies — it 401s once
// /api/billing is served by the billing edge function. This helper attaches
// the same auth the rest of the app uses.

import { getApiUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/supabase';

function tenantIdForHeaders(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  if (localStorage.getItem('demo-authenticated') === 'true') {
    return localStorage.getItem('demo-tenant-id') || undefined;
  }
  return (
    localStorage.getItem('tenant-id') ||
    localStorage.getItem('printyx-tenant-id') ||
    localStorage.getItem('x-tenant-id') ||
    undefined
  );
}

export async function fetchInvoicePdfBlob(invoiceId: string): Promise<Blob> {
  const token = await getAccessToken();
  const tid = tenantIdForHeaders();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tid) headers['x-tenant-id'] = tid;

  const res = await fetch(getApiUrl(`/api/billing/invoices/${invoiceId}/pdf`), {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    let msg = 'Failed to load invoice PDF';
    try {
      const j = await res.json();
      if (j?.error || j?.message) msg = j.message || j.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }
  return res.blob();
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
