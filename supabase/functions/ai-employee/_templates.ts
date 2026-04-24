// AI Employee templates — static catalog presented in the UI.
// Ported verbatim from server/routes/ai-employee-routes.ts:342-446 so the
// frontend template picker keeps rendering the same options.

export const AI_EMPLOYEE_TEMPLATES = [
  {
    id: 'sales_assistant',
    name: 'Sales Assistant',
    description: 'AI specialist for lead qualification, outreach, and sales support',
    capabilities: [
      'lead_scoring',
      'email_outreach',
      'appointment_scheduling',
      'proposal_generation',
    ],
    expertiseAreas: [
      'lead_qualification',
      'product_knowledge',
      'pricing_strategies',
      'objection_handling',
    ],
    autonomyLevel: 'supervised',
    estimatedCostPerMonth: 89.99,
    expectedTasks: [
      'Lead qualification',
      'Email campaigns',
      'Follow-up scheduling',
      'Proposal creation',
    ],
  },
  {
    id: 'support_agent',
    name: 'Support Agent',
    description: 'AI customer support specialist for technical assistance and issue resolution',
    capabilities: [
      'ticket_triage',
      'solution_research',
      'customer_communication',
      'knowledge_base_updates',
    ],
    expertiseAreas: [
      'technical_troubleshooting',
      'product_support',
      'customer_communication',
      'issue_documentation',
    ],
    autonomyLevel: 'semi_autonomous',
    estimatedCostPerMonth: 79.99,
    expectedTasks: [
      'Ticket handling',
      'Customer inquiries',
      'Technical support',
      'Documentation updates',
    ],
  },
  {
    id: 'data_analyst',
    name: 'Data Analyst',
    description: 'AI business intelligence analyst for data analysis and reporting',
    capabilities: [
      'data_processing',
      'visualization_creation',
      'insight_generation',
      'predictive_modeling',
    ],
    expertiseAreas: [
      'data_analysis',
      'statistical_modeling',
      'report_generation',
      'trend_identification',
    ],
    autonomyLevel: 'autonomous',
    estimatedCostPerMonth: 129.99,
    expectedTasks: ['Data analysis', 'Report generation', 'Trend analysis', 'Performance metrics'],
  },
  {
    id: 'project_manager',
    name: 'Project Manager',
    description: 'AI project coordinator for task management and team coordination',
    capabilities: ['task_assignment', 'progress_tracking', 'risk_assessment', 'status_reporting'],
    expertiseAreas: [
      'project_planning',
      'resource_allocation',
      'timeline_management',
      'stakeholder_communication',
    ],
    autonomyLevel: 'semi_autonomous',
    estimatedCostPerMonth: 109.99,
    expectedTasks: [
      'Project planning',
      'Task coordination',
      'Progress tracking',
      'Team communication',
    ],
  },
];

// Skills seeded onto a new AI employee based on its type.
export const DEFAULT_SKILLS_BY_TYPE: Record<string, string[]> = {
  sales_assistant: [
    'lead_qualification',
    'email_communication',
    'objection_handling',
    'product_knowledge',
  ],
  support_agent: [
    'technical_troubleshooting',
    'customer_communication',
    'issue_resolution',
    'documentation',
  ],
  data_analyst: ['data_analysis', 'statistical_modeling', 'report_generation', 'visualization'],
  project_manager: [
    'project_planning',
    'task_coordination',
    'stakeholder_communication',
    'risk_management',
  ],
};

// Maps a task_type to the employee_type best suited to handle it.
export const TASK_TYPE_TO_EMPLOYEE_TYPE: Record<string, string> = {
  lead_qualification: 'sales_assistant',
  email_outreach: 'sales_assistant',
  customer_support: 'support_agent',
  data_analysis: 'data_analyst',
  report_generation: 'data_analyst',
};
