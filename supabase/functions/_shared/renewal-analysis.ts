/**
 * Renewal analysis, shared shape (EDGE-002g).
 *
 * /api/contract-renewal/analyze-all runs on Express in dev and is being moved
 * to the contract-renewal edge function for production. Both sides need the
 * same prompt text and — more importantly — the same DETERMINISTIC fallback,
 * which is what actually runs whenever the model call fails or no API key is
 * configured.
 *
 * Node and Deno cannot import each other, so the logic lives here and
 * server/services/contract-renewal-service.ts re-exports its own copy through
 * thin wrappers. server/tests/unit/renewal-analysis-parity.test.ts imports both
 * and asserts identical output, so a change landing in only one file fails.
 *
 * This module is intentionally free of Deno and Node APIs: it is pure, which is
 * what makes it testable from vitest.
 */

export type RenewalRisk = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export type RecommendedAction =
  | 'monitor'
  | 'send_proposal'
  | 'schedule_call'
  | 'offer_incentive'
  | 'escalate_to_sales'
  | 'increase_engagement'
  | 'address_concerns';

/**
 * The contract fields the analysis reads, in camelCase.
 *
 * PostgREST hands the edge function snake_case rows, so the caller there maps
 * with toCamel first; Drizzle already produces this shape on the Express side.
 */
export interface RenewalAnalysisInput {
  contractType?: string | null;
  customerName?: string | null;
  daysUntilExpiration?: number | null;
  monthlyRecurringRevenue?: string | number | null;
  annualContractValue?: string | number | null;
  npsScore?: number | null;
  satisfactionScore?: number | null;
  lastInteractionDate?: string | Date | null;
  interactionFrequency?: number | null;
  supportTicketsLast90Days?: number | null;
  escalationsLast90Days?: number | null;
  equipmentCount?: number | null;
  averageUptime?: string | number | null;
  serviceCallsLast90Days?: number | null;
  averageResponseTime?: string | number | null;
  firstTimeFixRate?: string | number | null;
}

export interface RenewalAnalysisResult {
  renewalProbability: number;
  churnRiskScore: number;
  renewalRisk: RenewalRisk;
  recommendedAction: RecommendedAction;
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

/** Renders a date the way the original prompt did, or 'Unknown'. */
function promptDate(value: string | Date | null | undefined): string {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleDateString();
}

/** The analysis prompt. Kept identical on both sides so results do not drift. */
export function buildRenewalAnalysisPrompt(contract: RenewalAnalysisInput): string {
  return `Analyze this contract renewal opportunity and predict renewal likelihood:

Contract Information:
- Type: ${contract.contractType}
- Customer: ${contract.customerName}
- Days Until Expiration: ${contract.daysUntilExpiration}
- Current MRR: $${contract.monthlyRecurringRevenue || 0}
- Current ACV: $${contract.annualContractValue || 0}

Customer Engagement Metrics:
- NPS Score: ${contract.npsScore !== null && contract.npsScore !== undefined ? contract.npsScore : 'Unknown'}
- Satisfaction Score: ${contract.satisfactionScore !== null && contract.satisfactionScore !== undefined ? contract.satisfactionScore + '/5' : 'Unknown'}
- Last Interaction: ${promptDate(contract.lastInteractionDate)}
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
}

/** Maps a renewal probability onto the risk band. */
export function renewalRiskFor(renewalProbability: number): RenewalRisk {
  if (renewalProbability >= 90) return 'very_low';
  if (renewalProbability >= 70) return 'low';
  if (renewalProbability >= 50) return 'medium';
  if (renewalProbability >= 30) return 'high';
  return 'very_high';
}

/** Maps a risk band onto the action the autopilot should take. */
export function recommendedActionFor(risk: RenewalRisk): RecommendedAction {
  if (risk === 'very_low' || risk === 'low') return 'send_proposal';
  if (risk === 'medium') return 'schedule_call';
  return 'escalate_to_sales';
}

/**
 * Deterministic analysis used whenever the model call is unavailable or fails.
 *
 * This is not a placeholder: with no CLAUDE_API_KEY configured it is the only
 * path that ever runs, so its numbers are the ones the dashboard shows.
 */
export function heuristicRenewalAnalysis(contract: RenewalAnalysisInput): RenewalAnalysisResult {
  let renewalProbability = 70;
  let churnRiskScore = 30;
  const riskFactors: string[] = [];
  const opportunityFactors: string[] = [];

  if (contract.satisfactionScore !== null && contract.satisfactionScore !== undefined) {
    if (contract.satisfactionScore >= 4) {
      renewalProbability += 15;
      churnRiskScore -= 15;
    } else if (contract.satisfactionScore <= 2) {
      renewalProbability -= 20;
      churnRiskScore += 20;
      riskFactors.push('Low satisfaction score');
    }
  }

  if ((contract.supportTicketsLast90Days ?? 0) > 10) {
    renewalProbability -= 10;
    churnRiskScore += 10;
    riskFactors.push('High support ticket volume');
  }

  if ((contract.escalationsLast90Days ?? 0) > 2) {
    renewalProbability -= 15;
    churnRiskScore += 15;
    riskFactors.push('Recent escalations');
  }

  if (contract.firstTimeFixRate && parseFloat(contract.firstTimeFixRate.toString()) < 80) {
    renewalProbability -= 10;
    churnRiskScore += 10;
    riskFactors.push('Low first-time fix rate');
  }

  if ((contract.equipmentCount ?? 0) > 5) {
    opportunityFactors.push('Large equipment fleet - potential for expanded services');
  }

  renewalProbability = Math.max(0, Math.min(100, renewalProbability));
  churnRiskScore = Math.max(0, Math.min(100, churnRiskScore));

  const renewalRisk = renewalRiskFor(renewalProbability);

  return {
    renewalProbability,
    churnRiskScore,
    renewalRisk,
    recommendedAction: recommendedActionFor(renewalRisk),
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
