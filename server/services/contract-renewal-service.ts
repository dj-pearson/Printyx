import { db } from '../db';
import { eq, and, lt, gte, desc, sql, between } from 'drizzle-orm';
import {
  contractRenewalTracking,
  renewalProposals,
  renewalAutomationRules,
  renewalAnalytics,
  renewalCommunicationLog,
} from '@shared/schema';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Contract Renewal Autopilot Service
 *
 * AI-powered contract renewal automation and churn prevention
 */

interface RenewalAnalysisResult {
  renewalProbability: number;
  churnRiskScore: number;
  renewalRisk: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  recommendedAction:
    | 'monitor'
    | 'send_proposal'
    | 'schedule_call'
    | 'offer_incentive'
    | 'escalate_to_sales'
    | 'increase_engagement'
    | 'address_concerns';
  aiAnalysis: {
    summary: string;
    strengths: string[];
    concerns: string[];
    opportunities: string[];
    recommendedStrategy: string;
  };
  riskFactors: string[];
  opportunityFactors: string[];
  confidenceScore: number;
}

interface ProposalRecommendations {
  proposedMrr: number;
  proposedAcv: number;
  proposedTermMonths: number;
  discountPercentage: number;
  incentiveOffered: string | null;
  incentiveValue: number;
  pricingStrategy: {
    reasoning: string;
    competitivePosition: string;
    valueJustification: string;
  };
  upsellOpportunities: Array<{
    service: string;
    value: number;
    rationale: string;
  }>;
}

/**
 * Analyze contract renewal likelihood using AI
 */
