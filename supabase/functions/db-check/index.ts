// Database diagnostic function
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { createSupabaseServiceClient } from '../_shared/supabase.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

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
