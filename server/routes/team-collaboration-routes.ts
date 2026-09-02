/**
 * Team Collaboration Routes
 * API endpoints for team management, project coordination, and collaborative scheduling
 */

import express from 'express';
import TeamCollaborationService from '../services/team-collaboration-service';
import { insertTeamSchema } from '@shared/schema';
import { createModuleLogger } from '../lib/logger';
import { getUserId, getTenantId } from '../utils/auth-helpers';
import { stripServerFields } from '../utils/strip-server-fields';
// CR-023: the documented error shape, { message, code, details, requestId }.
import { badRequest, serverError } from '../lib/error-response';
const log = createModuleLogger('team-collaboration-routes');

const router = express.Router();

/**
 * POST /api/teams
 * Create a new team
 */
router.post('/teams', async (req, res) => {
  try {
    // CR-008: whitelist body against the insert schema + strip server columns.
    const parsed = stripServerFields(insertTeamSchema.partial().parse(req.body ?? {}));
    const teamData = {
      ...parsed,
      tenantId: req.user!.tenantId,
      createdBy: req.user!.id,
    };

    const team = await TeamCollaborationService.createTeam(teamData);
    res.status(201).json(team);
  } catch (error) {
    log.error('Error creating team:', error);
    serverError(res, 'Failed to create team');
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
        tenantId: req.user!.tenantId,
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
        tenantId: req.user!.tenantId,
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
        tenantId: req.user!.tenantId,
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
    log.error('Error fetching teams:', error);
    serverError(res, 'Failed to fetch teams');
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
      tenantId: req.user!.tenantId,
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
    log.error('Error fetching team details:', error);
    serverError(res, 'Failed to fetch team details');
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
    log.error('Error adding team member:', error);
    serverError(res, 'Failed to add team member');
  }
});

/**
 * GET /api/teams/:teamId/capacity
 * Analyze team capacity and workload
 */
router.get('/teams/:teamId/capacity', async (req, res) => {
  try {
    const { teamId } = req.params;
    const tenantId = getTenantId(req);
    if (!tenantId) return badRequest(res, 'Tenant ID is required', { code: 'VALIDATION_ERROR' });

    // AUDIT-021: teamId comes straight off the URL, so the tenant has to reach
    // the query. Before this the analysis read no table at all, which is the
    // only reason an unscoped teamId was not already a cross-tenant read.
    const capacityAnalysis = await TeamCollaborationService.analyzeTeamCapacity(tenantId, teamId);
    res.json(capacityAnalysis);
  } catch (error) {
    log.error('Error analyzing team capacity:', error);
    serverError(res, 'Failed to analyze team capacity');
  }
});

/**
 * GET /api/teams/:teamId/insights
 * Get AI-powered collaboration insights
 */
router.get('/teams/:teamId/insights', async (req, res) => {
  try {
    const { teamId } = req.params;
    const tenantId = getTenantId(req);
    if (!tenantId) return badRequest(res, 'Tenant ID is required', { code: 'VALIDATION_ERROR' });

    const insights = await TeamCollaborationService.generateCollaborationInsights(tenantId, teamId);
    res.json(insights);
  } catch (error) {
    log.error('Error generating collaboration insights:', error);
    serverError(res, 'Failed to generate collaboration insights');
  }
});

// GET and POST /api/projects REMOVED (AUDIT-021 follow-up).
//
// Both were mocks - a hardcoded 'Q4 Enterprise Sales Campaign' - and both
// were dead: server/routes-tasks.ts registers the same two paths over the real
// projects table at routes-registry:400, and this router mounts at :620, so
// Express matched routes-tasks and never reached these. check:dup-routes could
// not see the collision because this router is mounted at the /api ROOT and
// declares router.get('/projects'), with no /api prefix for the guard to
// anchor on. It resolves mount prefixes now.
//
// The remaining /projects/:projectId, /teams and /collaboration handlers in
// this file are still mocks. They have no caller and no real counterpart, so
// they are a separate decision rather than a deletion.

// GET /api/projects/:projectId REMOVED (WF-P-07).
//
// It was a mock - the same hardcoded 'Q4 Enterprise Sales Campaign' the list
// handlers above returned before AUDIT-021 deleted them - and it had no caller.
// WF-P-07 gave server/routes-tasks.ts a REAL GET /api/projects/:id over the
// projects table, and that file registers at routes-registry:401 while this
// router mounts at :620, so Express would have matched the real one and never
// reached this. Deleted rather than left to be found later as a live-looking
// handler that never runs.
//
// /projects/:projectId/assignments/optimize and /projects/:projectId/dependencies
// below are three-segment paths, so the new :id route does not touch them. They
// are still mocks with no caller.

/**
 * POST /api/projects/:projectId/assignments/optimize
 * Optimize task assignments for a project
 */
router.post('/projects/:projectId/assignments/optimize', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { tasks, teamId } = req.body;

    if (!tasks || !Array.isArray(tasks)) {
      return badRequest(res, 'Tasks array is required', { code: 'VALIDATION_ERROR' });
    }

    const tenantId = getTenantId(req);
    if (!tenantId) return badRequest(res, 'Tenant ID is required', { code: 'VALIDATION_ERROR' });
    if (!teamId) return badRequest(res, 'teamId is required', { code: 'VALIDATION_ERROR' });

    // The default used to be the literal 'team-1', which matched the hardcoded
    // members getTeamMembers returned. With a real membership read that default
    // silently analyses a team nobody belongs to, so it is a 400 instead.
    const assignments = await TeamCollaborationService.optimizeTaskAssignments(
      tenantId,
      teamId,
      tasks,
    );
    res.json(assignments);
  } catch (error) {
    log.error('Error optimizing task assignments:', error);
    serverError(res, 'Failed to optimize task assignments');
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
    log.error('Error fetching project dependencies:', error);
    serverError(res, 'Failed to fetch project dependencies');
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
    log.error('Error fetching project templates:', error);
    serverError(res, 'Failed to fetch project templates');
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
    log.error('Error fetching collaboration analytics:', error);
    serverError(res, 'Failed to fetch collaboration analytics');
  }
});

export default router;