export async function analyzeContractRenewal(
  tenantId: number,
  contractTrackingId: number,
): Promise<RenewalAnalysisResult> {
  const contract = await db.query.contractRenewalTracking.findFirst({
    where: and(
      eq(contractRenewalTracking.id, contractTrackingId),
      eq(contractRenewalTracking.tenantId, tenantId),
    ),
  });

  if (!contract) {
    throw new Error('Contract not found');
  }

  // Prepare data for AI analysis
  const analysisPrompt = `Analyze this contract renewal opportunity and predict renewal likelihood:

Contract Information:
- Type: ${contract.contractType}
- Customer: ${contract.customerName}
- Days Until Expiration: ${contract.daysUntilExpiration}
- Current MRR: $${contract.monthlyRecurringRevenue || 0}
- Current ACV: $${contract.annualContractValue || 0}

Customer Engagement Metrics:
- NPS Score: ${contract.npsScore !== null ? contract.npsScore : 'Unknown'}
- Satisfaction Score: ${contract.satisfactionScore !== null ? contract.satisfactionScore + '/5' : 'Unknown'}
- Last Interaction: ${contract.lastInteractionDate ? new Date(contract.lastInteractionDate).toLocaleDateString() : 'Unknown'}
- Interaction Frequency: ${contract.interactionFrequency || 'Unknown'} per month
- Support Tickets (90d): ${contract.supportTicketsLast90Days}
- Escalations (90d): ${contract.escalationsLast90Days}

Service Performance:
- Equipment Count: ${contract.equipmentCount}
- Average Uptime: ${contract.averageUptime || 'Unknown'}%
- Service Calls (90d): ${contract.serviceCallsLast90Days}
- Average Response Time: ${contract.averageResponseTime || 'Unknown'} hours
- First Time Fix Rate: ${contract.firstTimeFixRate || 'Unknown'}%

Please analyze and provide:
1. Renewal probability (0-100)
2. Churn risk score (0-100, higher = more risk)
3. Risk classification (very_low/low/medium/high/very_high)
4. Recommended action
5. Key strengths (positive factors)
6. Concerns (risk factors)
7. Upsell opportunities
8. Overall strategy recommendation

Format response as JSON:
{
  "renewalProbability": 75,
  "churnRiskScore": 25,
  "renewalRisk": "low",
  "recommendedAction": "send_proposal",
  "summary": "Overall assessment",
  "strengths": ["strength1", "strength2"],
  "concerns": ["concern1", "concern2"],
  "opportunities": ["opportunity1", "opportunity2"],
  "recommendedStrategy": "Detailed strategy",
  "confidenceScore": 85
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: analysisPrompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const aiResponse = JSON.parse(responseText);

    return {
      renewalProbability: aiResponse.renewalProbability,
      churnRiskScore: aiResponse.churnRiskScore,
      renewalRisk: aiResponse.renewalRisk,
      recommendedAction: aiResponse.recommendedAction,
      aiAnalysis: {
        summary: aiResponse.summary,
        strengths: aiResponse.strengths,
        concerns: aiResponse.concerns,
        opportunities: aiResponse.opportunities,
        recommendedStrategy: aiResponse.recommendedStrategy,
      },
      riskFactors: aiResponse.concerns,
      opportunityFactors: aiResponse.opportunities,
      confidenceScore: aiResponse.confidenceScore || 70,
    };
  } catch (error) {
    console.error('AI analysis error:', error);

    // Fallback to heuristic analysis
    let renewalProbability = 70; // Base probability
    let churnRiskScore = 30;
    const riskFactors: string[] = [];
    const opportunityFactors: string[] = [];

    // Adjust based on satisfaction
    if (contract.satisfactionScore !== null) {
      if (contract.satisfactionScore >= 4) {
        renewalProbability += 15;
        churnRiskScore -= 15;
      } else if (contract.satisfactionScore <= 2) {
        renewalProbability -= 20;
        churnRiskScore += 20;
        riskFactors.push('Low satisfaction score');
      }
    }

    // Adjust based on support tickets
    if (contract.supportTicketsLast90Days > 10) {
      renewalProbability -= 10;
      churnRiskScore += 10;
      riskFactors.push('High support ticket volume');
    }

    // Adjust based on escalations
    if (contract.escalationsLast90Days > 2) {
      renewalProbability -= 15;
      churnRiskScore += 15;
      riskFactors.push('Recent escalations');
    }

    // Adjust based on service performance
    if (contract.firstTimeFixRate && parseFloat(contract.firstTimeFixRate.toString()) < 80) {
      renewalProbability -= 10;
      churnRiskScore += 10;
      riskFactors.push('Low first-time fix rate');
    }

    // Identify opportunities
    if (contract.equipmentCount > 5) {
      opportunityFactors.push('Large equipment fleet - potential for expanded services');
    }

    // Ensure bounds
    renewalProbability = Math.max(0, Math.min(100, renewalProbability));
    churnRiskScore = Math.max(0, Math.min(100, churnRiskScore));

    // Determine risk level
    let renewalRisk: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
    if (renewalProbability >= 90) renewalRisk = 'very_low';
    else if (renewalProbability >= 70) renewalRisk = 'low';
    else if (renewalProbability >= 50) renewalRisk = 'medium';
    else if (renewalProbability >= 30) renewalRisk = 'high';
    else renewalRisk = 'very_high';

    // Determine action
    let recommendedAction: RenewalAnalysisResult['recommendedAction'];
    if (renewalRisk === 'very_low' || renewalRisk === 'low') {
      recommendedAction = 'send_proposal';
    } else if (renewalRisk === 'medium') {
      recommendedAction = 'schedule_call';
    } else {
      recommendedAction = 'escalate_to_sales';
    }

    return {
      renewalProbability,
      churnRiskScore,
      renewalRisk,
      recommendedAction,
      aiAnalysis: {
        summary: 'Heuristic analysis based on key metrics',
        strengths: riskFactors.length === 0 ? ['Stable customer relationship'] : [],
        concerns: riskFactors,
        opportunities: opportunityFactors,
        recommendedStrategy: 'Review customer engagement and address any concerns before renewal',
      },
      riskFactors,
      opportunityFactors,
      confidenceScore: 60,
    };
  }
}

/**
 * Generate renewal proposal with AI-optimized pricing
 */
export async function generateRenewalProposal(
  tenantId: number,
  contractTrackingId: number,
  analysis: RenewalAnalysisResult,
): Promise<ProposalRecommendations> {
  const contract = await db.query.contractRenewalTracking.findFirst({
    where: and(
      eq(contractRenewalTracking.id, contractTrackingId),
      eq(contractRenewalTracking.tenantId, tenantId),
    ),
  });

  if (!contract) {
    throw new Error('Contract not found');
  }

  const rules = await getRenewalAutomationRules(tenantId);

  const currentMrr = contract.monthlyRecurringRevenue
    ? parseFloat(contract.monthlyRecurringRevenue.toString())
    : 0;

  const currentAcv = contract.annualContractValue
    ? parseFloat(contract.annualContractValue.toString())
    : currentMrr * 12;

  // Prepare pricing strategy prompt
  const pricingPrompt = `Generate optimal renewal pricing for this contract:

Current Contract:
- MRR: $${currentMrr}
- ACV: $${currentAcv}
- Renewal Probability: ${analysis.renewalProbability}%
- Churn Risk: ${analysis.renewalRisk}

Analysis:
- Strengths: ${analysis.aiAnalysis.strengths.join(', ')}
- Concerns: ${analysis.aiAnalysis.concerns.join(', ')}
- Opportunities: ${analysis.aiAnalysis.opportunities.join(', ')}

Pricing Constraints:
- Max Discount: ${rules.maxDiscountPercent}%
- Min Price Increase: ${rules.minPriceIncreasePercent}%
- Max Price Increase: ${rules.maxPriceIncreasePercent}%

Recommend:
1. New MRR and ACV
2. Discount percentage (if any)
3. Contract term length (12-60 months)
4. Incentive offering (if needed)
5. Pricing strategy rationale
6. Up to 3 upsell opportunities with values

Format as JSON:
{
  "proposedMrr": 5000,
  "proposedAcv": 60000,
  "proposedTermMonths": 24,
  "discountPercentage": 5,
  "incentiveOffered": "Description or null",
  "incentiveValue": 500,
  "pricingReasoning": "Why this pricing",
  "competitivePosition": "Market positioning",
  "valueJustification": "Value delivered",
  "upsellOpportunities": [
    {"service": "Service name", "value": 1000, "rationale": "Why recommend"}
  ]
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: pricingPrompt,
        },
      ],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    const aiResponse = JSON.parse(responseText);

    return {
      proposedMrr: aiResponse.proposedMrr,
      proposedAcv: aiResponse.proposedAcv,
      proposedTermMonths: aiResponse.proposedTermMonths,
      discountPercentage: aiResponse.discountPercentage,
      incentiveOffered: aiResponse.incentiveOffered,
      incentiveValue: aiResponse.incentiveValue,
      pricingStrategy: {
        reasoning: aiResponse.pricingReasoning,
        competitivePosition: aiResponse.competitivePosition,
        valueJustification: aiResponse.valueJustification,
      },
      upsellOpportunities: aiResponse.upsellOpportunities || [],
    };
  } catch (error) {
    console.error('AI pricing error:', error);

    // Fallback to rule-based pricing
    let proposedMrr = currentMrr;
    let discountPercentage = 0;
    let incentiveOffered: string | null = null;
    let incentiveValue = 0;

    // Apply pricing strategy based on risk
    if (analysis.renewalRisk === 'high' || analysis.renewalRisk === 'very_high') {
      // High risk: offer discount
      discountPercentage = Math.min(parseFloat(rules.maxDiscountPercent?.toString() || '15'), 10);
      proposedMrr = currentMrr * (1 - discountPercentage / 100);
      incentiveOffered = 'Loyalty discount for continued partnership';
    } else if (analysis.renewalRisk === 'very_low' || analysis.renewalRisk === 'low') {
      // Low risk: can increase price
      const increasePercent = Math.min(
        parseFloat(rules.maxPriceIncreasePercent?.toString() || '5'),
        3,
      );
      proposedMrr = currentMrr * (1 + increasePercent / 100);
    }

    return {
      proposedMrr,
      proposedAcv: proposedMrr * 12,
      proposedTermMonths: 24,
      discountPercentage,
      incentiveOffered,
      incentiveValue,
      pricingStrategy: {
        reasoning: 'Risk-based pricing strategy',
        competitivePosition: 'Competitive with market rates',
        valueJustification: 'Continued service excellence and reliability',
      },
      upsellOpportunities: [],
    };
  }
}

