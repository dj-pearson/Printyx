import { storage } from '../storage';
import { db } from '../db';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import {
  technicianMileage,
  mileageReimbursementRates,
  mileageReports,
  irsMileageLogs,
  InsertTechnicianMileage,
  InsertMileageReport,
  InsertIrsMileageLog,
  TechnicianMileage,
  MileageReimbursementRate,
  MileageReport,
  IrsMileageLog,
} from '@shared/mileage-tracking-schema';

// 2024 IRS standard mileage rate
const IRS_STANDARD_RATE_2024 = 0.67;

interface MileageSummary {
  technicianId: string;
  technicianName?: string;
  period: { start: Date; end: Date };
  totalMiles: number;
  businessMiles: number;
  personalMiles: number;
  commuteMiles: number;
  totalTrips: number;
  reimbursementAmount: number;
  reimbursementRate: number;
  averageMilesPerDay: number;
  daysWithMileage: number;
  fuelCost?: number;
  fuelGallons?: number;
  costPerMile?: number;
}

interface DailyMileage {
  date: Date;
  totalMiles: number;
  businessMiles: number;
  trips: number;
  stops: number;
  reimbursementAmount: number;
}

export class MileageService {
  /**
   * Get the applicable reimbursement rate for a technician on a specific date
   */
  async getApplicableRate(
    tenantId: string,
    technicianId: string,
    date: Date
  ): Promise<MileageReimbursementRate | null> {
    try {
      const rates = await db
        .select()
        .from(mileageReimbursementRates)
        .where(
          and(
            eq(mileageReimbursementRates.tenantId, tenantId),
            eq(mileageReimbursementRates.isActive, true),
            lte(mileageReimbursementRates.effectiveStartDate, date)
          )
        )
        .orderBy(desc(mileageReimbursementRates.effectiveStartDate));

      // Find the first rate that applies to this technician
      for (const rate of rates) {
        // Check end date
        if (rate.effectiveEndDate && new Date(rate.effectiveEndDate) < date) {
          continue;
        }

        // Check if rate applies to all or specific technicians
        if (rate.appliesToAllTechnicians) {
          return rate;
        }

        const applicableIds = rate.applicableTechnicianIds as string[] | null;
        if (applicableIds && applicableIds.includes(technicianId)) {
          return rate;
        }
      }

      return null;
    } catch (error) {
      console.error('Error getting applicable rate:', error);
      return null;
    }
  }

  /**
   * Calculate mileage from GPS location history for a technician
   */
  async calculateMileageFromGPS(
    tenantId: string,
    technicianId: string,
    date: Date
  ): Promise<{ totalMiles: number; trips: number; stops: number }> {
    try {
      // Get location history for the day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const history = await storage.getLocationHistory(technicianId, tenantId, {
        startDate: startOfDay,
        endDate: endOfDay,
      });

      let totalDistanceMeters = 0;
      let trips = 0;
      let stops = new Set<string>();

      for (const record of history) {
        // Sum up distances
        if (record.distanceFromPrevious) {
          totalDistanceMeters += parseFloat(record.distanceFromPrevious);
        }

        // Count unique ticket visits as stops
        if (record.ticketId) {
          stops.add(record.ticketId);
        }

        // Count trips (when activity changes from traveling)
        if (record.activityType === 'on_site') {
          trips++;
        }
      }

      // Convert meters to miles
      const totalMiles = totalDistanceMeters / 1609.34;

