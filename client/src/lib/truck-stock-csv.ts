// Truck-stock pick-list CSV download helper (PROD-011).
//
// Mirrors lib/invoice-pdf.ts. The page previously did
// `window.open(getApiUrl('/api/truck-stock/.../export.csv'))`, which is a plain
// browser navigation: it carries no Authorization header, so once the domain is
// served by the truck-stock edge function it 401s and the warehouse gets a JSON
// error page instead of a pick list. Fetching with the app's own auth and
// handing the browser a blob keeps the download working.

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

export async function downloadTruckStockPickList(recommendationId: string): Promise<void> {
  const token = await getAccessToken();
  const tid = tenantIdForHeaders();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (tid) headers['x-tenant-id'] = tid;

  const res = await fetch(
    getApiUrl(`/api/truck-stock/recommendations/${recommendationId}/export.csv`),
    { method: 'GET', headers, credentials: 'include' },
  );

  if (!res.ok) {
    let msg = 'Failed to download the pick list';
    try {
      const body = await res.json();
      if (body?.error || body?.message) msg = body.message || body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(msg);
  }

  triggerBlobDownload(await res.blob(), `truck-stock-${recommendationId}.csv`);
}
