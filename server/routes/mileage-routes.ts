import express, { Request, Response } from 'express';
import { z } from 'zod';
import { mileageService } from '../services/mileage-service';
import { db } from '../db';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('mileage-routes');

import {
  technicianMileage,
  mileageReimbursementRates,
  mileageReports,
  vehicleAssignments,
  irsMileageLogs,
  insertMileageReimbursementRateSchema,
  insertVehicleAssignmentSchema,
} from '@shared/mileage-tracking-schema';

const router = express.Router();

// Helper function to check if user has admin/manager role
function isAdminOrManager(user: any): boolean {
  if (!user?.role) return false;
  const role = user.role || '';
  const roleLower = role.toLowerCase();
  return (
    roleLower.includes('admin') || roleLower.includes('manager') || roleLower.includes('executive')
  );
}

// ==================== Daily Mileage Records ====================

// GET /api/mileage/records - Get mileage records
router.get('/records', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { technicianId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const targetTechnicianId = (technicianId as string) || user.id;

    // Non-admin users can only view their own records
    if (!isAdminOrManager(user) && targetTechnicianId !== user.id) {
      return res.status(403).json({ error: 'You can only view your own mileage records' });
    }

    const records = await mileageService.getTechnicianMileage(
      user.tenantId,
      targetTechnicianId,
      new Date(startDate as string),
      new Date(endDate as string),
    );

    res.json(records);
  } catch (error) {
    log.error('Get mileage records error:', error);
    res.status(500).json({ error: 'Failed to fetch mileage records' });
  }
});

// POST /api/mileage/records - Create or update daily mileage record
router.post('/records', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const recordSchema = z.object({
      technicianId: z.string().optional(),
      date: z.coerce.date(),
      totalMiles: z.string().or(z.number()).optional(),
      businessMiles: z.string().or(z.number()).optional(),
      personalMiles: z.string().or(z.number()).optional(),
      commuteMiles: z.string().or(z.number()).optional(),
      startOdometer: z.string().or(z.number()).optional(),
      endOdometer: z.string().or(z.number()).optional(),
      numberOfTrips: z.number().optional(),
      numberOfStops: z.number().optional(),
      fuelPurchased: z.string().or(z.number()).optional(),
      fuelCost: z.string().or(z.number()).optional(),
      vehicleId: z.string().optional(),
      notes: z.string().optional(),
    });

    const data = recordSchema.parse(req.body);
    const targetTechnicianId = data.technicianId || user.id;

    // Non-admin users can only create their own records
    if (!isAdminOrManager(user) && targetTechnicianId !== user.id) {
      return res.status(403).json({ error: 'You can only create your own mileage records' });
    }

    const record = await mileageService.recordDailyMileage(user.tenantId, targetTechnicianId, data);

    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create mileage record error:', error);
    res.status(500).json({ error: 'Failed to create mileage record' });
  }
});

// GET /api/mileage/summary - Get mileage summary for period
router.get('/summary', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { technicianId, startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const targetTechnicianId = (technicianId as string) || user.id;

    // Non-admin users can only view their own summary
    if (!isAdminOrManager(user) && targetTechnicianId !== user.id) {
      return res.status(403).json({ error: 'You can only view your own mileage summary' });
    }

    const summary = await mileageService.getMileageSummary(
      user.tenantId,
      targetTechnicianId,
      new Date(startDate as string),
      new Date(endDate as string),
    );

    res.json(summary);
  } catch (error) {
    log.error('Get mileage summary error:', error);
    res.status(500).json({ error: 'Failed to get mileage summary' });
  }
});

// POST /api/mileage/auto-generate - Auto-generate mileage from GPS data
router.post('/auto-generate', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const autoGenSchema = z.object({
      date: z.coerce.date().optional(),
    });

    const { date } = autoGenSchema.parse(req.body);
    const targetDate = date || new Date();

    const recordsCreated = await mileageService.autoGenerateDailyMileage(user.tenantId, targetDate);

    res.json({ success: true, recordsCreated, date: targetDate });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Auto-generate mileage error:', error);
    res.status(500).json({ error: 'Failed to auto-generate mileage' });
  }
});

// ==================== Mileage Reports ====================

