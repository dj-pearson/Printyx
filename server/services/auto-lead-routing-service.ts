import { db } from '../db';
import {
  businessRecords,
  leadScoringRules,
  leadScoreCalculations,
  bantQualificationCriteria,
  leadAssignmentRules,
  repCapacity,
  salesTerritories,
  leadAssignmentHistory,
  leadAssignmentQueue,
  type InsertLeadScoreCalculation,
  type InsertLeadAssignmentHistory,
  type InsertLeadAssignmentQueue
} from '@shared/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface LeadScoringResult {
  totalScore: number;
  demographicScore: number;
  firmographicScore: number;
  behavioralScore: number;
  engagementScore: number;
  bantScore: number;
  leadGrade: string;
  leadTier: string;
  aiInsights: string;
  aiRecommendations: string[];
  conversionProbability: number;
}

interface RepScoringResult {
  userId: string;
  userName: string;
  score: number;
  reasons: string[];
  capacity: {
    available: boolean;
    currentLoad: number;
    maxLoad: number;
  };
  performance: {
    conversionRate: number;
    avgResponseTime: number;
    avgDealSize: number;
  };
}

interface AutoRoutingResult {
  success: boolean;
  leadScore: LeadScoringResult;
  assignedTo: string;
  assignedRepName: string;
  assignmentReason: string;
  alternativeReps: RepScoringResult[];
  emailSent: boolean;
  processingTimeMs: number;
}

export class AutoLeadRoutingService {
  /**
   * Main entry point: Score a lead and automatically assign it
   */
  async routeLeadAutomatically(
    leadId: string,
    tenantId: string
  ): Promise<AutoRoutingResult> {
    const startTime = Date.now();

    try {
      // Step 1: Fetch lead data
      const lead = await db.query.businessRecords.findFirst({
        where: and(
          eq(businessRecords.id, leadId),
          eq(businessRecords.tenantId, tenantId)
        ),
      });

      if (!lead) {
        throw new Error(`Lead ${leadId} not found`);
      }

      // Step 2: Score the lead using AI
      const leadScore = await this.scoreLead(lead, tenantId);

      // Step 3: Find the best rep
      const repScores = await this.scoreRepsForLead(lead, leadScore, tenantId);

      if (repScores.length === 0) {
        throw new Error('No available reps found for assignment');
      }

      // Best rep is first in sorted array
      const bestRep = repScores[0];

      // Step 4: Assign the lead
      await this.assignLeadToRep(
        leadId,
        bestRep.userId,
        tenantId,
        'auto_ai_routing',
        leadScore
      );

      // Step 5: Send email notification (async, don't wait)
      const emailSent = await this.sendAssignmentEmail(
        lead,
        bestRep,
        leadScore
      ).catch(err => {
        console.error('Failed to send assignment email:', err);
        return false;
      });

      const processingTimeMs = Date.now() - startTime;

      return {
        success: true,
        leadScore,
        assignedTo: bestRep.userId,
        assignedRepName: bestRep.userName,
        assignmentReason: repScores[0].reasons.join('; '),
        alternativeReps: repScores.slice(1, 4), // Top 3 alternatives
        emailSent,
        processingTimeMs,
      };
    } catch (error) {
      console.error('Auto lead routing failed:', error);
      throw error;
    }
  }

  /**
   * Score a lead using AI and scoring rules
   */
  private async scoreLead(
    lead: any,
    tenantId: string
  ): Promise<LeadScoringResult> {
    // Fetch scoring rules
    const rules = await db.query.leadScoringRules.findMany({
      where: and(
        eq(leadScoringRules.tenantId, tenantId),
        eq(leadScoringRules.isActive, true)
      ),
      orderBy: [desc(leadScoringRules.priority)],
    });

    // Calculate base scores from rules
    let demographicScore = 0;
    let firmographicScore = 0;
    let behavioralScore = 0;
    let engagementScore = 0;

    for (const rule of rules) {
      if (this.evaluateRule(lead, rule)) {
        switch (rule.category) {
          case 'demographic':
            demographicScore += rule.scorePoints;
            break;
          case 'firmographic':
            firmographicScore += rule.scorePoints;
            break;
          case 'behavioral':
            behavioralScore += rule.scorePoints;
            break;
          case 'engagement':
            engagementScore += rule.scorePoints;
            break;
        }
      }
    }

    // Get BANT score if exists
    const bantData = await db.query.bantQualificationCriteria.findFirst({
      where: and(
        eq(bantQualificationCriteria.leadId, lead.id),
        eq(bantQualificationCriteria.tenantId, tenantId)
      ),
    });
    const bantScore = bantData?.totalBantScore || 0;

    // Calculate total (out of 100)
    const totalScore = Math.min(100, Math.round(
      (demographicScore * 0.2) +
      (firmographicScore * 0.2) +
      (behavioralScore * 0.15) +
      (engagementScore * 0.2) +
      (bantScore * 0.25)
    ));

    // Use AI to generate insights
    const aiAnalysis = await this.getAILeadInsights(lead, totalScore);

    // Determine grade and tier
    const leadGrade = this.calculateLeadGrade(totalScore);
    const leadTier = totalScore >= 70 ? 'hot' : totalScore >= 50 ? 'warm' : 'cold';

    // Save score calculation
    await db.insert(leadScoreCalculations).values({
      leadId: lead.id,
      tenantId,
      demographicScore,
      firmographicScore,
      behavioralScore,
      engagementScore,
      bantScore,
      totalScore,
      leadGrade,
      leadTier,
      predictionScore: aiAnalysis.conversionProbability,
      aiInsights: aiAnalysis.insights,
      aiRecommendations: aiAnalysis.recommendations,
    });

    return {
      totalScore,
      demographicScore,
      firmographicScore,
      behavioralScore,
      engagementScore,
      bantScore,
      leadGrade,
      leadTier,
      aiInsights: aiAnalysis.insights,
      aiRecommendations: aiAnalysis.recommendations,
      conversionProbability: aiAnalysis.conversionProbability,
    };
  }

