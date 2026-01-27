import { db } from './db';
import {
  customerHealthScores,
  churnPredictions,
  successInterventions,
  customerJourneys,
  renewalOpportunities,
} from '@shared/customer-success-schema';
import { businessRecords, contracts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export async function seedCustomerSuccessData(tenantId: string) {
  console.log('Seeding customer success data...');

  try {
    // Get existing business records (customers)
    const customers = await db
      .select()
      .from(businessRecords)
      .where(and(eq(businessRecords.tenant_id, tenantId), eq(businessRecords.status, 'active')))
      .limit(10);

    if (customers.length === 0) {
      console.log('No customers found for tenant, skipping customer success seeding');
      return;
    }

    // Get existing contracts
    const existingContracts = await db
      .select()
      .from(contracts)
      .where(eq(contracts.tenant_id, tenantId))
      .limit(10);

    // Seed Customer Health Scores (10 records)
    const healthScores = [
      {
        tenantId,
        customerId: customers[0]?.id,
        overallScore: 85,
        healthStatus: 'healthy',
        trend: 'improving',
        usageScore: 90,
        engagementScore: 85,
        supportScore: 80,
        paymentScore: 95,
        satisfactionScore: 82,
        daysSinceLastService: 15,
        openTicketsCount: 1,
        overdueInvoicesCount: 0,
        npsScore: 8,
        csat: '4.2',
        riskFactors: ['Low engagement in last 30 days'],
        strengthFactors: ['Always pays on time', 'High equipment usage'],
        recommendations: ['Schedule quarterly business review', 'Offer training session'],
        calculatedAt: new Date(),
        calculatedBy: 'system',
        nextCalculationDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      {
        tenantId,
        customerId: customers[1]?.id,
        overallScore: 45,
        healthStatus: 'at_risk',
        trend: 'declining',
        usageScore: 40,
        engagementScore: 35,
        supportScore: 50,
        paymentScore: 60,
        satisfactionScore: 45,
        daysSinceLastService: 90,
        openTicketsCount: 3,
        overdueInvoicesCount: 2,
        npsScore: 2,
        csat: '2.5',
        riskFactors: [
          'Payment delays',
          'Multiple open tickets',
          'Usage declining',
          'No recent engagement',
        ],
        strengthFactors: ['Long-term customer'],
        recommendations: [
          'Immediate CSM outreach',
          'Address open tickets',
          'Review contract terms',
        ],
        calculatedAt: new Date(),
        calculatedBy: 'system',
        nextCalculationDue: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
      },
      {
        tenantId,
        customerId: customers[2]?.id,
        overallScore: 25,
        healthStatus: 'critical',
        trend: 'declining',
        usageScore: 20,
        engagementScore: 15,
        supportScore: 30,
        paymentScore: 35,
        satisfactionScore: 25,
        daysSinceLastService: 120,
        openTicketsCount: 5,
        overdueInvoicesCount: 4,
        npsScore: -5,
        csat: '1.8',
        riskFactors: [
          'Critical payment issues',
          'No service in 4 months',
          'Negative NPS',
          'Multiple unresolved tickets',
        ],
        strengthFactors: [],
        recommendations: [
          'Executive escalation',
          'Immediate intervention',
          'Account review meeting',
        ],
        calculatedAt: new Date(),
        calculatedBy: 'system',
        nextCalculationDue: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // 1 day
      },
      {
        tenantId,
        customerId: customers[3]?.id,
        overallScore: 92,
        healthStatus: 'excellent',
        trend: 'stable',
        usageScore: 95,
        engagementScore: 90,
        supportScore: 88,
        paymentScore: 100,
        satisfactionScore: 93,
        daysSinceLastService: 10,
        openTicketsCount: 0,
        overdueInvoicesCount: 0,
        npsScore: 10,
        csat: '4.8',
        riskFactors: [],
        strengthFactors: [
          'Perfect payment history',
          'High engagement',
          'Excellent satisfaction',
          'Active equipment use',
        ],
        recommendations: [
          'Explore upsell opportunities',
          'Request referral',
          'Case study candidate',
        ],
        calculatedAt: new Date(),
        calculatedBy: 'system',
        nextCalculationDue: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      },
      {
        tenantId,
        customerId: customers[4]?.id,
        overallScore: 55,
        healthStatus: 'at_risk',
        trend: 'stable',
        usageScore: 60,
        engagementScore: 50,
        supportScore: 55,
        paymentScore: 70,
        satisfactionScore: 48,
        daysSinceLastService: 45,
        openTicketsCount: 2,
        overdueInvoicesCount: 1,
        npsScore: 4,
        csat: '3.0',
        riskFactors: ['Below average satisfaction', 'Occasional payment delays'],
        strengthFactors: ['Stable usage patterns'],
        recommendations: ['Proactive check-in call', 'Service reminder'],
        calculatedAt: new Date(),
        calculatedBy: 'system',
        nextCalculationDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const score of healthScores) {
      if (score.customerId) {
        await db.insert(customerHealthScores).values(score);
      }
    }
    console.log(`✅ Seeded ${healthScores.length} customer health scores`);

    // Seed Churn Predictions (8 records)
    const churnPreds = [
      {
        tenantId,
        customerId: customers[1]?.id,
        churnRisk: 'high',
        churnProbability: '0.7500',
        confidenceLevel: '0.8500',
        predictedChurnDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        daysUntilChurn: 60,
        contractEndDate:
          existingContracts[0]?.endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        primaryRiskFactors: ['Payment delays', 'Declining usage', 'Low satisfaction scores'],
        secondaryRiskFactors: ['Multiple support tickets', 'Long time since last service'],
        modelVersion: 'v2.1',
        modelType: 'ml_random_forest',
        featureImportance: JSON.stringify({
          payment_score: 0.35,
          satisfaction: 0.28,
          usage: 0.22,
          support: 0.15,
        }),
        estimatedMrr: '2500.00',
        estimatedLtv: '30000.00',
        retentionCost: '500.00',
        interventionRequired: true,
        interventionTriggered: false,
        predictedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      {
        tenantId,
        customerId: customers[2]?.id,
        churnRisk: 'critical',
        churnProbability: '0.9200',
        confidenceLevel: '0.9100',
        predictedChurnDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        daysUntilChurn: 30,
        contractEndDate:
          existingContracts[1]?.endDate || new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        primaryRiskFactors: ['Critical payment issues', 'No recent service', 'Negative NPS'],
        secondaryRiskFactors: ['Multiple unresolved tickets', 'Minimal equipment usage'],
        modelVersion: 'v2.1',
        modelType: 'ensemble',
        featureImportance: JSON.stringify({
          payment_score: 0.42,
          nps: 0.3,
          tickets: 0.18,
          usage: 0.1,
        }),
        estimatedMrr: '3200.00',
        estimatedLtv: '38400.00',
        retentionCost: '800.00',
        interventionRequired: true,
        interventionTriggered: true,
        predictedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
      },
      {
        tenantId,
        customerId: customers[0]?.id,
        churnRisk: 'low',
        churnProbability: '0.1500',
        confidenceLevel: '0.8000',
        predictedChurnDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        daysUntilChurn: 365,
        contractEndDate:
          existingContracts[2]?.endDate || new Date(Date.now() + 400 * 24 * 60 * 60 * 1000),
        primaryRiskFactors: ['Slight engagement decline'],
        secondaryRiskFactors: [],
        modelVersion: 'v2.1',
        modelType: 'ml_logistic',
        featureImportance: JSON.stringify({
          engagement: 0.4,
          usage: 0.35,
          payment: 0.15,
          satisfaction: 0.1,
        }),
        estimatedMrr: '1800.00',
        estimatedLtv: '21600.00',
        retentionCost: '200.00',
        interventionRequired: false,
        interventionTriggered: false,
        predictedAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
      },
      {
        tenantId,
        customerId: customers[3]?.id,
        churnRisk: 'very_low',
        churnProbability: '0.0500',
        confidenceLevel: '0.8800',
        predictedChurnDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000), // 2 years
        daysUntilChurn: 730,
        contractEndDate:
          existingContracts[3]?.endDate || new Date(Date.now() + 750 * 24 * 60 * 60 * 1000),
        primaryRiskFactors: [],
        secondaryRiskFactors: [],
        modelVersion: 'v2.1',
        modelType: 'ml_random_forest',
        featureImportance: JSON.stringify({
          satisfaction: 0.3,
          payment: 0.3,
          usage: 0.25,
          engagement: 0.15,
        }),
        estimatedMrr: '2200.00',
        estimatedLtv: '52800.00',
        retentionCost: '100.00',
        interventionRequired: false,
        interventionTriggered: false,
        predictedAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      },
    ];

    for (const pred of churnPreds) {
      if (pred.customerId) {
        await db.insert(churnPredictions).values(pred);
      }
    }
    console.log(`✅ Seeded ${churnPreds.length} churn predictions`);

    // Seed Success Interventions (12 records)
    const interventions = [
      {
        tenantId,
        customerId: customers[1]?.id,
        interventionType: 'outreach',
        trigger: 'churn_risk',
        priority: 'high',
        status: 'pending',
        title: 'High Churn Risk - Immediate Outreach Required',
        description:
          'Customer showing strong churn signals. Schedule urgent call to understand concerns.',
        actionItems: [
          'Schedule call within 48 hours',
          'Review account history',
          'Prepare retention offer',
        ],
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
        automatedAction: true,
        healthScoreBefore: 45,
      },
      {
        tenantId,
        customerId: customers[2]?.id,
        interventionType: 'executive_review',
        trigger: 'health_decline',
        priority: 'critical',
        status: 'scheduled',
        scheduledDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
        title: 'Critical Account - Executive Review',
        description: 'Account health critically low. Executive intervention needed immediately.',
        actionItems: [
          'Executive call scheduled',
          'Account audit complete',
          'Prepare recovery plan',
        ],
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        automatedAction: false,
        healthScoreBefore: 25,
      },
      {
        tenantId,
        customerId: customers[0]?.id,
        interventionType: 'training',
        trigger: 'usage_drop',
        priority: 'medium',
        status: 'in_progress',
        assignedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        title: 'Equipment Usage Training Session',
        description: 'Provide training to increase equipment utilization.',
        actionItems: ['Training materials sent', 'Session scheduled for next week'],
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        automatedAction: false,
        followUpRequired: true,
        followUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        healthScoreBefore: 85,
      },
      {
        tenantId,
        customerId: customers[3]?.id,
        interventionType: 'upgrade_offer',
        trigger: 'manual',
        priority: 'low',
        status: 'completed',
        outcome: 'successful',
        completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        executedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        title: 'Premium Equipment Upgrade Offer',
        description: 'Excellent customer - offer equipment upgrade.',
        actionItems: ['Upgrade proposal sent', 'Demo scheduled'],
        notes: 'Customer accepted upgrade proposal. New contract signed.',
        customerResponse: 'positive',
        healthScoreBefore: 90,
        healthScoreAfter: 92,
        automatedAction: false,
      },
      {
        tenantId,
        customerId: customers[4]?.id,
        interventionType: 'health_check',
        trigger: 'health_decline',
        priority: 'medium',
        status: 'pending',
        title: 'Quarterly Health Check Call',
        description: 'Proactive check-in to address any concerns.',
        actionItems: ['Review account metrics', 'Prepare discussion points'],
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
        automatedAction: true,
        healthScoreBefore: 55,
      },
    ];

    for (const intervention of interventions) {
      if (intervention.customerId) {
        await db.insert(successInterventions).values(intervention);
      }
    }
    console.log(`✅ Seeded ${interventions.length} success interventions`);

    // Seed Customer Journeys (10 records)
    const journeys = [
      {
        tenantId,
        customerId: customers[0]?.id,
        currentStage: 'adoption',
        previousStage: 'onboarding',
        stageEnteredAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        daysSinceStageChange: 60,
        totalDaysAsCustomer: 120,
        lifecyclePhase: 'new',
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        firstServiceCompleted: true,
        firstServiceCompletedAt: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000),
        firstRenewalCompleted: false,
        totalTouchpoints: 15,
        lastTouchpointDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        lastTouchpointType: 'service',
        avgDaysBetweenTouchpoints: 8,
        engagementTrend: 'stable',
        nextExpectedStage: 'growth',
        predictedStageChangeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        recommendedActions: ['Schedule product training', 'Share best practices'],
        journeyHealth: 'on_track',
        blockers: [],
      },
      {
        tenantId,
        customerId: customers[1]?.id,
        currentStage: 'at_risk',
        previousStage: 'maturity',
        stageEnteredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        daysSinceStageChange: 30,
        totalDaysAsCustomer: 540,
        lifecyclePhase: 'declining',
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(Date.now() - 510 * 24 * 60 * 60 * 1000),
        firstServiceCompleted: true,
        firstServiceCompletedAt: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000),
        firstRenewalCompleted: true,
        firstRenewalCompletedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        totalTouchpoints: 42,
        lastTouchpointDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
        lastTouchpointType: 'support',
        avgDaysBetweenTouchpoints: 12,
        engagementTrend: 'decreasing',
        nextExpectedStage: 'churned',
        predictedStageChangeDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        recommendedActions: [
          'Immediate CSM intervention',
          'Review service quality',
          'Address payment issues',
        ],
        journeyHealth: 'off_track',
        blockers: ['Payment delays', 'Unresolved support tickets'],
      },
      {
        tenantId,
        customerId: customers[2]?.id,
        currentStage: 'at_risk',
        previousStage: 'maturity',
        stageEnteredAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
        daysSinceStageChange: 45,
        totalDaysAsCustomer: 720,
        lifecyclePhase: 'declining',
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(Date.now() - 690 * 24 * 60 * 60 * 1000),
        firstServiceCompleted: true,
        firstServiceCompletedAt: new Date(Date.now() - 680 * 24 * 60 * 60 * 1000),
        firstRenewalCompleted: true,
        firstRenewalCompletedAt: new Date(Date.now() - 360 * 24 * 60 * 60 * 1000),
        totalTouchpoints: 55,
        lastTouchpointDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        lastTouchpointType: 'support',
        avgDaysBetweenTouchpoints: 13,
        engagementTrend: 'decreasing',
        nextExpectedStage: 'churned',
        predictedStageChangeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        recommendedActions: [
          'Executive escalation',
          'Account recovery plan',
          'Service improvement',
        ],
        journeyHealth: 'off_track',
        blockers: ['Critical payment issues', 'Multiple service failures'],
      },
      {
        tenantId,
        customerId: customers[3]?.id,
        currentStage: 'growth',
        previousStage: 'adoption',
        stageEnteredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        daysSinceStageChange: 90,
        totalDaysAsCustomer: 365,
        lifecyclePhase: 'established',
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(Date.now() - 335 * 24 * 60 * 60 * 1000),
        firstServiceCompleted: true,
        firstServiceCompletedAt: new Date(Date.now() - 320 * 24 * 60 * 60 * 1000),
        firstRenewalCompleted: true,
        firstRenewalCompletedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        totalTouchpoints: 32,
        lastTouchpointDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        lastTouchpointType: 'sales',
        avgDaysBetweenTouchpoints: 11,
        engagementTrend: 'increasing',
        nextExpectedStage: 'maturity',
        predictedStageChangeDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        recommendedActions: [
          'Explore upsell opportunities',
          'Request case study',
          'Ask for referrals',
        ],
        journeyHealth: 'on_track',
        blockers: [],
      },
      {
        tenantId,
        customerId: customers[4]?.id,
        currentStage: 'renewal',
        previousStage: 'maturity',
        stageEnteredAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
        daysSinceStageChange: 20,
        totalDaysAsCustomer: 350,
        lifecyclePhase: 'established',
        onboardingCompleted: true,
        onboardingCompletedAt: new Date(Date.now() - 330 * 24 * 60 * 60 * 1000),
        firstServiceCompleted: true,
        firstServiceCompletedAt: new Date(Date.now() - 315 * 24 * 60 * 60 * 1000),
        firstRenewalCompleted: false,
        totalTouchpoints: 28,
        lastTouchpointDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        lastTouchpointType: 'csm',
        avgDaysBetweenTouchpoints: 12,
        engagementTrend: 'stable',
        nextExpectedStage: 'maturity',
        predictedStageChangeDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
        recommendedActions: [
          'Finalize renewal terms',
          'Address any concerns',
          'Schedule renewal meeting',
        ],
        journeyHealth: 'needs_attention',
        blockers: ['Contract terms under review'],
      },
    ];

    for (const journey of journeys) {
      if (journey.customerId) {
        await db.insert(customerJourneys).values(journey);
      }
    }
    console.log(`✅ Seeded ${journeys.length} customer journeys`);

    // Seed Renewal Opportunities (10 records)
    const renewals = [
      {
        tenantId,
        customerId: customers[0]?.id,
        contractId: existingContracts[0]?.id || 'contract_1',
        renewalType: 'standard_renewal',
        renewalStatus: 'upcoming',
        renewalProbability: '0.8500',
        contractEndDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        daysUntilRenewal: 90,
        outreachStartDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        targetCloseDate: new Date(Date.now() + 85 * 24 * 60 * 60 * 1000), // 85 days
        currentMrr: '1800.00',
        projectedMrr: '1800.00',
        mrrChange: '0.00',
        mrrChangePercent: '0.00',
        currentContractValue: '21600.00',
        projectedContractValue: '21600.00',
        expansionPotential: true,
        suggestedAddOns: ['Additional equipment', 'Premium support'],
        suggestedUpgrades: ['Enterprise tier'],
        estimatedExpansionValue: '5000.00',
        renewalRisk: 'low',
        riskFactors: [],
        strengthFactors: ['Strong health score', 'Positive engagement', 'Good payment history'],
        contactFrequency: 'monthly',
        actionPlan: ['Send renewal notice', 'Schedule renewal call', 'Present expansion options'],
        internalNotes: 'Great renewal opportunity with expansion potential',
        competitorThreats: [],
      },
      {
        tenantId,
        customerId: customers[1]?.id,
        contractId: existingContracts[1]?.id || 'contract_2',
        renewalType: 'at_risk',
        renewalStatus: 'in_progress',
        renewalProbability: '0.3500',
        contractEndDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        daysUntilRenewal: 60,
        outreachStartDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Started 5 days ago
        targetCloseDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000), // 50 days
        lastContactDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        nextContactDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        currentMrr: '2500.00',
        projectedMrr: '2000.00',
        mrrChange: '-500.00',
        mrrChangePercent: '-20.00',
        currentContractValue: '30000.00',
        projectedContractValue: '24000.00',
        expansionPotential: false,
        renewalRisk: 'high',
        riskFactors: ['Low health score', 'Payment issues', 'Declining usage'],
        strengthFactors: ['Long relationship'],
        contactFrequency: 'weekly',
        actionPlan: [
          'Address payment issues',
          'Resolve support tickets',
          'Negotiate favorable terms',
        ],
        internalNotes: 'High risk renewal - needs executive attention',
        competitorThreats: ['Competitor A showing interest'],
      },
      {
        tenantId,
        customerId: customers[2]?.id,
        contractId: existingContracts[2]?.id || 'contract_3',
        renewalType: 'at_risk',
        renewalStatus: 'in_progress',
        renewalProbability: '0.1500',
        contractEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        daysUntilRenewal: 30,
        outreachStartDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // Started 15 days ago
        targetCloseDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000), // 25 days
        lastContactDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        nextContactDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        currentMrr: '3200.00',
        projectedMrr: '0.00',
        mrrChange: '-3200.00',
        mrrChangePercent: '-100.00',
        currentContractValue: '38400.00',
        projectedContractValue: '0.00',
        expansionPotential: false,
        renewalRisk: 'critical',
        riskFactors: ['Critical health score', 'Multiple payment failures', 'No engagement'],
        strengthFactors: [],
        contactFrequency: 'biweekly',
        actionPlan: ['Executive intervention', 'Last attempt to save', 'Prepare for loss'],
        internalNotes: 'Likely to churn - prepare account transition',
        competitorThreats: ['Competitor B pricing pressure', 'In-house solution consideration'],
      },
      {
        tenantId,
        customerId: customers[3]?.id,
        contractId: existingContracts[3]?.id || 'contract_4',
        renewalType: 'expansion',
        renewalStatus: 'upcoming',
        renewalProbability: '0.9500',
        contractEndDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000), // 120 days
        daysUntilRenewal: 120,
        outreachStartDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        targetCloseDate: new Date(Date.now() + 115 * 24 * 60 * 60 * 1000), // 115 days
        currentMrr: '2200.00',
        projectedMrr: '3500.00',
        mrrChange: '1300.00',
        mrrChangePercent: '59.09',
        currentContractValue: '26400.00',
        projectedContractValue: '42000.00',
        expansionPotential: true,
        suggestedAddOns: ['Additional printers', 'Advanced analytics', 'Training package'],
        suggestedUpgrades: ['Premium tier with 24/7 support'],
        estimatedExpansionValue: '15600.00',
        renewalRisk: 'very_low',
        riskFactors: [],
        strengthFactors: [
          'Excellent health',
          'High satisfaction',
          'Growth trajectory',
          'Strong champion',
        ],
        contactFrequency: 'monthly',
        actionPlan: ['Present expansion proposal', 'Demo new features', 'Prepare ROI analysis'],
        internalNotes: 'Ideal expansion candidate - high success probability',
        competitorThreats: [],
      },
      {
        tenantId,
        customerId: customers[4]?.id,
        contractId: existingContracts[4]?.id || 'contract_5',
        renewalType: 'standard_renewal',
        renewalStatus: 'upcoming',
        renewalProbability: '0.6500',
        contractEndDate: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000), // 75 days
        daysUntilRenewal: 75,
        outreachStartDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45 days
        targetCloseDate: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000), // 70 days
        currentMrr: '1500.00',
        projectedMrr: '1500.00',
        mrrChange: '0.00',
        mrrChangePercent: '0.00',
        currentContractValue: '18000.00',
        projectedContractValue: '18000.00',
        expansionPotential: false,
        renewalRisk: 'medium',
        riskFactors: ['Below average health score'],
        strengthFactors: ['Stable usage'],
        contactFrequency: 'monthly',
        actionPlan: ['Check-in call', 'Address concerns', 'Present renewal options'],
        internalNotes: 'Standard renewal - monitor closely',
        competitorThreats: [],
      },
    ];

    for (const renewal of renewals) {
      if (renewal.customerId && renewal.contractId) {
        await db.insert(renewalOpportunities).values(renewal);
      }
    }
    console.log(`✅ Seeded ${renewals.length} renewal opportunities`);

    console.log('✅ Customer success data seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding customer success data:', error);
    throw error;
  }
}
