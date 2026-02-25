import type { Express } from 'express';
import { Router } from 'express';
import { db } from './db';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-predictive-maintenance-hub');

import {
  equipment,
  businessRecords,
  serviceTickets,
  clientCollectedMetrics,
} from '../shared/schema';
import { eq, and, sql, desc, gte, lt } from 'drizzle-orm';
import { predictiveServiceDispatchService } from './services/predictive-service-dispatch-service';

import { getUserId, getTenantId } from './utils/auth-helpers';
const router = Router();

/**
 * UNIFIED PREDICTIVE MAINTENANCE HUB
 * Consolidates proactive maintenance, predictive dispatch, and health monitoring
 */

/**
 * GET /api/predictive-maintenance/dashboard
 * Unified dashboard with all predictive maintenance metrics
 */
router.get('/api/predictive-maintenance/dashboard', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all active equipment with health analysis
    const equipmentList = await db
      .select({
        equipmentId: equipment.id,
        serialNumber: equipment.serialNumber,
        make: equipment.make,
        model: equipment.model,
        customerId: equipment.customerId,
        customerName: businessRecords.companyName,
        location: equipment.location,
        meterReading: equipment.currentMeterReading,
        lastServiceDate: equipment.lastServiceDate,
        nextServiceDue: equipment.nextServiceDueDate,
        installDate: equipment.installDate,
        status: equipment.status,
      })
      .from(equipment)
      .leftJoin(businessRecords, eq(equipment.customerId, businessRecords.id))
      .where(and(eq(equipment.tenantId, tenantId), eq(equipment.status, 'active')))
      .orderBy(equipment.nextServiceDueDate);

    // Calculate health metrics for each equipment
    const equipmentHealth = await Promise.all(
      equipmentList.map(async (item) => {
        const now = new Date();
        const lastService = item.lastServiceDate ? new Date(item.lastServiceDate) : null;
        const nextDue = item.nextServiceDue
          ? new Date(item.nextServiceDue)
          : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        const daysSinceService = lastService
          ? Math.floor((now.getTime() - lastService.getTime()) / (1000 * 60 * 60 * 24))
          : 9999;

        const daysUntilDue = Math.floor(
          (nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Calculate health score (0-100)
        let healthScore = 100;

        if (daysUntilDue < 0) {
          healthScore -= Math.min(50, Math.abs(daysUntilDue) * 2);
        }

        if (daysSinceService > 180) {
          healthScore -= Math.min(30, (daysSinceService - 180) / 10);
        }

        const meterReading = item.meterReading || 0;
        const recommendedPages = 50000;
        if (meterReading > recommendedPages) {
          healthScore -= Math.min(20, ((meterReading - recommendedPages) / recommendedPages) * 20);
        }

        healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

        // Determine urgency
        let urgency: 'overdue' | 'urgent' | 'soon' | 'scheduled';
        let riskLevel: 'critical' | 'high' | 'medium' | 'low';

        if (daysUntilDue <= 0) {
          urgency = 'overdue';
          riskLevel = 'critical';
        } else if (daysUntilDue <= 7) {
          urgency = 'urgent';
          riskLevel = 'high';
        } else if (daysUntilDue <= 30) {
          urgency = 'soon';
          riskLevel = 'medium';
        } else {
          urgency = 'scheduled';
          riskLevel = 'low';
        }

        // Get AI prediction if metrics available
        let aiPrediction = null;
        try {
          const recentMetrics = await db.query.clientCollectedMetrics.findMany({
            where: and(
              eq(clientCollectedMetrics.serialNumber, item.serialNumber || ''),
              eq(clientCollectedMetrics.tenantId, parseInt(tenantId)),
              gte(clientCollectedMetrics.collectionTimestamp, thirtyDaysAgo),
            ),
            orderBy: [desc(clientCollectedMetrics.collectionTimestamp)],
            limit: 10,
          });

          if (recentMetrics.length > 0) {
            const analysis = await (predictiveServiceDispatchService as any).analyzeDeviceHealth(
              recentMetrics,
              tenantId,
            );
            aiPrediction = {
              failureRisk: analysis.predictedFailureRisk || 0,
              daysUntilFailure: analysis.daysUntilPredictedFailure,
              recommendations: analysis.recommendations || [],
            };
          }
        } catch (error) {
          log.error(`AI prediction failed for ${item.serialNumber}:`, error);
        }

        const estimatedIssues: string[] = [];
        if (healthScore < 40) {
          estimatedIssues.push('High risk of failure');
        } else if (healthScore < 60) {
          estimatedIssues.push('Preventive maintenance recommended');
        } else if (healthScore < 80) {
          estimatedIssues.push('Minor adjustments may be needed');
        }

        if (daysUntilDue < 0) {
          estimatedIssues.push(`${Math.abs(daysUntilDue)} days overdue`);
        }

        return {
          equipmentId: item.equipmentId,
          serialNumber: item.serialNumber || 'N/A',
          make: item.make || 'Unknown',
          model: item.model || 'Unknown',
          customerName: item.customerName || 'Unknown Customer',
          customerId: item.customerId,
          location: item.location || 'Unknown',
          lastServiceDate: item.lastServiceDate,
          daysSinceService,
          nextServiceDue: nextDue.toISOString(),
          daysUntilDue,
          healthScore,
          meterReading,
          recommendedPages,
          urgency,
          riskLevel,
          estimatedIssues: estimatedIssues.length > 0 ? estimatedIssues : undefined,
          aiPrediction,
        };
      }),
    );

    // Calculate summary statistics
    const overdueCount = equipmentHealth.filter((i) => i.urgency === 'overdue').length;
    const urgentCount = equipmentHealth.filter((i) => i.urgency === 'urgent').length;
    const soonCount = equipmentHealth.filter((i) => i.urgency === 'soon').length;
    const scheduledCount = equipmentHealth.filter((i) => i.urgency === 'scheduled').length;

    const averageHealthScore =
      equipmentHealth.length > 0
        ? Math.round(
            equipmentHealth.reduce((sum, i) => sum + i.healthScore, 0) / equipmentHealth.length,
          )
        : 100;

    // Devices at risk (health score < 60)
    const devicesAtRisk = equipmentHealth.filter((i) => i.healthScore < 60).length;

    // Estimate prevented emergencies
    const preventableEmergencies = Math.floor(devicesAtRisk * 0.7);

    // Prevented downtime estimation (4 hours per prevented emergency)
    const downtimePreventedHours = preventableEmergencies * 4;

    // Cost savings ($200 per prevented emergency)
    const costSavings = preventableEmergencies * 200;

    // Uptime improvement calculation
    const totalPossibleDowntime = equipmentHealth.length * 30 * 24;
    const uptimeImprovement =
      totalPossibleDowntime > 0
        ? ((downtimePreventedHours / totalPossibleDowntime) * 100).toFixed(2)
        : '0.00';

    res.json({
      success: true,
      overview: {
        totalEquipment: equipmentHealth.length,
        devicesMonitored: equipmentHealth.length,
        devicesAtRisk,
        overdueCount,
        urgentCount,
        soonCount,
        scheduledCount,
        averageHealthScore,
        preventableEmergencies,
        downtimePreventedHours,
        costSavings,
        uptimeImprovement: `${uptimeImprovement}%`,
        period: '30 days',
      },
      equipment: equipmentHealth,
    });
  } catch (error) {
    log.error('[PREDICTIVE MAINTENANCE HUB] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch predictive maintenance data',
    });
  }
});

