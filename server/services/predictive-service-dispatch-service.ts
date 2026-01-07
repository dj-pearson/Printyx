import { db } from '../db';
import {
  clientCollectedMetrics,
  monitoredDevices,
  tonerAlerts,
  installationSchedules,
  businessRecords,
  repCapacity,
  users
} from '@shared/schema';
import { eq, and, desc, sql, gte, lt, inArray } from 'drizzle-orm';

// Helper to get user full name
async function getUserName(userId: string): Promise<string> {
  try {
    const user = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length > 0) {
      const { firstName, lastName } = user[0];
      return [firstName, lastName].filter(Boolean).join(' ') || userId;
    }
  } catch (error) {
    console.error('Error fetching user name:', error);
  }
  return userId;
}
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

interface DeviceHealthAnalysis {
  deviceId: string;
  serialNumber: string;
  model: string;
  overallHealth: number; // 0-100
  healthStatus: 'excellent' | 'good' | 'warning' | 'critical' | 'failing';
  predictedFailureRisk: number; // 0-100
  daysUntilPredictedFailure: number | null;
  issues: HealthIssue[];
  recommendations: string[];
  requiresImmediateAttention: boolean;
  maintenanceDue: boolean;
}

interface HealthIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metric: string;
  currentValue: number;
  threshold: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface TechnicianMatch {
  technicianId: string;
  technicianName: string;
  score: number;
  reasons: string[];
  availability: {
    available: boolean;
    nextAvailableSlot: Date | null;
  };
  location: {
    distance: number;
    travelTime: number;
  };
  skills: string[];
  certifications: string[];
}

interface PredictiveDispatchResult {
  success: boolean;
  deviceAnalysis: DeviceHealthAnalysis;
  dispatchCreated: boolean;
  scheduledTechnician: TechnicianMatch | null;
  scheduledDate: Date | null;
  partsOrdered: string[];
  estimatedCost: number;
  preventedDowntime: number; // estimated hours
  processingTimeMs: number;
}

