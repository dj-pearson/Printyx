/**
 * Team Collaboration Service
 * Manages team coordination, project hierarchy, and collaborative scheduling
 */

import { db } from '../db';
import ClaudeAIService from './claude-ai-service';
import AdvancedSchedulingService from './advanced-scheduling-service';
import DynamicReschedulingService from './dynamic-rescheduling-service';
import { eq, and, sql, desc, asc, inArray, lt, isNotNull } from 'drizzle-orm';
import { users } from '../../shared/schema';
import { tasks as tasksTable } from '../../shared/task-schema';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('team-collaboration-service');

/**
 * A standard week. There is no per-user capacity column anywhere, so this is a
 * stated assumption rather than a measurement - which is why it lives here with
 * a name instead of as a 40 buried in an expression.
 */
const STANDARD_WEEK_HOURS = 40;

/** Policy: do not plan a person above 85% of their week. */
const RECOMMENDED_CAPACITY_RATIO = 0.85;

/**
 * Named on every capacity response, the way
 * supabase/functions/_shared/erp-integration-dashboard.ts names its own gaps.
 * A consumer that sees null here knows it is not measured, rather than guessing
 * whether zero means idle.
 */
const UNBACKED_CAPACITY_FIELDS = [
  'aiPredictedWorkload: nothing forecasts a workload',
  'aiEfficiencyScore: nothing measures individual efficiency',
  'totalCapacityHours: assumes a 40-hour week; no per-user capacity is recorded',
  'allocatedHours: sums tasks.estimated_hours, so unestimated tasks count as zero',
];

interface Team {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  teamType: 'department' | 'project' | 'cross_functional';
  managerId?: string;
  settings: Record<string, any>;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'manager' | 'lead' | 'member' | 'observer';
  permissions: string[];
  workloadCapacity: number; // 0.0-2.0
  hourlyRate?: number;
  skills: string[];
  availabilityPattern: Record<string, any>;
  joinedAt: Date;
  isActive: boolean;
}

