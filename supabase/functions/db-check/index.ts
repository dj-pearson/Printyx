// Database diagnostic function
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseServiceClient } from '../_shared/supabase.ts';
import { requirePlatformAdmin, AuthError } from '../_shared/auth.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // CR-004: this diagnostic uses the service role and returns information_schema
  // + live rows. Gate it behind platform-admin auth so it cannot leak schema or
  // data to anonymous callers.
  try {
    await requirePlatformAdmin(req);
  } catch (err) {
    const status = err instanceof AuthError ? err.status : 401;
    return createCorsResponse(
      { error: 'Platform admin authentication required', code: 'FORBIDDEN' },
      status,
      req,
    );
  }

  try {
    const admin = createSupabaseServiceClient();

    // Try to query the tasks table
    const { data: tasksData, error: tasksError } = await admin.from('tasks').select('*').limit(1);

    // Try to query the projects table
    const { data: projectsData, error: projectsError } = await admin
      .from('projects')
      .select('*')
      .limit(1);

    // Get list of tables from information_schema
    const { data: tables, error: tablesError } = await admin
      .from('information_schema.tables')
      .select('table_name, table_schema')
      .eq('table_schema', 'public')
      .order('table_name');

    return createCorsResponse(
      {
        status: 'ok',
        checks: {
          tasks: {
            exists: !tasksError,
            error: tasksError?.message || null,
            rowCount: tasksData?.length || 0,
          },
          projects: {
            exists: !projectsError,
            error: projectsError?.message || null,
            rowCount: projectsData?.length || 0,
          },
        },
        publicTables: tables || [],
        tablesError: tablesError?.message || null,
      },
      200,
      req,
    );
  } catch (error) {
    console.error('DB Check error:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
