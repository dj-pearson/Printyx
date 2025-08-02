import type { Express } from "express";
import { db } from "./db";
import { 
  salesGoals, 
  salesTeams, 
  salesTeamMembers, 
  activityReports,
  goalProgress,
  leadActivities,
  customerActivities,
  users,
  insertSalesGoalSchema,
  insertSalesTeamSchema,
  insertSalesTeamMemberSchema,
  type SalesGoal,
  type SalesTeam,
  type ActivityReport,
  type GoalProgress,
} from "@shared/schema";
import { eq, and, gte, lte, desc, asc, sql, count } from "drizzle-orm";
import { isAuthenticated } from "./replitAuth";

export function registerCrmGoalRoutes(app: Express) {
  // Sales Goals CRUD
  app.get("/api/crm/goals", isAuthenticated, async (req: any, res) => {
    try {
      const goals = await db
        .select({
          id: salesGoals.id,
          goalType: salesGoals.goalType,
          targetCount: salesGoals.targetCount,
          period: salesGoals.period,
          startDate: salesGoals.startDate,
          endDate: salesGoals.endDate,
          isActive: salesGoals.isActive,
          notes: salesGoals.notes,
          assignedToUserId: salesGoals.assignedToUserId,
          assignedToTeamId: salesGoals.assignedToTeamId,
          assignedBy: salesGoals.assignedBy,
          userName: users.firstName,
          userLastName: users.lastName,
          teamName: salesTeams.name,
        })
        .from(salesGoals)
        .leftJoin(users, eq(salesGoals.assignedToUserId, users.id))
        .leftJoin(salesTeams, eq(salesGoals.assignedToTeamId, salesTeams.id))
        .where(eq(salesGoals.tenantId, req.user.tenantId))
        .orderBy(desc(salesGoals.createdAt));

      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ error: "Failed to fetch goals" });
    }
  });

  app.post("/api/crm/goals", isAuthenticated, async (req: any, res) => {
    try {
      const goalData = insertSalesGoalSchema.parse({
        ...req.body,
        tenantId: req.user.tenantId,
        assignedBy: req.user.claims.sub,
      });

      const [goal] = await db
        .insert(salesGoals)
        .values(goalData)
        .returning();

      res.status(201).json(goal);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).json({ error: "Failed to create goal" });
    }
  });

  // Sales Teams CRUD
  app.get("/api/crm/teams", isAuthenticated, async (req: any, res) => {
    try {
      const teams = await db
        .select({
          id: salesTeams.id,
          name: salesTeams.name,
          description: salesTeams.description,
          teamLevel: salesTeams.teamLevel,
          territory: salesTeams.territory,
          isActive: salesTeams.isActive,
          managerId: salesTeams.managerId,
          managerName: users.firstName,
          managerLastName: users.lastName,
          memberCount: count(salesTeamMembers.id),
        })
        .from(salesTeams)
        .leftJoin(users, eq(salesTeams.managerId, users.id))
        .leftJoin(salesTeamMembers, and(
          eq(salesTeams.id, salesTeamMembers.teamId),
          eq(salesTeamMembers.isActive, true)
        ))
        .where(eq(salesTeams.tenantId, req.user.tenantId))
        .groupBy(salesTeams.id, users.firstName, users.lastName)
        .orderBy(asc(salesTeams.teamLevel), asc(salesTeams.name));

      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.post("/api/crm/teams", isAuthenticated, async (req: any, res) => {
    try {
      const teamData = insertSalesTeamSchema.parse({
        ...req.body,
        tenantId: req.user.tenantId,
      });

      const [team] = await db
        .insert(salesTeams)
        .values(teamData)
        .returning();

      res.status(201).json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  // Team Members
  app.get("/api/crm/teams/:teamId/members", isAuthenticated, async (req: any, res) => {
    try {
      const members = await db
        .select({
          id: salesTeamMembers.id,
          userId: salesTeamMembers.userId,
          role: salesTeamMembers.role,
          joinedDate: salesTeamMembers.joinedDate,
          isActive: salesTeamMembers.isActive,
          userName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
        })
        .from(salesTeamMembers)
        .innerJoin(users, eq(salesTeamMembers.userId, users.id))
        .where(and(
          eq(salesTeamMembers.teamId, req.params.teamId),
          eq(salesTeamMembers.tenantId, req.user.tenantId)
        ))
        .orderBy(asc(users.firstName));

      res.json(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  // Activity Reporting - Get aggregated stats
  app.get("/api/crm/activity-reports", isAuthenticated, async (req: any, res) => {
    try {
      const { period = 'weekly', userId, teamId, startDate, endDate } = req.query;
      
      let whereConditions = [eq(activityReports.tenantId, req.user.tenantId)];
      
      if (period) {
        whereConditions.push(eq(activityReports.period, period as any));
      }
      
      if (userId) {
        whereConditions.push(eq(activityReports.userId, userId as string));
      }
      
      if (teamId) {
        whereConditions.push(eq(activityReports.teamId, teamId as string));
      }
      
      if (startDate) {
        whereConditions.push(gte(activityReports.reportDate, new Date(startDate as string)));
      }
      
      if (endDate) {
        whereConditions.push(lte(activityReports.reportDate, new Date(endDate as string)));
      }

      const reports = await db
        .select({
          id: activityReports.id,
          userId: activityReports.userId,
          teamId: activityReports.teamId,
          reportDate: activityReports.reportDate,
          period: activityReports.period,
          totalCalls: activityReports.totalCalls,
          totalEmails: activityReports.totalEmails,
          totalMeetings: activityReports.totalMeetings,
          totalReachouts: activityReports.totalReachouts,
          totalProposals: activityReports.totalProposals,
          totalNewOpportunities: activityReports.totalNewOpportunities,
          connectedCalls: activityReports.connectedCalls,
          emailReplies: activityReports.emailReplies,
          meetingsScheduled: activityReports.meetingsScheduled,
          callConnectRate: activityReports.callConnectRate,
          emailReplyRate: activityReports.emailReplyRate,
          userName: users.firstName,
          userLastName: users.lastName,
          teamName: salesTeams.name,
        })
        .from(activityReports)
        .leftJoin(users, eq(activityReports.userId, users.id))
        .leftJoin(salesTeams, eq(activityReports.teamId, salesTeams.id))
        .where(and(...whereConditions))
        .orderBy(desc(activityReports.reportDate));

      res.json(reports);
    } catch (error) {
      console.error("Error fetching activity reports:", error);
      res.status(500).json({ error: "Failed to fetch activity reports" });
    }
  });

  // Goal Progress Tracking
  app.get("/api/crm/goal-progress", isAuthenticated, async (req: any, res) => {
    try {
      const { goalId, startDate, endDate } = req.query;
      
      let whereConditions = [eq(goalProgress.tenantId, req.user.tenantId)];
      
      if (goalId) {
        whereConditions.push(eq(goalProgress.goalId, goalId as string));
      }
      
      if (startDate) {
        whereConditions.push(gte(goalProgress.reportDate, new Date(startDate as string)));
      }
      
      if (endDate) {
        whereConditions.push(lte(goalProgress.reportDate, new Date(endDate as string)));
      }

      const progress = await db
        .select({
          id: goalProgress.id,
          goalId: goalProgress.goalId,
          reportDate: goalProgress.reportDate,
          currentCount: goalProgress.currentCount,
          targetCount: goalProgress.targetCount,
          progressPercentage: goalProgress.progressPercentage,
          dailyAverage: goalProgress.dailyAverage,
          projectedTotal: goalProgress.projectedTotal,
          onTrack: goalProgress.onTrack,
          goalType: salesGoals.goalType,
          goalPeriod: salesGoals.period,
          assignedUserName: users.firstName,
          assignedUserLastName: users.lastName,
          teamName: salesTeams.name,
        })
        .from(goalProgress)
        .innerJoin(salesGoals, eq(goalProgress.goalId, salesGoals.id))
        .leftJoin(users, eq(salesGoals.assignedToUserId, users.id))
        .leftJoin(salesTeams, eq(salesGoals.assignedToTeamId, salesTeams.id))
        .where(and(...whereConditions))
        .orderBy(desc(goalProgress.reportDate));

      res.json(progress);
    } catch (error) {
      console.error("Error fetching goal progress:", error);
      res.status(500).json({ error: "Failed to fetch goal progress" });
    }
  });

  // Generate Activity Report for a specific user/team and date
  app.post("/api/crm/generate-activity-report", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, teamId, reportDate, period } = req.body;
      
      // Calculate activity stats from lead_activities and customer_activities
      const startDate = new Date(reportDate);
      const endDate = new Date(reportDate);
      
      // Adjust date range based on period
      if (period === 'weekly') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (period === 'monthly') {
        startDate.setMonth(startDate.getMonth() - 1);
      }

      // Count activities from lead_activities table
      const leadActivitiesStats = await db
        .select({
          totalCalls: count(sql`CASE WHEN ${leadActivities.activityType} = 'call' THEN 1 END`),
          totalEmails: count(sql`CASE WHEN ${leadActivities.activityType} = 'email' THEN 1 END`),
          totalMeetings: count(sql`CASE WHEN ${leadActivities.activityType} = 'meeting' THEN 1 END`),
          connectedCalls: count(sql`CASE WHEN ${leadActivities.activityType} = 'call' AND ${leadActivities.callOutcome} = 'answered' THEN 1 END`),
          emailReplies: count(sql`CASE WHEN ${leadActivities.activityType} = 'email' AND ${leadActivities.outcome} = 'replied' THEN 1 END`),
        })
        .from(leadActivities)
        .where(and(
          eq(leadActivities.tenantId, req.user.tenantId),
          gte(leadActivities.createdAt, startDate),
          lte(leadActivities.createdAt, endDate),
          ...(userId ? [eq(leadActivities.createdBy, userId)] : [])
        ));

      // Count activities from customer_activities table
      const customerActivitiesStats = await db
        .select({
          totalCalls: count(sql`CASE WHEN ${customerActivities.activityType} = 'call' THEN 1 END`),
          totalEmails: count(sql`CASE WHEN ${customerActivities.activityType} = 'email' THEN 1 END`),
          totalMeetings: count(sql`CASE WHEN ${customerActivities.activityType} = 'meeting' THEN 1 END`),
          connectedCalls: count(sql`CASE WHEN ${customerActivities.activityType} = 'call' AND ${customerActivities.callOutcome} = 'answered' THEN 1 END`),
          emailReplies: count(sql`CASE WHEN ${customerActivities.activityType} = 'email' AND ${customerActivities.outcome} = 'replied' THEN 1 END`),
        })
        .from(customerActivities)
        .where(and(
          eq(customerActivities.tenantId, req.user.tenantId),
          gte(customerActivities.createdAt, startDate),
          lte(customerActivities.createdAt, endDate),
          ...(userId ? [eq(customerActivities.createdBy, userId)] : [])
        ));

      // Combine stats
      const totalCalls = (leadActivitiesStats[0]?.totalCalls || 0) + (customerActivitiesStats[0]?.totalCalls || 0);
      const totalEmails = (leadActivitiesStats[0]?.totalEmails || 0) + (customerActivitiesStats[0]?.totalEmails || 0);
      const totalMeetings = (leadActivitiesStats[0]?.totalMeetings || 0) + (customerActivitiesStats[0]?.totalMeetings || 0);
      const connectedCalls = (leadActivitiesStats[0]?.connectedCalls || 0) + (customerActivitiesStats[0]?.connectedCalls || 0);
      const emailReplies = (leadActivitiesStats[0]?.emailReplies || 0) + (customerActivitiesStats[0]?.emailReplies || 0);

      const reportData = {
        tenantId: req.user.tenantId,
        userId,
        teamId,
        reportDate: new Date(reportDate),
        period,
        totalCalls,
        totalEmails,
        totalMeetings,
        totalReachouts: totalCalls + totalEmails, // Combined calls + emails
        totalProposals: 0, // Would need to count from quotes table
        totalNewOpportunities: 0, // Would need to count new leads/deals
        connectedCalls,
        emailReplies,
        meetingsScheduled: 0, // Would need more complex logic
        callConnectRate: totalCalls > 0 ? ((connectedCalls / totalCalls) * 100) : 0,
        emailReplyRate: totalEmails > 0 ? ((emailReplies / totalEmails) * 100) : 0,
      };

      const [report] = await db
        .insert(activityReports)
        .values([reportData])
        .returning();

      res.status(201).json(report);
    } catch (error) {
      console.error("Error generating activity report:", error);
      res.status(500).json({ error: "Failed to generate activity report" });
    }
  });

  // Dashboard Summary Stats
  app.get("/api/crm/dashboard-stats", isAuthenticated, async (req: any, res) => {
    try {
      // Get active goals count
      const activeGoalsCount = await db
        .select({ count: count() })
        .from(salesGoals)
        .where(and(
          eq(salesGoals.tenantId, req.user.tenantId),
          eq(salesGoals.isActive, true)
        ));

      // Get teams count
      const teamsCount = await db
        .select({ count: count() })
        .from(salesTeams)
        .where(and(
          eq(salesTeams.tenantId, req.user.tenantId),
          eq(salesTeams.isActive, true)
        ));

      // Get team members count
      const membersCount = await db
        .select({ count: count() })
        .from(salesTeamMembers)
        .where(and(
          eq(salesTeamMembers.tenantId, req.user.tenantId),
          eq(salesTeamMembers.isActive, true)
        ));

      // Get recent activity reports count
      const recentReportsCount = await db
        .select({ count: count() })
        .from(activityReports)
        .where(and(
          eq(activityReports.tenantId, req.user.tenantId),
          gte(activityReports.reportDate, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) // Last 7 days
        ));

      res.json({
        activeGoals: activeGoalsCount[0]?.count || 0,
        activeTeams: teamsCount[0]?.count || 0,
        teamMembers: membersCount[0]?.count || 0,
        recentReports: recentReportsCount[0]?.count || 0,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });
}