/**
 * Create renewal proposal
 */
export async function createRenewalProposal(
  tenantId: number,
  contractTrackingId: number,
  analysis: RenewalAnalysisResult,
  recommendations: ProposalRecommendations,
): Promise<any> {
  const contract = await db.query.contractRenewalTracking.findFirst({
    where: and(
      eq(contractRenewalTracking.id, contractTrackingId),
      eq(contractRenewalTracking.tenantId, tenantId),
    ),
  });

  if (!contract) {
    throw new Error('Contract not found');
  }

  // Generate proposal number
  const proposalNumber = `REN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  // Calculate dates
  const proposalDate = new Date();
  const expirationDate = new Date(proposalDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const proposedStartDate = new Date(contract.endDate);
  const proposedEndDate = new Date(
    proposedStartDate.getTime() + recommendations.proposedTermMonths * 30 * 24 * 60 * 60 * 1000,
  );

  const discountAmount = contract.monthlyRecurringRevenue
    ? ((parseFloat(contract.monthlyRecurringRevenue.toString()) *
        recommendations.discountPercentage) /
        100) *
      12
    : 0;

  // Create proposal
  const [proposal] = await db
    .insert(renewalProposals)
    .values({
      tenantId,
      contractRenewalTrackingId: contractTrackingId,
      contractId: contract.contractId,
      customerId: contract.customerId,
      customerName: contract.customerName,
      proposalNumber,
      proposalDate,
      expirationDate,
      currentMrr: contract.monthlyRecurringRevenue || undefined,
      currentAcv: contract.annualContractValue || undefined,
      currentTermMonths:
        contract.endDate && contract.startDate
          ? Math.ceil(
              (new Date(contract.endDate).getTime() - new Date(contract.startDate).getTime()) /
                (30 * 24 * 60 * 60 * 1000),
            )
          : undefined,
      proposedMrr: recommendations.proposedMrr.toString(),
      proposedAcv: recommendations.proposedAcv.toString(),
      proposedTermMonths: recommendations.proposedTermMonths,
      proposedStartDate,
      proposedEndDate,
      basePrice: contract.monthlyRecurringRevenue || undefined,
      discountPercentage: recommendations.discountPercentage.toString(),
      discountAmount: discountAmount.toString(),
      incentiveOffered: recommendations.incentiveOffered || undefined,
      incentiveValue: recommendations.incentiveValue.toString(),
      aiPricingStrategy: recommendations.pricingStrategy as any,
      competitiveAnalysis: { analysis: 'Market-competitive pricing' } as any,
      valueProposition: analysis.aiAnalysis as any,
      riskMitigation: { concerns: analysis.riskFactors } as any,
      baseServicesIncluded: ['Standard service agreement', 'Equipment maintenance'] as any,
      additionalServicesOffered: recommendations.upsellOpportunities as any,
      upsellValue: recommendations.upsellOpportunities
        .reduce((sum, opp) => sum + opp.value, 0)
        .toString(),
      executiveSummary: `We value your partnership and are pleased to present this renewal proposal for your ${contract.contractType}.`,
      servicesSummary: 'Continued comprehensive service coverage for all equipment.',
      pricingSummary: `Proposed MRR: $${recommendations.proposedMrr.toFixed(2)} | ACV: $${recommendations.proposedAcv.toFixed(2)}`,
      status: 'draft',
      generatedBy: 'ai_autopilot',
    })
    .returning();

  // Update contract tracking
  await db
    .update(contractRenewalTracking)
    .set({
      proposalGenerated: true,
      proposalGeneratedAt: new Date(),
      proposedMrr: recommendations.proposedMrr.toString(),
      proposedAcv: recommendations.proposedAcv.toString(),
      proposedTermMonths: recommendations.proposedTermMonths,
      proposedDiscount: recommendations.discountPercentage.toString(),
      upsellOpportunities: recommendations.upsellOpportunities as any,
      updatedAt: new Date(),
    })
    .where(eq(contractRenewalTracking.id, contractTrackingId));

  return proposal;
}

/**
 * Batch analyze all expiring contracts
 */
export async function analyzeExpiringContracts(tenantId: number): Promise<{
  analyzed: number;
  proposalsCreated: number;
  results: any[];
}> {
  const rules = await getRenewalAutomationRules(tenantId);
  const renewalWindowDays = rules.renewalWindowDays || 90;

  // Find contracts expiring within renewal window
  const contracts = await db.query.contractRenewalTracking.findMany({
    where: and(
      eq(contractRenewalTracking.tenantId, tenantId),
      lt(contractRenewalTracking.daysUntilExpiration, renewalWindowDays),
      gte(contractRenewalTracking.daysUntilExpiration, 0),
      eq(contractRenewalTracking.status, 'active'),
    ),
  });

  let proposalsCreated = 0;
  const results = [];

  for (const contract of contracts) {
    try {
      // Analyze renewal probability
      const analysis = await analyzeContractRenewal(tenantId, contract.id);

      // Update tracking with analysis
      await db
        .update(contractRenewalTracking)
        .set({
          renewalProbability: analysis.renewalProbability,
          churnRiskScore: analysis.churnRiskScore,
          renewalRisk: analysis.renewalRisk,
          aiAnalysis: analysis.aiAnalysis as any,
          riskFactors: analysis.riskFactors as any,
          opportunityFactors: analysis.opportunityFactors as any,
          recommendedAction: analysis.recommendedAction,
          confidenceScore: analysis.confidenceScore,
          lastAnalyzedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(contractRenewalTracking.id, contract.id));

      // Generate proposal if recommended and auto-send is enabled
      if (
        rules.autoSendProposals &&
        analysis.recommendedAction === 'send_proposal' &&
        !contract.proposalGenerated
      ) {
        const recommendations = await generateRenewalProposal(tenantId, contract.id, analysis);
        await createRenewalProposal(tenantId, contract.id, analysis, recommendations);
        proposalsCreated++;
      }

      results.push({
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        customerName: contract.customerName,
        analysis,
        proposalCreated: analysis.recommendedAction === 'send_proposal',
      });
    } catch (error) {
      console.error(`Error analyzing contract ${contract.id}:`, error);
      results.push({
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        customerName: contract.customerName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return {
    analyzed: contracts.length,
    proposalsCreated,
    results,
  };
}

/**
 * Get dashboard metrics
 */
export async function getDashboardMetrics(tenantId: number) {
  const rules = await getRenewalAutomationRules(tenantId);

  // Count contracts in various states
  const [activeContracts, expiringSoon, atRisk, proposalsOutstanding] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(contractRenewalTracking)
      .where(
        and(
          eq(contractRenewalTracking.tenantId, tenantId),
          eq(contractRenewalTracking.status, 'active'),
        ),
      )
      .then((res) => res[0]?.count || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(contractRenewalTracking)
      .where(
        and(
          eq(contractRenewalTracking.tenantId, tenantId),
          lt(contractRenewalTracking.daysUntilExpiration, rules.renewalWindowDays || 90),
          gte(contractRenewalTracking.daysUntilExpiration, 0),
        ),
      )
      .then((res) => res[0]?.count || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(contractRenewalTracking)
      .where(
        and(
          eq(contractRenewalTracking.tenantId, tenantId),
          sql`renewal_risk IN ('high', 'very_high')`,
        ),
      )
      .then((res) => res[0]?.count || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(renewalProposals)
      .where(and(eq(renewalProposals.tenantId, tenantId), sql`status IN ('sent', 'viewed')`))
      .then((res) => res[0]?.count || 0),
  ]);

  // Get MRR at risk
  const atRiskContracts = await db.query.contractRenewalTracking.findMany({
    where: and(
      eq(contractRenewalTracking.tenantId, tenantId),
      sql`renewal_risk IN ('high', 'very_high')`,
    ),
  });

  const mrrAtRisk = atRiskContracts.reduce(
    (sum, c) =>
      sum + (c.monthlyRecurringRevenue ? parseFloat(c.monthlyRecurringRevenue.toString()) : 0),
    0,
  );

  // Get recent analytics
  const analytics = await db.query.renewalAnalytics.findFirst({
    where: and(eq(renewalAnalytics.tenantId, tenantId), eq(renewalAnalytics.periodType, 'monthly')),
    orderBy: [desc(renewalAnalytics.periodEnd)],
  });

  return {
    activeContracts,
    expiringSoon,
    atRisk,
    proposalsOutstanding,
    mrrAtRisk,
    renewalRate: analytics?.renewalRate ? parseFloat(analytics.renewalRate.toString()) : 0,
    mrrRetained: analytics?.mrrRetained ? parseFloat(analytics.mrrRetained.toString()) : 0,
    autoRenewalSuccessRate: analytics?.autoRenewalSuccessRate
      ? parseFloat(analytics.autoRenewalSuccessRate.toString())
      : 0,
  };
}

/**
 * Get contracts at risk
 */
export async function getContractsAtRisk(tenantId: number) {
  return db.query.contractRenewalTracking.findMany({
    where: and(
      eq(contractRenewalTracking.tenantId, tenantId),
      sql`renewal_risk IN ('high', 'very_high')`,
    ),
    orderBy: [contractRenewalTracking.churnRiskScore],
    limit: 50,
  });
}

/**
 * Get expiring contracts
 */
export async function getExpiringContracts(tenantId: number, days: number = 90) {
  return db.query.contractRenewalTracking.findMany({
    where: and(
      eq(contractRenewalTracking.tenantId, tenantId),
      lt(contractRenewalTracking.daysUntilExpiration, days),
      gte(contractRenewalTracking.daysUntilExpiration, 0),
    ),
    orderBy: [contractRenewalTracking.daysUntilExpiration],
    limit: 50,
  });
}

/**
 * Get or create renewal automation rules
 */
export async function getRenewalAutomationRules(tenantId: number) {
  let rules = await db.query.renewalAutomationRules.findFirst({
    where: eq(renewalAutomationRules.tenantId, tenantId),
  });

  if (!rules) {
    // Create default rules
    [rules] = await db
      .insert(renewalAutomationRules)
      .values({
        tenantId,
      })
      .returning();
  }

  return rules;
}

/**
 * Update renewal automation rules
 */
export async function updateRenewalAutomationRules(
  tenantId: number,
  updates: Partial<typeof renewalAutomationRules.$inferInsert>,
) {
  const existing = await getRenewalAutomationRules(tenantId);

  const [updated] = await db
    .update(renewalAutomationRules)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(renewalAutomationRules.id, existing.id))
    .returning();

  return updated;
}
