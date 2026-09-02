/**
 * Tasks & Automation Domain
 * Task management, templates, automation, workflows
 */
export { registerTaskRoutes } from '../routes-tasks';
// registerEnhancedTaskRoutes - DELETED (WF-P-07, its one handler was a 42703)
export { registerTemplateRoutes } from '../routes-templates';
export { registerTaskWorkflowRoutes } from '../routes-task-workflows';
