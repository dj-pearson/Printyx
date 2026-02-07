import type { Express } from 'express';
import { db } from './db';
import { predictiveServiceDispatchService } from './services/predictive-service-dispatch-service';
import { eq, and, desc, sql, gte, lte, isNull } from 'drizzle-orm';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('routes-predictive-service-dispatch');

export function registerPredictiveServiceDispatchRoutes(app: Express) {
  /**
   * Analyze a single device and auto-dispatch if needed
   */
  app.post('/api/predictive-dispatch/analyze/:serialNumber', async (req, res) => {
    try {
      const { serialNumber } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

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
          ? 'Predictive maintenance scheduled'
          : 'Device health is acceptable',
        data: result,
      });
    } catch (error: any) {
      log.error('Predictive dispatch analysis failed:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to analyze device',
      });
    }
  });

  /**
   * Batch analyze multiple devices
   */
  app.post('/api/predictive-dispatch/analyze-batch', async (req, res) => {
    try {
      const { serialNumbers } = req.body;
      const tenantId = req.headers['x-tenant-id'] as string;

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
      log.error('Batch predictive dispatch failed:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to batch analyze devices',
      });
    }
  });

  /**
   * Get predictive dispatch dashboard metrics
   */
  app.get('/api/predictive-dispatch/dashboard', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Total predictive dispatches
      const predictiveDispatches = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(serviceCallsEnhanced)
        .where(
          and(
            eq(serviceCallsEnhanced.tenantId, tenantId),
            eq(serviceCallsEnhanced.callType, 'preventive'),
            gte(serviceCallsEnhanced.scheduledDate, thirtyDaysAgo),
          ),
        );

      const totalPredictiveDispatches = predictiveDispatches[0]?.count || 0;

      // Prevented downtime estimation
      // Assumption: Each predictive dispatch prevents average 4 hours downtime
      const avgDowntimePreventedHours = 4;
      const totalDowntimePrevented = totalPredictiveDispatches * avgDowntimePreventedHours;

      // Devices currently monitored
      const monitoredDevices = await db
        .select({ count: sql<number>`count(distinct serial_number)::int` })
        .from(equipmentMetrics)
        .where(eq(equipmentMetrics.tenantId, tenantId));

      const totalMonitoredDevices = monitoredDevices[0]?.count || 0;

      // Recent health checks (devices with metrics in last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentHealthChecks = await db
        .select({ count: sql<number>`count(distinct serial_number)::int` })
        .from(equipmentMetrics)
        .where(
          and(
            eq(equipmentMetrics.tenantId, tenantId),
            gte(equipmentMetrics.collectedAt, yesterday),
          ),
        );

      const devicesCheckedLast24h = recentHealthChecks[0]?.count || 0;

      // At-risk devices (need to query service for this)
      // For now, approximate based on devices that have preventive calls scheduled
      const atRiskDevices = await db
        .select({ count: sql<number>`count(distinct equipment_id)::int` })
        .from(serviceCallsEnhanced)
        .where(
          and(
            eq(serviceCallsEnhanced.tenantId, tenantId),
            eq(serviceCallsEnhanced.callType, 'preventive'),
            eq(serviceCallsEnhanced.status, 'scheduled'),
          ),
        );

      const devicesAtRisk = atRiskDevices[0]?.count || 0;

      // Upcoming scheduled maintenance
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const upcomingMaintenance = await db
        .select({
          id: serviceCallsEnhanced.id,
          equipmentId: serviceCallsEnhanced.equipmentId,
          scheduledDate: serviceCallsEnhanced.scheduledDate,
          priority: serviceCallsEnhanced.priority,
          technicianId: serviceCallsEnhanced.assignedTechnicianId,
          estimatedDuration: serviceCallsEnhanced.estimatedDuration,
          predictedIssue: serviceCallsEnhanced.description,
        })
        .from(serviceCallsEnhanced)
        .where(
          and(
            eq(serviceCallsEnhanced.tenantId, tenantId),
            eq(serviceCallsEnhanced.callType, 'preventive'),
            eq(serviceCallsEnhanced.status, 'scheduled'),
            gte(serviceCallsEnhanced.scheduledDate, new Date()),
            lte(serviceCallsEnhanced.scheduledDate, nextWeek),
          ),
        )
        .orderBy(serviceCallsEnhanced.scheduledDate)
        .limit(10);

      // Parts ordering stats (last 30 days)
      // TODO: Query from purchase orders or parts orders table when available
      const partsAutoOrdered = 0; // Placeholder

      // Calculate cost savings
      // Assumption: Each emergency call costs $200 more than preventive
      const emergencyCostDiff = 200;
      const costSavings = totalPredictiveDispatches * emergencyCostDiff;

      // Calculate uptime improvement
      // Total possible downtime hours = devices * 30 days * 24 hours
      // Prevented downtime as percentage
      const totalPossibleDowntime = totalMonitoredDevices * 30 * 24;
      const uptimeImprovement =
        totalPossibleDowntime > 0
          ? ((totalDowntimePrevented / totalPossibleDowntime) * 100).toFixed(2)
          : '0.00';

      res.json({
        overview: {
          totalPredictiveDispatches,
          devicesMonitored: totalMonitoredDevices,
          devicesAtRisk,
          devicesCheckedLast24h,
          downtimePreventedHours: totalDowntimePrevented,
          costSavings,
          uptimeImprovement: `${uptimeImprovement}%`,
          partsAutoOrdered,
          period: '30 days',
        },
        upcomingMaintenance: upcomingMaintenance.map((m) => ({
          id: m.id,
          equipmentId: m.equipmentId,
          scheduledDate: m.scheduledDate,
          priority: m.priority,
          technicianId: m.technicianId,
          estimatedDuration: m.estimatedDuration,
          predictedIssue: m.predictedIssue,
        })),
      });
    } catch (error: any) {
      log.error('Failed to fetch predictive dispatch dashboard:', error);
      res.status(500).json({
        error: 'Failed to fetch dashboard data',
      });
    }
  });

  /**
   * Get list of devices at risk requiring attention
   */
  app.get('/api/predictive-dispatch/devices-at-risk', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      // Get devices with scheduled preventive maintenance (indicates they were flagged as at-risk)
      const devicesWithScheduledMaintenance = await db
        .select({
          equipmentId: serviceCallsEnhanced.equipmentId,
          scheduledDate: serviceCallsEnhanced.scheduledDate,
          priority: serviceCallsEnhanced.priority,
          description: serviceCallsEnhanced.description,
        })
        .from(serviceCallsEnhanced)
        .where(
          and(
            eq(serviceCallsEnhanced.tenantId, tenantId),
            eq(serviceCallsEnhanced.callType, 'preventive'),
            eq(serviceCallsEnhanced.status, 'scheduled'),
          ),
        )
        .orderBy(desc(serviceCallsEnhanced.priority), serviceCallsEnhanced.scheduledDate);

      // Get latest metrics for each device
      const atRiskDevices = [];

      for (const service of devicesWithScheduledMaintenance) {
        // Get device info
        const device = await db.query.equipment.findFirst({
          where: and(eq(equipment.id, service.equipmentId), eq(equipment.tenantId, tenantId)),
        });

        if (!device) continue;

        // Get latest metrics
        const latestMetric = await db.query.equipmentMetrics.findFirst({
          where: and(
            eq(equipmentMetrics.serialNumber, device.serialNumber),
            eq(equipmentMetrics.tenantId, tenantId),
          ),
          orderBy: [desc(equipmentMetrics.collectedAt)],
        });

        atRiskDevices.push({
          equipmentId: device.id,
          serialNumber: device.serialNumber,
          model: device.model,
          location: device.location,
          scheduledMaintenance: service.scheduledDate,
          priority: service.priority,
          predictedIssue: service.description,
          lastCheck: latestMetric?.collectedAt || null,
          tonerLevel: latestMetric?.tonerLevel || null,
          fuserLife: latestMetric?.fuserLife || null,
          drumLife: latestMetric?.drumLife || null,
          totalPageCount: latestMetric?.totalPages || null,
        });
      }

      res.json({
        devicesAtRisk: atRiskDevices,
        count: atRiskDevices.length,
      });
    } catch (error: any) {
      log.error('Failed to fetch at-risk devices:', error);
      res.status(500).json({
        error: 'Failed to fetch at-risk devices',
      });
    }
  });

  /**
   * Get health status for a specific device
   */
  app.get('/api/predictive-dispatch/device-health/:serialNumber', async (req, res) => {
    try {
      const { serialNumber } = req.params;
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      // Get device
      const device = await db.query.equipment.findFirst({
        where: and(eq(equipment.serialNumber, serialNumber), eq(equipment.tenantId, tenantId)),
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Get recent metrics (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const metrics = await db.query.equipmentMetrics.findMany({
        where: and(
          eq(equipmentMetrics.serialNumber, serialNumber),
          eq(equipmentMetrics.tenantId, tenantId),
          gte(equipmentMetrics.collectedAt, thirtyDaysAgo),
        ),
        orderBy: [desc(equipmentMetrics.collectedAt)],
      });

      if (metrics.length === 0) {
        return res.status(404).json({ error: 'No metrics available for this device' });
      }

      // Analyze health (but don't create service call)
      const service = predictiveServiceDispatchService as any;
      const healthAnalysis = await service.analyzeDeviceHealth(metrics, tenantId);

      // Get any scheduled maintenance for this device
      const scheduledMaintenance = await db.query.serviceCallsEnhanced.findMany({
        where: and(
          eq(serviceCallsEnhanced.equipmentId, device.id),
          eq(serviceCallsEnhanced.tenantId, tenantId),
          eq(serviceCallsEnhanced.callType, 'preventive'),
          eq(serviceCallsEnhanced.status, 'scheduled'),
        ),
        orderBy: [serviceCallsEnhanced.scheduledDate],
      });

      res.json({
        device: {
          id: device.id,
          serialNumber: device.serialNumber,
          model: device.model,
          location: device.location,
        },
        healthAnalysis,
        metricsCount: metrics.length,
        latestMetrics: metrics[0],
        scheduledMaintenance: scheduledMaintenance.map((s) => ({
          id: s.id,
          scheduledDate: s.scheduledDate,
          priority: s.priority,
          description: s.description,
          technicianId: s.assignedTechnicianId,
        })),
      });
    } catch (error: any) {
      log.error('Failed to fetch device health:', error);
      res.status(500).json({
        error: 'Failed to fetch device health',
      });
    }
  });

  /**
   * Get technician performance metrics for predictive dispatch
   */
  app.get('/api/predictive-dispatch/technician-performance', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      const technicians = await db.query.technicianResourcesEnhanced.findMany({
        where: and(
          eq(technicianResourcesEnhanced.tenantId, tenantId),
          eq(technicianResourcesEnhanced.status, 'available'),
        ),
      });

      const performanceData = technicians.map((tech) => ({
        technicianId: tech.technicianId,
        name: tech.technicianId, // TODO: Join with users table
        skills: tech.skills || [],
        certifications: tech.certifications || [],
        currentWorkload: tech.assignedCallsCount,
        maxWorkload: tech.maxDailyCapacity || 8,
        utilizationPercent: tech.maxDailyCapacity
          ? ((tech.assignedCallsCount / tech.maxDailyCapacity) * 100).toFixed(0)
          : 0,
        avgResponseTime: tech.averageResponseTime,
        completionRate: parseFloat(tech.completionRate?.toString() || '0') * 100,
        location: tech.currentLocation,
        territories: tech.serviceTerritory || [],
      }));

      res.json({
        technicians: performanceData,
        count: performanceData.length,
      });
    } catch (error: any) {
      log.error('Failed to fetch technician performance:', error);
      res.status(500).json({
        error: 'Failed to fetch technician performance',
      });
    }
  });

  /**
   * Trigger batch analysis for all monitored devices
   */
  app.post('/api/predictive-dispatch/analyze-all', async (req, res) => {
    try {
      const tenantId = req.headers['x-tenant-id'] as string;

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID required' });
      }

      log.info(`🔮 Starting full fleet analysis for tenant ${tenantId}...`);

      // Get all unique devices with recent metrics (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const devicesWithMetrics = await db
        .selectDistinct({ serialNumber: equipmentMetrics.serialNumber })
        .from(equipmentMetrics)
        .where(
          and(
            eq(equipmentMetrics.tenantId, tenantId),
            gte(equipmentMetrics.collectedAt, sevenDaysAgo),
          ),
        );

      const serialNumbers = devicesWithMetrics.map((d) => d.serialNumber);

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
}
