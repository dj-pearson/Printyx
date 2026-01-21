/**
 * Incident Response Service
 * Implements SOC2 Incident Response requirements
 * Handles incident lifecycle, escalations, and post-mortem tracking
 */

import { db } from '../db';
import { eq, and, desc, gte, lte, inArray, sql, or } from 'drizzle-orm';
import {
  incidents,
  incidentTimeline,
  incidentEscalations,
  type Incident,
  type InsertIncident,
  type IncidentTimeline,
  type IncidentEscalation,
} from '@shared/soc2-compliance-schema';

// ============= CONSTANTS =============

const INCIDENT_NUMBER_PREFIX = 'INC';

// SLA response times in minutes by severity
const SLA_RESPONSE_TIMES: Record<string, number> = {
  sev1: 15, // 15 minutes for critical
  sev2: 60, // 1 hour for high
  sev3: 240, // 4 hours for medium
  sev4: 1440, // 24 hours for low
  sev5: 2880, // 48 hours for informational
};

// Auto-escalation thresholds in minutes
const AUTO_ESCALATION_THRESHOLDS: Record<string, number> = {
  sev1: 30,
  sev2: 120,
  sev3: 480,
  sev4: 2880,
  sev5: 4320,
};

// Escalation levels
const ESCALATION_LEVELS = [
  { level: 1, role: 'on_call_engineer' },
  { level: 2, role: 'team_lead' },
  { level: 3, role: 'engineering_manager' },
  { level: 4, role: 'director' },
  { level: 5, role: 'vp_engineering' },
  { level: 6, role: 'cto' },
];

// ============= INCIDENT MANAGEMENT =============

/**
 * Generate unique incident number
 */
async function generateIncidentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const day = String(new Date().getDate()).padStart(2, '0');

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(incidents)
    .where(sql`DATE(${incidents.createdAt}) = CURRENT_DATE`);

  const sequence = String((result[0]?.count || 0) + 1).padStart(4, '0');
  return `${INCIDENT_NUMBER_PREFIX}-${year}${month}${day}-${sequence}`;
}

/**
 * Create a new incident
 */
export async function createIncident(
  data: Omit<InsertIncident, 'incidentNumber'>,
  detectorId?: string,
  detectorName?: string,
): Promise<Incident> {
  const incidentNumber = await generateIncidentNumber();

  const [incident] = await db
    .insert(incidents)
    .values({
      ...data,
      incidentNumber,
      status: 'detected',
      detectedAt: data.detectedAt || new Date(),
      detectedBy: detectorId,
    })
    .returning();

  // Add initial timeline entry
  await addTimelineEntry(incident.id, {
    eventType: 'incident_created',
    title: 'Incident Created',
    description: `Incident "${incident.title}" was created with severity ${incident.severity}`,
    actorId: detectorId,
    actorName: detectorName,
    isAutomated: !detectorId,
  });

  return incident;
}

/**
 * Get incident by ID
 */
export async function getIncident(incidentId: string, tenantId: string): Promise<Incident | null> {
  const [incident] = await db
    .select()
    .from(incidents)
    .where(and(eq(incidents.id, incidentId), eq(incidents.tenantId, tenantId)));

  return incident || null;
}

/**
 * List incidents with filters
 */
