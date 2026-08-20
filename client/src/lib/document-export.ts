// Purchase-agreement export helper (PROD-013).
//
// Mirrors lib/invoice-pdf.ts. DocumentBuilder used a plain
// fetch('/api/documents/:id/pdf', { credentials: 'include' }), which breaks in
// production twice over: a relative path never goes through getApiUrl, so it
// hits the static origin instead of the edge function, and cookies alone do not
// authenticate an edge function — it needs a Bearer JWT.
//
// The endpoint returns HTML, not PDF (see _shared/document-html.ts), so the
// download is named .html rather than mislabelled.

import { getApiUrl } from '@/lib/config';
import { getAccessToken } from '@/lib/supabase';
import { triggerBlobDownload } from '@/lib/invoice-pdf';

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

export async function downloadDocumentAgreement(documentId: string): Promise<void> {
  const token = await getAccessToken();
  const tid = tenantIdForHeaders();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tid) headers['x-tenant-id'] = tid;

  const res = await fetch(getApiUrl(`/api/documents/${documentId}/pdf`), {
    method: 'POST',
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let message = 'Failed to generate document';
    try {
      const body = await res.json();
      if (body?.error || body?.message) message = body.message || body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  triggerBlobDownload(await res.blob(), `document-${documentId}.html`);
}