  /**
   * Use Claude AI to analyze the lead and provide insights
   */
  private async getAILeadInsights(lead: any, totalScore: number): Promise<{
    insights: string;
    recommendations: string[];
    conversionProbability: number;
  }> {
    try {
      const prompt = `Analyze this sales lead and provide insights:

Lead Information:
- Company: ${lead.companyName || 'Unknown'}
- Industry: ${lead.industry || 'Unknown'}
- Size: ${lead.employeeCount || 'Unknown'} employees
- Revenue: $${lead.annualRevenue || 'Unknown'}
- Location: ${lead.city}, ${lead.state}
- Source: ${lead.source || 'Unknown'}
- Current Score: ${totalScore}/100

Contact:
- Name: ${lead.firstName} ${lead.lastName}
- Title: ${lead.title || 'Unknown'}
- Email: ${lead.email || 'None'}
- Phone: ${lead.phone || 'None'}

Provide:
1. Brief insights about this lead's potential (2-3 sentences)
2. Top 3 recommended actions to convert this lead
3. Estimated conversion probability (0-100%)

Format as JSON:
{
  "insights": "...",
  "recommendations": ["...", "...", "..."],
  "conversionProbability": 75
}`;

      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = message.content[0];
      if (content.type === 'text') {
        // Extract JSON from response
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return result;
        }
      }

      // Fallback if AI fails
      return {
        insights: `Lead with score ${totalScore}/100. ${totalScore >= 70 ? 'High potential' : totalScore >= 50 ? 'Medium potential' : 'Needs nurturing'}.`,
        recommendations: [
          'Contact within 5 minutes',
          'Research company background',
          'Prepare custom pitch'
        ],
        conversionProbability: totalScore,
      };
    } catch (error) {
      console.error('AI analysis failed:', error);
      // Return fallback
      return {
        insights: `Lead scored ${totalScore}/100 based on demographic and firmographic data.`,
        recommendations: ['Follow up promptly', 'Qualify BANT', 'Send introduction email'],
        conversionProbability: totalScore,
      };
    }
  }

  /**
   * Score all available reps for this lead
   */
  private async scoreRepsForLead(
    lead: any,
    leadScore: LeadScoringResult,
    tenantId: string
  ): Promise<RepScoringResult[]> {
    // Get all available reps with capacity
    const reps = await db.query.repCapacity.findMany({
      where: and(
        eq(repCapacity.tenantId, tenantId),
        eq(repCapacity.isAvailable, true)
      ),
    });

    if (reps.length === 0) {
      throw new Error('No available sales reps');
    }

    // Score each rep
    const repScores: RepScoringResult[] = [];

    for (const rep of reps) {
      const reasons: string[] = [];
      let score = 50; // Base score

      // Check capacity
      const capacityUtilization = rep.currentActiveLeads / (rep.maxActiveLeads || 50);
      if (capacityUtilization < 0.6) {
        score += 20;
        reasons.push('Low workload');
      } else if (capacityUtilization < 0.8) {
        score += 10;
        reasons.push('Moderate workload');
      } else {
        score -= 10;
        reasons.push('High workload');
      }

      // Check performance metrics
      if (rep.conversionRate && parseFloat(rep.conversionRate.toString()) > 0.3) {
        score += 15;
        reasons.push(`High conversion rate (${(parseFloat(rep.conversionRate.toString()) * 100).toFixed(0)}%)`);
      }

      if (rep.averageResponseTimeMinutes && rep.averageResponseTimeMinutes < 10) {
        score += 10;
        reasons.push('Fast response time');
      }

      // Check skills match (if lead has product interest)
      if (rep.skills && rep.skills.length > 0) {
        score += 5;
        reasons.push('Relevant skills');
      }

      // Geographic match
      const territories = await db.query.salesTerritories.findMany({
        where: and(
          eq(salesTerritories.tenantId, tenantId),
          eq(salesTerritories.ownerId, rep.userId),
          eq(salesTerritories.isActive, true)
        ),
      });

      for (const territory of territories) {
        if (this.leadMatchesTerritory(lead, territory)) {
          score += 25;
          reasons.push(`Territory match: ${territory.territoryName}`);
          break;
        }
      }

      // Lead score match (high-value leads to top performers)
      if (leadScore.totalScore >= 70 && rep.conversionRate && parseFloat(rep.conversionRate.toString()) > 0.25) {
        score += 10;
        reasons.push('Top performer for hot lead');
      }

      repScores.push({
        userId: rep.userId,
        userName: rep.userId, // TODO: Join with users table for actual name
        score,
        reasons,
        capacity: {
          available: rep.isAvailable,
          currentLoad: rep.currentActiveLeads,
          maxLoad: rep.maxActiveLeads || 50,
        },
        performance: {
          conversionRate: parseFloat(rep.conversionRate?.toString() || '0'),
          avgResponseTime: rep.averageResponseTimeMinutes || 0,
          avgDealSize: parseFloat(rep.averageDealSize?.toString() || '0'),
        },
      });
    }

    // Sort by score (highest first)
    return repScores.sort((a, b) => b.score - a.score);
  }

  /**
   * Assign lead to rep and update all tracking
   */
  private async assignLeadToRep(
    leadId: string,
    repUserId: string,
    tenantId: string,
    reason: string,
    leadScore: LeadScoringResult
  ): Promise<void> {
    // Update lead owner
    await db.update(businessRecords)
      .set({
        ownerId: repUserId,
        status: 'assigned',
        updatedAt: new Date(),
      })
      .where(and(
        eq(businessRecords.id, leadId),
        eq(businessRecords.tenantId, tenantId)
      ));

    // Record in assignment history
    await db.insert(leadAssignmentHistory).values({
      leadId,
      tenantId,
      assignedTo: repUserId,
      assignmentReason: reason,
      assignedBy: 'system',
      assignmentNotes: `AI-powered auto-routing. Lead score: ${leadScore.totalScore}/100. Grade: ${leadScore.leadGrade}. Conversion probability: ${leadScore.conversionProbability}%`,
    });

    // Update rep capacity
    await db.execute(sql`
      UPDATE rep_capacity
      SET
        current_active_leads = current_active_leads + 1,
        leads_assigned_today = leads_assigned_today + 1,
        leads_assigned_this_week = leads_assigned_this_week + 1
      WHERE user_id = ${repUserId} AND tenant_id = ${tenantId}
    `);
  }

  /**
   * Send automated email to lead
   */
  private async sendAssignmentEmail(
    lead: any,
    rep: RepScoringResult,
    leadScore: LeadScoringResult
  ): Promise<boolean> {
    // TODO: Integrate with email service
    // For now, just log
    console.log(`📧 Would send email to ${lead.email}:
      - Assigned to: ${rep.userName}
      - Lead score: ${leadScore.totalScore}/100
      - Next step: ${leadScore.aiRecommendations[0]}
    `);

    return true; // Simulate success
  }

  /**
   * Helper: Evaluate if a scoring rule matches the lead
   */
  private evaluateRule(lead: any, rule: any): boolean {
    const fieldValue = lead[rule.field];
    const ruleValue = rule.value;

    switch (rule.operator) {
      case 'equals':
        return fieldValue === ruleValue;
      case 'not_equals':
        return fieldValue !== ruleValue;
      case 'greater_than':
        return parseFloat(fieldValue) > parseFloat(ruleValue);
      case 'less_than':
        return parseFloat(fieldValue) < parseFloat(ruleValue);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(ruleValue).toLowerCase());
      case 'in_list':
        return Array.isArray(ruleValue) && ruleValue.includes(fieldValue);
      default:
        return false;
    }
  }

  /**
   * Helper: Check if lead matches territory
   */
  private leadMatchesTerritory(lead: any, territory: any): boolean {
    const geoRules = territory.geographicRules;
    if (geoRules) {
      if (geoRules.states && lead.state) {
        return geoRules.states.includes(lead.state);
      }
      if (geoRules.cities && lead.city) {
        return geoRules.cities.includes(lead.city);
      }
      if (geoRules.zipCodes && lead.postalCode) {
        return geoRules.zipCodes.includes(lead.postalCode);
      }
    }

    const accountRules = territory.accountRules;
    if (accountRules) {
      if (accountRules.industries && lead.industry) {
        return accountRules.industries.includes(lead.industry);
      }
    }

    return false;
  }

  /**
   * Helper: Calculate letter grade from score
   */
  private calculateLeadGrade(score: number): string {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    return 'D';
  }
}

// Export singleton
export const autoLeadRoutingService = new AutoLeadRoutingService();
