// Performance Edge Function
// Handles performance metrics and alerts
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';

// Export handler for use by the main server router
export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const endpoint = pathParts[0]; // Will be 'alerts', 'metrics', etc.

  try {
    // Verify JWT and get current auth user
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return createCorsResponse({ error: 'Unauthorized' }, 401, req);
    }

    const admin = createSupabaseServiceClient();

    switch (endpoint) {
      case 'metrics': {
        // Return performance metrics
        // In a real implementation, you'd fetch this from system monitoring tables
        const metrics = {
          responseTime: 185,
          throughput: 1250,
          errorRate: 0.5,
          uptime: 99.95,
          memoryUsage: 62,
          cpuUsage: 45,
          diskUsage: 38,
          activeUsers: 24,
        };
        return createCorsResponse(metrics, 200, req);
      }

      case 'alerts': {
        // Return system alerts
        // In a real implementation, you'd fetch this from an alerts table
        const alerts = [
          {
            id: 'alert-1',
            type: 'info',
            message: 'System running normally',
            timestamp: new Date().toISOString(),
            resolved: false,
          },
        ];
        return createCorsResponse(alerts, 200, req);
      }

      default:
        return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
    }
  } catch (error) {
    console.error('Performance function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
