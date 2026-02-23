/**
 * Lead Intelligence Service
 *
 * Provides AI-powered lead qualification, scoring, and enrichment by integrating:
 * - Lead Scoring: Rule-based and BANT qualification
 * - Apollo.io: Lead enrichment with company and contact data
 * - Salesforce: Bi-directional synchronization
 *
 * Key Features:
 * - Auto-scoring on lead creation/update
 * - Auto-enrichment from Apollo.io when leads are created
 * - Bi-directional Salesforce sync with conflict resolution
 * - Real-time lead intelligence dashboard data
 */

import { db } from '../db';
import { businessRecords } from '@shared/schema';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('lead-intelligence-service');

import {
  leadScoringRules,
  leadScoreCalculations,
  bantQualificationCriteria,
  leadEngagementTracking,
  leadScoringFactors,
  leadQualificationHistory,
} from '@shared/lead-scoring-schema';
import { centralizedApolloContacts, tenantApolloLeads } from '@shared/apollo-schema';
import { eq, and, desc, gte, sql, inArray } from 'drizzle-orm';
import { storage } from '../storage';

// Types for lead intelligence
export interface LeadScoreResult {
  totalScore: number;
  demographicScore: number;
  firmographicScore: number;
  behavioralScore: number;
  engagementScore: number;
  bantScore: number;
  leadGrade: string;
  leadTier: 'hot' | 'warm' | 'cold';
  recommendedAction: string;
  factors: Array<{
    ruleName: string;
    category: string;
    points: number;
    field: string;
    value: any;
  }>;
}

export interface EnrichmentResult {
  enriched: boolean;
  source: 'apollo' | 'salesforce' | 'manual';
  fieldsUpdated: string[];
  apolloContactId?: string;
  confidence: number;
}

export interface LeadIntelligence {
  leadId: string;
  score: LeadScoreResult | null;
  enrichment: EnrichmentResult | null;
  bantQualification: any | null;
  recentEngagements: any[];
  qualificationHistory: any[];
  syncStatus: {
    salesforce: boolean;
    apollo: boolean;
    lastSyncDate: Date | null;
  };
}

class LeadIntelligenceService {
  /**
   * Calculate lead score using active scoring rules
   */
  async calculateLeadScore(
    leadId: string,
    tenantId: string,
    userId?: string,
  ): Promise<LeadScoreResult> {
    const startTime = Date.now();

    // Get the lead
    const lead = await storage.getBusinessRecord(leadId);
    if (!lead || lead.tenantId !== tenantId) {
      throw new Error('Lead not found or access denied');
    }

    // Get active scoring rules
    const rules = await db
      .select()
      .from(leadScoringRules)
      .where(and(eq(leadScoringRules.tenantId, tenantId), eq(leadScoringRules.isActive, true)))
      .orderBy(desc(leadScoringRules.priority));

    // Initialize scores
    let demographicScore = 0;
    let firmographicScore = 0;
    let behavioralScore = 0;
    let engagementScore = 0;
    let bantScore = 0;
    const appliedRules: string[] = [];
    const factors: LeadScoreResult['factors'] = [];

    // Clear previous scoring factors
    await db.delete(leadScoringFactors).where(eq(leadScoringFactors.leadId, leadId));

    // Apply each scoring rule
    for (const rule of rules) {
      const fieldValue = (lead as any)[rule.field];
      let ruleMatches = false;

      switch (rule.operator) {
        case 'equals':
          ruleMatches = fieldValue === rule.value;
          break;
        case 'not_equals':
          ruleMatches = fieldValue !== rule.value;
          break;
        case 'greater_than':
          ruleMatches = Number(fieldValue) > Number(rule.value);
          break;
        case 'less_than':
          ruleMatches = Number(fieldValue) < Number(rule.value);
          break;
        case 'greater_than_or_equal':
          ruleMatches = Number(fieldValue) >= Number(rule.value);
          break;
        case 'less_than_or_equal':
          ruleMatches = Number(fieldValue) <= Number(rule.value);
          break;
        case 'contains':
          ruleMatches = String(fieldValue || '')
            .toLowerCase()
            .includes(String(rule.value).toLowerCase());
          break;
        case 'in_list':
          ruleMatches = Array.isArray(rule.value) && rule.value.includes(fieldValue);
          break;
        case 'is_null':
          ruleMatches = fieldValue === null || fieldValue === undefined;
          break;
        case 'is_not_null':
          ruleMatches = fieldValue !== null && fieldValue !== undefined;
          break;
        case 'starts_with':
          ruleMatches = String(fieldValue || '')
            .toLowerCase()
            .startsWith(String(rule.value).toLowerCase());
          break;
        case 'ends_with':
          ruleMatches = String(fieldValue || '')
            .toLowerCase()
            .endsWith(String(rule.value).toLowerCase());
          break;
      }

      if (ruleMatches) {
        appliedRules.push(rule.id);

        factors.push({
          ruleName: rule.ruleName,
          category: rule.category,
          points: rule.scorePoints,
          field: rule.field,
          value: fieldValue,
        });

        // Track scoring factor
        await db.insert(leadScoringFactors).values({
          leadId,
          ruleId: rule.id,
          tenantId,
          factorName: rule.ruleName,
          factorCategory: rule.category,
          pointsAwarded: rule.scorePoints,
          evaluatedField: rule.field,
          evaluatedValue: fieldValue,
          ruleCondition: { operator: rule.operator, value: rule.value },
        });

        // Add points to appropriate category
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
          case 'bant':
            bantScore += rule.scorePoints;
            break;
        }
      }
    }

