/**
 * Tasks & Automation Domain
 * Task management, templates, automation, workflows
 */
export { registerTaskRoutes } from '../routes-tasks';
// registerEnhancedTaskRoutes - DELETED (WF-P-07, its one handler was a 42703)
// Round 159: registerTemplateRoutes (routes-templates.ts) retired. The edge
// function reads the same project_templates table now; /api/templates is
// proxied. Its /api/projects/:id/create-template had no caller anywhere.
export { registerTaskWorkflowRoutes } from '../routes-task-workflows';
