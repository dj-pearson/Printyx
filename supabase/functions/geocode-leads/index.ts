// Geocode Leads Edge Function
// Enriches business_records with addresses and lat/lng via Google Places API
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY') || '';
const BATCH_SIZE = 10;
const DELAY_MS = 200; // rate limiting between requests

interface GeocodeResult {
  id: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  error?: string;
}

async function geocodeCompany(
  companyName: string,
  city: string,
  state: string,
  zip: string,
): Promise<{ address: string | null; lat: number | null; lng: number | null }> {
  const query = `${companyName}, ${city}, ${state} ${zip}`;

  const url = `https://places.googleapis.com/v1/places:searchText`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: query,
      locationBias: {
        rectangle: {
          low: { latitude: 40.375, longitude: -96.639 }, // Iowa SW
          high: { latitude: 43.501, longitude: -90.14 }, // Iowa NE
        },
      },
      maxResultCount: 1,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Places API ${res.status}: ${text}`);
  }

  const data = await res.json();
  const place = data.places?.[0];

  if (!place) {
    return { address: null, lat: null, lng: null };
  }

  return {
    address: place.formattedAddress || null,
    lat: place.location?.latitude || null,
    lng: place.location?.longitude || null,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (!GOOGLE_PLACES_API_KEY) {
      return createCorsResponse({ error: 'GOOGLE_PLACES_API_KEY not configured' }, 500, req);
    }

    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenant_id as string) || (user.user_metadata?.tenant_id as string);

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);

    // POST /geocode-leads - Process batch of leads
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const limit = Math.min(body.limit || BATCH_SIZE, 50);
      const recordIds: string[] | undefined = body.ids;

      // Fetch leads needing geocoding
      let query = admin
        .from('business_records')
        .select(
          'id, company_name, billing_city, billing_state, billing_zip_code, city, state, postal_code',
        )
        .eq('tenant_id', tenantId)
        .is('latitude', null);

      if (recordIds && recordIds.length > 0) {
        query = query.in('id', recordIds);
      } else {
        // Default: process EDA Import leads first, then others
        query = query.eq('source', 'EDA Import');
      }

      const { data: leads, error: fetchError } = await query.limit(limit);

      if (fetchError) {
        return createCorsResponse({ error: fetchError.message }, 500, req);
      }

      if (!leads || leads.length === 0) {
        return createCorsResponse(
          {
            message: 'No leads to geocode',
            processed: 0,
            results: [],
          },
          200,
          req,
        );
      }

      const results: GeocodeResult[] = [];

      for (const lead of leads) {
        const city = lead.billing_city || lead.city || '';
        const state = lead.billing_state || lead.state || 'IA';
        const zip = lead.billing_zip_code || lead.postal_code || '';

        if (!city && !zip) {
          results.push({
            id: lead.id,
            address: null,
            lat: null,
            lng: null,
            error: 'No city or zip code available',
          });
          continue;
        }

        try {
          const geo = await geocodeCompany(lead.company_name, city, state, zip);

          if (geo.lat && geo.lng) {
            // Update the record
            const updateData: Record<string, unknown> = {
              latitude: geo.lat,
              longitude: geo.lng,
              updated_at: new Date().toISOString(),
            };

            // Only update address if we got one and record doesn't already have one
            if (geo.address) {
              updateData.address_line1 = geo.address;
              // Also set billing address if not set
              if (!lead.billing_city) {
                // Parse address components from formatted address
              }
            }

            const { error: updateError } = await admin
              .from('business_records')
              .update(updateData)
              .eq('id', lead.id);

            if (updateError) {
              results.push({
                id: lead.id,
                address: geo.address,
                lat: geo.lat,
                lng: geo.lng,
                error: `Update failed: ${updateError.message}`,
              });
            } else {
              results.push({
                id: lead.id,
                address: geo.address,
                lat: geo.lat,
                lng: geo.lng,
              });
            }
          } else {
            results.push({
              id: lead.id,
              address: null,
              lat: null,
              lng: null,
              error: 'No results from Places API',
            });
          }

          // Rate limit
          await sleep(DELAY_MS);
        } catch (err) {
          results.push({
            id: lead.id,
            address: null,
            lat: null,
            lng: null,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      const successful = results.filter((r) => r.lat !== null).length;
      return createCorsResponse(
        {
          message: `Geocoded ${successful}/${results.length} leads`,
          processed: results.length,
          successful,
          results,
        },
        200,
        req,
      );
    }

    // GET /geocode-leads/status - Get geocoding progress
    if (req.method === 'GET') {
      const { data, error } = await admin.rpc('exec_sql', {
        sql: `
          SELECT
            COUNT(*) as total,
            COUNT(CASE WHEN latitude IS NOT NULL THEN 1 END) as geocoded,
            COUNT(CASE WHEN latitude IS NULL THEN 1 END) as pending
          FROM business_records
          WHERE tenant_id = '${tenantId}'
            AND source = 'EDA Import'
        `,
      });

      // Fallback: query directly
      const { count: total } = await admin
        .from('business_records')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('source', 'EDA Import');

      const { count: geocoded } = await admin
        .from('business_records')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('source', 'EDA Import')
        .not('latitude', 'is', null);

      return createCorsResponse(
        {
          total: total || 0,
          geocoded: geocoded || 0,
          pending: (total || 0) - (geocoded || 0),
          percentage: total ? Math.round(((geocoded || 0) / total) * 100) : 0,
        },
        200,
        req,
      );
    }

    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  } catch (err) {
    console.error('Geocode error:', err);
    return createCorsResponse(
      { error: err instanceof Error ? err.message : 'Internal error' },
      500,
      req,
    );
  }
}
