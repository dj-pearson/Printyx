// Authenticated file download helper (EDGE-023).
//
// Generalises what lib/invoice-pdf.ts does for one endpoint. Edge functions
// authenticate every request with a Bearer JWT, so the two obvious ways to
// download a file BOTH fail in production:
//
//   window.open(getApiUrl(path))          — a browser navigation. No
//                                           Authorization header at all → 401.
//   fetch(path, {credentials:'include'})  — sends cookies only, and the edge
//                                           host does not use cookie auth → 401.
//
// In dev neither is obvious: Express accepts the session cookie, so a
// window.open download works locally and breaks only once the request goes to
// functions.printyx.net. Same prod-only shape as the edge path-normalization bug.
//
// Use this for any authenticated file download (CSV, PDF, ZIP, ICS).

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

/** GET `path` with the app's auth headers and return the body as a Blob. */
export async function fetchAuthedBlob(path: string): Promise<Blob> {
  const token = await getAccessToken();
  const tid = tenantIdForHeaders();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tid) headers['x-tenant-id'] = tid;

  const res = await fetch(getApiUrl(path), { method: 'GET', headers, credentials: 'include' });
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error || j?.message) msg = j.message || j.error;
    } catch {
      /* non-JSON error body — keep the status-code message */
    }
    throw new Error(msg);
  }
  return res.blob();
}

/** Save a Blob to disk under `filename`. */
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

/** Fetch an authenticated file and save it. */
export async function downloadAuthedFile(path: string, filename: string): Promise<void> {
  triggerBlobDownload(await fetchAuthedBlob(path), filename);
}
