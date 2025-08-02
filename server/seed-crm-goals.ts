import { db } from "./db";
import { 
  salesGoals, 
  salesTeams, 
  salesTeamMembers, 
  activityReports,
  goalProgress,
  users,
  tenants
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export async function seedCrmGoals() {
  console.log("Seeding CRM Goals data...");

  try {
    // Get the first tenant
    const [tenant] = await db.select().from(tenants).limit(1);
    if (!tenant) {
      console.log("No tenant found, skipping CRM goals seeding");
      return;
    }

    // Get users from this tenant
    const tenantUsers = await db
      .select()
      .from(users)
      .where(eq(users.tenantId, tenant.id))
      .limit(10);

    if (tenantUsers.length === 0) {
      console.log("No users found for tenant, skipping CRM goals seeding");
      return;
    }

    // Create sample sales teams
    const teamData = [
      {
        tenantId: tenant.id,
        name: "Enterprise Sales",
        description: "Large enterprise accounts and strategic partnerships",
        teamLevel: 1,
        territory: "Northeast Region",
        managerId: tenantUsers[0]?.id,
        isActive: true,
      },
      {
        tenantId: tenant.id,
        name: "SMB Sales",
        description: "Small and medium business sales team",
        teamLevel: 1,
        territory: "Southeast Region",
        managerId: tenantUsers[1]?.id || tenantUsers[0]?.id,
        isActive: true,
      },
      {
        tenantId: tenant.id,
        name: "Channel Partners",
        description: "Partner and reseller channel management",
        teamLevel: 2,
        territory: "National",
        managerId: tenantUsers[2]?.id || tenantUsers[0]?.id,
        isActive: true,
        parentTeamId: null,
      },
    ];

    const createdTeams = await db
      .insert(salesTeams)
      .values(teamData)
      .onConflictDoNothing()
      .returning();

    console.log(`Created ${createdTeams.length} sales teams`);

    // Add team members
    if (createdTeams.length > 0 && tenantUsers.length > 3) {
      const memberData = [
        {
          tenantId: tenant.id,
          teamId: createdTeams[0].id,
          userId: tenantUsers[3]?.id,
          role: "Account Executive",
          joinedDate: new Date("2024-01-15"),
          isActive: true,
        },
        {
          tenantId: tenant.id,
          teamId: createdTeams[0].id,
          userId: tenantUsers[4]?.id,
          role: "Senior Account Executive",
          joinedDate: new Date("2023-08-01"),
          isActive: true,
        },
        {
          tenantId: tenant.id,
          teamId: createdTeams[1]?.id,
          userId: tenantUsers[5]?.id,
          role: "Sales Representative",
          joinedDate: new Date("2024-03-01"),
          isActive: true,
        },
        {
          tenantId: tenant.id,
          teamId: createdTeams[1]?.id,
          userId: tenantUsers[6]?.id,
          role: "Inside Sales Rep",
          joinedDate: new Date("2024-02-15"),
          isActive: true,
        },
      ].filter(member => member.userId); // Filter out undefined userIds

      if (memberData.length > 0) {
        const createdMembers = await db
          .insert(salesTeamMembers)
          .values(memberData)
          .onConflictDoNothing()
          .returning();

        console.log(`Created ${createdMembers.length} team members`);
      }
    }

    // Create sample sales goals
    const goalData = [
      {
        tenantId: tenant.id,
        goalType: "calls" as const,
        targetCount: 50,
        period: "weekly" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        assignedToUserId: tenantUsers[3]?.id,
        assignedBy: tenantUsers[0]?.id,
        isActive: true,
        notes: "Weekly call activity goal for Q1-Q4 2024",
      },
      {
        tenantId: tenant.id,
        goalType: "emails" as const,
        targetCount: 100,
        period: "weekly" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        assignedToUserId: tenantUsers[4]?.id,
        assignedBy: tenantUsers[0]?.id,
        isActive: true,
        notes: "Weekly email outreach goal",
      },
      {
        tenantId: tenant.id,
        goalType: "reachouts" as const,
        targetCount: 150,
        period: "weekly" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        assignedToTeamId: createdTeams[0]?.id,
        assignedBy: tenantUsers[0]?.id,
        isActive: true,
        notes: "Combined calls + emails goal for Enterprise team",
      },
      {
        tenantId: tenant.id,
        goalType: "meetings" as const,
        targetCount: 15,
        period: "monthly" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        assignedToUserId: tenantUsers[5]?.id,
        assignedBy: tenantUsers[1]?.id,
        isActive: true,
        notes: "Monthly meeting schedule target",
      },
      {
        tenantId: tenant.id,
        goalType: "new_opportunities" as const,
        targetCount: 5,
        period: "monthly" as const,
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-12-31"),
        assignedToTeamId: createdTeams[1]?.id,
        assignedBy: tenantUsers[1]?.id,
        isActive: true,
        notes: "New opportunity creation target for SMB team",
      },
    ].filter(goal => goal.assignedToUserId || goal.assignedToTeamId); // Filter out goals without assignments

    if (goalData.length > 0) {
      const createdGoals = await db
        .insert(salesGoals)
        .values(goalData)
        .onConflictDoNothing()
        .returning();

      console.log(`Created ${createdGoals.length} sales goals`);

      // Create sample activity reports
      const reportData = [
        {
          tenantId: tenant.id,
          userId: tenantUsers[3]?.id,
          teamId: createdTeams[0]?.id,
          reportDate: new Date("2024-01-29"),
          period: "weekly" as const,
          totalCalls: 45,
          totalEmails: 85,
          totalMeetings: 8,
          totalReachouts: 130,
          totalProposals: 3,
          totalNewOpportunities: 2,
          connectedCalls: 18,
          emailReplies: 12,
          meetingsScheduled: 6,
          callConnectRate: 40.0,
          emailReplyRate: 14.1,
        },
        {
          tenantId: tenant.id,
          userId: tenantUsers[4]?.id,
          teamId: createdTeams[0]?.id,
          reportDate: new Date("2024-01-29"),
          period: "weekly" as const,
          totalCalls: 55,
          totalEmails: 120,
          totalMeetings: 12,
          totalReachouts: 175,
          totalProposals: 5,
          totalNewOpportunities: 4,
          connectedCalls: 28,
          emailReplies: 22,
          meetingsScheduled: 10,
          callConnectRate: 50.9,
          emailReplyRate: 18.3,
        },
        {
          tenantId: tenant.id,
          userId: tenantUsers[5]?.id,
          teamId: createdTeams[1]?.id,
          reportDate: new Date("2024-01-29"),
          period: "weekly" as const,
          totalCalls: 38,
          totalEmails: 92,
          totalMeetings: 5,
          totalReachouts: 130,
          totalProposals: 2,
          totalNewOpportunities: 3,
          connectedCalls: 14,
          emailReplies: 8,
          meetingsScheduled: 4,
          callConnectRate: 36.8,
          emailReplyRate: 8.7,
        },
      ].filter(report => report.userId && report.teamId); // Filter out reports without valid IDs

      if (reportData.length > 0) {
        const createdReports = await db
          .insert(activityReports)
          .values(reportData)
          .onConflictDoNothing()
          .returning();

        console.log(`Created ${createdReports.length} activity reports`);

        // Create sample goal progress tracking
        const progressData = createdGoals.map((goal, index) => ({
          tenantId: tenant.id,
          goalId: goal.id,
          reportDate: new Date("2024-01-29"),
          currentCount: Math.floor(goal.targetCount * (0.7 + Math.random() * 0.3)), // 70-100% progress
          targetCount: goal.targetCount,
          progressPercentage: 0,
          dailyAverage: 0,
          projectedTotal: 0,
          onTrack: true,
        }));

        // Calculate derived fields
        progressData.forEach(progress => {
          progress.progressPercentage = (progress.currentCount / progress.targetCount) * 100;
          progress.dailyAverage = progress.currentCount / 29; // 29 days into January
          progress.projectedTotal = Math.floor(progress.dailyAverage * 365);
          progress.onTrack = progress.progressPercentage >= 70;
        });

        const createdProgress = await db
          .insert(goalProgress)
          .values(progressData)
          .onConflictDoNothing()
          .returning();

        console.log(`Created ${createdProgress.length} goal progress records`);
      }
    }

    console.log("CRM Goals seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding CRM Goals:", error);
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedCrmGoals().then(() => {
    console.log("Seeding completed");
    process.exit(0);
  }).catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
}