// Usage analytics + equipment health handlers (EDGE-002b).
//   GET /usage-analytics   — used by UsageAnalyticsDashboard.tsx
//   GET /equipment-health  — used by EquipmentHealthDashboard.tsx
//
// usage-analytics ports the real delta-based meter computation from
// server/services/customer-portal-service.ts (getUsageAnalytics). The
// comparison block uses a fixed previous-period multiplier instead of the
// Express version's Math.random() — deterministic responses cache better and
// the random "previous period" was placeholder data anyway.
//
// equipment-health intentionally DIVERGES from Express: the Express service
// returned three hardcoded mock machines to every customer. Here health rows
// are built from the customer's real `equipment` rows + latest meter
// submissions, with heuristic scores from service-due dates. IoT metrics
// (toner, temperature, jam rate) are zeroed until real telemetry exists.
import { createCorsResponse } from '../../_shared/cors.ts';
import { isMissingTableError, resolveCustomerId, type PortalCtx } from './_context.ts';

const TIME_RANGES = new Set(['7d', '30d', '90d', '6m', '1y']);
const PERIOD_TYPES = new Set(['daily', 'weekly', 'monthly']);

interface MeterDelta {
  equipmentId: string;
  readingDate: Date;
  totalImpressions: number;
  blackWhiteImpressions: number;
  colorImpressions: number;
  largeFormatImpressions: number;
  scanImpressions: number;
  faxImpressions: number;
}

function rangeStart(timeRange: string, endDate: Date): Date {
  const startDate = new Date(endDate);
  switch (timeRange) {
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      break;
    case '6m':
      startDate.setMonth(endDate.getMonth() - 6);
      break;
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    case '30d':
    default:
      startDate.setDate(endDate.getDate() - 30);
      break;
  }
  return startDate;
}

// deno-lint-ignore no-explicit-any
function calculateMeterDeltas(readings: any[]): MeterDelta[] {
  const byEquipment = new Map<string, typeof readings>();
  for (const reading of readings) {
    const list = byEquipment.get(reading.equipment_id) || [];
    list.push(reading);
    byEquipment.set(reading.equipment_id, list);
  }

  const deltas: MeterDelta[] = [];
  for (const [equipmentId, list] of byEquipment) {
    const sorted = list.sort(
      (a, b) => new Date(a.reading_date).getTime() - new Date(b.reading_date).getTime(),
    );
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = sorted[i - 1];
      const totalDelta = Math.max(
        0,
        (current.total_impressions || 0) - (previous.total_impressions || 0),
      );
      // Filter out meter resets and outliers, same bounds as the Express service.
      if (totalDelta <= 0 || totalDelta >= 100000) continue;
      deltas.push({
        equipmentId,
        readingDate: new Date(current.reading_date),
        totalImpressions: totalDelta,
        blackWhiteImpressions: Math.max(
          0,
          (current.black_white_impressions || 0) - (previous.black_white_impressions || 0),
        ),
        colorImpressions: Math.max(
          0,
          (current.color_impressions || 0) - (previous.color_impressions || 0),
        ),
        largeFormatImpressions: Math.max(
          0,
          (current.large_format_impressions || 0) - (previous.large_format_impressions || 0),
        ),
        scanImpressions: Math.max(
          0,
          (current.scan_impressions || 0) - (previous.scan_impressions || 0),
        ),
        faxImpressions: Math.max(
          0,
          (current.fax_impressions || 0) - (previous.fax_impressions || 0),
        ),
      });
    }
  }
  return deltas;
}

interface TrendPoint {
  date: string;
  period: string;
  totalImpressions: number;
  blackWhiteImpressions: number;
  colorImpressions: number;
  largeFormatImpressions: number;
  scanImpressions: number;
  faxImpressions: number;
}

