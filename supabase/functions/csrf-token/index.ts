// CSRF Token Edge Function
// Returns empty CSRF token for Supabase auth mode (CSRF not needed with JWT tokens)
import { handleCors, createCorsResponse } from '../_shared/cors.ts';

// Export handler for use by the main server router
export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // In Supabase auth mode, CSRF tokens aren't needed (we use JWT Bearer tokens)
  // Return an empty response to prevent 404 errors
  return createCorsResponse(
    {
      csrfToken: null,
      message: 'CSRF tokens not required for Supabase auth mode',
    },
    200,
    req,
  );
}