/**
 * POST /api/predictive-maintenance/:equipmentId/schedule
 * Schedule proactive service for equipment
 */
router.post('/api/predictive-maintenance/:equipmentId/schedule', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { equipmentId } = req.params;
    const { scheduledDate, priority = 'medium', notes, technicianId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    // Get equipment details
    const [equipmentItem] = await db
      .select({
        id: equipment.id,
        customerId: equipment.customerId,
        serialNumber: equipment.serialNumber,
        make: equipment.make,
        model: equipment.model,
        location: equipment.location,
      })
      .from(equipment)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, tenantId)))
      .limit(1);

    if (!equipmentItem) {
      return res.status(404).json({ message: 'Equipment not found' });
    }

    // Create service ticket for proactive maintenance
    const ticketNumber = `PM-${Date.now().toString(36).toUpperCase()}`;

    const [ticket] = await db
      .insert(serviceTickets)
      .values({
        tenantId,
        customerId: equipmentItem.customerId,
        equipmentId: equipmentItem.id,
        ticketNumber,
        title: `Predictive Maintenance - ${equipmentItem.make} ${equipmentItem.model}`,
        description:
          notes || `AI-recommended preventive maintenance for ${equipmentItem.serialNumber}`,
        priority: priority,
        status: 'pending',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        customerAddress: equipmentItem.location,
        technicianId: technicianId || undefined,
        createdBy: req.user?.id || 'system',
      })
      .returning();

    log.info(
      `[PREDICTIVE MAINTENANCE] Created ticket ${ticketNumber} for equipment ${equipmentId}`,
    );

    res.json({
      success: true,
      message: 'Predictive maintenance scheduled successfully',
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        scheduledDate: ticket.scheduledDate,
        technicianId: ticket.technicianId,
      },
    });
  } catch (error) {
    log.error('[PREDICTIVE MAINTENANCE] Error scheduling service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule predictive maintenance',
    });
  }
});

