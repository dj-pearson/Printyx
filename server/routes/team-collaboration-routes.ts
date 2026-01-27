/**
 * Team Collaboration Routes
 * API endpoints for team management, project coordination, and collaborative scheduling
 */

import express from 'express';
import TeamCollaborationService from '../services/team-collaboration-service';

const router = express.Router();

// Mock authentication middleware
const requireAuth = (req: any, res: any, next: any) => {
  req.user = { id: 'mock-user-id', tenantId: 'mock-tenant-id' };
  next();
};

/**
 * POST /api/teams
 * Create a new team
 */
router.post('/teams', async (req, res) => {
  try {
    const teamData = {
      ...req.body,
      tenantId: req.user.tenant_id,
      createdBy: req.user.id,
    };

    const team = await TeamCollaborationService.createTeam(teamData);
    res.status(201).json(team);
  } catch (error) {
    console.error('Error creating team:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
});

/**
 * GET /api/teams
 * Get teams for current tenant
 */
router.get('/teams', async (req, res) => {
  try {
    // Mock teams data
    const teams = [
      {
        id: 'team-1',
        tenantId: req.user.tenant_id,
        name: 'Sales Team',
        description: 'Primary sales and business development team',
        teamType: 'department',
        managerId: 'user-manager-1',
        memberCount: 8,
        activeProjects: 12,
        settings: {
          autoTaskAssignment: true,
          workloadBalancing: true,
          skillBasedAssignment: true,
        },
        performance: {
          teamHealthScore: 0.87,
          averageUtilization: 78,
          completionRate: 0.92,
        },
        isActive: true,
        createdAt: new Date('2025-01-15'),
        updatedAt: new Date(),
      },
      {
        id: 'team-2',
        tenantId: req.user.tenant_id,
        name: 'Technical Services',
        description: 'Installation, maintenance, and technical support',
        teamType: 'department',
        managerId: 'user-manager-2',
        memberCount: 12,
        activeProjects: 8,
        settings: {
          autoTaskAssignment: true,
          workloadBalancing: true,
          skillBasedAssignment: true,
        },
        performance: {
          teamHealthScore: 0.91,
          averageUtilization: 85,
          completionRate: 0.89,
        },
        isActive: true,
        createdAt: new Date('2025-01-10'),
        updatedAt: new Date(),
      },
      {
        id: 'team-3',
        tenantId: req.user.tenant_id,
        name: 'Customer Success',
        description: 'Customer onboarding and relationship management',
        teamType: 'department',
        managerId: 'user-manager-3',
        memberCount: 6,
        activeProjects: 15,
        settings: {
          autoTaskAssignment: true,
          workloadBalancing: true,
          skillBasedAssignment: false,
        },
        performance: {
          teamHealthScore: 0.83,
          averageUtilization: 72,
          completionRate: 0.95,
        },
        isActive: true,
        createdAt: new Date('2025-02-01'),
        updatedAt: new Date(),
      },
    ];

    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

/**
 * GET /api/teams/:teamId
 * Get team details
 */
router.get('/teams/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;

    // Mock detailed team data
    const team = {
      id: teamId,
      tenantId: req.user.tenant_id,
      name: 'Sales Team',
      description: 'Primary sales and business development team',
      teamType: 'department',
      managerId: 'user-manager-1',
      settings: {
        autoTaskAssignment: true,
        workloadBalancing: true,
        skillBasedAssignment: true,
        burnoutPrevention: true,
        collaborationOptimization: true,
      },
      members: [
        {
          id: 'member-1',
          userId: 'user-1',
          name: 'John Smith',
          role: 'manager',
          permissions: ['all'],
          workloadCapacity: 1.0,
          hourlyRate: 75.0,
          skills: ['leadership', 'sales', 'project_management', 'negotiation'],
          currentUtilization: 82,
          activeTasksCount: 6,
          joinedAt: new Date('2025-01-15'),
          isActive: true,
        },
        {
          id: 'member-2',
          userId: 'user-2',
          name: 'Sarah Johnson',
          role: 'lead',
          permissions: ['manage_tasks', 'assign_tasks', 'view_reports'],
          workloadCapacity: 1.1,
          hourlyRate: 65.0,
          skills: ['sales', 'customer_relations', 'proposal_writing', 'presentation'],
          currentUtilization: 75,
          activeTasksCount: 8,
          joinedAt: new Date('2025-01-20'),
          isActive: true,
        },
        {
          id: 'member-3',
          userId: 'user-3',
          name: 'Mike Chen',
          role: 'member',
          permissions: ['view_tasks', 'edit_own_tasks', 'comment'],
          workloadCapacity: 0.9,
          hourlyRate: 55.0,
          skills: ['sales', 'technical_sales', 'product_knowledge'],
          currentUtilization: 68,
          activeTasksCount: 5,
          joinedAt: new Date('2025-02-01'),
          isActive: true,
        },
      ],
      performance: {
        teamHealthScore: 0.87,
        productivityTrend: 'improving',
        collaborationEffectiveness: 0.84,
        communicationFrequency: 14.2,
        knowledgeSharingScore: 0.79,
        averageUtilization: 75,
        completionRate: 0.92,
        onTimeDeliveryRate: 0.88,
      },
      isActive: true,
      createdAt: new Date('2025-01-15'),
      updatedAt: new Date(),
    };

    res.json(team);
  } catch (error) {
    console.error('Error fetching team details:', error);
    res.status(500).json({ error: 'Failed to fetch team details' });
  }
});

/**
 * POST /api/teams/:teamId/members
 * Add member to team
 */
router.post('/teams/:teamId/members', async (req, res) => {
  try {
    const { teamId } = req.params;
    const memberData = req.body;

    const member = await TeamCollaborationService.addTeamMember(teamId, memberData);
    res.status(201).json(member);
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

/**
 * GET /api/teams/:teamId/capacity
 * Analyze team capacity and workload
 */
router.get('/teams/:teamId/capacity', async (req, res) => {
  try {
    const { teamId } = req.params;

    const capacityAnalysis = await TeamCollaborationService.analyzeTeamCapacity(teamId);
    res.json(capacityAnalysis);
  } catch (error) {
    console.error('Error analyzing team capacity:', error);
    res.status(500).json({ error: 'Failed to analyze team capacity' });
  }
});

/**
 * GET /api/teams/:teamId/insights
 * Get AI-powered collaboration insights
 */
router.get('/teams/:teamId/insights', async (req, res) => {
  try {
    const { teamId } = req.params;

    const insights = await TeamCollaborationService.generateCollaborationInsights(teamId);
    res.json(insights);
  } catch (error) {
    console.error('Error generating collaboration insights:', error);
    res.status(500).json({ error: 'Failed to generate collaboration insights' });
  }
});

/**
 * POST /api/projects
 * Create a new project
 */
router.post('/projects', async (req, res) => {
  try {
    const projectData = {
      ...req.body,
      tenantId: req.user.tenant_id,
      createdBy: req.user.id,
    };

    const project = await TeamCollaborationService.createProject(projectData);
    res.status(201).json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * GET /api/projects
 * Get projects for current tenant
 */
router.get('/projects', async (req, res) => {
  try {
    const { status, teamId, priority } = req.query;

    // Mock projects data
    const projects = [
      {
        id: 'project-1',
        tenantId: req.user.tenant_id,
        parentProjectId: null,
        teamId: 'team-1',
        teamName: 'Sales Team',
        name: 'Q4 Enterprise Sales Campaign',
        description: 'Large enterprise client acquisition campaign for Q4',
        projectType: 'sales',
        status: 'active',
        priority: 'high',
        startDate: new Date('2025-09-01'),
        dueDate: new Date('2025-12-31'),
        estimatedHours: 320,
        actualHours: 180,
        completionPercentage: 56,
        aiComplexityScore: 8.2,
        aiRiskScore: 4.1,
        aiTimelineConfidence: 0.78,
        clientId: 'client-enterprise-1',
        budget: 150000,
        revenuePotential: 2500000,
        milestones: [
          { name: 'Market Research', status: 'completed', dueDate: '2025-09-15' },
          { name: 'Lead Generation', status: 'in_progress', dueDate: '2025-10-15' },
          { name: 'Proposal Phase', status: 'pending', dueDate: '2025-11-15' },
          { name: 'Contract Negotiation', status: 'pending', dueDate: '2025-12-15' },
        ],
        assignedMembers: 5,
        createdAt: new Date('2025-08-15'),
        updatedAt: new Date(),
      },
      {
        id: 'project-2',
        tenantId: req.user.tenant_id,
        parentProjectId: null,
        teamId: 'team-2',
        teamName: 'Technical Services',
        name: 'Copier Fleet Modernization',
        description: 'Upgrade client copier fleet to latest models with advanced features',
        projectType: 'service',
        status: 'active',
        priority: 'medium',
        startDate: new Date('2025-09-10'),
        dueDate: new Date('2025-11-30'),
        estimatedHours: 240,
        actualHours: 95,
        completionPercentage: 40,
        aiComplexityScore: 6.8,
        aiRiskScore: 3.5,
        aiTimelineConfidence: 0.85,
        clientId: 'client-corp-2',
        budget: 85000,
        revenuePotential: 180000,
        milestones: [
          { name: 'Site Assessment', status: 'completed', dueDate: '2025-09-20' },
          { name: 'Equipment Ordering', status: 'in_progress', dueDate: '2025-10-05' },
          { name: 'Installation Phase 1', status: 'pending', dueDate: '2025-10-25' },
          { name: 'Installation Phase 2', status: 'pending', dueDate: '2025-11-15' },
          { name: 'Training & Handover', status: 'pending', dueDate: '2025-11-30' },
        ],
        assignedMembers: 8,
        createdAt: new Date('2025-08-25'),
        updatedAt: new Date(),
      },
      {
        id: 'project-3',
        tenantId: req.user.tenant_id,
        parentProjectId: null,
        teamId: 'team-3',
        teamName: 'Customer Success',
        name: 'New Client Onboarding Program',
        description: 'Streamlined onboarding process for new enterprise clients',
        projectType: 'service',
        status: 'planning',
        priority: 'medium',
        startDate: new Date('2025-10-01'),
        dueDate: new Date('2025-12-01'),
        estimatedHours: 160,
        actualHours: 12,
        completionPercentage: 8,
        aiComplexityScore: 5.5,
        aiRiskScore: 2.8,
        aiTimelineConfidence: 0.92,
        clientId: null, // Internal project
        budget: 45000,
        revenuePotential: 0, // Internal efficiency project
        milestones: [
          { name: 'Process Design', status: 'in_progress', dueDate: '2025-10-15' },
          { name: 'Documentation', status: 'pending', dueDate: '2025-10-30' },
          { name: 'Team Training', status: 'pending', dueDate: '2025-11-15' },
          { name: 'Pilot Program', status: 'pending', dueDate: '2025-11-30' },
        ],
        assignedMembers: 4,
        createdAt: new Date('2025-09-20'),
        updatedAt: new Date(),
      },
    ].filter((p) => {
      if (status && p.status !== status) return false;
      if (teamId && p.teamId !== teamId) return false;
      if (priority && p.priority !== priority) return false;
      return true;
    });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * GET /api/projects/:projectId
 * Get project details
 */
router.get('/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Mock detailed project data
    const project = {
      id: projectId,
      tenantId: req.user.tenant_id,
      teamId: 'team-1',
      teamName: 'Sales Team',
      name: 'Q4 Enterprise Sales Campaign',
      description: 'Large enterprise client acquisition campaign targeting Fortune 500 companies',
      projectType: 'sales',
      status: 'active',
      priority: 'high',
      startDate: new Date('2025-09-01'),
      dueDate: new Date('2025-12-31'),
      estimatedHours: 320,
      actualHours: 180,
      completionPercentage: 56,

      // AI insights
      aiComplexityScore: 8.2,
      aiRiskScore: 4.1,
      aiTimelineConfidence: 0.78,
      aiResourceRequirements: {
        salesReps: 3,
        salesEngineers: 2,
        marketingSupport: 1,
        projectManager: 1,
      },

      // Business context
      clientId: 'client-enterprise-1',
      clientName: 'Global Manufacturing Corp',
      budget: 150000,
      revenuePotential: 2500000,

      // Milestones with AI insights
      milestones: [
        {
          id: 'milestone-1',
          name: 'Market Research & Target Identification',
          description: 'Research target accounts and decision makers',
          status: 'completed',
          completionPercentage: 100,
          dueDate: new Date('2025-09-15'),
          actualCompletionDate: new Date('2025-09-12'),
          aiCriticalPath: true,
          aiDelayRisk: 0.1,
          tasks: 8,
          completedTasks: 8,
        },
        {
          id: 'milestone-2',
          name: 'Lead Generation & Initial Outreach',
          description: 'Generate qualified leads and initiate contact',
          status: 'in_progress',
          completionPercentage: 75,
          dueDate: new Date('2025-10-15'),
          aiCriticalPath: true,
          aiDelayRisk: 0.3,
          tasks: 12,
          completedTasks: 9,
        },
        {
          id: 'milestone-3',
          name: 'Proposal Development',
          description: 'Create customized proposals for qualified prospects',
          status: 'pending',
          completionPercentage: 0,
          dueDate: new Date('2025-11-15'),
          aiCriticalPath: true,
          aiDelayRisk: 0.4,
          tasks: 15,
          completedTasks: 0,
        },
        {
          id: 'milestone-4',
          name: 'Contract Negotiation & Closing',
          description: 'Negotiate terms and close deals',
          status: 'pending',
          completionPercentage: 0,
          dueDate: new Date('2025-12-15'),
          aiCriticalPath: true,
          aiDelayRisk: 0.5,
          tasks: 10,
          completedTasks: 0,
        },
      ],

      // Team assignments
      assignments: [
        {
          userId: 'user-1',
          name: 'John Smith',
          role: 'Project Lead',
          assignmentType: 'primary',
          estimatedEffortHours: 80,
          actualEffortHours: 45,
          workloadPercentage: 25,
          aiSkillMatchScore: 0.95,
        },
        {
          userId: 'user-2',
          name: 'Sarah Johnson',
          role: 'Senior Sales Rep',
          assignmentType: 'primary',
          estimatedEffortHours: 120,
          actualEffortHours: 68,
          workloadPercentage: 35,
          aiSkillMatchScore: 0.88,
        },
        {
          userId: 'user-3',
          name: 'Mike Chen',
          role: 'Sales Engineer',
          assignmentType: 'collaborator',
          estimatedEffortHours: 60,
          actualEffortHours: 32,
          workloadPercentage: 20,
          aiSkillMatchScore: 0.92,
        },
      ],

      // Collaboration settings
      collaborationSettings: {
        dailyStandups: true,
        weeklyReviews: true,
        milestoneNotifications: true,
        autoTaskAssignment: true,
      },

      // Recent activity
      recentActivity: [
        {
          type: 'milestone_progress',
          description: 'Lead Generation milestone reached 75% completion',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          userId: 'user-2',
        },
        {
          type: 'task_completed',
          description: 'Completed prospect research for 5 target accounts',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
          userId: 'user-3',
        },
        {
          type: 'comment',
          description: 'Added notes from client discovery call',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
          userId: 'user-2',
        },
      ],

      createdBy: 'user-1',
      createdAt: new Date('2025-08-15'),
      updatedAt: new Date(),
    };

    res.json(project);
  } catch (error) {
    console.error('Error fetching project details:', error);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

/**
 * POST /api/projects/:projectId/assignments/optimize
 * Optimize task assignments for a project
 */
router.post('/projects/:projectId/assignments/optimize', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tasks, teamId } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'Tasks array is required' });
    }

    const assignments = await TeamCollaborationService.optimizeTaskAssignments(
      teamId || 'team-1',
      tasks,
    );
    res.json(assignments);
  } catch (error) {
    console.error('Error optimizing task assignments:', error);
    res.status(500).json({ error: 'Failed to optimize task assignments' });
  }
});

/**
 * GET /api/projects/:projectId/dependencies
 * Get cross-team dependencies for a project
 */
router.get('/projects/:projectId/dependencies', async (req, res) => {
  try {
    const { projectId } = req.params;

    const dependencyData =
      await TeamCollaborationService.coordinateCrossTeamDependencies(projectId);
    res.json(dependencyData);
  } catch (error) {
    console.error('Error fetching project dependencies:', error);
    res.status(500).json({ error: 'Failed to fetch project dependencies' });
  }
});

/**
 * GET /api/collaboration/templates
 * Get project templates
 */
router.get('/collaboration/templates', async (req, res) => {
  try {
    const { category } = req.query;

    // Mock project templates
    const templates = [
      {
        id: 'template-1',
        name: 'Sales Opportunity',
        description: 'Standard sales opportunity project template',
        category: 'sales',
        estimatedDurationDays: 18,
        estimatedHours: 32,
        requiredSkills: ['sales', 'communication', 'proposal_writing'],
        usageCount: 47,
        successRate: 0.84,
        milestones: [
          { name: 'Initial Contact', estimatedDays: 1 },
          { name: 'Needs Assessment', estimatedDays: 3 },
          { name: 'Proposal Creation', estimatedDays: 7 },
          { name: 'Negotiation', estimatedDays: 5 },
          { name: 'Contract Signing', estimatedDays: 2 },
        ],
        tasks: [
          { name: 'Research prospect', estimatedHours: 2, skills: ['research'] },
          { name: 'Schedule discovery call', estimatedHours: 1, skills: ['communication'] },
          { name: 'Create proposal', estimatedHours: 8, skills: ['proposal_writing'] },
          { name: 'Follow up', estimatedHours: 1, skills: ['communication'] },
        ],
      },
      {
        id: 'template-2',
        name: 'Service Installation',
        description: 'Equipment installation and setup project',
        category: 'service',
        estimatedDurationDays: 10,
        estimatedHours: 16,
        requiredSkills: ['technical', 'installation', 'training'],
        usageCount: 32,
        successRate: 0.91,
        milestones: [
          { name: 'Site Survey', estimatedDays: 2 },
          { name: 'Equipment Delivery', estimatedDays: 5 },
          { name: 'Installation', estimatedDays: 1 },
          { name: 'Testing & Training', estimatedDays: 1 },
          { name: 'Go Live', estimatedDays: 1 },
        ],
        tasks: [
          { name: 'Conduct site survey', estimatedHours: 4, skills: ['technical'] },
          { name: 'Order equipment', estimatedHours: 1, skills: ['procurement'] },
          { name: 'Install equipment', estimatedHours: 6, skills: ['installation'] },
          { name: 'Test system', estimatedHours: 2, skills: ['technical'] },
          { name: 'Train users', estimatedHours: 3, skills: ['training'] },
        ],
      },
      {
        id: 'template-3',
        name: 'Customer Onboarding',
        description: 'New customer onboarding process',
        category: 'service',
        estimatedDurationDays: 11,
        estimatedHours: 17,
        requiredSkills: ['customer_service', 'training', 'technical_support'],
        usageCount: 28,
        successRate: 0.89,
        milestones: [
          { name: 'Welcome Package', estimatedDays: 1 },
          { name: 'Account Setup', estimatedDays: 2 },
          { name: 'Training', estimatedDays: 3 },
          { name: 'Go Live Support', estimatedDays: 5 },
        ],
        tasks: [
          { name: 'Send welcome materials', estimatedHours: 1, skills: ['customer_service'] },
          { name: 'Set up account', estimatedHours: 3, skills: ['technical_support'] },
          { name: 'Schedule training', estimatedHours: 1, skills: ['coordination'] },
          { name: 'Conduct training', estimatedHours: 4, skills: ['training'] },
          { name: 'Provide go-live support', estimatedHours: 8, skills: ['technical_support'] },
        ],
      },
    ].filter((t) => !category || t.category === category);

    res.json(templates);
  } catch (error) {
    console.error('Error fetching project templates:', error);
    res.status(500).json({ error: 'Failed to fetch project templates' });
  }
});

/**
 * GET /api/collaboration/analytics
 * Get collaboration analytics and insights
 */
router.get('/collaboration/analytics', async (req, res) => {
  try {
    const { timeRange = 'month' } = req.query;

    // Mock collaboration analytics
    const analytics = {
      timeRange,
      overview: {
        totalTeams: 3,
        activeProjects: 35,
        completedProjects: 127,
        totalTeamMembers: 26,
        averageTeamSize: 8.7,
      },
      teamPerformance: {
        averageTeamHealthScore: 0.87,
        topPerformingTeam: {
          id: 'team-2',
          name: 'Technical Services',
          healthScore: 0.91,
          completionRate: 0.89,
        },
        improvementOpportunities: [
          {
            teamId: 'team-3',
            teamName: 'Customer Success',
            issue: 'Communication frequency below optimal',
            recommendation: 'Implement daily stand-ups',
            impact: 'medium',
          },
        ],
      },
      projectMetrics: {
        onTimeDeliveryRate: 0.86,
        averageProjectDuration: 42, // days
        budgetVariance: -5.2, // % under budget
        resourceUtilization: 0.78,
        clientSatisfactionScore: 4.6, // out of 5
      },
      collaborationMetrics: {
        crossTeamProjects: 8,
        dependencyResolutionTime: 2.3, // days
        knowledgeSharingScore: 0.74,
        communicationEffectiveness: 0.81,
        conflictResolutionTime: 1.8, // days
      },
      aiInsights: [
        'Teams with daily stand-ups show 23% higher completion rates',
        'Cross-functional projects have 15% higher client satisfaction',
        'Skill-based task assignment improves efficiency by 18%',
        'Teams with balanced workload have 31% lower burnout rates',
      ],
      recommendations: [
        'Implement skill-based automatic task assignment across all teams',
        'Create cross-team communication channels for better coordination',
        'Establish mentorship programs to improve knowledge sharing',
        'Use AI-powered workload balancing to prevent team member burnout',
      ],
      trends: {
        teamHealthTrend: 'improving',
        productivityTrend: 'stable',
        collaborationTrend: 'improving',
        projectSuccessTrend: 'improving',
      },
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching collaboration analytics:', error);
    res.status(500).json({ error: 'Failed to fetch collaboration analytics' });
  }
});

export default router;