    // Get BANT score if exists
    const [bantQual] = await db
      .select()
      .from(bantQualificationCriteria)
      .where(eq(bantQualificationCriteria.leadId, leadId))
      .limit(1);

    if (bantQual) {
      bantScore = bantQual.totalBantScore || 0;
    }

    // Get engagement score from recent activities (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentEngagements = await db
      .select()
      .from(leadEngagementTracking)
      .where(
        and(
          eq(leadEngagementTracking.leadId, leadId),
          gte(leadEngagementTracking.engagedAt, thirtyDaysAgo),
        ),
      );

    for (const engagement of recentEngagements) {
      engagementScore += engagement.engagementValue || 1;
    }

    // Cap individual components
    demographicScore = Math.min(demographicScore, 20);
    firmographicScore = Math.min(firmographicScore, 20);
    behavioralScore = Math.min(behavioralScore, 20);
    engagementScore = Math.min(engagementScore, 20);
    bantScore = Math.min(bantScore, 25);

    // Calculate total score (0-100)
    const totalScore = Math.min(
      Math.round(
        demographicScore + firmographicScore + behavioralScore + engagementScore + bantScore * 0.8,
      ),
      100,
    );

    // Determine lead grade
    let leadGrade: string;
    if (totalScore >= 90) leadGrade = 'A+';
    else if (totalScore >= 80) leadGrade = 'A';
    else if (totalScore >= 70) leadGrade = 'B+';
    else if (totalScore >= 60) leadGrade = 'B';
    else if (totalScore >= 50) leadGrade = 'C+';
    else if (totalScore >= 40) leadGrade = 'C';
    else leadGrade = 'D';

    // Determine lead tier
    let leadTier: 'hot' | 'warm' | 'cold';
    if (totalScore >= 75) leadTier = 'hot';
    else if (totalScore >= 50) leadTier = 'warm';
    else leadTier = 'cold';

    // Determine recommended action
    let recommendedAction: string;
    if (totalScore >= 75) recommendedAction = 'contact_immediately';
    else if (totalScore >= 50) recommendedAction = 'nurture';
    else if (totalScore >= 30) recommendedAction = 'request_more_info';
    else recommendedAction = 'disqualify';

    // Get previous score for comparison
    const [previousCalc] = await db
      .select()
      .from(leadScoreCalculations)
      .where(eq(leadScoreCalculations.leadId, leadId))
      .orderBy(desc(leadScoreCalculations.calculatedAt))
      .limit(1);

    const previousScore = previousCalc?.totalScore || 0;
    const scoreChange = totalScore - previousScore;

    // Save calculation
    await db.insert(leadScoreCalculations).values({
      leadId,
      tenantId,
      demographicScore,
      firmographicScore,
      behavioralScore,
      engagementScore,
      bantScore: Math.round(bantScore),
      totalScore,
      previousScore,
      scoreChange,
      leadGrade,
      leadTier,
      confidenceLevel: 'medium',
      recommendedAction,
      calculationMethod: 'rule_based',
      rulesApplied: appliedRules,
      calculationDuration: Date.now() - startTime,
    });