/**
 * POST /api/predictive-maintenance/analyze/:serialNumber
 * Analyze single device with AI and auto-dispatch if needed
 */
router.post('/api/predictive-maintenance/analyze/:serialNumber', async (req: any, res) => {
  try {
    const { serialNumber } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    log.info(`🔮 Analyzing device ${serialNumber} for predictive dispatch...`);

    const result = await predictiveServiceDispatchService.analyzeAndDispatch(
      serialNumber,
      tenantId,
    );

    log.info(
      `✅ Analysis complete in ${result.processingTimeMs}ms - Dispatch: ${result.dispatchCreated}`,
    );

    res.json({
      success: true,
      message: result.dispatchCreated
        ? 'Predictive maintenance auto-scheduled'
        : 'Device health is acceptable',
      data: result,
    });
  } catch (error: any) {
    log.error('Predictive analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze device',
    });
  }
});

/**
 * POST /api/predictive-maintenance/analyze-batch
 * Batch analyze multiple devices
 */
router.post('/api/predictive-maintenance/analyze-batch', async (req: any, res) => {
  try {
    const { serialNumbers } = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    if (!Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return res.status(400).json({ error: 'serialNumbers array required' });
    }

    log.info(`🔮 Batch analyzing ${serialNumbers.length} devices...`);

    const results = [];
    const errors = [];

    for (const serialNumber of serialNumbers) {
      try {
        const result = await predictiveServiceDispatchService.analyzeAndDispatch(
          serialNumber,
          tenantId,
        );
        results.push({ serialNumber, ...result });
      } catch (error: any) {
        errors.push({ serialNumber, error: error.message });
      }
    }

    res.json({
      success: true,
      analyzed: results.length,
      failed: errors.length,
      dispatchesCreated: results.filter((r) => r.dispatchCreated).length,
      results,
      errors,
    });
  } catch (error: any) {
    log.error('Batch predictive analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to batch analyze devices',
    });
  }
});

/**
 * POST /api/predictive-maintenance/analyze-fleet
 * Analyze all monitored devices in fleet
 */
router.post('/api/predictive-maintenance/analyze-fleet', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    log.info(`🔮 Starting full fleet analysis for tenant ${tenantId}...`);

    // Get all active equipment
    const activeEquipment = await db
      .select({ serialNumber: equipment.serialNumber })
      .from(equipment)
      .where(and(eq(equipment.tenantId, tenantId), eq(equipment.status, 'active')));

    const serialNumbers = activeEquipment
      .map((e) => e.serialNumber)
      .filter((sn): sn is string => sn !== null && sn !== undefined);

    log.info(`📊 Found ${serialNumbers.length} devices to analyze`);

    // Analyze in batches to avoid overload
    const batchSize = 10;
    const results = [];
    const errors = [];

    for (let i = 0; i < serialNumbers.length; i += batchSize) {
      const batch = serialNumbers.slice(i, i + batchSize);

      for (const serialNumber of batch) {
        try {
          const result = await predictiveServiceDispatchService.analyzeAndDispatch(
            serialNumber,
            tenantId,
          );
          results.push({ serialNumber, ...result });
        } catch (error: any) {
          errors.push({ serialNumber, error: error.message });
        }
      }
    }

    log.info(`✅ Fleet analysis complete - ${results.length} analyzed, ${errors.length} failed`);

    res.json({
      success: true,
      analyzed: results.length,
      failed: errors.length,
      dispatchesCreated: results.filter((r) => r.dispatchCreated).length,
      summary: {
        totalDevices: serialNumbers.length,
        requiresAttention: results.filter((r) => r.dispatchCreated).length,
        healthy: results.filter((r) => !r.dispatchCreated).length,
      },
      results: results.slice(0, 50), // Return first 50 for display
      errors,
    });
  } catch (error: any) {
    log.error('Fleet analysis failed:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to analyze fleet',
    });
  }
});

