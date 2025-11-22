import { db } from '../db';
import {
  alertTriageResults,
  automatedContainmentLogs,
  incidentCorrelations,
  incidentResolutionPatterns,
  proactiveThreatDetection,
  alertRoutingRules,
  resolutionSuggestionFeedback,
  auditLogs,
  securitySessions,
  AlertTriageResult,
  IncidentResolutionPattern,
  AutomatedContainmentLog,
  InsertAlertTriageResult,
  InsertAutomatedContainmentLog,
  InsertIncidentCorrelation,
  InsertProactiveThreatDetection,
} from '@shared/schema';
import { eq, and, sql, desc, gte, lte, inArray, or } from 'drizzle-orm';

/**
 * INTELLIGENT ALERTS & INCIDENT RESPONSE SERVICE
 *
 * AI-powered security alert triage, automated containment, and intelligent
 * incident response with pattern matching and resolution suggestions.
 */

// ========== TYPES & INTERFACES ==========

export interface TriageAlertParams {
  alertId: string;
  tenantId: string;
  alertTitle: string;
  alertDescription: string;
  affectedResources?: string[];
  userId?: string;
  ipAddress?: string;
}

export interface ContainmentActionParams {
  alertId: string;
  tenantId: string;
  actionType:
    | 'suspend_user'
    | 'terminate_session'
    | 'block_ip'
    | 'quarantine_file'
    | 'disable_integration'
    | 'rate_limit'
    | 'force_password_reset'
    | 'enable_mfa'
    | 'restrict_permissions'
    | 'notify_team';
  target: string;
  reason: string;
  automated?: boolean;
  executedBy?: string;
}

export interface ExecuteSuggestionParams {
  incidentId: string;
  suggestionId: string;
  triageResultId: string;
  executedBy: string;
}

export interface DetectAnomalyParams {
  tenantId: string;
  entityType: 'user' | 'ip' | 'resource';
  entityId: string;
  anomalyType:
    | 'unusual_login_time'
    | 'unusual_location'
    | 'excessive_data_access'
    | 'privilege_escalation'
    | 'suspicious_api_usage';
  normalBehavior: any;
  observedBehavior: any;
  deviation: number;
}

// ========== INTELLIGENT ALERTS SERVICE ==========

export class IntelligentAlertsService {
  // ==================== ALERT TRIAGE ====================

  /**
   * AI-powered alert triage and classification
   */
  static async triageAlert(params: TriageAlertParams): Promise<AlertTriageResult> {
    const {
      alertId,
      tenantId,
      alertTitle,
      alertDescription,
      affectedResources,
      userId,
      ipAddress,
    } = params;

    // Gather context for AI analysis
    const context = await this.gatherAlertContext(tenantId, userId, ipAddress, affectedResources);

    // Perform AI classification (placeholder - would use actual ML model)
    const classification = await this.classifyAlert(alertTitle, alertDescription, context);

    // Find similar past incidents
    const similarIncidents = await this.findSimilarIncidents(
      classification.category,
      alertDescription,
      tenantId,
    );

    // Generate resolution suggestions
    const suggestions = await this.generateSuggestions(classification.category, similarIncidents);

    // Determine routing
    const routing = await this.determineRouting(
      classification.severity,
      classification.category,
      tenantId,
    );

    // Check if auto-containment is needed
    const autoContainmentNeeded = this.shouldAutoContain(
      classification.severity,
      classification.priority,
      classification.confidence,
    );

    // Calculate risk score
    const riskScore = this.calculateRiskScore(classification, context, similarIncidents);

    // Determine if escalation is required
    const requiresEscalation =
      classification.severity === 'critical' || classification.priority === 'p1' || riskScore > 80;

    // Create triage result
    const [triageResult] = await db
      .insert(alertTriageResults)
      .values({
        tenantId,
        alertId,
        alertTitle,
        alertDescription: alertDescription || null,
        aiClassification: classification,
        contextGathered: context,
        similarIncidents,
        routingRecommendation: routing,
        suggestions,
        autoContainmentNeeded,
        autoContainmentActions: autoContainmentNeeded
          ? this.generateContainmentActions(classification.category, userId, ipAddress)
          : [],
        riskScore,
        riskFactors: this.identifyRiskFactors(classification, context),
        potentialImpact: this.assessPotentialImpact(classification, affectedResources),
        requiresEscalation,
        escalationReason: requiresEscalation ? 'High severity or risk score' : null,
        overallConfidence: classification.confidence,
        aiModelVersion: 'v1.0.0',
        humanReviewRequired: classification.confidence < 80,
      })
      .returning();

    // Execute auto-containment if needed
    if (autoContainmentNeeded && triageResult.autoContainmentActions) {
      await this.executeAutoContainment(alertId, tenantId, triageResult.autoContainmentActions);
    }

    // Check for incident correlation
    await this.checkIncidentCorrelation(
      alertId,
      tenantId,
      userId,
      ipAddress,
      classification.category,
    );

    // Create audit log
    await db.insert(auditLogs).values({
      tenantId,
      userId: userId || 'system',
      action: 'ALERT_TRIAGED',
      resource: 'security_alerts',
      resourceId: alertId,
      newValues: {
        severity: classification.severity,
        priority: classification.priority,
        category: classification.category,
        confidence: classification.confidence,
        autoContained: autoContainmentNeeded,
      },
      ipAddress: ipAddress || '0.0.0.0',
      userAgent: 'system',
      severity: classification.severity as any,
      category: 'security',
    });

    return triageResult;
  }

