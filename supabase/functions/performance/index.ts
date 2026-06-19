// Performance Edge Function
// Handles performance metrics and alerts
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { normalizePath } from '../_shared/path.ts';

// Export handler for use by the main server router
export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  // Coolify-safe routing: server.ts strips the function-name prefix, so
  // normalizePath gives parts[0] = first segment after /performance.
  const { parts } = normalizePath(url.pathname, 'performance');
  const endpoint = parts[0]; // 'alerts', 'metrics', 'health', etc.

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return createCorsResponse({ error: 'Missing or invalid Authorization header' }, 401, req);
    }

    const jwt = authHeader.replace('Bearer ', '');

    // Verify JWT and get user
    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error('Auth error:', userError);
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

      case 'health': {
        // Overall system health summary.
        // Mirrors the shape of server PerformanceMonitor.getSystemHealth()
        // ({ status, score, metrics[], recommendations[], timestamp }). The
        // edge runtime has no host-level monitoring, so this is a derived
        // healthy summary consistent with the mock /metrics values above.
        const now = new Date().toISOString();
        const memoryUsage = 62;
        const cpuUsage = 45;
        const responseTime = 185;

        const health = {
          status: 'healthy',
          score: 95,
          degraded: true,
          metrics: [
            { name: 'memory_usage', value: memoryUsage, unit: '%', timestamp: now },
            { name: 'cpu_usage', value: cpuUsage, unit: '%', timestamp: now },
            { name: 'database_query_time', value: responseTime, unit: 'ms', timestamp: now },
          ],
          recommendations: [],
          timestamp: now,
        };
        return createCorsResponse(health, 200, req);
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
