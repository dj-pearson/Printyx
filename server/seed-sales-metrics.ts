import { db } from "./db";
import { 
  salesMetrics, 
  conversionFunnel,
  managerInsights,
  users,
  tenants,
  salesTeams
} from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedSalesMetrics() {
  console.log("Seeding Sales Metrics data...");

  try {
    // Get the first tenant
    const [tenant] = await db.select().from(tenants).limit(1);
    if (!tenant) {
      console.log("No tenant found, skipping sales metrics seeding");
      return;
    }

    // Get users from this tenant
    const tenantUsers = await db
      .select()
      .from(users)
      .where(eq(users.tenantId, tenant.id))
      .limit(5);

    if (tenantUsers.length === 0) {
      console.log("No users found for tenant, skipping sales metrics seeding");
      return;
    }

    // Get sales teams
    const teams = await db
      .select()
      .from(salesTeams)
      .where(eq(salesTeams.tenantId, tenant.id))
      .limit(3);

    // Create sample sales metrics for different periods
    const metricsData = [
      // User 1 - Strong performer
      {
        tenantId: tenant.id,
        userId: tenantUsers[0]?.id,
        teamId: teams[0]?.id,
        metricPeriod: 'monthly',
        periodStartDate: new Date('2024-01-01'),
        periodEndDate: new Date('2024-01-31'),
        
        // Activity metrics
        totalCalls: 180,
        answeredCalls: 65,
        totalEmails: 240,
        emailReplies: 48,
        totalMeetings: 25,
        meetingsHeld: 22,
        
        // Conversion metrics
        callAnswerRate: 36.1,
        emailResponseRate: 20.0,
        activityToMeetingRate: 13.5,
        meetingToProposalRate: 45.0,
        proposalClosingRate: 28.0,
        
        // Deal metrics
        totalProposals: 10,
        closedDeals: 3,
        totalRevenue: 165000,
        averageDealSize: 55000,
        activitiesPerDeal: 140,
        
        // Performance insights
        activitiesNeededForGoal: 380,
        projectedRevenue: 198000
      },
      
      // User 2 - Needs improvement
      {
        tenantId: tenant.id,
        userId: tenantUsers[1]?.id,
        teamId: teams[0]?.id,
        metricPeriod: 'monthly',
        periodStartDate: new Date('2024-01-01'),
        periodEndDate: new Date('2024-01-31'),
        
        totalCalls: 150,
        answeredCalls: 30,
        totalEmails: 200,
        emailReplies: 20,
        totalMeetings: 15,
        meetingsHeld: 12,
        
        callAnswerRate: 20.0,
        emailResponseRate: 10.0,
        activityToMeetingRate: 8.0,
        meetingToProposalRate: 33.3,
        proposalClosingRate: 20.0,
        
        totalProposals: 4,
        closedDeals: 1,
        totalRevenue: 45000,
        averageDealSize: 45000,
        activitiesPerDeal: 350,
        
        activitiesNeededForGoal: 600,
        projectedRevenue: 67500
      },
      
      // User 3 - Average performer
      {
        tenantId: tenant.id,
        userId: tenantUsers[2]?.id,
        teamId: teams[1]?.id,
        metricPeriod: 'monthly',
        periodStartDate: new Date('2024-01-01'),
        periodEndDate: new Date('2024-01-31'),
        
        totalCalls: 165,
        answeredCalls: 45,
        totalEmails: 220,
        emailReplies: 33,
        totalMeetings: 18,
        meetingsHeld: 16,
        
        callAnswerRate: 27.3,
        emailResponseRate: 15.0,
        activityToMeetingRate: 10.5,
        meetingToProposalRate: 38.9,
        proposalClosingRate: 22.0,
        
        totalProposals: 7,
        closedDeals: 2,
        totalRevenue: 98000,
        averageDealSize: 49000,
        activitiesPerDeal: 192,
        
        activitiesNeededForGoal: 450,
        projectedRevenue: 147000
      }
    ].filter(metric => metric.userId && metric.teamId);

    if (metricsData.length > 0) {
      const createdMetrics = await db
        .insert(salesMetrics)
        .values(metricsData)
        .onConflictDoNothing()
        .returning();

      console.log(`Created ${createdMetrics.length} sales metrics records`);
    }

    // Create conversion funnel data
    const funnelData = [
      {
        tenantId: tenant.id,
        userId: tenantUsers[0]?.id,
        teamId: teams[0]?.id,
        trackingPeriod: 'monthly',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        
        totalActivities: 420,
        connectionsEstablished: 113,
        meetingsScheduled: 25,
        meetingsHeld: 22,
        proposalsSent: 10,
        dealsWon: 3,
        
        activityToConnectionRate: 26.9,
        connectionToMeetingRate: 22.1,
        meetingToProposalRate: 45.5,
        proposalToWinRate: 30.0,
        overallConversionRate: 0.71
      },
      {
        tenantId: tenant.id,
        userId: tenantUsers[1]?.id,
        teamId: teams[0]?.id,
        trackingPeriod: 'monthly',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        
        totalActivities: 350,
        connectionsEstablished: 50,
        meetingsScheduled: 15,
        meetingsHeld: 12,
        proposalsSent: 4,
        dealsWon: 1,
        
        activityToConnectionRate: 14.3,
        connectionToMeetingRate: 30.0,
        meetingToProposalRate: 33.3,
        proposalToWinRate: 25.0,
        overallConversionRate: 0.29
      }
    ].filter(funnel => funnel.userId && funnel.teamId);

    if (funnelData.length > 0) {
      const createdFunnels = await db
        .insert(conversionFunnel)
        .values(funnelData)
        .onConflictDoNothing()
        .returning();

      console.log(`Created ${createdFunnels.length} conversion funnel records`);
    }

    // Create manager insights based on the metrics
    const insightsData = [
      {
        tenantId: tenant.id,
        managerId: tenantUsers[0]?.id,
        userId: tenantUsers[1]?.id,
        teamId: teams[0]?.id,
        insightType: 'performance_gap',
        insightCategory: 'calls',
        currentPerformance: 20.0,
        targetPerformance: 30.0,
        performanceGap: 10.0,
        priorityLevel: 'high',
        expectedImpact: 'high',
        timeframe: 'immediate',
        insightTitle: 'Low Call Answer Rate Alert',
        insightDescription: 'Call answer rate of 20% is significantly below team average of 30%. This impacts meeting conversion and overall pipeline.',
        recommendedActions: [
          { action: 'Optimize call timing to 9-11 AM and 2-4 PM', impact: 'Increase answer rate by 8-12%' },
          { action: 'Use local caller ID numbers', impact: 'Improve trust and pickup rates' },
          { action: 'Refine opening 7-second script', impact: 'Better initial connection' }
        ],
        supportingData: {
          totalCalls: 150,
          answeredCalls: 30,
          teamAverage: 30.0,
          benchmark: '25-35%'
        },
        isActive: true,
        isRead: false
      },
      {
        tenantId: tenant.id,
        managerId: tenantUsers[0]?.id,
        userId: tenantUsers[1]?.id,
        teamId: teams[0]?.id,
        insightType: 'activity_recommendation',
        insightCategory: 'deals',
        currentPerformance: 350,
        targetPerformance: 600,
        performanceGap: 250,
        priorityLevel: 'high',
        expectedImpact: 'high',
        timeframe: 'immediate',
        insightTitle: 'Activities Needed to Hit Revenue Goal',
        insightDescription: 'Based on current 20% closing rate and $45K average deal size, need 600 monthly activities to hit $100K revenue goal.',
        recommendedActions: [
          { action: 'Increase daily activities from 16 to 27', impact: 'Hit monthly revenue target' },
          { action: 'Focus on improving conversion rates first', impact: 'Reduce total activities needed' },
          { action: 'Track daily progress with activity dashboard', impact: 'Stay on target throughout month' }
        ],
        supportingData: {
          currentActivities: 350,
          targetActivities: 600,
          revenueGoal: 100000,
          currentClosingRate: 20.0,
          avgDealSize: 45000
        },
        isActive: true,
        isRead: false
      }
    ].filter(insight => insight.managerId && insight.userId && insight.teamId);

    if (insightsData.length > 0) {
      const createdInsights = await db
        .insert(managerInsights)
        .values(insightsData)
        .onConflictDoNothing()
        .returning();

      console.log(`Created ${createdInsights.length} manager insights`);
    }

    console.log("Sales Metrics seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding Sales Metrics:", error);
  }
}

// Run seeding if this file is executed directly
if (import.meta.main) {
  seedSalesMetrics().then(() => {
    console.log("Seeding completed");
    process.exit(0);
  }).catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
}