// GET /api/mileage/reports - List mileage reports
router.get('/reports', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { technicianId, status, reportType } = req.query;

    let query = db
      .select()
      .from(mileageReports)
      .where(eq(mileageReports.tenantId, user.tenantId))
      .orderBy(desc(mileageReports.createdAt));

    // Non-admin users can only view their own reports
    if (!isAdminOrManager(user)) {
      query = query.where(
        and(eq(mileageReports.tenantId, user.tenantId), eq(mileageReports.technicianId, user.id)),
      ) as any;
    }

    const reports = await query;
    res.json(reports);
  } catch (error) {
    log.error('Get mileage reports error:', error);
    res.status(500).json({ error: 'Failed to fetch mileage reports' });
  }
});

// POST /api/mileage/reports - Generate mileage report
router.post('/reports', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const reportSchema = z.object({
      technicianId: z.string().optional(),
      reportType: z.enum(['weekly', 'monthly', 'quarterly', 'annual', 'custom']),
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
    });

    const data = reportSchema.parse(req.body);
    const targetTechnicianId = data.technicianId || user.id;

    // Non-admin users can only generate their own reports
    if (!isAdminOrManager(user) && targetTechnicianId !== user.id) {
      return res.status(403).json({ error: 'You can only generate your own mileage reports' });
    }

    const report = await mileageService.generateMileageReport(
      user.tenantId,
      targetTechnicianId,
      data.reportType,
      data.startDate,
      data.endDate,
      user.id,
    );

    res.status(201).json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Generate mileage report error:', error);
    res.status(500).json({ error: 'Failed to generate mileage report' });
  }
});

// GET /api/mileage/reports/:id - Get specific report
router.get('/reports/:id', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const [report] = await db
      .select()
      .from(mileageReports)
      .where(and(eq(mileageReports.id, req.params.id), eq(mileageReports.tenantId, user.tenantId)))
      .limit(1);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Non-admin users can only view their own reports
    if (!isAdminOrManager(user) && report.technicianId !== user.id) {
      return res.status(403).json({ error: 'You can only view your own mileage reports' });
    }

    res.json(report);
  } catch (error) {
    log.error('Get mileage report error:', error);
    res.status(500).json({ error: 'Failed to fetch mileage report' });
  }
});

// POST /api/mileage/reports/:id/submit - Submit report for approval
router.post('/reports/:id/submit', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const report = await mileageService.submitReport(req.params.id, user.tenantId, user.id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    log.error('Submit mileage report error:', error);
    res.status(500).json({ error: 'Failed to submit mileage report' });
  }
});

// POST /api/mileage/reports/:id/approve - Approve report (Admin/Manager only)
router.post('/reports/:id/approve', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const report = await mileageService.approveReport(req.params.id, user.tenantId, user.id);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    log.error('Approve mileage report error:', error);
    res.status(500).json({ error: 'Failed to approve mileage report' });
  }
});

// POST /api/mileage/reports/:id/reject - Reject report (Admin/Manager only)
router.post('/reports/:id/reject', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const rejectSchema = z.object({
      reason: z.string(),
    });

    const { reason } = rejectSchema.parse(req.body);

    const report = await mileageService.rejectReport(req.params.id, user.tenantId, user.id, reason);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Reject mileage report error:', error);
    res.status(500).json({ error: 'Failed to reject mileage report' });
  }
});

// ==================== Reimbursement Rates ====================

// GET /api/mileage/rates - Get reimbursement rates
router.get('/rates', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const rates = await db
      .select()
      .from(mileageReimbursementRates)
      .where(eq(mileageReimbursementRates.tenantId, user.tenantId))
      .orderBy(desc(mileageReimbursementRates.effectiveStartDate));

    res.json(rates);
  } catch (error) {
    log.error('Get reimbursement rates error:', error);
    res.status(500).json({ error: 'Failed to fetch reimbursement rates' });
  }
});

// POST /api/mileage/rates - Create reimbursement rate (Admin only)
router.post('/rates', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const data = insertMileageReimbursementRateSchema.parse({
      ...req.body,
      createdBy: user.id,
    });

    const [rate] = await db
      .insert(mileageReimbursementRates)
      .values({
        ...data,
        tenantId: user.tenantId,
      })
      .returning();

    res.status(201).json(rate);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create reimbursement rate error:', error);
    res.status(500).json({ error: 'Failed to create reimbursement rate' });
  }
});

// ==================== IRS Mileage Log ====================