export async function listIncidents(
  tenantId: string,
  options: {
    status?: string[];
    severity?: string[];
    category?: string[];
    startDate?: Date;
    endDate?: Date;
    includeResolved?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{ data: Incident[]; total: number }> {
  const conditions = [eq(incidents.tenantId, tenantId)];

  if (options.status?.length) {
    conditions.push(inArray(incidents.status, options.status as any));
  }
  if (options.severity?.length) {
    conditions.push(inArray(incidents.severity, options.severity as any));
  }
  if (options.category?.length) {
    conditions.push(inArray(incidents.category, options.category as any));
  }
  if (options.startDate) {
    conditions.push(gte(incidents.detectedAt, options.startDate));
  }
  if (options.endDate) {
    conditions.push(lte(incidents.detectedAt, options.endDate));
  }
  if (!options.includeResolved) {
    conditions.push(
      inArray(incidents.status, [
        'detected',
        'acknowledged',
        'investigating',
        'identified',
        'mitigating',
        'reopened',
      ] as any),
    );
  }

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(incidents)
      .where(and(...conditions))
      .orderBy(desc(incidents.detectedAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0),
    db
      .select({ count: sql<number>`count(*)` })
      .from(incidents)
      .where(and(...conditions)),
  ]);

  return {
    data,
    total: countResult[0]?.count || 0,
  };
}

/**
 * Get active incidents (not resolved/closed)
 */
export async function getActiveIncidents(tenantId: string): Promise<Incident[]> {
  return db
    .select()
    .from(incidents)
    .where(
      and(
        eq(incidents.tenantId, tenantId),
        inArray(incidents.status, [
          'detected',
          'acknowledged',
          'investigating',
          'identified',
          'mitigating',
          'reopened',
        ] as any),
      ),
    )
    .orderBy(incidents.severity, desc(incidents.detectedAt));
}

// ============= INCIDENT LIFECYCLE =============

/**
 * Acknowledge an incident
 */
export async function acknowledgeIncident(
  incidentId: string,
  tenantId: string,
  acknowledgerId: string,
  acknowledgerName: string,
): Promise<Incident> {
  const incident = await getIncident(incidentId, tenantId);
  if (!incident) {
    throw new Error('Incident not found');
  }

  if (incident.status !== 'detected') {
    throw new Error('Incident has already been acknowledged');
  }

  const timeToAcknowledge = Math.round(
    (new Date().getTime() - incident.detectedAt.getTime()) / 60000,
  );

  const [updated] = await db
    .update(incidents)
    .set({
      status: 'acknowledged',
      incidentCommanderId: acknowledgerId,
      timeToAcknowledge,
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, incidentId))
    .returning();

  await addTimelineEntry(incidentId, {
    eventType: 'acknowledged',
    title: 'Incident Acknowledged',
    description: `Incident acknowledged by ${acknowledgerName}. Time to acknowledge: ${timeToAcknowledge} minutes`,
    actorId: acknowledgerId,
    actorName: acknowledgerName,
  });

  return updated;
}

/**
 * Start investigation
 */
export async function startInvestigation(
  incidentId: string,
  tenantId: string,
  investigatorId: string,
  investigatorName: string,
): Promise<Incident> {
  const incident = await getIncident(incidentId, tenantId);
  if (!incident) {
    throw new Error('Incident not found');
  }

  const [updated] = await db
    .update(incidents)
    .set({
      status: 'investigating',
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, incidentId))
    .returning();

  await addTimelineEntry(incidentId, {
    eventType: 'investigation_started',
    title: 'Investigation Started',
    description: `Investigation started by ${investigatorName}`,
    actorId: investigatorId,
    actorName: investigatorName,
  });

  return updated;
}

/**
 * Identify root cause
 */
export async function identifyRootCause(
  incidentId: string,
  tenantId: string,
  rootCause: string,
  contributingFactors: string[],
  identifierId: string,
  identifierName: string,
): Promise<Incident> {
  const incident = await getIncident(incidentId, tenantId);
  if (!incident) {
    throw new Error('Incident not found');
  }

  const [updated] = await db
    .update(incidents)
    .set({
      status: 'identified',
      rootCause,
      contributingFactors,
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, incidentId))
    .returning();

  await addTimelineEntry(incidentId, {
    eventType: 'root_cause_identified',
    title: 'Root Cause Identified',
    description: `Root cause identified: ${rootCause}`,
    actorId: identifierId,
    actorName: identifierName,
    metadata: { rootCause, contributingFactors },
  });

  return updated;
}

/**
 * Start mitigation
 */
export async function startMitigation(
  incidentId: string,
  tenantId: string,
  mitigatorId: string,
  mitigatorName: string,
  mitigationPlan: string,
): Promise<Incident> {
  const incident = await getIncident(incidentId, tenantId);
  if (!incident) {
    throw new Error('Incident not found');
  }

  const [updated] = await db
    .update(incidents)
    .set({
      status: 'mitigating',
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, incidentId))
    .returning();

  await addTimelineEntry(incidentId, {
    eventType: 'mitigation_started',
    title: 'Mitigation Started',
    description: `Mitigation started: ${mitigationPlan}`,
    actorId: mitigatorId,
    actorName: mitigatorName,
    metadata: { mitigationPlan },
  });

  return updated;
}

/**
 * Resolve incident
 */
export async function resolveIncident(
  incidentId: string,
  tenantId: string,
  resolverId: string,
  resolverName: string,
  resolutionSummary: string,
  resolutionActions: Array<{
    action: string;
    completedBy: string;
    completedAt: string;
    notes?: string;
  }>,
): Promise<Incident> {
  const incident = await getIncident(incidentId, tenantId);
  if (!incident) {
    throw new Error('Incident not found');
  }

  const resolvedAt = new Date();
  const timeToResolve = Math.round((resolvedAt.getTime() - incident.detectedAt.getTime()) / 60000);

  const [updated] = await db
    .update(incidents)
    .set({
      status: 'resolved',
      resolutionSummary,
      resolutionActions,
      resolvedAt,
      resolvedBy: resolverId,
      timeToResolve,
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, incidentId))
    .returning();

  await addTimelineEntry(incidentId, {
    eventType: 'resolved',
    title: 'Incident Resolved',
    description: `Incident resolved by ${resolverName}. Time to resolve: ${timeToResolve} minutes. Summary: ${resolutionSummary}`,
    actorId: resolverId,
    actorName: resolverName,
    metadata: { resolutionSummary, resolutionActions, timeToResolve },
  });

  return updated;
}

/**
 * Close incident (after post-mortem)
 */
export async function closeIncident(
  incidentId: string,
  tenantId: string,
  closerId: string,
  closerName: string,
  lessonsLearned: string,
  preventiveMeasures: string[],
  postMortemUrl?: string,
): Promise<Incident> {
  const incident = await getIncident(incidentId, tenantId);
  if (!incident) {
    throw new Error('Incident not found');
  }

  if (incident.status !== 'resolved') {
    throw new Error('Incident must be resolved before closing');
  }

  const [updated] = await db
    .update(incidents)
    .set({
      status: 'closed',
      lessonsLearned,
      preventiveMeasures,
      postMortemUrl,
      postMortemCompletedAt: new Date(),
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, incidentId))
    .returning();

  await addTimelineEntry(incidentId, {
    eventType: 'closed',
    title: 'Incident Closed',
    description: `Incident closed by ${closerName}. Post-mortem completed.`,
    actorId: closerId,
    actorName: closerName,
    metadata: { lessonsLearned, preventiveMeasures, postMortemUrl },
  });

  return updated;
}

/**
 * Reopen incident
 */
export async function reopenIncident(
  incidentId: string,
  tenantId: string,
  reopenerId: string,
  reopenerName: string,
  reason: string,
): Promise<Incident> {
  const incident = await getIncident(incidentId, tenantId);
  if (!incident) {
    throw new Error('Incident not found');
  }

  if (!['resolved', 'closed'].includes(incident.status)) {
    throw new Error('Only resolved or closed incidents can be reopened');
  }

  const [updated] = await db
    .update(incidents)
    .set({
      status: 'reopened',
      closedAt: null,
      resolvedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, incidentId))
    .returning();

  await addTimelineEntry(incidentId, {
    eventType: 'reopened',
    title: 'Incident Reopened',
    description: `Incident reopened by ${reopenerName}. Reason: ${reason}`,
    actorId: reopenerId,
    actorName: reopenerName,
    metadata: { reason },
  });

  return updated;
}

// ============= TIMELINE MANAGEMENT =============

/**
 * Add timeline entry
 */
export async function addTimelineEntry(
  incidentId: string,
  data: {
    eventType: string;
    title: string;
    description?: string;
    actorId?: string;
    actorName?: string;
    metadata?: Record<string, any>;
    isAutomated?: boolean;
  },
): Promise<IncidentTimeline> {
  const [entry] = await db
    .insert(incidentTimeline)
    .values({
      incidentId,
      ...data,
    })
    .returning();

  return entry;
}

/**
 * Get incident timeline
 */
export async function getIncidentTimeline(incidentId: string): Promise<IncidentTimeline[]> {
  return db
    .select()
    .from(incidentTimeline)
    .where(eq(incidentTimeline.incidentId, incidentId))
    .orderBy(desc(incidentTimeline.timestamp));
}

// ============= ESCALATION MANAGEMENT =============

/**
 * Escalate incident
 */
export async function escalateIncident(
  incidentId: string,
  tenantId: string,
  escalatedBy: string,
  escalatedByName: string,
  escalatedTo: string,
  escalatedToName: string,
  reason: string,
): Promise<IncidentEscalation> {
  const incident = await getIncident(incidentId, tenantId);
  if (!incident) {
    throw new Error('Incident not found');
  }

  // Get current escalation level
  const currentEscalations = await db
    .select()
    .from(incidentEscalations)
    .where(eq(incidentEscalations.incidentId, incidentId))
    .orderBy(desc(incidentEscalations.toLevel));

  const currentLevel = currentEscalations[0]?.toLevel || 0;
  const newLevel = currentLevel + 1;

  if (newLevel > ESCALATION_LEVELS.length) {
    throw new Error('Maximum escalation level reached');
  }

  const [escalation] = await db
    .insert(incidentEscalations)
    .values({
      incidentId,
      fromLevel: currentLevel,
      toLevel: newLevel,
      reason,
      escalatedBy,
      escalatedTo,
      escalatedToName,
    })
    .returning();

  await addTimelineEntry(incidentId, {
    eventType: 'escalated',
    title: `Escalated to Level ${newLevel}`,
    description: `Incident escalated from level ${currentLevel} to level ${newLevel}. Reason: ${reason}`,
    actorId: escalatedBy,
    actorName: escalatedByName,
    metadata: { fromLevel: currentLevel, toLevel: newLevel, escalatedTo, reason },
  });

  return escalation;
}

/**
 * Acknowledge escalation
 */
export async function acknowledgeEscalation(
  escalationId: string,
  acknowledgerId: string,
): Promise<IncidentEscalation> {
  const [escalation] = await db
    .update(incidentEscalations)
    .set({
      acknowledged: true,
      acknowledgedAt: new Date(),
    })
    .where(eq(incidentEscalations.id, escalationId))
    .returning();

  return escalation;
}

/**
 * Get incident escalations
 */
export async function getIncidentEscalations(incidentId: string): Promise<IncidentEscalation[]> {
  return db
    .select()
    .from(incidentEscalations)
    .where(eq(incidentEscalations.incidentId, incidentId))
    .orderBy(incidentEscalations.escalatedAt);
}

// ============= TEAM MANAGEMENT =============

/**
 * Assign team member to incident
 */
export async function assignTeamMember(
  incidentId: string,
  tenantId: string,
  userId: string,
  userName: string,
  role: string,
  assignerId: string,
  assignerName: string,
): Promise<Incident> {
  const incident = await getIncident(incidentId, tenantId);
  if (!incident) {
    throw new Error('Incident not found');
  }

  const currentTeam = incident.assignedTeam || [];
  const newTeam = [
    ...currentTeam.filter((m: any) => m.userId !== userId),
    {
      userId,
      userName,
      role,
      assignedAt: new Date().toISOString(),
    },
  ];

  const [updated] = await db
    .update(incidents)
    .set({
      assignedTeam: newTeam,
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, incidentId))
    .returning();

  await addTimelineEntry(incidentId, {
    eventType: 'team_member_assigned',
    title: 'Team Member Assigned',
    description: `${userName} assigned as ${role} by ${assignerName}`,
    actorId: assignerId,
    actorName: assignerName,
    metadata: { userId, userName, role },
  });

  return updated;
}

// ============= NOTIFICATIONS =============

/**
 * Record notification sent
 */
export async function recordNotification(
  incidentId: string,
  tenantId: string,
  recipient: string,
  type: string,
  sentBy: string,
): Promise<Incident> {
  const incident = await getIncident(incidentId, tenantId);
  if (!incident) {
    throw new Error('Incident not found');
  }

  const currentNotifications = incident.notificationsSent || [];
  const newNotifications = [
    ...currentNotifications,
    {
      recipient,
      type,
      sentAt: new Date().toISOString(),
      sentBy,
    },
  ];

  const [updated] = await db
    .update(incidents)
    .set({
      notificationsSent: newNotifications,
      updatedAt: new Date(),
    })
    .where(eq(incidents.id, incidentId))
    .returning();

  return updated;
}

// ============= METRICS & REPORTING =============

/**
 * Get incident metrics
 */
export async function getIncidentMetrics(
  tenantId: string,
  startDate: Date,
  endDate: Date,
): Promise<{
  totalIncidents: number;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  mttr: number; // Mean Time to Resolve (minutes)
  mtta: number; // Mean Time to Acknowledge (minutes)
  slaCompliance: number; // Percentage
  dataBreaches: number;
}> {
  const incidentList = await db
    .select()
    .from(incidents)
    .where(
      and(
        eq(incidents.tenantId, tenantId),
        gte(incidents.detectedAt, startDate),
        lte(incidents.detectedAt, endDate),
      ),
    );

  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let totalTTR = 0;
  let ttrCount = 0;
  let totalTTA = 0;
  let ttaCount = 0;
  let slaMetCount = 0;
  let dataBreaches = 0;

  for (const incident of incidentList) {
    bySeverity[incident.severity] = (bySeverity[incident.severity] || 0) + 1;
    byCategory[incident.category] = (byCategory[incident.category] || 0) + 1;
    byStatus[incident.status] = (byStatus[incident.status] || 0) + 1;

    if (incident.timeToResolve) {
      totalTTR += incident.timeToResolve;
      ttrCount++;
    }

    if (incident.timeToAcknowledge) {
      totalTTA += incident.timeToAcknowledge;
      ttaCount++;

      // Check SLA compliance
      const slaTarget = SLA_RESPONSE_TIMES[incident.severity];
      if (incident.timeToAcknowledge <= slaTarget) {
        slaMetCount++;
      }
    }

    if (incident.dataBreachConfirmed) {
      dataBreaches++;
    }
  }

  return {
    totalIncidents: incidentList.length,
    bySeverity,
    byCategory,
    byStatus,
    mttr: ttrCount > 0 ? Math.round(totalTTR / ttrCount) : 0,
    mtta: ttaCount > 0 ? Math.round(totalTTA / ttaCount) : 0,
    slaCompliance: ttaCount > 0 ? Math.round((slaMetCount / ttaCount) * 100) : 100,
    dataBreaches,
  };
}

/**
 * Get open incidents summary for dashboard
 */
export async function getOpenIncidentsSummary(tenantId: string): Promise<{
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  oldestUnresolved: Incident | null;
}> {
  const openIncidents = await getActiveIncidents(tenantId);

  const summary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: openIncidents.length,
    oldestUnresolved: openIncidents.length > 0 ? openIncidents[openIncidents.length - 1] : null,
  };

  for (const incident of openIncidents) {
    switch (incident.severity) {
      case 'sev1':
        summary.critical++;
        break;
      case 'sev2':
        summary.high++;
        break;
      case 'sev3':
        summary.medium++;
        break;
      case 'sev4':
      case 'sev5':
        summary.low++;
        break;
    }
  }

  return summary;
}

export default {
  createIncident,
  getIncident,
  listIncidents,
  getActiveIncidents,
  acknowledgeIncident,
  startInvestigation,
  identifyRootCause,
  startMitigation,
  resolveIncident,
  closeIncident,
  reopenIncident,
  addTimelineEntry,
  getIncidentTimeline,
  escalateIncident,
  acknowledgeEscalation,
  getIncidentEscalations,
  assignTeamMember,
  recordNotification,
  getIncidentMetrics,
  getOpenIncidentsSummary,
};