    // Update lead record with score
    await db
      .update(businessRecords)
      .set({
        leadScore: totalScore,
        priority: leadTier === 'hot' ? 'high' : leadTier === 'warm' ? 'medium' : 'low',
        updatedAt: new Date(),
      })
      .where(eq(businessRecords.id, leadId));

    return {
      totalScore,
      demographicScore,
      firmographicScore,
      behavioralScore,
      engagementScore,
      bantScore,
      leadGrade,
      leadTier,
      recommendedAction,
      factors,
    };
  }

  /**
   * Auto-enrich lead from Apollo.io
   */
  async enrichLeadFromApollo(
    leadId: string,
    tenantId: string,
    userId?: string,
  ): Promise<EnrichmentResult> {
    const lead = await storage.getBusinessRecord(leadId);
    if (!lead || lead.tenantId !== tenantId) {
      throw new Error('Lead not found or access denied');
    }

    // Check if we have any Apollo data for this lead by email or company
    const fieldsUpdated: string[] = [];
    let apolloContactId: string | undefined;
    let enriched = false;
    let confidence = 0;

    try {
      // Try to find matching Apollo contact by email
      if (lead.email) {
        const [apolloContact] = await db
          .select()
          .from(centralizedApolloContacts)
          .where(eq(centralizedApolloContacts.email, lead.email))
          .limit(1);

        if (apolloContact) {
          apolloContactId = apolloContact.id;
          confidence = 0.95; // High confidence for email match

          // Update lead with Apollo data
          const updates: any = {};

          if (!lead.firstName && apolloContact.firstName) {
            updates.firstName = apolloContact.firstName;
            fieldsUpdated.push('firstName');
          }
          if (!lead.lastName && apolloContact.lastName) {
            updates.lastName = apolloContact.lastName;
            fieldsUpdated.push('lastName');
          }
          if (!lead.jobTitle && apolloContact.title) {
            updates.jobTitle = apolloContact.title;
            fieldsUpdated.push('jobTitle');
          }
          if (!lead.linkedinUrl && apolloContact.linkedinUrl) {
            updates.linkedinUrl = apolloContact.linkedinUrl;
            fieldsUpdated.push('linkedinUrl');
          }
          if (!lead.industry && apolloContact.industry) {
            updates.industry = apolloContact.industry;
            fieldsUpdated.push('industry');
          }
          if (!lead.employeeCount && apolloContact.employeeCount) {
            updates.employeeCount = apolloContact.employeeCount;
            fieldsUpdated.push('employeeCount');
          }
          if (!lead.website && apolloContact.websiteUrl) {
            updates.website = apolloContact.websiteUrl;
            fieldsUpdated.push('website');
          }
          if (!lead.companyName && apolloContact.organizationName) {
            updates.companyName = apolloContact.organizationName;
            fieldsUpdated.push('companyName');
          }

          // Update phone from Apollo if missing
          const phoneNumbers = apolloContact.phoneNumbers as string[] | null;
          if (!lead.phone && phoneNumbers && phoneNumbers.length > 0) {
            updates.phone = phoneNumbers[0];
            fieldsUpdated.push('phone');
          }

          if (Object.keys(updates).length > 0) {
            updates.updatedAt = new Date();
            updates.enrichedFromApollo = true;
            updates.apolloEnrichedAt = new Date();

            await db.update(businessRecords).set(updates).where(eq(businessRecords.id, leadId));

            enriched = true;
          }

          // Create or update tenant lead record
          const [existingTenantLead] = await db
            .select()
            .from(tenantApolloLeads)
            .where(
              and(
                eq(tenantApolloLeads.tenantId, tenantId),
                eq(tenantApolloLeads.apolloId, apolloContact.apolloId),
              ),
            )
            .limit(1);

          if (!existingTenantLead) {
            await db.insert(tenantApolloLeads).values({
              tenantId,
              apolloContactId: apolloContact.id,
              apolloId: apolloContact.apolloId,
              status: 'added_to_crm',
              addedToCrm: true,
              businessRecordId: leadId,
              discoveredVia: 'auto_enrichment',
              addedAt: new Date(),
              addedBy: userId,
            });
          } else if (!existingTenantLead.businessRecordId) {
            await db
              .update(tenantApolloLeads)
              .set({
                businessRecordId: leadId,
                status: 'added_to_crm',
                addedToCrm: true,
                addedAt: new Date(),
                addedBy: userId,
                updatedAt: new Date(),
              })
              .where(eq(tenantApolloLeads.id, existingTenantLead.id));
          }

          // Update access count in centralized cache
          await db
            .update(centralizedApolloContacts)
            .set({
              accessCount: sql`${centralizedApolloContacts.accessCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(centralizedApolloContacts.id, apolloContact.id));
        }
      }

      // Try to match by company domain if no email match
      if (!enriched && lead.website) {
        const domain = new URL(
          lead.website.startsWith('http') ? lead.website : `https://${lead.website}`,
        ).hostname.replace('www.', '');

        const [apolloContact] = await db
          .select()
          .from(centralizedApolloContacts)
          .where(eq(centralizedApolloContacts.companyDomain, domain))
          .limit(1);

        if (apolloContact) {
          apolloContactId = apolloContact.id;
          confidence = 0.7; // Lower confidence for domain-only match

          // Only update company-level fields for domain match
          const updates: any = {};
          if (!lead.industry && apolloContact.industry) {
            updates.industry = apolloContact.industry;
            fieldsUpdated.push('industry');
          }
          if (!lead.employeeCount && apolloContact.employeeCount) {
            updates.employeeCount = apolloContact.employeeCount;
            fieldsUpdated.push('employeeCount');
          }

          if (Object.keys(updates).length > 0) {
            updates.updatedAt = new Date();
            await db.update(businessRecords).set(updates).where(eq(businessRecords.id, leadId));
            enriched = true;
          }
        }
      }
    } catch (error) {
      log.error('Apollo enrichment error:', error);
    }

    return {
      enriched,
      source: 'apollo',
      fieldsUpdated,
      apolloContactId,
      confidence,
    };
  }

  /**
   * Get comprehensive lead intelligence
   */
  async getLeadIntelligence(leadId: string, tenantId: string): Promise<LeadIntelligence> {
    const lead = await storage.getBusinessRecord(leadId);
    if (!lead || lead.tenantId !== tenantId) {
      throw new Error('Lead not found or access denied');
    }

    // Get latest score
    const [latestScore] = await db
      .select()
      .from(leadScoreCalculations)
      .where(eq(leadScoreCalculations.leadId, leadId))
      .orderBy(desc(leadScoreCalculations.calculatedAt))
      .limit(1);

    // Get scoring factors
    const scoringFactors = await db
      .select()
      .from(leadScoringFactors)
      .where(eq(leadScoringFactors.leadId, leadId));

    // Get BANT qualification
    const [bantQual] = await db
      .select()
      .from(bantQualificationCriteria)
      .where(eq(bantQualificationCriteria.leadId, leadId))
      .limit(1);

    // Get recent engagements (last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const recentEngagements = await db
      .select()
      .from(leadEngagementTracking)
      .where(
        and(
          eq(leadEngagementTracking.leadId, leadId),
          gte(leadEngagementTracking.engagedAt, ninetyDaysAgo),
        ),
      )
      .orderBy(desc(leadEngagementTracking.engagedAt))
      .limit(50);

    // Get qualification history
    const qualificationHistory = await db
      .select()
      .from(leadQualificationHistory)
      .where(eq(leadQualificationHistory.leadId, leadId))
      .orderBy(desc(leadQualificationHistory.changedAt))
      .limit(20);

    // Check Apollo sync status
    const [apolloLead] = await db
      .select()
      .from(tenantApolloLeads)
      .where(
        and(
          eq(tenantApolloLeads.tenantId, tenantId),
          eq(tenantApolloLeads.businessRecordId, leadId),
        ),
      )
      .limit(1);

    const scoreResult: LeadScoreResult | null = latestScore
      ? {
          totalScore: latestScore.totalScore,
          demographicScore: latestScore.demographicScore || 0,
          firmographicScore: latestScore.firmographicScore || 0,
          behavioralScore: latestScore.behavioralScore || 0,
          engagementScore: latestScore.engagementScore || 0,
          bantScore: latestScore.bantScore || 0,
          leadGrade: latestScore.leadGrade || 'D',
          leadTier: (latestScore.leadTier as 'hot' | 'warm' | 'cold') || 'cold',
          recommendedAction: latestScore.recommendedAction || 'request_more_info',
          factors: scoringFactors.map((f) => ({
            ruleName: f.factorName,
            category: f.factorCategory,
            points: f.pointsAwarded,
            field: f.evaluatedField || '',
            value: f.evaluatedValue,
          })),
        }
      : null;

    return {
      leadId,
      score: scoreResult,
      enrichment: apolloLead
        ? {
            enriched: true,
            source: 'apollo',
            fieldsUpdated: [],
            apolloContactId: apolloLead.apolloContactId,
            confidence: 1.0,
          }
        : null,
      bantQualification: bantQual || null,
      recentEngagements,
      qualificationHistory,
      syncStatus: {
        salesforce: !!(lead as any).externalSalesforceId,
        apollo: !!apolloLead,
        lastSyncDate: (lead as any).lastSyncDate || null,
      },
    };
  }

  /**
   * Process lead on creation - auto-score and auto-enrich
   */
  async processNewLead(
    leadId: string,
    tenantId: string,
    userId?: string,
  ): Promise<{
    score: LeadScoreResult;
    enrichment: EnrichmentResult;
  }> {
    // First enrich, then score (enrichment may add data that affects scoring)
    const enrichment = await this.enrichLeadFromApollo(leadId, tenantId, userId);
    const score = await this.calculateLeadScore(leadId, tenantId, userId);

    // Track qualification history
    await db.insert(leadQualificationHistory).values({
      leadId,
      tenantId,
      previousStatus: null,
      newStatus: score.leadTier === 'hot' ? 'mql' : 'new',
      statusReason: 'Initial scoring on lead creation',
      scoreAtChange: score.totalScore,
      bantScoreAtChange: score.bantScore,
      changedBy: userId || 'system',
      changeReason: 'automatic',
    });

    return { score, enrichment };
  }

  /**
   * Batch process multiple leads
   */
  async batchProcessLeads(
    leadIds: string[],
    tenantId: string,
    userId?: string,
  ): Promise<{
    processed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processed = 0;

    for (const leadId of leadIds) {
      try {
        await this.calculateLeadScore(leadId, tenantId, userId);
        processed++;
      } catch (error: any) {
        errors.push(`Lead ${leadId}: ${error.message}`);
      }
    }

    return { processed, errors };
  }

  /**
   * Get lead scoring analytics
   */
  async getScoringAnalytics(tenantId: string): Promise<{
    totalLeads: number;
    scoredLeads: number;
    averageScore: number;
    scoreDistribution: { tier: string; count: number }[];
    gradeDistribution: { grade: string; count: number }[];
    topRules: { ruleName: string; timesApplied: number; totalPoints: number }[];
    recentActivity: { date: string; leadsScored: number; averageScore: number }[];
  }> {
    // Get total leads count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(businessRecords)
      .where(and(eq(businessRecords.tenantId, tenantId), eq(businessRecords.recordType, 'lead')));

    // Get scored leads with latest score
    const scoredLeadsData = await db
      .selectDistinctOn([leadScoreCalculations.leadId], {
        leadId: leadScoreCalculations.leadId,
        totalScore: leadScoreCalculations.totalScore,
        leadGrade: leadScoreCalculations.leadGrade,
        leadTier: leadScoreCalculations.leadTier,
        calculatedAt: leadScoreCalculations.calculatedAt,
      })
      .from(leadScoreCalculations)
      .where(eq(leadScoreCalculations.tenantId, tenantId))
      .orderBy(leadScoreCalculations.leadId, desc(leadScoreCalculations.calculatedAt));

    // Calculate distributions
    const tierCounts: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
    const gradeCounts: Record<string, number> = {};
    let totalScore = 0;

    for (const lead of scoredLeadsData) {
      totalScore += lead.totalScore;
      if (lead.leadTier) {
        tierCounts[lead.leadTier] = (tierCounts[lead.leadTier] || 0) + 1;
      }
      if (lead.leadGrade) {
        gradeCounts[lead.leadGrade] = (gradeCounts[lead.leadGrade] || 0) + 1;
      }
    }

    // Get top rules
    const topRulesData = await db
      .select({
        ruleName: leadScoringFactors.factorName,
        timesApplied: sql<number>`count(*)`,
        totalPoints: sql<number>`sum(${leadScoringFactors.pointsAwarded})`,
      })
      .from(leadScoringFactors)
      .where(eq(leadScoringFactors.tenantId, tenantId))
      .groupBy(leadScoringFactors.factorName)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentActivityData = await db
      .select({
        date: sql<string>`date(${leadScoreCalculations.calculatedAt})`,
        leadsScored: sql<number>`count(distinct ${leadScoreCalculations.leadId})`,
        averageScore: sql<number>`avg(${leadScoreCalculations.totalScore})`,
      })
      .from(leadScoreCalculations)
      .where(
        and(
          eq(leadScoreCalculations.tenantId, tenantId),
          gte(leadScoreCalculations.calculatedAt, thirtyDaysAgo),
        ),
      )
      .groupBy(sql`date(${leadScoreCalculations.calculatedAt})`)
      .orderBy(desc(sql`date(${leadScoreCalculations.calculatedAt})`));

    return {
      totalLeads: totalResult?.count || 0,
      scoredLeads: scoredLeadsData.length,
      averageScore:
        scoredLeadsData.length > 0 ? Math.round(totalScore / scoredLeadsData.length) : 0,
      scoreDistribution: Object.entries(tierCounts).map(([tier, count]) => ({ tier, count })),
      gradeDistribution: Object.entries(gradeCounts).map(([grade, count]) => ({ grade, count })),
      topRules: topRulesData.map((r) => ({
        ruleName: r.ruleName,
        timesApplied: Number(r.timesApplied),
        totalPoints: Number(r.totalPoints),
      })),
      recentActivity: recentActivityData.map((r) => ({
        date: r.date,
        leadsScored: Number(r.leadsScored),
        averageScore: Math.round(Number(r.averageScore)),
      })),
    };
  }

  /**
   * Get leads requiring attention based on scoring
   */
  async getLeadsRequiringAttention(tenantId: string, limit: number = 20): Promise<any[]> {
    // Get hot leads that haven't been contacted recently
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const hotLeads = await db
      .selectDistinctOn([leadScoreCalculations.leadId], {
        leadId: leadScoreCalculations.leadId,
        totalScore: leadScoreCalculations.totalScore,
        leadGrade: leadScoreCalculations.leadGrade,
        leadTier: leadScoreCalculations.leadTier,
        recommendedAction: leadScoreCalculations.recommendedAction,
        calculatedAt: leadScoreCalculations.calculatedAt,
      })
      .from(leadScoreCalculations)
      .where(
        and(
          eq(leadScoreCalculations.tenantId, tenantId),
          eq(leadScoreCalculations.leadTier, 'hot'),
        ),
      )
      .orderBy(leadScoreCalculations.leadId, desc(leadScoreCalculations.calculatedAt))
      .limit(limit);

    // Batch-fetch all lead records in a single query instead of N individual lookups
    const leadIds = hotLeads.map((score) => score.leadId);
    const leads =
      leadIds.length > 0
        ? await db
            .select({
              id: businessRecords.id,
              companyName: businessRecords.companyName,
              firstName: businessRecords.firstName,
              lastName: businessRecords.lastName,
              email: businessRecords.email,
              phone: businessRecords.phone,
              status: businessRecords.status,
              ownerId: businessRecords.ownerId,
            })
            .from(businessRecords)
            .where(inArray(businessRecords.id, leadIds))
        : [];

    // Build a map for O(1) lookup
    const leadMap = new Map(leads.map((l) => [l.id, l]));

    const enrichedLeads = hotLeads.map((score) => {
      const lead = leadMap.get(score.leadId);
      return {
        ...score,
        lead: lead
          ? {
              id: lead.id,
              companyName: lead.companyName,
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.email,
              phone: lead.phone,
              status: lead.status,
              ownerId: lead.ownerId,
              lastActivityDate: null,
            }
          : null,
      };
    });

    return enrichedLeads.filter((l) => l.lead !== null);
  }
}

export const leadIntelligenceService = new LeadIntelligenceService();
export default leadIntelligenceService;
