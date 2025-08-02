import type { Express } from "express";
import { db } from "./db";
import { 
  salesGoals, 
  salesTeams, 
  salesTeamMembers, 
  activityReports,
  goalProgress,
  salesMetrics,
  conversionFunnel,
  managerInsights,
  leadActivities,
  customerActivities,
  users,
  insertSalesGoalSchema,
  insertSalesTeamSchema,
  insertSalesTeamMemberSchema,
  insertSalesMetricsSchema,
  insertConversionFunnelSchema,
  insertManagerInsightsSchema,
  type SalesGoal,
  type SalesTeam,
  type ActivityReport,
  type GoalProgress,
  type SalesMetrics,
  type ConversionFunnel,
  type ManagerInsight,
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

  // Sales Metrics & Analytics Routes
  app.get("/api/crm/analytics/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const { period = 'monthly', userId, teamId } = req.query;
      
      const metrics = await db
        .select()
        .from(salesMetrics)
        .where(
          and(
            eq(salesMetrics.tenantId, req.user.tenantId),
            eq(salesMetrics.metricPeriod, period),
            userId ? eq(salesMetrics.userId, userId) : undefined,
            teamId ? eq(salesMetrics.teamId, teamId) : undefined
          )
        )
        .orderBy(desc(salesMetrics.periodStartDate));

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching sales metrics:", error);
      res.status(500).json({ error: "Failed to fetch sales metrics" });
    }
  });

  app.post("/api/crm/analytics/metrics", isAuthenticated, async (req: any, res) => {
    try {
      const metricsData = insertSalesMetricsSchema.parse({
        ...req.body,
        tenantId: req.user.tenantId,
      });

      const [metrics] = await db
        .insert(salesMetrics)
        .values(metricsData)
        .returning();

      res.status(201).json(metrics);
    } catch (error) {
      console.error("Error creating sales metrics:", error);
      res.status(500).json({ error: "Failed to create sales metrics" });
    }
  });

  // Conversion Funnel Analytics
  app.get("/api/crm/analytics/conversion-funnel", isAuthenticated, async (req: any, res) => {
    try {
      const { period = 'monthly', userId, teamId } = req.query;
      
      const funnelData = await db
        .select()
        .from(conversionFunnel)
        .where(
          and(
            eq(conversionFunnel.tenantId, req.user.tenantId),
            eq(conversionFunnel.trackingPeriod, period),
            userId ? eq(conversionFunnel.userId, userId) : undefined,
            teamId ? eq(conversionFunnel.teamId, teamId) : undefined
          )
        )
        .orderBy(desc(conversionFunnel.startDate));

      res.json(funnelData);
    } catch (error) {
      console.error("Error fetching conversion funnel:", error);
      res.status(500).json({ error: "Failed to fetch conversion funnel data" });
    }
  });

  // Manager Insights - The key feature for advanced analytics
  app.get("/api/crm/manager-insights", isAuthenticated, async (req: any, res) => {
    try {
      const { managerId, teamId, userId, category, priority } = req.query;
      
      const insights = await db
        .select()
        .from(managerInsights)
        .where(
          and(
            eq(managerInsights.tenantId, req.user.tenantId),
            managerId ? eq(managerInsights.managerId, managerId) : undefined,
            teamId ? eq(managerInsights.teamId, teamId) : undefined,
            userId ? eq(managerInsights.userId, userId) : undefined,
            category ? eq(managerInsights.insightCategory, category) : undefined,
            priority ? eq(managerInsights.priorityLevel, priority) : undefined,
            eq(managerInsights.isActive, true)
          )
        )
        .orderBy(desc(managerInsights.createdAt));

      res.json(insights);
    } catch (error) {
      console.error("Error fetching manager insights:", error);
      res.status(500).json({ error: "Failed to fetch manager insights" });
    }
  });

  // Generate Manager Insights based on current performance
  app.post("/api/crm/manager-insights/generate", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, teamId, goalId } = req.body;
      const managerId = req.user.claims.sub;

      // Get current metrics for the user/team
      const currentMetrics = await db
        .select()
        .from(salesMetrics)
        .where(
          and(
            eq(salesMetrics.tenantId, req.user.tenantId),
            userId ? eq(salesMetrics.userId, userId) : undefined,
            teamId ? eq(salesMetrics.teamId, teamId) : undefined,
            eq(salesMetrics.metricPeriod, 'monthly')
          )
        )
        .orderBy(desc(salesMetrics.periodStartDate))
        .limit(1);

      if (currentMetrics.length === 0) {
        return res.status(404).json({ error: "No metrics found for analysis" });
      }

      const metrics = currentMetrics[0];
      const insights: any[] = [];

      // Analyze call answer rate
      if (metrics.callAnswerRate && Number(metrics.callAnswerRate) < 25) {
        insights.push({
          tenantId: req.user.tenantId,
          managerId,
          userId: metrics.userId,
          teamId: metrics.teamId,
          insightType: 'performance_gap',
          insightCategory: 'calls',
          currentPerformance: metrics.callAnswerRate,
          targetPerformance: 35.0,
          performanceGap: 35.0 - Number(metrics.callAnswerRate),
          priorityLevel: 'high',
          expectedImpact: 'high',
          timeframe: 'immediate',
          insightTitle: 'Low Call Answer Rate Detected',
          insightDescription: `Call answer rate of ${metrics.callAnswerRate}% is below optimal range. Industry benchmark is 25-35%. Recommend call timing optimization and script refinement.`,
          recommendedActions: [
            { action: 'Optimize call timing', impact: 'Increase answer rate by 8-12%' },
            { action: 'Refine opening script', impact: 'Improve connection quality' },
            { action: 'Use local numbers', impact: 'Increase trust and pickup rate' }
          ],
          supportingData: {
            totalCalls: metrics.totalCalls,
            answeredCalls: metrics.answeredCalls,
            benchmark: '25-35%'
          }
        });
      }

      // Analyze email response rate
      if (metrics.emailResponseRate && Number(metrics.emailResponseRate) < 15) {
        insights.push({
          tenantId: req.user.tenantId,
          managerId,
          userId: metrics.userId,
          teamId: metrics.teamId,
          insightType: 'performance_gap',
          insightCategory: 'emails',
          currentPerformance: metrics.emailResponseRate,
          targetPerformance: 20.0,
          performanceGap: 20.0 - Number(metrics.emailResponseRate),
          priorityLevel: 'medium',
          expectedImpact: 'medium',
          timeframe: 'short_term',
          insightTitle: 'Email Response Rate Below Average',
          insightDescription: `Email response rate of ${metrics.emailResponseRate}% indicates need for message optimization. Target range is 15-25%.`,
          recommendedActions: [
            { action: 'A/B test subject lines', impact: 'Increase open rates by 15-20%' },
            { action: 'Personalize email content', impact: 'Improve response rates' },
            { action: 'Optimize send timing', impact: 'Better inbox visibility' }
          ],
          supportingData: {
            totalEmails: metrics.totalEmails,
            emailReplies: metrics.emailReplies,
            benchmark: '15-25%'
          }
        });
      }

      // Calculate activities needed for goals
      if (metrics.proposalClosingRate && Number(metrics.proposalClosingRate) > 0) {
        const closingRate = Number(metrics.proposalClosingRate) / 100;
        const avgDealSize = Number(metrics.averageDealSize) || 50000;
        
        // Calculate activities needed to hit $100k monthly goal
        const monthlyGoal = 100000;
        const dealsNeeded = Math.ceil(monthlyGoal / avgDealSize);
        const proposalsNeeded = Math.ceil(dealsNeeded / closingRate);
        const meetingsNeeded = Math.ceil(proposalsNeeded / (Number(metrics.meetingToProposalRate) / 100 || 0.3));
        const activitiesNeeded = Math.ceil(meetingsNeeded / (Number(metrics.activityToMeetingRate) / 100 || 0.1));

        insights.push({
          tenantId: req.user.tenantId,
          managerId,
          userId: metrics.userId,
          teamId: metrics.teamId,
          insightType: 'activity_recommendation',
          insightCategory: 'deals',
          currentPerformance: metrics.activitiesPerDeal,
          targetPerformance: activitiesNeeded,
          performanceGap: activitiesNeeded - (Number(metrics.activitiesPerDeal) || 0),
          priorityLevel: 'high',
          expectedImpact: 'high',
          timeframe: 'immediate',
          insightTitle: 'Activities Required to Hit Revenue Goal',
          insightDescription: `Based on current conversion rates, ${activitiesNeeded} activities needed monthly to achieve $${(monthlyGoal/1000).toFixed(0)}k goal.`,
          recommendedActions: [
            { action: `Increase daily activities to ${Math.ceil(activitiesNeeded/22)}`, impact: `Hit monthly goal of $${(monthlyGoal/1000).toFixed(0)}k` },
            { action: 'Focus on conversion rate improvement', impact: 'Reduce activities needed' },
            { action: 'Track daily progress', impact: 'Stay on target' }
          ],
          supportingData: {
            monthlyGoal,
            dealsNeeded,
            proposalsNeeded,
            meetingsNeeded,
            activitiesNeeded,
            currentClosingRate: metrics.proposalClosingRate,
            avgDealSize
          }
        });
      }

      // Insert insights
      if (insights.length > 0) {
        const createdInsights = await db
          .insert(managerInsights)
          .values(insights)
          .returning();

        res.status(201).json(createdInsights);
      } else {
        res.json({ message: "No new insights generated - performance is on track" });
      }
    } catch (error) {
      console.error("Error generating manager insights:", error);
      res.status(500).json({ error: "Failed to generate insights" });
    }
  });

  // Calculate Required Activities for Goal Achievement
  app.post("/api/crm/analytics/calculate-activities", isAuthenticated, async (req: any, res) => {
    try {
      const { 
        revenueGoal, 
        averageDealSize, 
        callAnswerRate, 
        emailResponseRate, 
        activityToMeetingRate, 
        meetingToProposalRate, 
        proposalClosingRate 
      } = req.body;

      // Convert percentages to decimals
      const callRate = callAnswerRate / 100;
      const emailRate = emailResponseRate / 100;
      const meetingRate = activityToMeetingRate / 100;
      const proposalRate = meetingToProposalRate / 100;
      const closingRate = proposalClosingRate / 100;

      // Calculate funnel backwards from revenue goal
      const dealsNeeded = Math.ceil(revenueGoal / averageDealSize);
      const proposalsNeeded = Math.ceil(dealsNeeded / closingRate);
      const meetingsNeeded = Math.ceil(proposalsNeeded / proposalRate);
      const connectionsNeeded = Math.ceil(meetingsNeeded / meetingRate);
      
      // Assume 50/50 split between calls and emails
      const callsNeeded = Math.ceil(connectionsNeeded / callRate / 2);
      const emailsNeeded = Math.ceil(connectionsNeeded / emailRate / 2);
      const totalActivities = callsNeeded + emailsNeeded;

      // Daily breakdown (22 working days per month)
      const dailyActivities = Math.ceil(totalActivities / 22);
      const dailyCalls = Math.ceil(callsNeeded / 22);
      const dailyEmails = Math.ceil(emailsNeeded / 22);

      const calculation = {
        revenueGoal,
        averageDealSize,
        conversionRates: {
          callAnswerRate,
          emailResponseRate,
          activityToMeetingRate,
          meetingToProposalRate,
          proposalClosingRate
        },
        requiredActivities: {
          dealsNeeded,
          proposalsNeeded,
          meetingsNeeded,
          connectionsNeeded,
          totalCalls: callsNeeded,
          totalEmails: emailsNeeded,
          totalActivities
        },
        dailyBreakdown: {
          totalDaily: dailyActivities,
          callsDaily: dailyCalls,
          emailsDaily: dailyEmails
        },
        recommendations: [
          {
            metric: 'Total Activities',
            current: 0,
            target: totalActivities,
            improvement: `Need ${totalActivities} total activities monthly`
          },
          {
            metric: 'Daily Activities',
            current: 0,
            target: dailyActivities,
            improvement: `Maintain ${dailyActivities} activities per day`
          }
        ]
      };

      res.json(calculation);
    } catch (error) {
      console.error("Error calculating required activities:", error);
      res.status(500).json({ error: "Failed to calculate activities" });
    }
  });

  // Advanced Conversion Analysis
  app.get("/api/crm/analytics/conversion-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const { userId, teamId, period = 'monthly' } = req.query;

      const analysis = await db
        .select({
          userId: salesMetrics.userId,
          teamId: salesMetrics.teamId,
          periodStart: salesMetrics.periodStartDate,
          
          // Activity metrics
          totalCalls: salesMetrics.totalCalls,
          answeredCalls: salesMetrics.answeredCalls,
          totalEmails: salesMetrics.totalEmails,
          emailReplies: salesMetrics.emailReplies,
          totalMeetings: salesMetrics.totalMeetings,
          meetingsHeld: salesMetrics.meetingsHeld,
          
          // Conversion metrics
          callAnswerRate: salesMetrics.callAnswerRate,
          emailResponseRate: salesMetrics.emailResponseRate,
          activityToMeetingRate: salesMetrics.activityToMeetingRate,
          meetingToProposalRate: salesMetrics.meetingToProposalRate,
          proposalClosingRate: salesMetrics.proposalClosingRate,
          
          // Performance metrics
          totalProposals: salesMetrics.totalProposals,
          closedDeals: salesMetrics.closedDeals,
          totalRevenue: salesMetrics.totalRevenue,
          averageDealSize: salesMetrics.averageDealSize,
          activitiesPerDeal: salesMetrics.activitiesPerDeal,
          
          // User info
          firstName: users.firstName,
          lastName: users.lastName,
          teamName: salesTeams.name
        })
        .from(salesMetrics)
        .leftJoin(users, eq(salesMetrics.userId, users.id))
        .leftJoin(salesTeams, eq(salesMetrics.teamId, salesTeams.id))
        .where(
          and(
            eq(salesMetrics.tenantId, req.user.tenantId),
            eq(salesMetrics.metricPeriod, period),
            userId ? eq(salesMetrics.userId, userId) : undefined,
            teamId ? eq(salesMetrics.teamId, teamId) : undefined
          )
        )
        .orderBy(desc(salesMetrics.periodStartDate));

      // Calculate industry benchmarks and gaps
      const analysisWithBenchmarks = analysis.map(metric => ({
        ...metric,
        benchmarks: {
          callAnswerRate: { target: 30, current: Number(metric.callAnswerRate) || 0 },
          emailResponseRate: { target: 20, current: Number(metric.emailResponseRate) || 0 },
          activityToMeetingRate: { target: 12, current: Number(metric.activityToMeetingRate) || 0 },
          meetingToProposalRate: { target: 40, current: Number(metric.meetingToProposalRate) || 0 },
          proposalClosingRate: { target: 25, current: Number(metric.proposalClosingRate) || 0 }
        },
        performanceGaps: {
          callAnswerGap: 30 - (Number(metric.callAnswerRate) || 0),
          emailResponseGap: 20 - (Number(metric.emailResponseRate) || 0),
          meetingConversionGap: 12 - (Number(metric.activityToMeetingRate) || 0),
          proposalConversionGap: 40 - (Number(metric.meetingToProposalRate) || 0),
          closingGap: 25 - (Number(metric.proposalClosingRate) || 0)
        }
      }));

      res.json(analysisWithBenchmarks);
    } catch (error) {
      console.error("Error fetching conversion analysis:", error);
      res.status(500).json({ error: "Failed to fetch conversion analysis" });
    }
  });
}