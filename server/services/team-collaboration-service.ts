/**
 * Team Collaboration Service
 * Manages team coordination, project hierarchy, and collaborative scheduling
 */

import { db } from '../db';
import ClaudeAIService from './claude-ai-service';
import AdvancedSchedulingService from './advanced-scheduling-service';
import DynamicReschedulingService from './dynamic-rescheduling-service';
import { eq, and, sql, desc, asc } from 'drizzle-orm';

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
  aiPredictedWorkload: number;
  aiBurnoutRisk: number;
  aiEfficiencyScore: number;
  aiRecommendedCapacity: number;
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
    console.log('👥 Creating new team:', teamData.name);

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

      console.log('✅ Team created successfully:', team.id);
      return team;
    } catch (error) {
      console.error('Failed to create team:', error);
      throw error;
    }
  }

  /**
   * Add member to team with AI-optimized role assignment
   */
  async addTeamMember(teamId: string, memberData: Partial<TeamMember>): Promise<TeamMember> {
    console.log('👤 Adding team member to team:', teamId);

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

      console.log('✅ Team member added:', member.id);
      return member;
    } catch (error) {
      console.error('Failed to add team member:', error);
      throw error;
    }
  }

  /**
   * Create project with AI-optimized planning
   */
  async createProject(projectData: Partial<Project>): Promise<Project> {
    console.log('📋 Creating new project:', projectData.name);

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

      console.log('✅ Project created with AI optimization:', project.id);
      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  /**
   * Optimize task assignments across team using AI
   */
  async optimizeTaskAssignments(teamId: string, tasks: any[]): Promise<TaskAssignment[]> {
    console.log('🎯 Optimizing task assignments for team:', teamId);

    try {
      // Get team members and their current workload
      const teamMembers = await this.getTeamMembers(teamId);
      const currentCapacity = await this.analyzeTeamCapacity(teamId);

      // Use AI to optimize assignments
      const optimizationPrompt = `Optimize task assignments for maximum efficiency:

Team Members: ${teamMembers.length}
Available Tasks: ${tasks.length}
Current Team Utilization: ${Math.round(currentCapacity.averageUtilization)}%

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

      console.log(`✅ Optimized ${assignments.length} task assignments`);
      return assignments;
    } catch (error) {
      console.error('Task assignment optimization failed:', error);
      return [];
    }
  }

  /**
   * Analyze team capacity and workload distribution
   */
  async analyzeTeamCapacity(teamId: string): Promise<{
    averageUtilization: number;
    totalCapacity: number;
    allocatedCapacity: number;
    memberAnalytics: Record<string, TeamCapacityAnalysis>;
    bottlenecks: string[];
    recommendations: string[];
  }> {
    console.log('📊 Analyzing team capacity:', teamId);

    try {
      const teamMembers = await this.getTeamMembers(teamId);
      const memberAnalytics: Record<string, TeamCapacityAnalysis> = {};

      let totalCapacity = 0;
      let totalAllocated = 0;

      // Mock capacity analysis for each member
      for (const member of teamMembers) {
        const weeklyHours = 40; // Standard work week
        const availableHours = weeklyHours * member.workloadCapacity;
        const allocatedHours = Math.random() * availableHours; // Mock current allocation

        memberAnalytics[member.userId] = {
          teamId,
          userId: member.userId,
          totalCapacityHours: availableHours,
          allocatedHours,
          utilizationPercentage: (allocatedHours / availableHours) * 100,
          aiPredictedWorkload: allocatedHours * (1 + Math.random() * 0.2), // +0-20%
          aiBurnoutRisk: allocatedHours > availableHours * 0.9 ? 0.8 : 0.2,
          aiEfficiencyScore: 0.7 + Math.random() * 0.3, // 70-100%
          aiRecommendedCapacity: availableHours * 0.85, // 85% recommended max
          projectsCount: Math.floor(Math.random() * 5) + 1,
          tasksCount: Math.floor(Math.random() * 15) + 3,
          overdueTasksCount: Math.floor(Math.random() * 3),
        };

        totalCapacity += availableHours;
        totalAllocated += allocatedHours;
      }

      const averageUtilization = (totalAllocated / totalCapacity) * 100;

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
      };
    } catch (error) {
      console.error('Team capacity analysis failed:', error);
      return {
        averageUtilization: 0,
        totalCapacity: 0,
        allocatedCapacity: 0,
        memberAnalytics: {},
        bottlenecks: [],
        recommendations: [],
      };
    }
  }

  /**
   * Generate collaboration insights using AI
   */
  async generateCollaborationInsights(teamId: string): Promise<CollaborationInsights> {
    console.log('🧠 Generating collaboration insights for team:', teamId);

    try {
      // Get team performance data
      const capacityAnalysis = await this.analyzeTeamCapacity(teamId);
      const teamMembers = await this.getTeamMembers(teamId);
      const recentProjects = await this.getTeamProjects(teamId, {
        status: ['active', 'completed'],
        limit: 5,
      });

      // Use AI to analyze collaboration patterns
      const insightsPrompt = `Analyze team collaboration effectiveness:

Team Size: ${teamMembers.length} members
Average Utilization: ${Math.round(capacityAnalysis.averageUtilization)}%
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

      console.log('✅ Generated collaboration insights:', insights.teamHealthScore);
      return insights;
    } catch (error) {
      console.error('Collaboration insights generation failed:', error);
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
    console.log('🤝 Coordinating cross-team dependencies for project:', projectId);

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
      console.error('Cross-team coordination failed:', error);
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
    console.log('🏗️  Generating project structure with AI for:', project.name);
    // This would create milestones and initial tasks
  }

  private async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    // Mock team members
    return [
      {
        id: 'member-1',
        teamId,
        userId: 'user-1',
        role: 'manager',
        permissions: ['all'],
        workloadCapacity: 1.0,
        skills: ['leadership', 'sales', 'project_management'],
        availabilityPattern: {},
        joinedAt: new Date(),
        isActive: true,
      },
      {
        id: 'member-2',
        teamId,
        userId: 'user-2',
        role: 'member',
        permissions: ['view_tasks', 'edit_own_tasks'],
        workloadCapacity: 1.2,
        skills: ['technical', 'installation', 'troubleshooting'],
        availabilityPattern: {},
        joinedAt: new Date(),
        isActive: true,
      },
    ];
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
    console.log('⚖️  Rebalancing team workload for team:', teamId);
    // This would trigger workload redistribution
  }
}

export default new TeamCollaborationService();