interface Project {
  id: string;
  tenantId: string;
  parentProjectId?: string;
  teamId?: string;
  name: string;
  description?: string;
  projectType?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'asap' | 'high' | 'medium' | 'low';
  startDate?: Date;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours: number;
  completionPercentage: number;
  aiComplexityScore?: number;
  aiRiskScore?: number;
  aiResourceRequirements: Record<string, any>;
  aiTimelineConfidence?: number;
  clientId?: string;
  budget?: number;
  revenuePotential?: number;
  collaborationSettings: Record<string, any>;
  notificationSettings: Record<string, any>;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface TaskAssignment {
  id: string;
  taskId: string;
  projectId?: string;
  milestoneId?: string;
  assignedTo: string;
  assignedBy: string;
  assignmentType: 'primary' | 'collaborator' | 'reviewer' | 'observer';
  estimatedEffortHours?: number;
  actualEffortHours: number;
  workloadPercentage?: number;
  aiSkillMatchScore?: number;
  aiWorkloadOptimization?: number;
  aiSuggestedStartDate?: Date;
  aiSuggestedDurationDays?: number;
  status: 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'rejected';
  acceptedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface TeamCapacityAnalysis {
  teamId: string;
  userId: string;
  totalCapacityHours: number;
  allocatedHours: number;
  utilizationPercentage: number;
  /**
   * AUDIT-021: null, always. Nothing predicts a workload and nothing measures
   * an efficiency score - these were `allocatedHours * (1 + Math.random()*0.2)`
   * and `0.7 + Math.random()*0.3`, so they changed on every request, which is
   * exactly what real telemetry does. Kept as null fields rather than removed
   * so the shape stays stable, and named in `unbacked` on the response.
   */
  aiPredictedWorkload: null;
  aiEfficiencyScore: null;
  /** Derived: allocated hours exceed 90% of the standard week. */
  overAllocated: boolean;
  /** Policy, not a measurement: 85% of the standard week. */
  recommendedCapacityHours: number;
  projectsCount: number;
  tasksCount: number;
  overdueTasksCount: number;
}

interface CollaborationInsights {
  teamHealthScore: number;
  productivityTrend: 'improving' | 'stable' | 'declining';
  collaborationEffectiveness: number;
  communicationFrequency: number;
  knowledgeSharingScore: number;
  recommendations: string[];
  bottlenecks: Array<{
    type: string;
    description: string;
    impact: 'low' | 'medium' | 'high';
    solution: string;
  }>;
}

class TeamCollaborationService {
  /**
   * Create a new team
   */
  async createTeam(teamData: Partial<Team>): Promise<Team> {
    log.info('👥 Creating new team:', teamData.name);

    try {
      // Mock team creation - in production, this would use Drizzle ORM
      const team: Team = {
        id: `team-${Date.now()}`,
        tenantId: teamData.tenantId || 'mock-tenant',
        name: teamData.name || 'New Team',
        description: teamData.description,
        teamType: teamData.teamType || 'department',
        managerId: teamData.managerId,
        settings: teamData.settings || {},
        isActive: true,
        createdBy: teamData.createdBy || 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Initialize team with AI-suggested collaboration settings
      const aiSettings = await this.generateTeamAISettings(team);
      team.settings = { ...team.settings, ...aiSettings };

      log.info('✅ Team created successfully:', team.id);
      return team;
    } catch (error) {
      log.error('Failed to create team:', error);
      throw error;
    }
  }

  /**
   * Add member to team with AI-optimized role assignment
   */
  async addTeamMember(teamId: string, memberData: Partial<TeamMember>): Promise<TeamMember> {
    log.info('👤 Adding team member to team:', teamId);

    try {
      // Analyze optimal role and capacity for new member
      const optimalAssignment = await this.analyzeOptimalMemberAssignment(teamId, memberData);

      const member: TeamMember = {
        id: `member-${Date.now()}`,
        teamId,
        userId: memberData.userId || 'new-user',
        role: optimalAssignment.recommendedRole,
        permissions: optimalAssignment.recommendedPermissions,
        workloadCapacity: optimalAssignment.recommendedCapacity,
        hourlyRate: memberData.hourlyRate,
        skills: memberData.skills || [],
        availabilityPattern: memberData.availabilityPattern || {},
        joinedAt: new Date(),
        isActive: true,
      };

      // Trigger team rebalancing if needed
      if (optimalAssignment.rebalanceRequired) {
        await this.rebalanceTeamWorkload(teamId);
      }

      log.info('✅ Team member added:', member.id);
      return member;
    } catch (error) {
      log.error('Failed to add team member:', error);
      throw error;
    }
  }

  /**
   * Create project with AI-optimized planning
   */
  async createProject(projectData: Partial<Project>): Promise<Project> {
    log.info('📋 Creating new project:', projectData.name);

    try {
      // Use AI to analyze project complexity and requirements
      const aiAnalysis = await this.analyzeProjectWithAI(projectData);

      const project: Project = {
        id: `project-${Date.now()}`,
        tenantId: projectData.tenantId || 'mock-tenant',
        parentProjectId: projectData.parentProjectId,
        teamId: projectData.teamId,
        name: projectData.name || 'New Project',
        description: projectData.description,
        projectType: projectData.projectType,
        status: 'planning',
        priority: projectData.priority || 'medium',
        startDate: projectData.startDate,
        dueDate: projectData.dueDate,
        estimatedHours: aiAnalysis.estimatedHours,
        actualHours: 0,
        completionPercentage: 0,
        aiComplexityScore: aiAnalysis.complexityScore,
        aiRiskScore: aiAnalysis.riskScore,
        aiResourceRequirements: aiAnalysis.resourceRequirements,
        aiTimelineConfidence: aiAnalysis.timelineConfidence,
        clientId: projectData.clientId,
        budget: projectData.budget,
        revenuePotential: projectData.revenuePotential,
        collaborationSettings: aiAnalysis.collaborationSettings,
        notificationSettings: aiAnalysis.notificationSettings,
        createdBy: projectData.createdBy || 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Generate project milestones and tasks using AI
      await this.generateProjectStructureWithAI(project);

      log.info('✅ Project created with AI optimization:', project.id);
      return project;
    } catch (error) {
      log.error('Failed to create project:', error);
      throw error;
    }
  }

  /**
   * Optimize task assignments across team using AI
   */
  async optimizeTaskAssignments(
    tenantId: string,
    teamId: string,
    tasks: any[],
  ): Promise<TaskAssignment[]> {
    log.info('🎯 Optimizing task assignments for team:', teamId);

    try {
      // Get team members and their current workload
      const teamMembers = await this.getTeamMembers(tenantId, teamId);
      const currentCapacity = await this.analyzeTeamCapacity(tenantId, teamId);

      // Use AI to optimize assignments
      const optimizationPrompt = `Optimize task assignments for maximum efficiency:

Team Members: ${teamMembers.length}
Available Tasks: ${tasks.length}
Current Team Utilization: ${currentCapacity.averageUtilization === null ? 'not measured' : Math.round(currentCapacity.averageUtilization) + '%'}

Team Member Skills and Capacity:
${teamMembers.map((m) => `- ${m.userId}: Skills: ${m.skills.join(', ')}, Capacity: ${m.workloadCapacity}x, Current: ${currentCapacity.memberAnalytics[m.userId]?.utilizationPercentage || 0}%`).join('\n')}

Tasks to Assign:
${tasks.map((t) => `- ${t.title}: Priority: ${t.priority}, Est. Hours: ${t.estimatedDuration / 60}, Skills: ${t.requiredSkills?.join(', ') || 'general'}`).join('\n')}

Optimization Goals:
1. Balance workload across team members
2. Match tasks to member skills
3. Respect capacity limits
4. Minimize context switching
5. Consider priority and deadlines

Return JSON with assignments:
{
  "assignments": [
    {
      "taskId": "task-id",
      "assignedTo": "user-id", 
      "assignmentType": "primary",
      "estimatedEffortHours": 8,
      "workloadPercentage": 15,
      "skillMatchScore": 0.9,
      "reasoning": "Best skill match with available capacity"
    }
  ],
  "unassignedTasks": ["task-id-1"],
  "workloadBalance": 0.85,
  "recommendations": ["Consider hiring specialist for X", "Redistribute Y tasks"]
}`;

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: optimizationPrompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const optimization = JSON.parse(aiResponse);

      // Create task assignments based on AI recommendations
      const assignments: TaskAssignment[] = [];

      for (const assignment of optimization.assignments) {
        const taskAssignment: TaskAssignment = {
          id: `assignment-${Date.now()}-${Math.random()}`,
          taskId: assignment.taskId,
          projectId: tasks.find((t) => t.id === assignment.taskId)?.projectId,
          assignedTo: assignment.assignedTo,
          assignedBy: 'ai-optimizer',
          assignmentType: assignment.assignmentType,
          estimatedEffortHours: assignment.estimatedEffortHours,
          actualEffortHours: 0,
          workloadPercentage: assignment.workloadPercentage,
          aiSkillMatchScore: assignment.skillMatchScore,
          aiWorkloadOptimization: optimization.workloadBalance,
          status: 'assigned',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        assignments.push(taskAssignment);
      }

      log.info(`✅ Optimized ${assignments.length} task assignments`);
      return assignments;
    } catch (error) {
      log.error('Task assignment optimization failed:', error);
      return [];
    }
  }

  /**
   * Analyze team capacity and workload distribution
   */
  async analyzeTeamCapacity(
    tenantId: string,
    teamId: string,
  ): Promise<{
    averageUtilization: number | null;
    totalCapacity: number;
    allocatedCapacity: number;
    memberAnalytics: Record<string, TeamCapacityAnalysis>;
    bottlenecks: string[];
    recommendations: string[];
    unbacked: string[];
  }> {
    log.info('📊 Analyzing team capacity:', teamId);

    try {
      const teamMembers = await this.getTeamMembers(tenantId, teamId);
      const memberAnalytics: Record<string, TeamCapacityAnalysis> = {};

      let totalCapacity = 0;
      let totalAllocated = 0;

      // AUDIT-021. Every number below used to come from Math.random(): the
      // allocation itself, the task and project counts, the overdue count. The
      // method then read its own invented utilisation back out and recommended
      // "redistribute tasks from <user> to prevent burnout" - a claim about a
      // named person's workload, regenerated per request.
      //
      // tasks carries assigned_to, project_id, due_date, status and
      // estimated_hours, which is enough for all of it. Only two fields have no
      // source at all and they are null, not smaller guesses.
      const memberIds = teamMembers.map((m) => m.userId);
      const openTasks = memberIds.length
        ? await db
            .select({
              assignedTo: tasksTable.assignedTo,
              projectId: tasksTable.projectId,
              dueDate: tasksTable.dueDate,
              estimatedHours: tasksTable.estimatedHours,
            })
            .from(tasksTable)
            .where(
              and(
                eq(tasksTable.tenantId, tenantId),
                inArray(tasksTable.assignedTo, memberIds),
                inArray(tasksTable.status, ['todo', 'in_progress', 'review']),
              ),
            )
        : [];

      const now = new Date();

      for (const member of teamMembers) {
        // No per-user capacity column exists, so the standard week is a stated
        // assumption rather than a measurement, and workloadCapacity is 1.0 for
        // everyone until something records otherwise.
        const availableHours = STANDARD_WEEK_HOURS * member.workloadCapacity;
        const mine = openTasks.filter((t) => t.assignedTo === member.userId);

        // An unestimated task contributes 0 hours. That understates the load
        // rather than inventing an estimate for it.
        const allocatedHours = mine.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
        const projectIds = new Set(mine.map((t) => t.projectId).filter(Boolean));
        const overdue = mine.filter((t) => t.dueDate && t.dueDate < now).length;

        memberAnalytics[member.userId] = {
          teamId,
          userId: member.userId,
          totalCapacityHours: availableHours,
          allocatedHours,
          utilizationPercentage: availableHours > 0 ? (allocatedHours / availableHours) * 100 : 0,
          aiPredictedWorkload: null,
          aiEfficiencyScore: null,
          overAllocated: allocatedHours > availableHours * 0.9,
          recommendedCapacityHours: availableHours * RECOMMENDED_CAPACITY_RATIO,
          projectsCount: projectIds.size,
          tasksCount: mine.length,
          overdueTasksCount: overdue,
        };

        totalCapacity += availableHours;
        totalAllocated += allocatedHours;
      }

      // A team with no members has no utilisation. 0% would read as an idle
      // team, which is a different claim from 'nobody is on this team'.
      const averageUtilization = totalCapacity > 0 ? (totalAllocated / totalCapacity) * 100 : null;

      // Identify bottlenecks and generate recommendations
      const bottlenecks = [];
      const recommendations = [];

      for (const [userId, analytics] of Object.entries(memberAnalytics)) {
        if (analytics.utilizationPercentage > 90) {
          bottlenecks.push(
            `${userId} is over-utilized at ${Math.round(analytics.utilizationPercentage)}%`,
          );
          recommendations.push(`Redistribute tasks from ${userId} to prevent burnout`);
        }

        if (analytics.utilizationPercentage < 50) {
          recommendations.push(
            `${userId} has additional capacity for ${Math.round(analytics.totalCapacityHours - analytics.allocatedHours)} hours`,
          );
        }
      }

      return {
        averageUtilization,
        totalCapacity,
        allocatedCapacity: totalAllocated,
        memberAnalytics,
        bottlenecks,
        recommendations,
        unbacked: UNBACKED_CAPACITY_FIELDS,
      };
    } catch (error) {
      log.error('Team capacity analysis failed:', error);
      // A failed read is not an idle team. averageUtilization is null so the
      // caller can tell the two apart; it used to be 0.
      return {
        averageUtilization: null,
        totalCapacity: 0,
        allocatedCapacity: 0,
        memberAnalytics: {},
        bottlenecks: [],
        recommendations: [],
        unbacked: UNBACKED_CAPACITY_FIELDS,
      };
    }
  }

  /**
   * Generate collaboration insights using AI
   */
  async generateCollaborationInsights(
    tenantId: string,
    teamId: string,
  ): Promise<CollaborationInsights> {
    log.info('🧠 Generating collaboration insights for team:', teamId);

    try {
      // Get team performance data
      const capacityAnalysis = await this.analyzeTeamCapacity(tenantId, teamId);
      const teamMembers = await this.getTeamMembers(tenantId, teamId);
      const recentProjects = await this.getTeamProjects(teamId, {
        status: ['active', 'completed'],
        limit: 5,
      });

      // Use AI to analyze collaboration patterns
      const insightsPrompt = `Analyze team collaboration effectiveness:

Team Size: ${teamMembers.length} members
Average Utilization: ${capacityAnalysis.averageUtilization === null ? 'not measured' : Math.round(capacityAnalysis.averageUtilization) + '%'}
Active Projects: ${recentProjects.filter((p) => p.status === 'active').length}
Completed Projects: ${recentProjects.filter((p) => p.status === 'completed').length}

Team Member Roles:
${teamMembers.map((m) => `- ${m.role}: ${m.skills.length} skills, ${Math.round(m.workloadCapacity * 100)}% capacity`).join('\n')}

Current Bottlenecks:
${capacityAnalysis.bottlenecks.join('\n')}

Recent Project Performance:
${recentProjects.map((p) => `- ${p.name}: ${p.status}, ${p.completionPercentage}% complete`).join('\n')}

Analyze and return JSON:
{
  "teamHealthScore": 0.85,
  "productivityTrend": "improving",
  "collaborationEffectiveness": 0.78,
  "communicationFrequency": 12.5,
  "knowledgeSharingScore": 0.72,
  "recommendations": [
    "Improve knowledge sharing through documentation",
    "Consider cross-training for skill gaps"
  ],
  "bottlenecks": [
    {
      "type": "skill_gap",
      "description": "Limited expertise in X area",
      "impact": "medium",
      "solution": "Training or hiring specialist"
    }
  ]
}`;

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: insightsPrompt }],
        temperature: 0.4,
        max_tokens: 1500,
      });

      const insights = JSON.parse(aiResponse);

      log.info('✅ Generated collaboration insights:', insights.teamHealthScore);
      return insights;
    } catch (error) {
      log.error('Collaboration insights generation failed:', error);
      return {
        teamHealthScore: 0.7,
        productivityTrend: 'stable',
        collaborationEffectiveness: 0.7,
        communicationFrequency: 8.0,
        knowledgeSharingScore: 0.6,
        recommendations: ['Unable to generate insights - please try again'],
        bottlenecks: [],
      };
    }
  }

  /**
   * Coordinate cross-team dependencies
   */
  async coordinateCrossTeamDependencies(projectId: string): Promise<{
    dependencies: Array<{
      id: string;
      requestingTeam: string;
      providingTeam: string;
      dependencyType: string;
      status: string;
      neededByDate: Date;
      aiCoordinationScore: number;
    }>;
    coordinationPlan: string[];
    riskAssessment: Array<{
      risk: string;
      probability: number;
      impact: string;
      mitigation: string;
    }>;
  }> {
    log.info('🤝 Coordinating cross-team dependencies for project:', projectId);

    try {
      // Mock dependencies - in production, this would query the database
      const dependencies = [
        {
          id: 'dep-1',
          requestingTeam: 'Sales Team',
          providingTeam: 'Technical Team',
          dependencyType: 'technical_review',
          status: 'requested',
          neededByDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          aiCoordinationScore: 0.8,
        },
        {
          id: 'dep-2',
          requestingTeam: 'Technical Team',
          providingTeam: 'Service Team',
          dependencyType: 'resource_allocation',
          status: 'in_progress',
          neededByDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          aiCoordinationScore: 0.6,
        },
      ];

      // Generate coordination plan using AI
      const coordinationPrompt = `Create cross-team coordination plan:

Project Dependencies:
${dependencies.map((d) => `- ${d.requestingTeam} needs ${d.dependencyType} from ${d.providingTeam} by ${d.neededByDate.toISOString().split('T')[0]} (Status: ${d.status})`).join('\n')}

Generate coordination plan and risk assessment to ensure smooth collaboration.`;

      const aiResponse = await ClaudeAIService.generateCompletion({
        messages: [{ role: 'user', content: coordinationPrompt }],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const coordinationPlan = [
        'Schedule daily stand-ups between dependent teams',
        'Set up shared communication channels for real-time updates',
        'Create dependency tracking dashboard',
        'Establish escalation procedures for blocked dependencies',
      ];

      const riskAssessment = [
        {
          risk: 'Technical review delay',
          probability: 0.3,
          impact: 'medium',
          mitigation: 'Assign backup reviewer and set clear timeline',
        },
        {
          risk: 'Resource allocation conflict',
          probability: 0.4,
          impact: 'high',
          mitigation: 'Pre-allocate resources and create resource pool',
        },
      ];

      return {
        dependencies,
        coordinationPlan,
        riskAssessment,
      };
    } catch (error) {
      log.error('Cross-team coordination failed:', error);
      return {
        dependencies: [],
        coordinationPlan: ['Manual coordination required'],
        riskAssessment: [],
      };
    }
  }

  // Helper methods
  private async generateTeamAISettings(team: Team): Promise<Record<string, any>> {
    return {
      autoTaskAssignment: true,
      workloadBalancing: true,
      skillBasedAssignment: true,
      burnoutPrevention: true,
      collaborationOptimization: true,
    };
  }

  private async analyzeOptimalMemberAssignment(
    teamId: string,
    memberData: Partial<TeamMember>,
  ): Promise<{
    recommendedRole: 'manager' | 'lead' | 'member' | 'observer';
    recommendedPermissions: string[];
    recommendedCapacity: number;
    rebalanceRequired: boolean;
  }> {
    // Mock optimal assignment analysis
    return {
      recommendedRole: 'member',
      recommendedPermissions: ['view_tasks', 'edit_own_tasks', 'comment'],
      recommendedCapacity: 1.0,
      rebalanceRequired: false,
    };
  }

  private async analyzeProjectWithAI(projectData: Partial<Project>): Promise<{
    estimatedHours: number;
    complexityScore: number;
    riskScore: number;
    resourceRequirements: Record<string, any>;
    timelineConfidence: number;
    collaborationSettings: Record<string, any>;
    notificationSettings: Record<string, any>;
  }> {
    // Mock AI project analysis
    return {
      estimatedHours: 120,
      complexityScore: 7.5,
      riskScore: 4.2,
      resourceRequirements: { developers: 2, designers: 1, managers: 1 },
      timelineConfidence: 0.78,
      collaborationSettings: { dailyStandups: true, weeklyReviews: true },
      notificationSettings: { milestoneUpdates: true, taskAssignments: true },
    };
  }

  private async generateProjectStructureWithAI(project: Project): Promise<void> {
    log.info('🏗️  Generating project structure with AI for:', project.name);
    // This would create milestones and initial tasks
  }

  /**
   * The team's real members.
   *
   * AUDIT-021: this returned two hardcoded people, 'user-1' and 'user-2', with
   * invented skills and a 1.2 workload multiplier - so every per-member number
   * the capacity analysis produced was about someone who does not exist.
   * users.team_id is the real membership, and it is filtered by tenant here
   * because the callers take a teamId straight off the URL.
   *
   * Two fields have no column and are stated rather than invented:
   * workloadCapacity is 1.0 for everyone, and skills is empty. A skills list is
   * what optimizeTaskAssignments matches on, so an empty one is the honest
   * input - a fabricated one would have it assign work on made-up expertise.
   */
  private async getTeamMembers(tenantId: string, teamId: string): Promise<TeamMember[]> {
    const rows = await db
      .select({
        id: users.id,
        roleId: users.roleId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.teamId, teamId), eq(users.isActive, true)));

    return rows.map((r) => ({
      id: r.id,
      teamId,
      userId: r.id,
      role: 'member' as const,
      permissions: [],
      workloadCapacity: 1.0,
      skills: [],
      availabilityPattern: {},
      joinedAt: r.createdAt ?? new Date(),
      isActive: true,
    }));
  }

  private async getTeamProjects(teamId: string, filters: any): Promise<Project[]> {
    // Mock projects
    return [
      {
        id: 'project-1',
        tenantId: 'tenant-1',
        teamId,
        name: 'Q4 Sales Campaign',
        status: 'active',
        priority: 'high',
        completionPercentage: 75,
        actualHours: 80,
        aiComplexityScore: 6.5,
        aiRiskScore: 3.2,
        aiResourceRequirements: {},
        collaborationSettings: {},
        notificationSettings: {},
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  private async rebalanceTeamWorkload(teamId: string): Promise<void> {
    log.info('⚖️  Rebalancing team workload for team:', teamId);
    // This would trigger workload redistribution
  }
}

export default new TeamCollaborationService();