function generateTrends(deltas: MeterDelta[], periodType: string) {
  const trendMap = new Map<string, TrendPoint>();
  for (const delta of deltas) {
    const date = delta.readingDate;
    let periodKey: string;
    if (periodType === 'weekly') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      periodKey = weekStart.toISOString().split('T')[0];
    } else if (periodType === 'monthly') {
      periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    } else {
      periodKey = date.toISOString().split('T')[0];
    }

    if (!trendMap.has(periodKey)) {
      trendMap.set(periodKey, {
        date: periodKey,
        period: periodKey,
        totalImpressions: 0,
        blackWhiteImpressions: 0,
        colorImpressions: 0,
        largeFormatImpressions: 0,
        scanImpressions: 0,
        faxImpressions: 0,
      });
    }
    const trend = trendMap.get(periodKey)!;
    trend.totalImpressions += delta.totalImpressions;
    trend.blackWhiteImpressions += delta.blackWhiteImpressions;
    trend.colorImpressions += delta.colorImpressions;
    trend.largeFormatImpressions += delta.largeFormatImpressions;
    trend.scanImpressions += delta.scanImpressions;
    trend.faxImpressions += delta.faxImpressions;
  }

  return Array.from(trendMap.values())
    .map((trend) => ({
      ...trend,
      costEstimate:
        trend.blackWhiteImpressions * 0.03 +
        trend.colorImpressions * 0.12 +
        trend.largeFormatImpressions * 0.25 +
        trend.scanImpressions * 0.01,
      efficiency:
        trend.totalImpressions > 0
          ? Math.min(100, 100 - (trend.colorImpressions / trend.totalImpressions) * 50)
          : 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Static peak-usage analysis — same placeholder values as the Express service
// (real time-of-day patterns need per-job telemetry that meter reads lack).
const PEAK_USAGE = {
  hourlyPeaks: [
    { hour: 9, averageVolume: 120 },
    { hour: 10, averageVolume: 98 },
    { hour: 11, averageVolume: 87 },
    { hour: 14, averageVolume: 67 },
    { hour: 15, averageVolume: 89 },
  ],
  dailyPeaks: [
    { dayOfWeek: 1, averageVolume: 450 },
    { dayOfWeek: 2, averageVolume: 520 },
    { dayOfWeek: 3, averageVolume: 480 },
    { dayOfWeek: 4, averageVolume: 465 },
    { dayOfWeek: 5, averageVolume: 380 },
  ],
  monthlyPeaks: [
    { month: 1, averageVolume: 8200 },
    { month: 3, averageVolume: 9500 },
    { month: 6, averageVolume: 7800 },
    { month: 9, averageVolume: 9200 },
    { month: 12, averageVolume: 6500 },
  ],
};

export async function handleUsageAnalytics(ctx: PortalCtx): Promise<Response> {
  const { req, admin, tenantId, url } = ctx;
  if (req.method !== 'GET') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  const customerId = resolveCustomerId(ctx);
  if (!customerId) {
    return createCorsResponse(
      { success: false, message: 'Access denied: missing tenant or customer context' },
      403,
      req,
    );
  }

  const timeRangeParam = url.searchParams.get('timeRange') || '30d';
  const timeRange = TIME_RANGES.has(timeRangeParam) ? timeRangeParam : '30d';
  const periodTypeParam = url.searchParams.get('periodType') || 'daily';
  const periodType = PERIOD_TYPES.has(periodTypeParam) ? periodTypeParam : 'daily';
  const equipmentIdsParam = url.searchParams.get('equipmentIds');
  let equipmentIds: string[] | undefined;
  if (equipmentIdsParam) {
    try {
      const parsed = JSON.parse(equipmentIdsParam);
      if (Array.isArray(parsed)) equipmentIds = parsed.map(String);
    } catch {
      equipmentIds = equipmentIdsParam.split(',').filter(Boolean);
    }
  }

  const endDate = new Date();
  const startDate = rangeStart(timeRange, endDate);

  let query = admin
    .from('customer_meter_submissions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('is_validated', true)
    .gte('reading_date', startDate.toISOString())
    .lte('reading_date', endDate.toISOString())
    .order('reading_date', { ascending: false });
  if (equipmentIds && equipmentIds.length > 0) {
    query = query.in('equipment_id', equipmentIds);
  }

  const { data: readings, error } = await query;
  if (error && !isMissingTableError(error)) {
    console.error('Error fetching meter submissions:', error);
    return createCorsResponse(
      { success: false, message: 'Failed to fetch usage analytics' },
      500,
      req,
    );
  }
  const meterReadings = readings || [];

  const deltas = calculateMeterDeltas(meterReadings);
  const totalImpressions = deltas.reduce((sum, d) => sum + d.totalImpressions, 0);
  const totalBlackWhite = deltas.reduce((sum, d) => sum + d.blackWhiteImpressions, 0);
  const totalColor = deltas.reduce((sum, d) => sum + d.colorImpressions, 0);
  const totalLargeFormat = deltas.reduce((sum, d) => sum + d.largeFormatImpressions, 0);
  const totalScans = deltas.reduce((sum, d) => sum + d.scanImpressions, 0);

  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
  const averageDaily = daysDiff > 0 ? totalImpressions / daysDiff : 0;
  const averageMonthly = averageDaily * 30;

  // Same industry-standard rate card as the Express service.
  const blackWhiteCost = totalBlackWhite * 0.03;
  const colorCost = totalColor * 0.12;
  const largeFormatCost = totalLargeFormat * 0.25;
  const scanCost = totalScans * 0.01;
  const maintenanceCost = Math.floor(totalImpressions / 1000) * 25;
  const supplyCost = (totalImpressions / 2500) * 85;
  const totalCost =
    blackWhiteCost + colorCost + largeFormatCost + scanCost + maintenanceCost + supplyCost;
  const costPerPage = totalImpressions > 0 ? totalCost / totalImpressions : 0;

  const carbonFootprint = totalImpressions * 0.004;
  const paperSaved = totalScans * 0.1;
  const colorRatio = totalImpressions > 0 ? (totalColor / totalImpressions) * 100 : 0;
  const scanRatio = totalImpressions > 0 ? (totalScans / totalImpressions) * 100 : 0;
  const efficiencyScore = Math.min(100, 100 - colorRatio * 0.5 + scanRatio * 0.3);

  // Peak day/volume from raw readings (mirrors Express findPeakDay/findPeakVolume).
  const dayTotals = new Map<string, number>();
  for (const reading of meterReadings) {
    const day = new Date(reading.reading_date).toLocaleDateString('en-US', { weekday: 'long' });
    dayTotals.set(day, (dayTotals.get(day) || 0) + (reading.total_impressions || 0));
  }
  let peakDay = 'Monday';
  let peakDayVolume = 0;
  for (const [day, volume] of dayTotals) {
    if (volume > peakDayVolume) {
      peakDayVolume = volume;
      peakDay = day;
    }
  }
  const peakVolume = meterReadings.length
    ? Math.max(
        ...meterReadings.map((r: { total_impressions?: number }) => r.total_impressions || 0),
      )
    : 0;

  const trends = generateTrends(deltas, periodType);

  // Equipment usage summary from deltas.
  const equipmentMap = new Map<
    string,
    {
      equipmentId: string;
      serialNumber: string;
      totalImpressions: number;
      deltaCount: number;
      lastReading: string;
    }
  >();
  for (const reading of meterReadings) {
    const existing = equipmentMap.get(reading.equipment_id);
    if (!existing) {
      equipmentMap.set(reading.equipment_id, {
        equipmentId: reading.equipment_id,
        serialNumber: reading.equipment_serial_number,
        totalImpressions: 0,
        deltaCount: 0,
        lastReading: reading.reading_date,
      });
    } else if (new Date(reading.reading_date) > new Date(existing.lastReading)) {
      existing.lastReading = reading.reading_date;
    }
  }
  for (const delta of deltas) {
    const equipment = equipmentMap.get(delta.equipmentId);
    if (equipment) {
      equipment.totalImpressions += delta.totalImpressions;
      equipment.deltaCount += 1;
    }
  }
  const equipmentUsage = Array.from(equipmentMap.values()).map((equipment) => {
    const monthlyAverage =
      equipment.deltaCount > 0 ? (equipment.totalImpressions / equipment.deltaCount) * 30 : 0;
    return {
      equipmentId: equipment.equipmentId,
      equipmentName: `Equipment ${equipment.equipmentId.substring(0, 8)}`,
      serialNumber: equipment.serialNumber,
      totalImpressions: equipment.totalImpressions,
      monthlyAverage,
      utilizationRate: Math.min(100, (monthlyAverage / 1000) * 100),
      costPerPage: 0.05,
      efficiency: 95,
      lastReading: equipment.lastReading,
      trendDirection: 'stable' as const,
    };
  });

  // Previous-period comparison with a fixed multiplier (see header note).
  const previousMultiplier = 0.9;
  const current = {
    totalVolume: totalImpressions,
    averageDaily,
    averageMonthly,
    colorRatio,
    peakDay,
    peakVolume: Math.floor(totalImpressions * 0.15),
    totalCost,
    costPerPage,
    efficiencyScore,
    carbonFootprint,
    paperSaved,
  };
  const previous = {
    totalVolume: Math.floor(totalImpressions * previousMultiplier),
    averageDaily: Math.floor(averageDaily * previousMultiplier),
    averageMonthly: Math.floor(averageMonthly * previousMultiplier),
    colorRatio,
    peakDay,
    peakVolume: Math.floor(totalImpressions * previousMultiplier * 0.15),
    totalCost: totalCost * previousMultiplier,
    costPerPage,
    efficiencyScore,
    carbonFootprint: carbonFootprint * previousMultiplier,
    paperSaved: 0,
  };
  const percentageChange =
    previous.totalVolume > 0
      ? ((current.totalVolume - previous.totalVolume) / previous.totalVolume) * 100
      : 0;

  // Recommendations — same thresholds as the Express service.
  const recommendations = [];
  if (colorRatio > 30) {
    recommendations.push({
      type: 'cost_saving',
      title: 'Reduce Color Printing',
      description: `${colorRatio.toFixed(1)}% of your prints are in color. Consider using black & white for internal documents to save up to ${((colorRatio * totalImpressions * 0.09) / 100).toFixed(0)} dollars per month.`,
      impact: 'high',
      effort: 'low',
    });
  }
  if (scanRatio < 10) {
    recommendations.push({
      type: 'environmental',
      title: 'Increase Digital Scanning',
      description: `Only ${scanRatio.toFixed(1)}% of your activity is scanning. Consider scanning documents instead of printing for better environmental impact.`,
      impact: 'medium',
      effort: 'low',
    });
  }
  if (costPerPage > 0.08) {
    recommendations.push({
      type: 'cost_saving',
      title: 'Optimize Print Settings',
      description: `Your cost per page of $${costPerPage.toFixed(3)} is above average. Consider draft mode printing and duplex settings to reduce costs.`,
      impact: 'medium',
      effort: 'low',
    });
  }
  if (efficiencyScore < 70) {
    recommendations.push({
      type: 'efficiency',
      title: 'Improve Print Efficiency',
      description:
        'Your efficiency score is below optimal. Review print policies and user training to improve resource utilization.',
      impact: 'medium',
      effort: 'medium',
    });
  }
  if (totalImpressions > 5000) {
    recommendations.push({
      type: 'maintenance',
      title: 'Schedule Preventive Maintenance',
      description:
        'With high usage volume, regular maintenance will ensure optimal performance and reduce long-term costs.',
      impact: 'high',
      effort: 'low',
    });
  }

  const analytics = {
    timeRange,
    lastUpdated: new Date().toISOString(),
    metrics: {
      totalVolume: totalImpressions,
      averageDaily,
      averageMonthly,
      colorRatio,
      peakDay,
      peakVolume,
      totalCost,
      costPerPage,
      efficiencyScore,
      carbonFootprint,
      paperSaved,
    },
    trends,
    equipmentUsage,
    costBreakdown: {
      blackWhiteCost,
      colorCost,
      largeFormatCost,
      scanCost,
      maintenanceCost,
      supplyCost,
      totalCost,
    },
    peakUsage: PEAK_USAGE,
    comparison: {
      current,
      previous,
      percentageChange,
      trendDirection:
        percentageChange > 5 ? 'up' : percentageChange < -5 ? 'down' : ('stable' as string),
    },
    recommendations,
  };

  return createCorsResponse(
    {
      success: true,
      data: analytics,
      meta: {
        totalReadings: meterReadings.length,
        timeRange,
        lastUpdated: analytics.lastUpdated,
        equipmentCount: equipmentUsage.length,
      },
    },
    200,
    req,
  );
}

export async function handleEquipmentHealth(ctx: PortalCtx): Promise<Response> {
  const { req, admin, tenantId, url } = ctx;
  if (req.method !== 'GET') {
    return createCorsResponse({ error: 'Method not allowed' }, 405, req);
  }

  const customerId = resolveCustomerId(ctx);
  if (!customerId) {
    return createCorsResponse(
      { success: false, message: 'Access denied: missing tenant or customer context' },
      403,
      req,
    );
  }

  const timeRange = url.searchParams.get('timeRange') || '30d';
  const includeAlerts = url.searchParams.get('includeAlerts') !== 'false';
  const includeMetrics = url.searchParams.get('includeMetrics') !== 'false';
  let equipmentIds: string[] | undefined;
  const equipmentIdsParam = url.searchParams.get('equipmentIds');
  if (equipmentIdsParam) {
    try {
      const parsed = JSON.parse(equipmentIdsParam);
      if (Array.isArray(parsed)) equipmentIds = parsed.map(String);
    } catch {
      equipmentIds = equipmentIdsParam.split(',').filter(Boolean);
    }
  }

  let query = admin
    .from('equipment')
    .select(
      'id, serial_number, model_number, manufacturer, description, location_description, install_date, equipment_status, last_service_date, next_service_due_date, updated_at',
    )
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId);
  if (equipmentIds && equipmentIds.length > 0) {
    query = query.in('id', equipmentIds);
  }

  const { data: equipmentRows, error } = await query;
  if (error) {
    if (isMissingTableError(error)) {
      return createCorsResponse({ success: true, data: [], total: 0 }, 200, req);
    }
    console.error('Error fetching equipment for health dashboard:', error);
    return createCorsResponse(
      { success: false, message: 'Failed to fetch equipment health data' },
      500,
      req,
    );
  }

  // Latest meter totals per equipment for print counts + monthly averages.
  const meterTotals = new Map<string, { total: number; monthly: number }>();
  if ((equipmentRows || []).length > 0) {
    const { data: meterRows } = await admin
      .from('customer_meter_submissions')
      .select('equipment_id, total_impressions, reading_date')
      .eq('tenant_id', tenantId)
      .eq('customer_id', customerId)
      .order('reading_date', { ascending: false })
      .limit(500);
    const seen = new Map<
      string,
      { latest: number; earliest: number; latestDate: Date; earliestDate: Date }
    >();
    for (const row of meterRows || []) {
      const entry = seen.get(row.equipment_id);
      if (!entry) {
        seen.set(row.equipment_id, {
          latest: row.total_impressions || 0,
          earliest: row.total_impressions || 0,
          latestDate: new Date(row.reading_date),
          earliestDate: new Date(row.reading_date),
        });
      } else {
        // Rows arrive newest-first; keep updating the earliest side.
        entry.earliest = row.total_impressions || 0;
        entry.earliestDate = new Date(row.reading_date);
      }
    }
    for (const [equipmentId, entry] of seen) {
      const spanDays = Math.max(
        1,
        (entry.latestDate.getTime() - entry.earliestDate.getTime()) / (1000 * 3600 * 24),
      );
      const usage = Math.max(0, entry.latest - entry.earliest);
      meterTotals.set(equipmentId, {
        total: entry.latest,
        monthly: Math.round((usage / spanDays) * 30),
      });
    }
  }

  const now = new Date();
  const data = (equipmentRows || []).map((row: Record<string, unknown>) => {
    const isActive = row.equipment_status === 'active' || !row.equipment_status;
    const nextDue = row.next_service_due_date ? new Date(String(row.next_service_due_date)) : null;
    const serviceOverdue = Boolean(nextDue && nextDue < now);

    let overallHealthScore = 75;
    if (!isActive) overallHealthScore = 40;
    else if (serviceOverdue) overallHealthScore = 60;
    else if (nextDue) overallHealthScore = 90;
    const status = !isActive
      ? 'offline'
      : overallHealthScore >= 90
        ? 'excellent'
        : overallHealthScore >= 75
          ? 'good'
          : overallHealthScore >= 60
            ? 'warning'
            : 'critical';

    const alerts = [];
    if (serviceOverdue) {
      alerts.push({
        id: `alert-service-${row.id}`,
        type: 'warning',
        message: 'Service overdue - scheduled maintenance required',
        timestamp: now.toISOString(),
        resolved: false,
      });
    }

    const meters = meterTotals.get(String(row.id));
    return {
      id: row.id,
      equipmentName:
        row.description ||
        `${row.manufacturer || ''} ${row.model_number || ''}`.trim() ||
        'Equipment',
      make: row.manufacturer || '',
      model: row.model_number || '',
      serialNumber: row.serial_number || '',
      location: row.location_description || '',
      overallHealthScore,
      status,
      lastServiceDate: row.last_service_date || null,
      nextServiceDue: row.next_service_due_date || null,
      totalPrintCount: meters?.total || 0,
      monthlyAverage: meters?.monthly || 0,
      predictedMaintenanceDate: row.next_service_due_date || null,
      // No IoT telemetry source yet — zeroed metrics rather than fabricated ones.
      healthMetrics: includeMetrics
        ? {
            tonerLevels: [],
            paperLevels: 0,
            drumLifeRemaining: 0,
            fuserLifeRemaining: 0,
            temperature: 0,
            humidity: 0,
            errorCount: 0,
            jamRate: 0,
          }
        : null,
      recentActivity: [],
      alerts: includeAlerts ? alerts : [],
      connectionStatus: {
        isOnline: false,
        lastSeen: row.updated_at || null,
        signalStrength: 0,
        ipAddress: '',
      },
    };
  });

  return createCorsResponse(
    {
      success: true,
      data,
      total: data.length,
      meta: { totalCount: data.length, timeRange, lastUpdated: now.toISOString() },
    },
    200,
    req,
  );
}