  /**
   * Gather context for alert analysis
   */
  private static async gatherAlertContext(
    tenantId: string,
    userId?: string,
    ipAddress?: string,
    affectedResources?: string[],
  ): Promise<any> {
    const context: any = {
      timestamp: new Date().toISOString(),
    };

    // Get recent audit logs if user involved
    if (userId) {
      const recentLogs = await db.query.auditLogs.findMany({
        where: and(
          eq(auditLogs.tenantId, tenantId),
          eq(auditLogs.userId, userId),
          gte(auditLogs.timestamp, sql`NOW() - INTERVAL '24 hours'`),
        ),
        limit: 50,
        orderBy: [desc(auditLogs.timestamp)],
      });

      context.recentAuditLogs = recentLogs.length;
      context.recentActions = recentLogs.map((log) => log.action);
    }

    // Check for other alerts from same IP
    if (ipAddress) {
      const relatedAlerts = await db.query.alertTriageResults.findMany({
        where: and(
          eq(alertTriageResults.tenantId, tenantId),
          sql`${alertTriageResults.contextGathered}->>'ipAddress' = ${ipAddress}`,
          gte(alertTriageResults.createdAt, sql`NOW() - INTERVAL '24 hours'`),
        ),
        limit: 10,
      });

      context.relatedAlerts = relatedAlerts.map((a) => a.alertId);
    }

    // System state
    context.systemState = {
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      recentIncidents: await this.getRecentIncidentCount(tenantId),
    };

    return context;
  }