// GET /api/mileage/irs-log - Get IRS mileage log
router.get('/irs-log', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { technicianId, taxYear } = req.query;

    const targetTechnicianId = (technicianId as string) || user.id;
    const year = taxYear ? parseInt(taxYear as string) : new Date().getFullYear();

    // Non-admin users can only view their own log
    if (!isAdminOrManager(user) && targetTechnicianId !== user.id) {
      return res.status(403).json({ error: 'You can only view your own IRS mileage log' });
    }

    const log = await mileageService.getIrsMileageLog(user.tenantId, targetTechnicianId, year);
    res.json(log);
  } catch (error) {
    log.error('Get IRS mileage log error:', error);
    res.status(500).json({ error: 'Failed to fetch IRS mileage log' });
  }
});

// GET /api/mileage/irs-log/export - Export IRS mileage log to CSV
router.get('/irs-log/export', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { technicianId, taxYear } = req.query;

    const targetTechnicianId = (technicianId as string) || user.id;
    const year = taxYear ? parseInt(taxYear as string) : new Date().getFullYear();

    // Non-admin users can only export their own log
    if (!isAdminOrManager(user) && targetTechnicianId !== user.id) {
      return res.status(403).json({ error: 'You can only export your own IRS mileage log' });
    }

    const csv = await mileageService.exportIrsMileageLog(user.tenantId, targetTechnicianId, year);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="irs-mileage-log-${year}.csv"`);
    res.send(csv);
  } catch (error) {
    log.error('Export IRS mileage log error:', error);
    res.status(500).json({ error: 'Failed to export IRS mileage log' });
  }
});

// POST /api/mileage/irs-log - Create IRS log entry
router.post('/irs-log', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const logSchema = z.object({
      technicianId: z.string().optional(),
      tripDate: z.coerce.date(),
      startLocation: z.string(),
      endLocation: z.string(),
      businessPurpose: z.string(),
      milesdriven: z.string().or(z.number()),
      odometerStart: z.string().or(z.number()).optional(),
      odometerEnd: z.string().or(z.number()).optional(),
      vehicleUsed: z.string().optional(),
      tolls: z.string().or(z.number()).optional(),
      parking: z.string().or(z.number()).optional(),
      ticketId: z.string().optional(),
      customerId: z.string().optional(),
      customerName: z.string().optional(),
    });

    const data = logSchema.parse(req.body);
    const targetTechnicianId = data.technicianId || user.id;

    // Non-admin users can only create their own log entries
    if (!isAdminOrManager(user) && targetTechnicianId !== user.id) {
      return res
        .status(403)
        .json({ error: 'You can only create your own IRS mileage log entries' });
    }

    const entry = await mileageService.createIrsLogEntry(user.tenantId, targetTechnicianId, {
      tripDate: data.tripDate,
      startLocation: data.startLocation,
      endLocation: data.endLocation,
      businessPurpose: data.businessPurpose,
      milesdriven: String(data.milesdriven),
      odometerStart: data.odometerStart ? String(data.odometerStart) : undefined,
      odometerEnd: data.odometerEnd ? String(data.odometerEnd) : undefined,
      vehicleUsed: data.vehicleUsed,
      tolls: data.tolls ? String(data.tolls) : undefined,
      parking: data.parking ? String(data.parking) : undefined,
      ticketId: data.ticketId,
      customerId: data.customerId,
      customerName: data.customerName,
      taxYear: data.tripDate.getFullYear(),
    });

    res.status(201).json(entry);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create IRS log entry error:', error);
    res.status(500).json({ error: 'Failed to create IRS log entry' });
  }
});

// ==================== Vehicles ====================

// GET /api/mileage/vehicles - Get vehicle assignments
router.get('/vehicles', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const vehicles = await db
      .select()
      .from(vehicleAssignments)
      .where(eq(vehicleAssignments.tenantId, user.tenantId));

    res.json(vehicles);
  } catch (error) {
    log.error('Get vehicles error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// POST /api/mileage/vehicles - Create vehicle (Admin only)
router.post('/vehicles', async (req: Request, res: Response) => {
  const user = req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!isAdminOrManager(user)) {
    return res.status(403).json({ error: 'Admin or Manager role required' });
  }

  try {
    const data = insertVehicleAssignmentSchema.parse(req.body);

    const [vehicle] = await db
      .insert(vehicleAssignments)
      .values({
        ...data,
        tenantId: user.tenantId,
      })
      .returning();

    res.status(201).json(vehicle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    log.error('Create vehicle error:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

export default router;
