// Deal Stages Edge Function
// Returns available deal/opportunity pipeline stages
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

// Default deal stages
const defaultStages = [
  { id: '1', name: 'Prospecting', order: 1, probability: 10, color: '#94a3b8' },
  { id: '2', name: 'Qualification', order: 2, probability: 25, color: '#60a5fa' },
  { id: '3', name: 'Proposal', order: 3, probability: 50, color: '#fbbf24' },
  { id: '4', name: 'Negotiation', order: 4, probability: 75, color: '#f97316' },
  { id: '5', name: 'Closed Won', order: 5, probability: 100, color: '#22c55e' },
  { id: '6', name: 'Closed Lost', order: 6, probability: 0, color: '#ef4444' },
];

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
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

    // For now, return default stages
    // TODO: In the future, fetch custom stages from database per tenant
    return createCorsResponse(defaultStages, 200, req);
  } catch (error) {
    console.error('Error in deal-stages function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
