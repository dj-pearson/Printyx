// Collaboration templates — stub (no collaboration_templates table).
//
// Path: GET /collaboration/templates

import { jsonResponse } from '../../_shared/http.ts';
import type { HandlerCtx } from '../_context.ts';

const TEMPLATES = [
  {
    id: 'equipment-installation',
    name: 'Equipment Installation',
    description: 'Standard workflow for installing new equipment',
    category: 'installation',
    defaultTasks: [
      { title: 'Site survey', priority: 'medium', estimatedHours: 2 },
      { title: 'Equipment delivery', priority: 'medium', estimatedHours: 1 },
      { title: 'Installation', priority: 'high', estimatedHours: 4 },
      { title: 'Customer training', priority: 'medium', estimatedHours: 2 },
      { title: 'Sign-off', priority: 'low', estimatedHours: 1 },
    ],
  },
  {
    id: 'customer-onboarding',
    name: 'Customer Onboarding',
    description: 'Post-sale onboarding workflow',
    category: 'customer_follow_up',
    defaultTasks: [
      { title: 'Welcome call', priority: 'high', estimatedHours: 1 },
      { title: 'Portal access setup', priority: 'medium', estimatedHours: 1 },
      { title: 'First-month check-in', priority: 'medium', estimatedHours: 1 },
    ],
  },
  {
    id: 'monthly-maintenance',
    name: 'Monthly Maintenance',
    description: 'Recurring preventive-maintenance checklist',
    category: 'maintenance',
    defaultTasks: [
      { title: 'Meter read collection', priority: 'medium', estimatedHours: 1 },
      { title: 'Consumables check', priority: 'medium', estimatedHours: 1 },
      { title: 'Clean + inspect', priority: 'low', estimatedHours: 2 },
    ],
  },
];

export async function handleTemplates(req: Request, ctx: HandlerCtx): Promise<Response | null> {
  if (ctx.method !== 'GET') return null;
  return jsonResponse({ templates: TEMPLATES, stub: true }, 200, req, ctx.requestId);
}
