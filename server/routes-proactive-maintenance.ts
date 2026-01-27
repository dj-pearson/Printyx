import { Router } from 'express';
import { db } from './db';
import { equipment, businessRecords, serviceTickets } from '../shared/schema';
import { eq, and, sql, desc, count } from 'drizzle-orm';

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};

const router = Router();

/**
 * Proactive Service Scheduling API
 * Predictive maintenance and equipment health monitoring
 */

router.get('/api/service/proactive-maintenance', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(400).json({ message: 'Tenant ID is required' });
    }

    // Get all equipment with calculated maintenance needs
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

    // Calculate maintenance metrics for each equipment
    const maintenanceItems = equipmentList.map((item) => {
      const now = new Date();
      const lastService = item.lastServiceDate ? new Date(item.lastServiceDate) : null;
      const nextDue = item.nextServiceDue
        ? new Date(item.nextServiceDue)
        : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

      // Calculate days since last service
      const daysSinceService = lastService
        ? Math.floor((now.getTime() - lastService.getTime()) / (1000 * 60 * 60 * 24))
        : 9999;

      // Calculate days until next service due
      const daysUntilDue = Math.floor((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate health score (0-100)
      // Factors: days since service, meter reading, service history
      let healthScore = 100;

      // Penalize for overdue service
      if (daysUntilDue < 0) {
        healthScore -= Math.min(50, Math.abs(daysUntilDue) * 2);
      }

      // Penalize for long time since last service
      if (daysSinceService > 180) {
        healthScore -= Math.min(30, (daysSinceService - 180) / 10);
      }

      // Add meter reading factor (higher pages = lower health)
      const meterReading = item.meterReading || 0;
      const recommendedPages = 50000; // Typical PM interval
      if (meterReading > recommendedPages) {
        healthScore -= Math.min(20, ((meterReading - recommendedPages) / recommendedPages) * 20);
      }

      healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

      // Determine urgency
      let urgency: 'overdue' | 'urgent' | 'soon' | 'scheduled';
      if (daysUntilDue <= 0) {
        urgency = 'overdue';
      } else if (daysUntilDue <= 7) {
        urgency = 'urgent';
      } else if (daysUntilDue <= 30) {
        urgency = 'soon';
      } else {
        urgency = 'scheduled';
      }

      // Estimated issues based on health score
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
        meterReading: meterReading,
        recommendedPages,
        urgency,
        estimatedIssues: estimatedIssues.length > 0 ? estimatedIssues : undefined,
      };
    });

    // Calculate summary statistics
    const overdueCount = maintenanceItems.filter((i) => i.urgency === 'overdue').length;
    const urgentCount = maintenanceItems.filter((i) => i.urgency === 'urgent').length;
    const soonCount = maintenanceItems.filter((i) => i.urgency === 'soon').length;
    const scheduledCount = maintenanceItems.filter((i) => i.urgency === 'scheduled').length;

    const averageHealthScore =
      maintenanceItems.length > 0
        ? maintenanceItems.reduce((sum, i) => sum + i.healthScore, 0) / maintenanceItems.length
        : 100;

    // Estimate prevented emergencies (equipment that was proactively serviced)
    // This would come from actual historical data in production
    const preventableEmergencies = Math.floor(
      maintenanceItems.filter((i) => i.healthScore < 60).length * 0.7,
    );

    res.json({
      success: true,
      summary: {
        totalEquipment: maintenanceItems.length,
        overdueCount,
        urgentCount,
        soonCount,
        scheduledCount,
        averageHealthScore: Math.round(averageHealthScore),
        preventableEmergencies,
      },
      equipment: maintenanceItems,
    });
  } catch (error) {
    console.error('[PROACTIVE MAINTENANCE] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch proactive maintenance data',
    });
  }
});

/**
 * Schedule proactive service for equipment
 */
router.post('/api/service/proactive-maintenance/:equipmentId/schedule', async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { equipmentId } = req.params;
    const { scheduledDate, priority = 'medium', notes } = req.body;

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
        title: `Proactive Maintenance - ${equipmentItem.make} ${equipmentItem.model}`,
        description: notes || `Scheduled preventive maintenance for ${equipmentItem.serialNumber}`,
        priority: priority,
        status: 'pending',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        customerAddress: equipmentItem.location,
        createdBy: req.user?.id || 'system',
      })
      .returning();

    console.log(
      `[PROACTIVE MAINTENANCE] Created ticket ${ticketNumber} for equipment ${equipmentId}`,
    );

    res.json({
      success: true,
      message: 'Proactive service scheduled successfully',
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        scheduledDate: ticket.scheduledDate,
      },
    });
  } catch (error) {
    console.error('[PROACTIVE MAINTENANCE] Error scheduling service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule proactive service',
    });
  }
});

export { router as proactiveMaintenanceRouter };
