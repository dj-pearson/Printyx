/**
 * Tasks & Automation Domain
 * Task management, templates, automation, workflows
 */
// Round 160: registerTaskRoutes (routes-tasks.ts) retired. It served only
// GET /api/projects, GET /:id and POST, with no PATCH although HandoffProject
// calls one, so milestone edits 404'd in dev. /api/projects is proxied to
// supabase/functions/projects/, which already shared _project-scope with it.
// registerEnhancedTaskRoutes - DELETED (WF-P-07, its one handler was a 42703)
// Round 159: registerTemplateRoutes (routes-templates.ts) retired. The edge
// function reads the same project_templates table now; /api/templates is
// proxied. Its /api/projects/:id/create-template had no caller anywhere.
export { registerTaskWorkflowRoutes } from '../routes-task-workflows';