/**
 * GET /api/predictive-maintenance/parts-forecast
 * Forecast parts needed based on equipment health
 */
router.get('/api/predictive-maintenance/parts-forecast', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID required' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all equipment with recent metrics
    const activeEquipment = await db
      .select({
        id: equipment.id,
        serialNumber: equipment.serialNumber,
        make: equipment.make,
        model: equipment.model,
      })
      .from(equipment)
      .where(and(eq(equipment.tenantId, tenantId), eq(equipment.status, 'active')));

    const partsForecast: Record<
      string,
      {
        partName: string;
        category: string;
        quantity: number;
        priority: string;
        estimatedCost: number;
        devices: string[];
      }
    > = {};

    // Analyze each device for parts needs
    for (const device of activeEquipment) {
      if (!device.serialNumber) continue;

      try {
        const metrics = await db.query.clientCollectedMetrics.findMany({
          where: and(
            eq(clientCollectedMetrics.serialNumber, device.serialNumber),
            eq(clientCollectedMetrics.tenantId, parseInt(tenantId)),
            gte(clientCollectedMetrics.collectionTimestamp, thirtyDaysAgo),
          ),
          orderBy: [desc(clientCollectedMetrics.collectionTimestamp)],
          limit: 1,
        });

        if (metrics.length === 0) continue;

        const latest = metrics[0];

        // Check toner levels
        const tonerLevels = [
          { color: 'black', level: latest.tonerBlack, cost: 50 },
          { color: 'cyan', level: latest.tonerCyan, cost: 50 },
          { color: 'magenta', level: latest.tonerMagenta, cost: 50 },
          { color: 'yellow', level: latest.tonerYellow, cost: 50 },
        ];

        for (const toner of tonerLevels) {
          if (toner.level !== null && toner.level < 15) {
            const partKey = `toner_${toner.color}`;
            if (!partsForecast[partKey]) {
              partsForecast[partKey] = {
                partName: `Toner Cartridge - ${toner.color}`,
                category: 'consumable',
                quantity: 0,
                priority: toner.level < 5 ? 'urgent' : 'high',
                estimatedCost: 0,
                devices: [],
              };
            }
            partsForecast[partKey].quantity += 1;
            partsForecast[partKey].estimatedCost += toner.cost;
            partsForecast[partKey].devices.push(device.serialNumber);
          }
        }

        // Check fuser life
        if (latest.fuserLife !== null && latest.fuserLife < 10) {
          const partKey = 'fuser_assembly';
          if (!partsForecast[partKey]) {
            partsForecast[partKey] = {
              partName: 'Fuser Assembly',
              category: 'component',
              quantity: 0,
              priority: latest.fuserLife < 5 ? 'critical' : 'high',
              estimatedCost: 0,
              devices: [],
            };
          }
          partsForecast[partKey].quantity += 1;
          partsForecast[partKey].estimatedCost += 300;
          partsForecast[partKey].devices.push(device.serialNumber);
        }

        // Check drum life
        if (latest.drumLife !== null && latest.drumLife < 15) {
          const partKey = 'drum_unit';
          if (!partsForecast[partKey]) {
            partsForecast[partKey] = {
              partName: 'Drum Unit',
              category: 'component',
              quantity: 0,
              priority: latest.drumLife < 5 ? 'urgent' : 'medium',
              estimatedCost: 0,
              devices: [],
            };
          }
          partsForecast[partKey].quantity += 1;
          partsForecast[partKey].estimatedCost += 150;
          partsForecast[partKey].devices.push(device.serialNumber);
        }
      } catch (error) {
        log.error(`Error analyzing device ${device.serialNumber}:`, error);
      }
    }

    const forecast = Object.values(partsForecast);
    const totalCost = forecast.reduce((sum, part) => sum + part.estimatedCost, 0);

    res.json({
      success: true,
      forecast,
      summary: {
        totalParts: forecast.reduce((sum, part) => sum + part.quantity, 0),
        uniqueParts: forecast.length,
        totalEstimatedCost: totalCost,
        criticalParts: forecast.filter((p) => p.priority === 'critical').length,
        urgentParts: forecast.filter((p) => p.priority === 'urgent').length,
      },
    });
  } catch (error) {
    log.error('Parts forecast failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate parts forecast',
    });
  }
});

export function registerPredictiveMaintenanceHub(app: Express) {
  app.use(router);
}

export { router as predictiveMaintenanceHubRouter };