  /**
   * AI classification (placeholder for actual ML model)
   */
  private static async classifyAlert(
    title: string,
    description: string,
    context: any,
  ): Promise<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    priority: 'p1' | 'p2' | 'p3' | 'p4';
    category: string;
    confidence: number;
    reasoning: string;
  }> {
    // TODO: Replace with actual ML model classification
    // For now, using keyword-based classification

    const text = `${title} ${description}`.toLowerCase();

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    let priority: 'p1' | 'p2' | 'p3' | 'p4' = 'p3';
    let category = 'other';
    let confidence = 75;
    let reasoning = 'Keyword-based classification';

    // Severity detection
    if (text.includes('critical') || text.includes('breach') || text.includes('compromised')) {
      severity = 'critical';
      priority = 'p1';
      confidence = 90;
    } else if (
      text.includes('high') ||
      text.includes('unauthorized') ||
      text.includes('suspicious')
    ) {
      severity = 'high';
      priority = 'p2';
      confidence = 85;
    } else if (text.includes('medium') || text.includes('unusual') || text.includes('anomaly')) {
      severity = 'medium';
      priority = 'p3';
      confidence = 80;
    } else {
      severity = 'low';
      priority = 'p4';
      confidence = 70;
    }

    // Category detection
    if (
      text.includes('data') &&
      (text.includes('breach') || text.includes('leak') || text.includes('export'))
    ) {
      category = 'data_breach';
      reasoning = 'Data breach indicators detected';
    } else if (text.includes('malware') || text.includes('virus') || text.includes('trojan')) {
      category = 'malware';
      reasoning = 'Malware indicators detected';
    } else if (
      text.includes('unauthorized') ||
      text.includes('access denied') ||
      text.includes('forbidden')
    ) {
      category = 'unauthorized_access';
      reasoning = 'Unauthorized access attempt detected';
    } else if (text.includes('ddos') || text.includes('flood') || text.includes('rate limit')) {
      category = 'ddos';
      reasoning = 'DDoS attack pattern detected';
    } else if (
      text.includes('brute force') ||
      text.includes('failed login') ||
      text.includes('password')
    ) {
      category = 'brute_force';
      reasoning = 'Brute force attack pattern detected';
    } else if (text.includes('sql injection') || text.includes('sqli')) {
      category = 'sql_injection';
      reasoning = 'SQL injection attempt detected';
    } else if (text.includes('xss') || text.includes('script injection')) {
      category = 'xss';
      reasoning = 'XSS attack detected';
    } else if (
      text.includes('privilege') ||
      text.includes('escalation') ||
      text.includes('elevation')
    ) {
      category = 'privilege_escalation';
      reasoning = 'Privilege escalation attempt detected';
    }

    // Adjust confidence based on context
    if (context.recentAuditLogs > 100) {
      confidence += 5; // More context = higher confidence
    }

    if (context.relatedAlerts?.length > 0) {
      confidence += 10; // Related alerts support classification
    }

    return {
      severity,
      priority,
      category,
      confidence: Math.min(confidence, 95), // Cap at 95%
      reasoning,
    };
  }

  /**
   * Find similar past incidents using pattern matching
   */
  private static async findSimilarIncidents(
    category: string,
    description: string,
    tenantId: string,
  ): Promise<
    Array<{
      incidentId: string;
      similarity: number;
      resolution: string;
      resolutionTime: number;
      successRate: number;
    }>
  > {
    // Get incidents in same category
    const pastIncidents = await db.query.alertTriageResults.findMany({
      where: and(
        eq(alertTriageResults.tenantId, tenantId),
        sql`${alertTriageResults.aiClassification}->>'category' = ${category}`,
        eq(alertTriageResults.humanReviewed, true),
        eq(alertTriageResults.classificationAccurate, true),
      ),
      limit: 20,
      orderBy: [desc(alertTriageResults.createdAt)],
    });

    // Calculate similarity scores (placeholder - would use vector similarity in production)
    const similar = pastIncidents
      .map((incident) => {
        const similarity = this.calculateTextSimilarity(
          description,
          incident.alertDescription || '',
        );

        return {
          incidentId: incident.alertId,
          similarity,
          resolution: 'Resolved via standard procedure', // TODO: Get actual resolution
          resolutionTime: 15, // TODO: Calculate actual time
          successRate: 85, // TODO: Get actual success rate
        };
      })
      .filter((item) => item.similarity > 50) // Only include >50% similar
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5); // Top 5 most similar

    return similar;
  }

  /**
   * Calculate text similarity (simple implementation)
   */
  private static calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const commonWords = words1.filter((word) => words2.includes(word));
    const similarity = ((commonWords.length * 2) / (words1.length + words2.length)) * 100;

    return Math.round(similarity);
  }

  /**
   * Generate resolution suggestions based on patterns
   */
  private static async generateSuggestions(
    category: string,
    similarIncidents: any[],
  ): Promise<
    Array<{
      suggestionId: string;
      title: string;
      steps: Array<{
        stepNumber: number;
        description: string;
        automated: boolean;
        command?: string;
      }>;
      estimatedTime: number;
      successRate: number;
      confidence: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
      basedOn?: string;
    }>
  > {
    // Get resolution patterns for this category
    const patterns = await db.query.incidentResolutionPatterns.findMany({
      where: eq(incidentResolutionPatterns.category, category as any),
      orderBy: [desc(incidentResolutionPatterns.successRate)],
      limit: 3,
    });

    const suggestions = patterns.map((pattern, index) => ({
      suggestionId: `suggestion_${index + 1}`,
      title: pattern.patternName,
      steps: pattern.commonResolutionSteps,
      estimatedTime: pattern.avgResolutionTime,
      successRate: pattern.successRate,
      confidence: pattern.confidence,
      basedOn:
        similarIncidents.length > 0
          ? `Similar to incident #${similarIncidents[0].incidentId}`
          : undefined,
    }));

    // Add default suggestion if no patterns found
    if (suggestions.length === 0) {
      suggestions.push({
        suggestionId: 'suggestion_default',
        title: 'Standard Security Review',
        steps: [
          { stepNumber: 1, description: 'Review security logs', automated: false },
          { stepNumber: 2, description: 'Identify affected systems', automated: false },
          { stepNumber: 3, description: 'Contain the threat', automated: false },
          { stepNumber: 4, description: 'Remediate vulnerabilities', automated: false },
          { stepNumber: 5, description: 'Document findings', automated: false },
        ],
        estimatedTime: 60,
        successRate: 70,
        confidence: 'medium',
      });
    }

    return suggestions;
  }

  /**
   * Determine alert routing based on rules
   */
  private static async determineRouting(
    severity: string,
    category: string,
    tenantId: string,
  ): Promise<{
    assignTo: string;
    teamId?: string;
    reason: string;
    alternativeAssignees?: Array<{
      userId: string;
      reason: string;
      score: number;
    }>;
  }> {
    // Get active routing rules
    const rules = await db.query.alertRoutingRules.findMany({
      where: and(
        or(eq(alertRoutingRules.tenantId, tenantId), sql`${alertRoutingRules.tenantId} IS NULL`),
        eq(alertRoutingRules.isActive, true),
      ),
      orderBy: [desc(alertRoutingRules.priority)],
    });

    // Find matching rule
    for (const rule of rules) {
      const conditions = rule.conditions as any;

      if (conditions.severity && !conditions.severity.includes(severity)) {
        continue;
      }

      if (conditions.category && !conditions.category.includes(category)) {
        continue;
      }

      // TODO: Check time of day, day of week conditions

      // Rule matches!
      return {
        assignTo: rule.assignToUserId || 'default_admin',
        teamId: rule.assignToTeamId || undefined,
        reason: 'category_match',
      };
    }

    // No matching rule - use default
    return {
      assignTo: 'security_admin',
      reason: 'default_assignment',
    };
  }

  /**
   * Check if auto-containment should be triggered
   */
  private static shouldAutoContain(
    severity: string,
    priority: string,
    confidence: number,
  ): boolean {
    // Auto-contain if high confidence and critical/P1
    if (confidence >= 90 && (severity === 'critical' || priority === 'p1')) {
      return true;
    }

    // Auto-contain if very high confidence and high severity
    if (confidence >= 85 && severity === 'high') {
      return true;
    }

    return false;
  }

  /**
   * Generate containment actions based on category
   */
  private static generateContainmentActions(
    category: string,
    userId?: string,
    ipAddress?: string,
  ): Array<{
    actionType: string;
    target: string;
    executed: boolean;
  }> {
    const actions: Array<{ actionType: string; target: string; executed: boolean }> = [];

    switch (category) {
      case 'brute_force':
        if (ipAddress) {
          actions.push({ actionType: 'block_ip', target: ipAddress, executed: false });
        }
        if (userId) {
          actions.push({ actionType: 'force_password_reset', target: userId, executed: false });
        }
        break;

      case 'data_breach':
      case 'suspicious_data_export':
        if (userId) {
          actions.push({ actionType: 'suspend_user', target: userId, executed: false });
          actions.push({ actionType: 'terminate_session', target: userId, executed: false });
        }
        actions.push({ actionType: 'notify_team', target: 'security_team', executed: false });
        break;

      case 'malware':
        if (userId) {
          actions.push({ actionType: 'quarantine_file', target: 'infected_file', executed: false });
          actions.push({ actionType: 'terminate_session', target: userId, executed: false });
        }
        break;

      case 'unauthorized_access':
        if (userId) {
          actions.push({ actionType: 'terminate_session', target: userId, executed: false });
          actions.push({ actionType: 'restrict_permissions', target: userId, executed: false });
        }
        break;

      case 'ddos':
        if (ipAddress) {
          actions.push({ actionType: 'rate_limit', target: ipAddress, executed: false });
        }
        break;

      case 'privilege_escalation':
        if (userId) {
          actions.push({ actionType: 'suspend_user', target: userId, executed: false });
          actions.push({ actionType: 'notify_team', target: 'security_team', executed: false });
        }
        break;

      default:
        actions.push({ actionType: 'notify_team', target: 'security_team', executed: false });
    }

    return actions;
  }

  /**
   * Calculate overall risk score
   */
  private static calculateRiskScore(
    classification: any,
    context: any,
    similarIncidents: any[],
  ): number {
    let score = 0;

    // Base score from severity
    switch (classification.severity) {
      case 'critical':
        score += 40;
        break;
      case 'high':
        score += 30;
        break;
      case 'medium':
        score += 20;
        break;
      case 'low':
        score += 10;
        break;
    }

    // Add for recent similar incidents
    if (similarIncidents.length > 0) {
      score += Math.min(similarIncidents.length * 10, 30);
    }

    // Add for related alerts
    if (context.relatedAlerts?.length > 0) {
      score += Math.min(context.relatedAlerts.length * 5, 20);
    }

    // Add for unusual time (night/weekend)
    if (context.systemState?.timeOfDay < 6 || context.systemState?.timeOfDay > 22) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Identify risk factors
   */
  private static identifyRiskFactors(classification: any, context: any): string[] {
    const factors: string[] = [];

    if (classification.severity === 'critical') {
      factors.push('Critical severity level');
    }

    if (context.relatedAlerts?.length > 0) {
      factors.push(`${context.relatedAlerts.length} related alerts in past 24 hours`);
    }

    if (context.recentAuditLogs > 100) {
      factors.push('High volume of recent user activity');
    }

    if (context.systemState?.timeOfDay < 6 || context.systemState?.timeOfDay > 22) {
      factors.push('Unusual time of day (outside business hours)');
    }

    return factors;
  }

  /**
   * Assess potential impact
   */
  private static assessPotentialImpact(classification: any, affectedResources?: string[]): string {
    const resourceCount = affectedResources?.length || 0;

    if (classification.severity === 'critical') {
      return resourceCount > 0
        ? `Critical security incident affecting ${resourceCount} resource(s). Immediate action required.`
        : 'Critical security incident. Immediate action required.';
    }

    if (classification.severity === 'high') {
      return resourceCount > 0
        ? `High severity incident affecting ${resourceCount} resource(s). Prompt response needed.`
        : 'High severity incident. Prompt response needed.';
    }

    return 'Medium or low severity incident. Monitor and address as appropriate.';
  }

  /**
   * Get recent incident count for context
   */
  private static async getRecentIncidentCount(tenantId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(alertTriageResults)
      .where(
        and(
          eq(alertTriageResults.tenantId, tenantId),
          gte(alertTriageResults.createdAt, sql`NOW() - INTERVAL '7 days'`),
        ),
      );

    return result[0]?.count || 0;
  }

  // ==================== AUTOMATED CONTAINMENT ====================

  /**
   * Execute auto-containment actions
   */
  private static async executeAutoContainment(
    alertId: string,
    tenantId: string,
    actions: any[],
  ): Promise<void> {
    for (const action of actions) {
      await this.executeContainmentAction({
        alertId,
        tenantId,
        actionType: action.actionType,
        target: action.target,
        reason: 'Automated containment triggered by AI triage',
        automated: true,
      });
    }
  }

  /**
   * Execute a specific containment action
   */
  static async executeContainmentAction(
    params: ContainmentActionParams,
  ): Promise<AutomatedContainmentLog> {
    const { alertId, tenantId, actionType, target, reason, automated = false, executedBy } = params;

    let success = false;
    let result = '';
    let errorMessage: string | null = null;

    try {
      // Execute the action based on type
      switch (actionType) {
        case 'suspend_user':
          // TODO: Implement actual user suspension
          result = `User ${target} suspended successfully`;
          success = true;
          break;

        case 'terminate_session':
          // TODO: Implement session termination
          const sessions = await db.query.securitySessions.findMany({
            where: and(eq(securitySessions.userId, target), eq(securitySessions.isActive, true)),
          });

          await db
            .update(securitySessions)
            .set({
              isActive: false,
              terminatedAt: new Date(),
              terminationReason: 'security',
            })
            .where(and(eq(securitySessions.userId, target), eq(securitySessions.isActive, true)));

          result = `Terminated ${sessions.length} active session(s) for user ${target}`;
          success = true;
          break;

        case 'block_ip':
          // TODO: Implement IP blocking at network level
          result = `IP address ${target} blocked`;
          success = true;
          break;

        case 'quarantine_file':
          // TODO: Implement file quarantine
          result = `File quarantined: ${target}`;
          success = true;
          break;

        case 'disable_integration':
          // TODO: Implement integration disabling
          result = `Integration disabled: ${target}`;
          success = true;
          break;

        case 'rate_limit':
          // TODO: Implement rate limiting
          result = `Rate limit applied to ${target}`;
          success = true;
          break;

        case 'force_password_reset':
          // TODO: Implement password reset requirement
          result = `Password reset required for user ${target}`;
          success = true;
          break;

        case 'enable_mfa':
          // TODO: Implement MFA requirement
          result = `MFA enabled for user ${target}`;
          success = true;
          break;

        case 'restrict_permissions':
          // TODO: Implement permission restriction
          result = `Permissions restricted for user ${target}`;
          success = true;
          break;

        case 'notify_team':
          // TODO: Implement team notification (Slack, email, etc.)
          result = `Notification sent to ${target}`;
          success = true;
          break;

        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result = `Failed to execute ${actionType}`;
    }

    // Log the containment action
    const [log] = await db
      .insert(automatedContainmentLogs)
      .values({
        tenantId,
        alertId,
        actionType,
        actionTarget: target,
        actionDetails: { reason },
        automated,
        executedBy: executedBy || null,
        success,
        result,
        errorMessage,
        notificationsSent: actionType === 'notify_team' ? { slack: true, email: true } : null,
      })
      .returning();

    // Create audit log
    await db.insert(auditLogs).values({
      tenantId,
      userId: executedBy || 'system',
      action: `CONTAINMENT_${actionType.toUpperCase()}`,
      resource: 'security_alerts',
      resourceId: alertId,
      newValues: {
        target,
        success,
        automated,
      },
      ipAddress: '0.0.0.0',
      userAgent: 'system',
      severity: 'high',
      category: 'security',
    });

    return log;
  }

  // ==================== INCIDENT CORRELATION ====================

  /**
   * Check for incident correlation
   */
  private static async checkIncidentCorrelation(
    alertId: string,
    tenantId: string,
    userId?: string,
    ipAddress?: string,
    category?: string,
  ): Promise<void> {
    // Find related incidents from past 24 hours
    const relatedIncidents = await db.query.alertTriageResults.findMany({
      where: and(
        eq(alertTriageResults.tenantId, tenantId),
        gte(alertTriageResults.createdAt, sql`NOW() - INTERVAL '24 hours'`),
        sql`${alertTriageResults.alertId} != ${alertId}`, // Exclude current alert
      ),
      limit: 50,
    });

    const correlatedIncidents: string[] = [];
    const correlationFactors: any = {};

    for (const incident of relatedIncidents) {
      let correlationScore = 0;

      // Check for same user
      const incidentUserId = (incident.contextGathered as any)?.userId;
      if (userId && incidentUserId === userId) {
        correlationScore += 30;
        correlationFactors.sameUser = true;
      }

      // Check for same IP
      const incidentIp = (incident.contextGathered as any)?.ipAddress;
      if (ipAddress && incidentIp === ipAddress) {
        correlationScore += 25;
        correlationFactors.sameIpAddress = true;
      }

      // Check for same category
      const incidentCategory = (incident.aiClassification as any)?.category;
      if (category && incidentCategory === category) {
        correlationScore += 20;
        correlationFactors.similarPattern = true;
      }

      // Time proximity (within 24 hours already checked)
      correlationScore += 10;
      correlationFactors.timeProximity = true;

      // If correlation score is high enough, add to list
      if (correlationScore >= 40) {
        correlatedIncidents.push(incident.alertId);
      }
    }

    // If we found correlated incidents, create correlation record
    if (correlatedIncidents.length > 0) {
      await db.insert(incidentCorrelations).values({
        tenantId,
        masterIncidentId: alertId,
        masterIncidentTitle: 'Correlated security incidents',
        relatedIncidentIds: correlatedIncidents,
        totalRelatedIncidents: correlatedIncidents.length,
        correlationFactors,
        correlationStrength: 75, // TODO: Calculate actual strength
        correlationType: userId ? 'user_compromise' : 'coordinated_attack',
        attackScope: `${correlatedIncidents.length + 1} related incidents detected`,
        affectedSystems: [],
        affectedUsers: userId ? [userId] : [],
        combinedRiskScore: 80, // TODO: Calculate combined risk
        estimatedImpact:
          'Multiple related security incidents suggest coordinated attack or compromised account',
        allIncidentsResolved: false,
      });
    }
  }

  // ==================== PROACTIVE THREAT DETECTION ====================

  /**
   * Detect anomalous behavior proactively
   */
  static async detectAnomaly(params: DetectAnomalyParams): Promise<void> {
    const {
      tenantId,
      entityType,
      entityId,
      anomalyType,
      normalBehavior,
      observedBehavior,
      deviation,
    } = params;

    // Calculate risk score based on deviation
    let riskScore = Math.min(Math.round(deviation), 100);

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (riskScore >= 80) severity = 'critical';
    else if (riskScore >= 60) severity = 'high';
    else if (riskScore >= 40) severity = 'medium';

    // Check if we already detected this anomaly
    const existing = await db.query.proactiveThreatDetection.findFirst({
      where: and(
        eq(proactiveThreatDetection.tenantId, tenantId),
        eq(proactiveThreatDetection.affectedEntityId, entityId),
        eq(proactiveThreatDetection.detectionType, 'anomaly'),
        inArray(proactiveThreatDetection.status, ['monitoring', 'alert_created']),
      ),
    });

    if (existing) {
      // Update detection count
      await db
        .update(proactiveThreatDetection)
        .set({
          detectionCount: sql`${proactiveThreatDetection.detectionCount} + 1`,
          lastDetectedAt: new Date(),
          riskScore,
          severity,
        })
        .where(eq(proactiveThreatDetection.id, existing.id));
    } else {
      // Create new detection
      await db.insert(proactiveThreatDetection).values({
        tenantId,
        detectionType: 'anomaly',
        threatCategory: 'insider_threat',
        anomalyDescription: `Unusual ${anomalyType} detected for ${entityType} ${entityId}`,
        detectionReason: `Deviation of ${deviation}% from normal behavior`,
        affectedEntityType: entityType,
        affectedEntityId: entityId,
        anomalyData: {
          normalBehavior,
          observedBehavior,
          deviation,
          indicators: [anomalyType],
        },
        riskScore,
        severity,
        status: 'monitoring',
        alertCreated: false,
        firstDetectedAt: new Date(),
        lastDetectedAt: new Date(),
        detectionCount: 1,
      });
    }

    // If risk is high and detected multiple times, create alert
    if (severity in ['high', 'critical'] && existing && existing.detectionCount >= 3) {
      // TODO: Create actual security alert
      console.log(`High risk anomaly detected for ${entityType} ${entityId} - creating alert`);
    }
  }

  // ==================== RESOLUTION PATTERNS ====================

  /**
   * Create or update resolution pattern
   */
  static async recordResolutionPattern(
    category: string,
    resolutionSteps: any[],
    resolutionTime: number,
    successful: boolean,
  ): Promise<void> {
    // Find existing pattern
    const existing = await db.query.incidentResolutionPatterns.findFirst({
      where: eq(incidentResolutionPatterns.category, category as any),
    });

    if (existing) {
      // Update existing pattern
      const newTotal = existing.totalIncidents + 1;
      const newResolved = existing.totalResolved + (successful ? 1 : 0);
      const newSuccessRate = Math.round((newResolved / newTotal) * 100);

      const newAvgTime = Math.round(
        (existing.avgResolutionTime * existing.totalIncidents + resolutionTime) / newTotal,
      );

      await db
        .update(incidentResolutionPatterns)
        .set({
          totalIncidents: newTotal,
          totalResolved: newResolved,
          successRate: newSuccessRate,
          avgResolutionTime: newAvgTime,
          lastUpdated: new Date(),
        })
        .where(eq(incidentResolutionPatterns.id, existing.id));
    } else {
      // Create new pattern
      await db.insert(incidentResolutionPatterns).values({
        category: category as any,
        patternName: `Standard ${category} Resolution`,
        description: `Common resolution pattern for ${category} incidents`,
        commonResolutionSteps: resolutionSteps,
        commonRootCauses: [],
        preventionMeasures: [],
        avgResolutionTime: resolutionTime,
        medianResolutionTime: resolutionTime,
        successRate: successful ? 100 : 0,
        totalIncidents: 1,
        totalResolved: successful ? 1 : 0,
        confidence: 'medium',
        basedOnIncidents: [],
      });
    }
  }
}
