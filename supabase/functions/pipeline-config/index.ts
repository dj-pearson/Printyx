// Pipeline Configuration Edge Function
// Handles pipeline templates and configuration
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

// Default pipeline templates
const defaultTemplates = [
  {
    id: 'default-sales',
    name: 'Default Sales Pipeline',
    description: 'Standard B2B sales process',
    stages: [
      { name: 'Prospecting', probability: 10 },
      { name: 'Qualification', probability: 25 },
      { name: 'Proposal', probability: 50 },
      { name: 'Negotiation', probability: 75 },
      { name: 'Closed Won', probability: 100 },
    ],
  },
  {
    id: 'enterprise-sales',
    name: 'Enterprise Sales Pipeline',
    description: 'Extended pipeline for complex enterprise deals',
    stages: [
      { name: 'Initial Contact', probability: 5 },
      { name: 'Discovery', probability: 15 },
      { name: 'Solution Design', probability: 30 },
      { name: 'Proposal', probability: 50 },
      { name: 'Negotiation', probability: 70 },
      { name: 'Legal Review', probability: 85 },
      { name: 'Closed Won', probability: 100 },
    ],
  },
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

    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    const subRoute = pathParts[1]; // e.g., 'templates'

    // GET /pipeline-config/templates - List pipeline templates
    if (req.method === 'GET' && subRoute === 'templates') {
      // TODO: In the future, fetch custom templates from database
      return createCorsResponse(defaultTemplates, 200, req);
    }

    return createCorsResponse({ error: 'Route not found' }, 404, req);
  } catch (error) {
    console.error('Error in pipeline-config function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
