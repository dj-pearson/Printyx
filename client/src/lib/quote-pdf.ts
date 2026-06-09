// Quote PDF download helpers (QUOTE-007/008).
//
// Edge functions require a Bearer JWT + x-tenant-id; a plain
// fetch(credentials:'include') only sends cookies and 401s in production. These
// helpers attach the same auth the rest of the app uses.

import { getApiUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/supabase';
import { apiRequest } from '@/lib/queryClient';

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

export async function fetchQuotePdfBlob(
  quoteId: string,
  opts?: { manager?: boolean },
): Promise<Blob> {
  const path = `/api/proposals/${quoteId}/export/${opts?.manager ? 'manager-pdf' : 'pdf'}`;
  const token = await getAccessToken();
  const tid = tenantIdForHeaders();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tid) headers['x-tenant-id'] = tid;

  const res = await fetch(getApiUrl(path), { method: 'GET', headers, credentials: 'include' });
  if (!res.ok) {
    let msg = `Failed to export ${opts?.manager ? 'manager ' : ''}PDF`;
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
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

export async function downloadQuotePdf(
  quoteId: string,
  quoteNumber: string | undefined,
  opts?: { manager?: boolean },
): Promise<void> {
  const blob = await fetchQuotePdfBlob(quoteId, opts);
  triggerBlobDownload(
    blob,
    `Quote-${quoteNumber || quoteId}${opts?.manager ? '-manager' : ''}.pdf`,
  );
}

export interface EmailQuoteResult {
  success: boolean;
  to: string;
  messageId: string;
  simulated?: boolean;
}

// Email the customer-facing PDF to a contact. `to` is optional — the server
// falls back to the contact's, then the customer's, email.
export async function emailQuote(
  quoteId: string,
  opts?: { to?: string; subject?: string; message?: string },
): Promise<EmailQuoteResult> {
  return apiRequest(`/api/proposals/${quoteId}/email`, 'POST', {
    to: opts?.to,
    subject: opts?.subject,
    message: opts?.message,
  });
}