      return {
        totalMiles: Math.round(totalMiles * 100) / 100,
        trips: trips > 0 ? trips : 1,
        stops: stops.size,
      };
    } catch (error) {
      console.error('Error calculating mileage from GPS:', error);
      return { totalMiles: 0, trips: 0, stops: 0 };
    }
  }

  /**
   * Create or update daily mileage record
   */
  async recordDailyMileage(
    tenantId: string,
    technicianId: string,
    data: Partial<InsertTechnicianMileage>
  ): Promise<TechnicianMileage> {
    const date = data.date || new Date();
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    // Get applicable rate
    const rate = await this.getApplicableRate(tenantId, technicianId, dateOnly);
    const ratePerMile = rate ? parseFloat(rate.ratePerMile) : IRS_STANDARD_RATE_2024;

    // Calculate GPS mileage if not provided
    let gpsMileage = data.gpsCalculatedMiles ? parseFloat(String(data.gpsCalculatedMiles)) : null;
    if (gpsMileage === null) {
      const gpsData = await this.calculateMileageFromGPS(tenantId, technicianId, dateOnly);
      gpsMileage = gpsData.totalMiles;
    }

    const totalMiles = data.totalMiles ? parseFloat(String(data.totalMiles)) : gpsMileage || 0;
    const businessMiles = data.businessMiles ? parseFloat(String(data.businessMiles)) : totalMiles;
    const reimbursementAmount = businessMiles * ratePerMile;

    // Check for existing record
    const existing = await db
      .select()
      .from(technicianMileage)
      .where(
        and(
          eq(technicianMileage.tenantId, tenantId),
          eq(technicianMileage.technicianId, technicianId),
          eq(technicianMileage.date, dateOnly)
        )
      )
      .limit(1);

    const mileageData: InsertTechnicianMileage = {
      tenantId,
      technicianId,
      date: dateOnly,
      weekNumber: this.getWeekNumber(dateOnly),
      monthNumber: dateOnly.getMonth() + 1,
      year: dateOnly.getFullYear(),
      totalMiles: String(totalMiles),
      gpsCalculatedMiles: String(gpsMileage),
      businessMiles: String(businessMiles),
      personalMiles: data.personalMiles ? String(data.personalMiles) : '0',
      commuteMiles: data.commuteMiles ? String(data.commuteMiles) : '0',
      numberOfTrips: data.numberOfTrips || 0,
      numberOfStops: data.numberOfStops || 0,
      routeIds: data.routeIds || null,
      ticketIds: data.ticketIds || null,
      startLocation: data.startLocation || null,
      endLocation: data.endLocation || null,
      reimbursementRate: String(ratePerMile),
      reimbursementAmount: String(reimbursementAmount),
      reimbursementStatus: 'pending',
      fuelPurchased: data.fuelPurchased ? String(data.fuelPurchased) : null,
      fuelCost: data.fuelCost ? String(data.fuelCost) : null,
      vehicleId: data.vehicleId || null,
      verificationMethod: data.verificationMethod || 'gps',
      notes: data.notes || null,
    };

    if (existing.length > 0) {
      const [updated] = await db
        .update(technicianMileage)
        .set({
          ...mileageData,
          updatedAt: new Date(),
        })
        .where(eq(technicianMileage.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(technicianMileage)
        .values(mileageData)
        .returning();
      return created;
    }
  }

  /**
   * Get mileage records for a technician
   */
  async getTechnicianMileage(
    tenantId: string,
    technicianId: string,
    startDate: Date,
    endDate: Date
  ): Promise<TechnicianMileage[]> {
    return await db
      .select()
      .from(technicianMileage)
      .where(
        and(
          eq(technicianMileage.tenantId, tenantId),
          eq(technicianMileage.technicianId, technicianId),
          gte(technicianMileage.date, startDate),
          lte(technicianMileage.date, endDate)
        )
      )
      .orderBy(technicianMileage.date);
  }

  /**
   * Calculate mileage summary for a period
   */
  async getMileageSummary(
    tenantId: string,
    technicianId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MileageSummary> {
    const records = await this.getTechnicianMileage(tenantId, technicianId, startDate, endDate);

    let totalMiles = 0;
    let businessMiles = 0;
    let personalMiles = 0;
    let commuteMiles = 0;
    let totalTrips = 0;
    let reimbursementAmount = 0;
    let totalFuelCost = 0;
    let totalFuelGallons = 0;
    const daysWithMileage = new Set<string>();

    for (const record of records) {
      totalMiles += parseFloat(record.totalMiles || '0');
      businessMiles += parseFloat(record.businessMiles || '0');
      personalMiles += parseFloat(record.personalMiles || '0');
      commuteMiles += parseFloat(record.commuteMiles || '0');
      totalTrips += record.numberOfTrips || 0;
      reimbursementAmount += parseFloat(record.reimbursementAmount || '0');
      totalFuelCost += parseFloat(record.fuelCost || '0');
      totalFuelGallons += parseFloat(record.fuelPurchased || '0');

      if (parseFloat(record.totalMiles || '0') > 0) {
        daysWithMileage.add(new Date(record.date).toISOString().split('T')[0]);
      }
    }

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const workingDays = daysWithMileage.size;
    const averageRate = records.length > 0
      ? records.reduce((sum, r) => sum + parseFloat(r.reimbursementRate || '0'), 0) / records.length
      : IRS_STANDARD_RATE_2024;

    return {
      technicianId,
      period: { start: startDate, end: endDate },
      totalMiles: Math.round(totalMiles * 100) / 100,
      businessMiles: Math.round(businessMiles * 100) / 100,
      personalMiles: Math.round(personalMiles * 100) / 100,
      commuteMiles: Math.round(commuteMiles * 100) / 100,
      totalTrips,
      reimbursementAmount: Math.round(reimbursementAmount * 100) / 100,
      reimbursementRate: averageRate,
      averageMilesPerDay: workingDays > 0 ? Math.round((totalMiles / workingDays) * 100) / 100 : 0,
      daysWithMileage: workingDays,
      fuelCost: totalFuelCost > 0 ? Math.round(totalFuelCost * 100) / 100 : undefined,
      fuelGallons: totalFuelGallons > 0 ? Math.round(totalFuelGallons * 1000) / 1000 : undefined,
      costPerMile: totalMiles > 0 && totalFuelCost > 0
        ? Math.round((totalFuelCost / totalMiles) * 100) / 100
        : undefined,
    };
  }

  /**
   * Generate a mileage report
   */
  async generateMileageReport(
    tenantId: string,
    technicianId: string,
    reportType: 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'custom',
    startDate: Date,
    endDate: Date,
    createdBy: string
  ): Promise<MileageReport> {
    const summary = await this.getMileageSummary(tenantId, technicianId, startDate, endDate);
    const records = await this.getTechnicianMileage(tenantId, technicianId, startDate, endDate);

    // Generate daily breakdown
    const dailyBreakdown: DailyMileage[] = records.map(record => ({
      date: record.date,
      totalMiles: parseFloat(record.totalMiles || '0'),
      businessMiles: parseFloat(record.businessMiles || '0'),
      trips: record.numberOfTrips || 0,
      stops: record.numberOfStops || 0,
      reimbursementAmount: parseFloat(record.reimbursementAmount || '0'),
    }));

    // Generate report number
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const reportNumber = `MR-${dateStr}-${random}`;

    const reportData: InsertMileageReport = {
      tenantId,
      reportNumber,
      reportType,
      periodStart: startDate,
      periodEnd: endDate,
      technicianId,
      totalMiles: String(summary.totalMiles),
      businessMiles: String(summary.businessMiles),
      personalMiles: summary.personalMiles > 0 ? String(summary.personalMiles) : null,
      commuteMiles: summary.commuteMiles > 0 ? String(summary.commuteMiles) : null,
      totalReimbursement: String(summary.reimbursementAmount),
      averageRatePerMile: String(summary.reimbursementRate),
      totalTrips: summary.totalTrips,
      totalServiceCalls: records.reduce((sum, r) => sum + (r.numberOfStops || 0), 0),
      averageMilesPerTrip: summary.totalTrips > 0
        ? String(Math.round((summary.totalMiles / summary.totalTrips) * 100) / 100)
        : null,
      averageMilesPerDay: String(summary.averageMilesPerDay),
      totalFuelGallons: summary.fuelGallons ? String(summary.fuelGallons) : null,
      totalFuelCost: summary.fuelCost ? String(summary.fuelCost) : null,
      averageMpg: summary.fuelGallons && summary.totalMiles > 0
        ? String(Math.round((summary.totalMiles / summary.fuelGallons) * 100) / 100)
        : null,
      costPerMile: summary.costPerMile ? String(summary.costPerMile) : null,
      dailyBreakdown,
      reportStatus: 'draft',
      createdBy,
    };

    const [report] = await db
      .insert(mileageReports)
      .values(reportData)
      .returning();

    return report;
  }

  /**
   * Submit a mileage report for approval
   */
  async submitReport(reportId: string, tenantId: string, submittedBy: string): Promise<MileageReport | null> {
    const [updated] = await db
      .update(mileageReports)
      .set({
        reportStatus: 'submitted',
        submittedAt: new Date(),
        submittedBy,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mileageReports.id, reportId),
          eq(mileageReports.tenantId, tenantId)
        )
      )
      .returning();

    return updated || null;
  }

  /**
   * Approve a mileage report
   */
  async approveReport(reportId: string, tenantId: string, approvedBy: string): Promise<MileageReport | null> {
    const [updated] = await db
      .update(mileageReports)
      .set({
        reportStatus: 'approved',
        approvedAt: new Date(),
        approvedBy,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mileageReports.id, reportId),
          eq(mileageReports.tenantId, tenantId)
        )
      )
      .returning();

    // Update related mileage records
    if (updated) {
      await db
        .update(technicianMileage)
        .set({
          reimbursementStatus: 'approved',
          verifiedBy: approvedBy,
          verifiedAt: new Date(),
          isVerified: true,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(technicianMileage.tenantId, tenantId),
            eq(technicianMileage.technicianId, updated.technicianId!),
            gte(technicianMileage.date, updated.periodStart),
            lte(technicianMileage.date, updated.periodEnd)
          )
        );
    }

    return updated || null;
  }

  /**
   * Reject a mileage report
   */
  async rejectReport(
    reportId: string,
    tenantId: string,
    rejectedBy: string,
    reason: string
  ): Promise<MileageReport | null> {
    const [updated] = await db
      .update(mileageReports)
      .set({
        reportStatus: 'rejected',
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(mileageReports.id, reportId),
          eq(mileageReports.tenantId, tenantId)
        )
      )
      .returning();

    return updated || null;
  }

  /**
   * Create IRS-compliant mileage log entry
   */
  async createIrsLogEntry(
    tenantId: string,
    technicianId: string,
    data: Omit<InsertIrsMileageLog, 'tenantId' | 'technicianId'>
  ): Promise<IrsMileageLog> {
    const [entry] = await db
      .insert(irsMileageLogs)
      .values({
        tenantId,
        technicianId,
        ...data,
        taxYear: data.taxYear || new Date(data.tripDate).getFullYear(),
      })
      .returning();

    return entry;
  }

  /**
   * Get IRS mileage log for a tax year
   */
  async getIrsMileageLog(
    tenantId: string,
    technicianId: string,
    taxYear: number
  ): Promise<IrsMileageLog[]> {
    return await db
      .select()
      .from(irsMileageLogs)
      .where(
        and(
          eq(irsMileageLogs.tenantId, tenantId),
          eq(irsMileageLogs.technicianId, technicianId),
          eq(irsMileageLogs.taxYear, taxYear)
        )
      )
      .orderBy(irsMileageLogs.tripDate);
  }

  /**
   * Export IRS mileage log to CSV format
   */
  async exportIrsMileageLog(
    tenantId: string,
    technicianId: string,
    taxYear: number
  ): Promise<string> {
    const logs = await this.getIrsMileageLog(tenantId, technicianId, taxYear);

    const headers = [
      'Date',
      'Start Location',
      'End Location',
      'Business Purpose',
      'Miles Driven',
      'Odometer Start',
      'Odometer End',
      'Vehicle',
      'Tolls',
      'Parking',
      'Customer',
    ].join(',');

    const rows = logs.map(log => [
      new Date(log.tripDate).toISOString().split('T')[0],
      `"${(log.startLocation || '').replace(/"/g, '""')}"`,
      `"${(log.endLocation || '').replace(/"/g, '""')}"`,
      `"${(log.businessPurpose || '').replace(/"/g, '""')}"`,
      log.milesdriven || '',
      log.odometerStart || '',
      log.odometerEnd || '',
      log.vehicleUsed || '',
      log.tolls || '',
      log.parking || '',
      `"${(log.customerName || '').replace(/"/g, '""')}"`,
    ].join(','));

    // Add summary row
    const totalMiles = logs.reduce((sum, log) => sum + parseFloat(log.milesdriven || '0'), 0);
    const totalTolls = logs.reduce((sum, log) => sum + parseFloat(log.tolls || '0'), 0);
    const totalParking = logs.reduce((sum, log) => sum + parseFloat(log.parking || '0'), 0);

    rows.push('');
    rows.push(`Total,,,,${totalMiles.toFixed(2)},,,,${totalTolls.toFixed(2)},${totalParking.toFixed(2)},`);
    rows.push(`IRS Standard Rate: $${IRS_STANDARD_RATE_2024}/mile`);
    rows.push(`Deductible Amount: $${(totalMiles * IRS_STANDARD_RATE_2024).toFixed(2)}`);

    return [headers, ...rows].join('\n');
  }

  /**
   * Auto-generate daily mileage records from GPS data
   */
  async autoGenerateDailyMileage(tenantId: string, date: Date): Promise<number> {
    try {
      // Get all active technician locations for the tenant
      const technicians = await storage.getActiveTechnicianLocations(tenantId);
      const uniqueTechnicians = new Set(technicians.map(t => t.technicianId));

      let recordsCreated = 0;

      for (const technicianId of uniqueTechnicians) {
        const gpsData = await this.calculateMileageFromGPS(tenantId, technicianId, date);

        if (gpsData.totalMiles > 0) {
          await this.recordDailyMileage(tenantId, technicianId, {
            date,
            totalMiles: String(gpsData.totalMiles),
            businessMiles: String(gpsData.totalMiles), // Assume all GPS-tracked miles are business
            numberOfTrips: gpsData.trips,
            numberOfStops: gpsData.stops,
            verificationMethod: 'gps',
          });
          recordsCreated++;
        }
      }

      return recordsCreated;
    } catch (error) {
      console.error('Error auto-generating daily mileage:', error);
      return 0;
    }
  }

  /**
   * Get week number from date
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}

export const mileageService = new MileageService();