export class PredictiveServiceDispatchService {
  /**
   * Main entry point: Analyze device health and dispatch if needed
   */
  async analyzeAndDispatch(
    serialNumber: string,
    tenantId: string
  ): Promise<PredictiveDispatchResult> {
    const startTime = Date.now();

    try {
      // Step 1: Get recent metrics for device
      const recentMetrics = await this.getRecentMetrics(serialNumber, tenantId);

      if (!recentMetrics || recentMetrics.length === 0) {
        throw new Error(`No metrics found for device ${serialNumber}`);
      }

      // Step 2: Analyze device health
      const healthAnalysis = await this.analyzeDeviceHealth(
        recentMetrics,
        tenantId
      );

      // Step 3: Decide if dispatch is needed
      const needsDispatch =
        healthAnalysis.requiresImmediateAttention ||
        healthAnalysis.maintenanceDue ||
        healthAnalysis.predictedFailureRisk > 70;

      if (!needsDispatch) {
        return {
          success: true,
          deviceAnalysis: healthAnalysis,
          dispatchCreated: false,
          scheduledTechnician: null,
          scheduledDate: null,
          partsOrdered: [],
          estimatedCost: 0,
          preventedDowntime: 0,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Step 4: Find best technician
      const device = recentMetrics[0];
      const technician = await this.findBestTechnician(
        device,
        healthAnalysis,
        tenantId
      );

      if (!technician) {
        throw new Error('No available technicians found');
      }

      // Step 5: Schedule service call
      const scheduledDate = technician.availability.nextAvailableSlot || new Date();
      await this.createServiceCall(
        device,
        technician,
        healthAnalysis,
        scheduledDate,
        tenantId
      );

      // Step 6: Auto-order parts if needed
      const partsOrdered = await this.autoOrderParts(
        healthAnalysis,
        tenantId
      );

      // Step 7: Calculate prevented downtime
      const preventedDowntime = this.calculatePreventedDowntime(healthAnalysis);

      const processingTimeMs = Date.now() - startTime;

      return {
        success: true,
        deviceAnalysis: healthAnalysis,
        dispatchCreated: true,
        scheduledTechnician: technician,
        scheduledDate,
        partsOrdered,
        estimatedCost: this.estimateServiceCost(healthAnalysis),
        preventedDowntime,
        processingTimeMs,
      };
    } catch (error) {
      console.error('Predictive dispatch failed:', error);
      throw error;
    }
  }

  /**
   * Get recent metrics for a device (last 30 days)
   */
  private async getRecentMetrics(serialNumber: string, tenantId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return db.query.clientCollectedMetrics.findMany({
      where: and(
        eq(clientCollectedMetrics.tenantId, parseInt(tenantId)),
        eq(clientCollectedMetrics.serialNumber, serialNumber),
        gte(clientCollectedMetrics.collectionTimestamp, thirtyDaysAgo)
      ),
      orderBy: [desc(clientCollectedMetrics.collectionTimestamp)],
      limit: 100,
    });
  }

  /**
   * Analyze device health using AI and metrics
   */
  private async analyzeDeviceHealth(
    metrics: any[],
    tenantId: string
  ): Promise<DeviceHealthAnalysis> {
    const latest = metrics[0];
    const issues: HealthIssue[] = [];

    // Analyze toner levels
    const tonerLevels = {
      black: latest.tonerBlack,
      cyan: latest.tonerCyan,
      magenta: latest.tonerMagenta,
      yellow: latest.tonerYellow,
    };

    for (const [color, level] of Object.entries(tonerLevels)) {
      if (level !== null && level < 15) {
        issues.push({
          type: 'toner_low',
          severity: level < 5 ? 'critical' : 'high',
          description: `${color} toner critically low (${level}%)`,
          metric: `toner_${color}`,
          currentValue: level,
          threshold: 15,
          trend: this.calculateTrend(metrics, `toner${color.charAt(0).toUpperCase() + color.slice(1)}`),
        });
      }
    }

    // Analyze supply life
    if (latest.fuserLife !== null && latest.fuserLife < 10) {
      issues.push({
        type: 'fuser_end_of_life',
        severity: latest.fuserLife < 5 ? 'critical' : 'high',
        description: `Fuser nearing end of life (${latest.fuserLife}% remaining)`,
        metric: 'fuser_life',
        currentValue: latest.fuserLife,
        threshold: 10,
        trend: this.calculateTrend(metrics, 'fuserLife'),
      });
    }

    if (latest.drumLife !== null && latest.drumLife < 15) {
      issues.push({
        type: 'drum_end_of_life',
        severity: latest.drumLife < 5 ? 'critical' : 'medium',
        description: `Drum nearing end of life (${latest.drumLife}% remaining)`,
        metric: 'drum_life',
        currentValue: latest.drumLife,
        threshold: 15,
        trend: this.calculateTrend(metrics, 'drumLife'),
      });
    }

    // Check for error codes
    if (latest.errorCodes && latest.errorCodes.length > 0) {
      issues.push({
        type: 'device_errors',
        severity: 'high',
        description: `Device reporting errors: ${latest.errorCodes.join(', ')}`,
        metric: 'error_codes',
        currentValue: latest.errorCodes.length,
        threshold: 0,
        trend: 'stable',
      });
    }

    // Check device status
    if (latest.deviceStatus === 'error' || latest.deviceStatus === 'maintenance') {
      issues.push({
        type: 'device_status',
        severity: 'critical',
        description: `Device in ${latest.deviceStatus} state`,
        metric: 'device_status',
        currentValue: 0,
        threshold: 0,
        trend: 'stable',
      });
    }

    // Use AI to analyze patterns and predict failures
    const aiAnalysis = await this.getAIPredictiveAnalysis(metrics, issues);

    // Calculate overall health score
    const overallHealth = this.calculateOverallHealth(issues, latest);

    // Determine health status
    let healthStatus: DeviceHealthAnalysis['healthStatus'];
    if (overallHealth >= 85) healthStatus = 'excellent';
    else if (overallHealth >= 70) healthStatus = 'good';
    else if (overallHealth >= 50) healthStatus = 'warning';
    else if (overallHealth >= 25) healthStatus = 'critical';
    else healthStatus = 'failing';

    return {
      deviceId: latest.id,
      serialNumber: latest.serialNumber,
      model: latest.model || 'Unknown',
      overallHealth,
      healthStatus,
      predictedFailureRisk: aiAnalysis.failureRisk,
      daysUntilPredictedFailure: aiAnalysis.daysUntilFailure,
      issues,
      recommendations: aiAnalysis.recommendations,
      requiresImmediateAttention: issues.some(i => i.severity === 'critical'),
      maintenanceDue: overallHealth < 70,
    };
  }

  /**
   * Use Claude AI to analyze device patterns and predict failures
   */
  private async getAIPredictiveAnalysis(metrics: any[], issues: HealthIssue[]): Promise<{
    failureRisk: number;
    daysUntilFailure: number | null;
    recommendations: string[];
  }> {
    try {
      const latest = metrics[0];
      const metricsData = metrics.slice(0, 10).map(m => ({
        date: m.collectionTimestamp,
        status: m.deviceStatus,
        tonerBlack: m.tonerBlack,
        fuserLife: m.fuserLife,
        drumLife: m.drumLife,
        errorCodes: m.errorCodes,
      }));

      const prompt = `Analyze this copier/printer device data and predict potential failures:

Device: ${latest.manufacturer} ${latest.model}
Serial: ${latest.serialNumber}
Current Status: ${latest.deviceStatus}

Recent Metrics (last 10 data points):
${JSON.stringify(metricsData, null, 2)}

Current Issues:
${issues.map(i => `- ${i.severity.toUpperCase()}: ${i.description}`).join('\n')}

Provide:
1. Failure risk score (0-100, where 100 = imminent failure)
2. Estimated days until failure (or null if low risk)
3. Top 3 preventive actions to take

Format as JSON:
{
  "failureRisk": 75,
  "daysUntilFailure": 7,
  "recommendations": ["Replace fuser assembly", "Order toner cartridges", "Schedule PM service"]
}`;

      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        temperature: 0.2,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = message.content[0];
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      // Fallback
      return {
        failureRisk: issues.length > 0 ? 50 : 20,
        daysUntilFailure: null,
        recommendations: ['Schedule preventive maintenance', 'Monitor device closely'],
      };
    } catch (error) {
      console.error('AI analysis failed:', error);
      return {
        failureRisk: 30,
        daysUntilFailure: null,
        recommendations: ['Monitor device', 'Check supplies'],
      };
    }
  }

  /**
   * Find the best technician for this service call
   */
  private async findBestTechnician(
    device: any,
    health: DeviceHealthAnalysis,
    tenantId: string
  ): Promise<TechnicianMatch | null> {
    // Get all available technicians
    const technicians = await db.query.repCapacity.findMany({
      where: and(
        eq(repCapacity.tenantId, tenantId),
        eq(repCapacity.isAvailable, true)
      ),
    });

    if (technicians.length === 0) {
      return null;
    }

    // Score each technician
    const matches: TechnicianMatch[] = [];

    for (const tech of technicians) {
      const reasons: string[] = [];
      let score = 50;

      // Check skills match
      const hasRelevantSkills = tech.skills && tech.skills.some(s =>
        s.includes('service') || s.includes(device.manufacturer?.toLowerCase())
      );
      if (hasRelevantSkills) {
        score += 20;
        reasons.push('Relevant skills');
      }

      // Check workload
      const utilizationRate = tech.currentActiveLeads / (tech.maxActiveLeads || 50);
      if (utilizationRate < 0.6) {
        score += 15;
        reasons.push('Low workload');
      } else if (utilizationRate < 0.8) {
        score += 5;
        reasons.push('Moderate workload');
      }

      // Check certifications
      if (tech.certifications && tech.certifications.length > 0) {
        score += 10;
        reasons.push(`${tech.certifications.length} certifications`);
      }

      // Priority for urgent issues
      if (health.requiresImmediateAttention && tech.currentActiveLeads < 5) {
        score += 15;
        reasons.push('Available for urgent call');
      }

      // Calculate next available slot (simplified)
      const nextSlot = new Date();
      nextSlot.setHours(nextSlot.getHours() + (tech.currentActiveLeads * 2)); // 2 hours per existing job

      // Get technician name from users table
      const technicianName = await getUserName(tech.userId);

      matches.push({
        technicianId: tech.userId,
        technicianName,
        score,
        reasons,
        availability: {
          available: tech.isAvailable,
          nextAvailableSlot: nextSlot,
        },
        location: {
          distance: 10, // TODO: Calculate actual distance using Google Maps API
          travelTime: 30, // minutes - estimated
        },
        skills: tech.skills || [],
        certifications: tech.certifications || [],
      });
    }

    // Sort by score and return best match
    matches.sort((a, b) => b.score - a.score);
    return matches[0];
  }

  /**
   * Create service call record
   */
  private async createServiceCall(
    device: any,
    technician: TechnicianMatch,
    health: DeviceHealthAnalysis,
    scheduledDate: Date,
    tenantId: string
  ): Promise<void> {
    // TODO: Create service call in database
    // For now, just log
    console.log(`📅 Service call created:
      Device: ${device.serialNumber}
      Technician: ${technician.technicianName}
      Scheduled: ${scheduledDate.toISOString()}
      Priority: ${health.requiresImmediateAttention ? 'URGENT' : 'Normal'}
      Issues: ${health.issues.map(i => i.type).join(', ')}
    `);

    // Update technician capacity
    await db.execute(sql`
      UPDATE rep_capacity
      SET current_active_leads = current_active_leads + 1
      WHERE user_id = ${technician.technicianId} AND tenant_id = ${tenantId}
    `);
  }

  /**
   * Auto-order parts based on analysis
   */
  private async autoOrderParts(
    health: DeviceHealthAnalysis,
    tenantId: string
  ): Promise<string[]> {
    const partsToOrder: string[] = [];

    for (const issue of health.issues) {
      if (issue.type === 'toner_low' && issue.severity === 'critical') {
        const color = issue.metric.replace('toner_', '');
        partsToOrder.push(`Toner cartridge - ${color}`);
      }
      if (issue.type === 'fuser_end_of_life' && issue.currentValue < 5) {
        partsToOrder.push('Fuser assembly');
      }
      if (issue.type === 'drum_end_of_life' && issue.currentValue < 5) {
        partsToOrder.push('Drum unit');
      }
    }

    // TODO: Actually create purchase orders
    if (partsToOrder.length > 0) {
      console.log(`🛒 Auto-ordering parts: ${partsToOrder.join(', ')}`);
    }

    return partsToOrder;
  }

  /**
   * Helper: Calculate trend for a metric
   */
  private calculateTrend(metrics: any[], field: string): 'improving' | 'stable' | 'declining' {
    if (metrics.length < 3) return 'stable';

    const recent = metrics.slice(0, 3);
    const values = recent.map(m => m[field]).filter(v => v !== null);

    if (values.length < 2) return 'stable';

    const avgChange = (values[0] - values[values.length - 1]) / (values.length - 1);

    if (avgChange > 2) return 'improving';
    if (avgChange < -2) return 'declining';
    return 'stable';
  }

  /**
   * Helper: Calculate overall health score
   */
  private calculateOverallHealth(issues: HealthIssue[], latest: any): number {
    let health = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          health -= 30;
          break;
        case 'high':
          health -= 15;
          break;
        case 'medium':
          health -= 8;
          break;
        case 'low':
          health -= 3;
          break;
      }
    }

    // Factor in device status
    if (latest.deviceStatus === 'error') health -= 20;
    if (latest.deviceStatus === 'warning') health -= 10;

    return Math.max(0, Math.min(100, health));
  }

  /**
   * Helper: Calculate prevented downtime hours
   */
  private calculatePreventedDowntime(health: DeviceHealthAnalysis): number {
    if (health.predictedFailureRisk > 80) return 24; // 1 day
    if (health.predictedFailureRisk > 60) return 8; // 8 hours
    if (health.predictedFailureRisk > 40) return 4; // 4 hours
    return 2; // 2 hours minimum
  }

  /**
   * Helper: Estimate service cost
   */
  private estimateServiceCost(health: DeviceHealthAnalysis): number {
    let cost = 150; // Base service call

    for (const issue of health.issues) {
      if (issue.type.includes('toner')) cost += 50;
      if (issue.type.includes('fuser')) cost += 300;
      if (issue.type.includes('drum')) cost += 150;
      if (issue.type.includes('error')) cost += 75;
    }

    return cost;
  }
}

// Export singleton
export const predictiveServiceDispatchService = new PredictiveServiceDispatchService();
