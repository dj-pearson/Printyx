// Dashboard Edge Function
// Handles dashboard modules and card configuration
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';

// Export handler for use by the main server router
export default async function handler(req: Request) {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const endpoint = pathParts[0]; // Will be 'modules', 'card-config', etc.

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

    // Get user role from metadata
    const userRole = (user.app_metadata as any)?.role || 'user';

    switch (endpoint) {
      case 'modules':
      case 'modules/': {
        // Return dashboard module data based on enabled cards
        const enabledCards = url.searchParams.get('cards')?.split(',') || [];

        // Default dashboard modules - in production, fetch from database
        const modules = [
          {
            id: 'revenue',
            category: 'financial',
            title: 'Monthly Revenue',
            value: '$125,430',
            subtitle: '+12% from last month',
            change: '+12%',
            trend: 'up',
            icon: 'DollarSign',
          },
          {
            id: 'deals',
            category: 'sales',
            title: 'Active Deals',
            value: 48,
            subtitle: '12 closing this week',
            change: '+5',
            trend: 'up',
            icon: 'Target',
          },
          {
            id: 'tasks',
            category: 'operations',
            title: 'Tasks Pending',
            value: 23,
            subtitle: '8 due today',
            change: '-3',
            trend: 'down',
            icon: 'CheckCircle',
          },
          {
            id: 'customers',
            category: 'customers',
            title: 'Total Customers',
            value: 1247,
            subtitle: '+28 this month',
            change: '+2.3%',
            trend: 'up',
            icon: 'Users',
          },
        ];

        // If specific cards are requested, filter
        const filteredModules =
          enabledCards.length > 0 ? modules.filter((m) => enabledCards.includes(m.id)) : modules;

        return createCorsResponse(filteredModules, 200, req);
      }

      case 'card-config': {
        // Return available dashboard cards based on user role
        const allCards = ['revenue', 'deals', 'tasks', 'customers', 'tickets', 'inventory'];

        const roleCards: Record<string, string[]> = {
          admin: allCards,
          manager: ['revenue', 'deals', 'tasks', 'customers', 'tickets'],
          sales: ['deals', 'tasks', 'customers'],
          support: ['tasks', 'tickets', 'customers'],
          user: ['tasks'],
        };

        const defaultCards: Record<string, string[]> = {
          admin: ['revenue', 'deals', 'tasks', 'customers'],
          manager: ['revenue', 'deals', 'tasks'],
          sales: ['deals', 'tasks', 'customers'],
          support: ['tasks', 'tickets'],
          user: ['tasks'],
        };

        const config = {
          role: userRole,
          defaultCards: defaultCards[userRole] || defaultCards.user,
          availableCards: roleCards[userRole] || roleCards.user,
          allCards,
        };

        return createCorsResponse(config, 200, req);
      }

      default:
        return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
    }
  } catch (error) {
    console.error('Dashboard function error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
