// Remote Monitoring Edge Function
// Handles remote device monitoring and alerts
import { createSupabaseClient, createSupabaseServiceClient } from '../_shared/supabase.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { normalizePath } from '../_shared/path.ts';

export default async function handler(req: Request) {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get('Authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const supabase = createSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      return createCorsResponse({ error: userError?.message || 'Unauthorized' }, 401, req);
    }

    const tenantId =
      (user.app_metadata?.tenantId as string) ||
      (user.app_metadata?.tenant_id as string) ||
      (user.user_metadata?.tenantId as string) ||
      (user.user_metadata?.tenant_id as string) ||
      req.headers.get('x-tenant-id');

    if (!tenantId) {
      return createCorsResponse({ error: 'No tenant ID found' }, 400, req);
    }

    const admin = createSupabaseServiceClient();
    const url = new URL(req.url);
    // Coolify-safe routing: parts[0] = first path segment after the fn prefix.
    const { parts } = normalizePath(url.pathname, 'remote-monitoring');
    const endpoint = parts[0];
    const resourceId = parts[1];

    // ----------------------------------------------------------------
    // GET /remote-monitoring/equipment-status
    // Real-time equipment status. Ports server/routes-remote-monitoring.ts
    // against device_registrations + device_metrics (real schema tables).
    // Frontend (RemoteMonitoring.tsx) reads equipmentId/serialNumber/model/
    // location/status/connectionStatus/lastPing/currentMetrics/performance/
    // maintenance/alerts/environmental.
    // ----------------------------------------------------------------
    if (req.method === 'GET' && endpoint === 'equipment-status') {
      const { data: devices, error: devErr } = await admin
        .from('device_registrations')
        .select('*')
        .eq('tenant_id', tenantId);

      if (devErr) {
        console.error('equipment-status devices error:', devErr.message);
        // Degrade: table/column missing -> empty list so the page renders.
        return createCorsResponse([], 200, req);
      }

      const now = Date.now();
      const tenMinutesAgo = new Date(now - 10 * 60 * 1000);
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

      const equipmentStatus = await Promise.all(
        (devices || []).map(async (device: any) => {
          const { data: latestRows } = await admin
            .from('device_metrics')
            .select('*')
            .eq('device_id', device.id)
            .order('collection_timestamp', { ascending: false })
            .limit(1);
          const metrics = (latestRows || [])[0] || null;

          const { data: dailyMetrics } = await admin
            .from('device_metrics')
            .select('*')
            .eq('device_id', device.id)
            .gte('collection_timestamp', oneDayAgo.toISOString())
            .order('collection_timestamp', { ascending: true });

          const daily = dailyMetrics || [];
          let dailyPageCount = 0;
          if (daily.length >= 2) {
            const first = daily[0].total_impressions || 0;
            const last = daily[daily.length - 1].total_impressions || 0;
            dailyPageCount = last - first;
          }

          const lastSeenDate = device.last_seen ? new Date(device.last_seen) : null;
          const connectionStatus =
            lastSeenDate && lastSeenDate > tenMinutesAgo ? 'connected' : 'disconnected';

          const tonerLevels = (metrics?.toner_levels as Record<string, number>) || {};
          const paperLevels = (metrics?.paper_levels as Record<string, number>) || {};
          const errorCodes: string[] = metrics?.error_codes || [];
          const errorCount = errorCodes.length;

          const alerts: any[] = [];
          for (const [color, level] of Object.entries(tonerLevels)) {
            if (level < 10) {
              alerts.push({
                id: `alert-toner-${color}-${device.id}`,
                type: 'supply_critical',
                severity: 'high',
                message: `${color.charAt(0).toUpperCase() + color.slice(1)} toner critically low (${level}%) - immediate replacement needed`,
                timestamp: new Date().toISOString(),
                acknowledged: false,
              });
            } else if (level < 25) {
              alerts.push({
                id: `alert-toner-${color}-${device.id}`,
                type: 'supply_low',
                severity: 'medium',
                message: `${color.charAt(0).toUpperCase() + color.slice(1)} toner at ${level}% - consider ordering replacement`,
                timestamp: new Date().toISOString(),
                acknowledged: false,
              });
            }
          }
          for (const [tray, level] of Object.entries(paperLevels)) {
            if (level === 0) {
              alerts.push({
                id: `alert-paper-${tray}-${device.id}`,
                type: 'paper_empty',
                severity: 'medium',
                message: `${tray} is empty - refill required`,
                timestamp: new Date().toISOString(),
                acknowledged: false,
              });
            } else if (level < 20) {
              alerts.push({
                id: `alert-paper-${tray}-${device.id}`,
                type: 'paper_low',
                severity: 'low',
                message: `${tray} is low (${level}%)`,
                timestamp: new Date().toISOString(),
                acknowledged: false,
              });
            }
          }
          if (connectionStatus === 'disconnected' && lastSeenDate) {
            const hoursOffline = Math.floor((now - lastSeenDate.getTime()) / (60 * 60 * 1000));
            alerts.push({
              id: `alert-connection-${device.id}`,
              type: 'connection_lost',
              severity: hoursOffline > 8 ? 'critical' : 'high',
              message: `Equipment offline for ${hoursOffline}+ hours - network connectivity issue`,
              timestamp: lastSeenDate.toISOString(),
              acknowledged: false,
            });
          }

          let status = 'operational';
          if (connectionStatus === 'disconnected') {
            status = 'offline';
          } else if (alerts.some((a) => a.severity === 'critical' || a.severity === 'high')) {
            status = 'warning';
          } else if (device.status === 'error') {
            status = 'critical';
          } else if (device.status === 'maintenance') {
            status = 'maintenance';
          }

          const uptime = metrics?.uptime != null ? Number(metrics.uptime) : 0;

          return {
            equipmentId: device.id,
            serialNumber: device.serial_number || 'N/A',
            model: device.model || 'Unknown Model',
            location: {
              customerName: device.location || 'Unknown Location',
              address: device.department || '',
              floor: '',
              coordinates: null,
            },
            status,
            connectionStatus,
            lastPing: device.last_seen,
            uptime,
            currentMetrics: {
              pagesPerMinute: 0,
              tonerLevels,
              paperLevels,
              temperature: null,
              humidity: null,
              errorCount,
              jamCount: 0,
              lastJobCompleted: metrics?.collection_timestamp || null,
            },
            performance: {
              dailyPageCount,
              weeklyPageCount: 0,
              monthlyPageCount: 0,
              utilizationRate: uptime,
              efficiency: 0,
              averageJobSize: 0,
              peakUsageHour: 0,
            },
            maintenance: {
              nextScheduled: null,
              lastCompleted: null,
              maintenanceScore: 0,
              predictiveAlerts: [],
            },
            alerts,
            environmental: {
              powerConsumption: 0,
              energyEfficiency: 'N/A',
              carbonFootprint: 0,
              sleepModeActive: false,
              autoSleepEnabled: false,
            },
          };
        }),
      );

      return createCorsResponse(equipmentStatus, 200, req);
    }

    // ----------------------------------------------------------------
    // GET /remote-monitoring/fleet-overview
    // Fleet analytics. Ports the Express fleet-overview shape:
    // summary / statusDistribution / locationAnalytics / performanceTrends /
    // topPerformers / attentionRequired / maintenanceSchedule / costMetrics.
    // ----------------------------------------------------------------
    if (req.method === 'GET' && endpoint === 'fleet-overview') {
      const { data: devicesRaw, error: devErr } = await admin
        .from('device_registrations')
        .select('*')
        .eq('tenant_id', tenantId);

      if (devErr) {
        console.error('fleet-overview devices error:', devErr.message);
        return createCorsResponse(
          {
            summary: {
              totalEquipment: 0,
              onlineEquipment: 0,
              offlineEquipment: 0,
              equipmentWithAlerts: 0,
              criticalAlerts: 0,
              averageUptime: 0,
              fleetUtilization: 0,
              energyEfficiency: 'N/A',
            },
            statusDistribution: {
              operational: 0,
              warning: 0,
              critical: 0,
              offline: 0,
              maintenance: 0,
            },
            locationAnalytics: [],
            performanceTrends: {
              weeklyUptime: [],
              weeklyUtilization: [],
              weeklyEfficiency: [],
            },
            topPerformers: [],
            attentionRequired: [],
            maintenanceSchedule: [],
            costMetrics: {
              totalMaintenanceCost: 0,
              energyCost: 0,
              supplyCost: 0,
              potentialSavings: {
                predictiveMaintenance: 0,
                energyOptimization: 0,
                supplyOptimization: 0,
              },
            },
            degraded: true,
          },
          200,
          req,
        );
      }

      const devices = devicesRaw || [];
      const totalEquipment = devices.length;
      const now = Date.now();
      const tenMinutesAgo = new Date(now - 10 * 60 * 1000);

      const onlineDevices = devices.filter(
        (d: any) => d.last_seen && new Date(d.last_seen) > tenMinutesAgo,
      );
      const offlineDevices = devices.filter(
        (d: any) => !d.last_seen || new Date(d.last_seen) <= tenMinutesAgo,
      );

      // Latest metrics per device
      const latestMetrics = await Promise.all(
        devices.map(async (device: any) => {
          const { data: rows } = await admin
            .from('device_metrics')
            .select('*')
            .eq('device_id', device.id)
            .order('collection_timestamp', { ascending: false })
            .limit(1);
          return { device, metrics: (rows || [])[0] || null };
        }),
      );

      let operational = 0,
        warning = 0,
        critical = 0,
        offline = 0,
        maintenance = 0;
      const devicesWithIssues: any[] = [];
      const topPerformers: any[] = [];

      for (const { device, metrics } of latestMetrics) {
        const isOnline = device.last_seen && new Date(device.last_seen) > tenMinutesAgo;

        if (!isOnline) {
          offline++;
          if (device.last_seen) {
            const hoursOffline = Math.floor(
              (now - new Date(device.last_seen).getTime()) / (60 * 60 * 1000),
            );
            if (hoursOffline > 2) {
              devicesWithIssues.push({
                equipmentId: device.id,
                customerName: device.location || 'Unknown',
                model: device.model || 'Unknown',
                issues: [`Connection lost for ${hoursOffline}+ hours`],
                priority: hoursOffline > 8 ? 'critical' : 'high',
                estimatedRevenueLoss: hoursOffline * 50,
              });
            }
          }
        } else if (device.status === 'maintenance') {
          maintenance++;
        } else if (device.status === 'error') {
          critical++;
        } else {
          const tonerLevels = (metrics?.toner_levels as Record<string, number>) || {};
          const hasLowSupply = Object.values(tonerLevels).some((level) => level < 25);
          const hasCriticalSupply = Object.values(tonerLevels).some((level) => level < 10);
          const hasErrors = metrics?.error_codes && metrics.error_codes.length > 0;

          if (hasCriticalSupply || hasErrors) {
            warning++;
            const issues: string[] = [];
            if (hasCriticalSupply) issues.push('Critical supply levels');
            if (hasErrors) issues.push(`${metrics?.error_codes?.length} active errors`);
            devicesWithIssues.push({
              equipmentId: device.id,
              customerName: device.location || 'Unknown',
              model: device.model || 'Unknown',
              issues,
              priority: 'high',
              estimatedRevenueLoss: 200,
            });
          } else if (hasLowSupply) {
            warning++;
          } else {
            operational++;
          }
        }

        if (isOnline && metrics?.uptime != null && Number(metrics.uptime) > 95) {
          topPerformers.push({
            equipmentId: device.id,
            customerName: device.location || 'Unknown',
            model: device.model || 'Unknown',
            uptime: Number(metrics.uptime),
            efficiency: 0,
            utilizationRate: Number(metrics.uptime),
          });
        }
      }

      topPerformers.sort((a, b) => b.uptime - a.uptime);

      const allUptimes = latestMetrics
        .filter(({ metrics }) => metrics?.uptime != null)
        .map(({ metrics }) => Number(metrics!.uptime));
      const averageUptime =
        allUptimes.length > 0
          ? Math.round((allUptimes.reduce((a, b) => a + b, 0) / allUptimes.length) * 10) / 10
          : 0;

      // Fleet utilization: devices with activity in last 24h.
      const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
      const { data: recentMetrics } = await admin
        .from('device_metrics')
        .select('device_id')
        .eq('tenant_id', tenantId)
        .gte('collection_timestamp', oneDayAgo.toISOString());
      const activeDeviceIds = new Set((recentMetrics || []).map((m: any) => m.device_id));
      const fleetUtilization =
        totalEquipment > 0 ? Math.round((activeDeviceIds.size / totalEquipment) * 1000) / 10 : 0;

      // Location analytics
      const locationGroups = new Map<string, typeof latestMetrics>();
      for (const item of latestMetrics) {
        const location = item.device.location || 'Unknown Location';
        if (!locationGroups.has(location)) locationGroups.set(location, []);
        locationGroups.get(location)!.push(item);
      }
      const locationAnalytics = Array.from(locationGroups.entries()).map(([region, items]) => {
        const uptimes = items
          .filter(({ metrics }) => metrics?.uptime != null)
          .map(({ metrics }) => Number(metrics!.uptime));
        const avgUptime =
          uptimes.length > 0
            ? Math.round((uptimes.reduce((a, b) => a + b, 0) / uptimes.length) * 10) / 10
            : 0;
        const criticalCount = items.filter(({ device }) => device.status === 'error').length;
        return {
          region,
          equipmentCount: items.length,
          averageUptime: avgUptime,
          criticalAlerts: criticalCount,
          utilizationRate: avgUptime,
        };
      });

      // Weekly performance trends (last 7 days)
      const weeklyUptime: number[] = [];
      const weeklyUtilization: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const dayStart = new Date();
        dayStart.setDate(dayStart.getDate() - i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const { data: dayMetrics } = await admin
          .from('device_metrics')
          .select('device_id, uptime')
          .eq('tenant_id', tenantId)
          .gte('collection_timestamp', dayStart.toISOString())
          .lte('collection_timestamp', dayEnd.toISOString());

        const rows = dayMetrics || [];
        const uptimes = rows.filter((m: any) => m.uptime != null).map((m: any) => Number(m.uptime));
        const avgUptime =
          uptimes.length > 0
            ? Math.round(
                (uptimes.reduce((a: number, b: number) => a + b, 0) / uptimes.length) * 10,
              ) / 10
            : 0;
        weeklyUptime.push(avgUptime);

        const activeCount = new Set(rows.map((m: any) => m.device_id)).size;
        const utilizationRate =
          totalEquipment > 0 ? Math.round((activeCount / totalEquipment) * 1000) / 10 : 0;
        weeklyUtilization.push(utilizationRate);
      }

      const fleetOverview = {
        summary: {
          totalEquipment,
          onlineEquipment: onlineDevices.length,
          offlineEquipment: offlineDevices.length,
          equipmentWithAlerts: devicesWithIssues.length,
          criticalAlerts: devicesWithIssues.filter((d) => d.priority === 'critical').length,
          averageUptime,
          fleetUtilization,
          energyEfficiency: 'N/A',
        },
        statusDistribution: {
          operational,
          warning,
          critical,
          offline,
          maintenance,
        },
        locationAnalytics,
        performanceTrends: {
          weeklyUptime,
          weeklyUtilization,
          weeklyEfficiency: weeklyUptime,
        },
        topPerformers: topPerformers.slice(0, 5),
        attentionRequired: devicesWithIssues.slice(0, 10),
        maintenanceSchedule: [],
        costMetrics: {
          totalMaintenanceCost: 0,
          energyCost: 0,
          supplyCost: 0,
          potentialSavings: {
            predictiveMaintenance: 0,
            energyOptimization: 0,
            supplyOptimization: 0,
          },
        },
      };

      return createCorsResponse(fleetOverview, 200, req);
    }

    // ----------------------------------------------------------------
    // GET /remote-monitoring/sensor-data?equipmentId=&timeRange=
    // Historical sensor / IoT metrics for a single device.
    // ----------------------------------------------------------------
    if (req.method === 'GET' && endpoint === 'sensor-data') {
      const equipmentId =
        url.searchParams.get('equipmentId') || url.searchParams.get('equipment_id');
      const timeRange = url.searchParams.get('timeRange') || '24h';

      if (!equipmentId) {
        return createCorsResponse({ message: 'Equipment ID is required' }, 400, req);
      }

      const hoursMap: Record<string, number> = {
        '1h': 1,
        '6h': 6,
        '12h': 12,
        '24h': 24,
        '7d': 168,
        '30d': 720,
      };
      const hours = hoursMap[timeRange] || 24;
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      const { data: historicalRaw, error: histErr } = await admin
        .from('device_metrics')
        .select('*')
        .eq('device_id', equipmentId)
        .gte('collection_timestamp', startTime.toISOString())
        .order('collection_timestamp', { ascending: true });

      if (histErr) {
        console.error('sensor-data error:', histErr.message);
        return createCorsResponse(
          {
            equipmentId,
            collectionPeriod: timeRange,
            dataPointsCollected: 0,
            currentReadings: {
              temperature: null,
              humidity: null,
              vibration: null,
              acousticLevel: null,
              powerDraw: null,
              networkSignal: null,
              ambientLight: null,
            },
            historicalData: {
              temperature: [],
              powerConsumption: [],
              utilizationRate: [],
              pageActivity: [],
              errorEvents: [],
            },
            predictions: {
              nextMaintenanceRequired: null,
              estimatedTonerReplacementDates: {},
              probabilityOfFailure: { next7Days: 0, next30Days: 0, next90Days: 0 },
              recommendedActions: [],
            },
            benchmarks: {
              industryAverage: {
                uptime: 94.5,
                efficiency: 87.2,
                energyEfficiency: 'B+',
                maintenanceCost: 1200,
              },
              fleetAverage: {
                uptime: 0,
                efficiency: 0,
                energyEfficiency: 'N/A',
                maintenanceCost: 0,
              },
              thisEquipment: {
                uptime: 0,
                efficiency: 0,
                energyEfficiency: 'N/A',
                maintenanceCost: 0,
              },
            },
            degraded: true,
          },
          200,
          req,
        );
      }

      const historicalMetrics = historicalRaw || [];
      const latestMetrics =
        historicalMetrics.length > 0 ? historicalMetrics[historicalMetrics.length - 1] : null;

      const utilizationHistory = historicalMetrics.map((m: any) => ({
        timestamp: m.collection_timestamp,
        value: m.uptime != null ? Number(m.uptime) : 0,
        status: 'normal',
      }));

      const pageCountHistory: { timestamp: any; value: number; status: string }[] = [];
      for (let i = 1; i < historicalMetrics.length; i++) {
        const prev = historicalMetrics[i - 1];
        const curr = historicalMetrics[i];
        const pagesDiff = (curr.total_impressions || 0) - (prev.total_impressions || 0);
        pageCountHistory.push({
          timestamp: curr.collection_timestamp,
          value: Math.max(0, pagesDiff),
          status: 'normal',
        });
      }

      const errorEvents = historicalMetrics
        .filter((m: any) => m.error_codes && m.error_codes.length > 0)
        .map((m: any) => ({
          timestamp: m.collection_timestamp,
          type: m.error_codes?.[0] || 'unknown',
          severity: 'medium',
          resolved: false,
          resolutionTime: null,
        }));

      const avgUptime =
        historicalMetrics.length > 0
          ? historicalMetrics.reduce(
              (sum: number, m: any) => sum + (m.uptime != null ? Number(m.uptime) : 0),
              0,
            ) / historicalMetrics.length
          : 0;

      const tonerLevels = (latestMetrics?.toner_levels as Record<string, number>) || {};
      const tonerReplacementDates: Record<string, string | null> = {};
      for (const [color, level] of Object.entries(tonerLevels)) {
        if (level > 0) {
          const daysRemaining = Math.floor(level / 2);
          const replacementDate = new Date();
          replacementDate.setDate(replacementDate.getDate() + daysRemaining);
          tonerReplacementDates[color] = replacementDate.toISOString();
        } else {
          tonerReplacementDates[color] = new Date().toISOString();
        }
      }

      const recommendedActions: any[] = [];
      for (const [color, level] of Object.entries(tonerLevels)) {
        if (level < 25) {
          recommendedActions.push({
            action: `Order ${color} toner cartridge`,
            priority: level < 10 ? 'critical' : 'high',
            estimatedCost: 85,
            preventsPotentialIssue: 'Print quality issues or printing stoppage',
          });
        }
      }

      const { data: fleetMetricsRaw } = await admin
        .from('device_metrics')
        .select('uptime')
        .eq('tenant_id', tenantId)
        .gte('collection_timestamp', startTime.toISOString());
      const fleetMetrics = fleetMetricsRaw || [];
      const fleetAvgUptime =
        fleetMetrics.length > 0
          ? fleetMetrics.reduce(
              (sum: number, m: any) => sum + (m.uptime != null ? Number(m.uptime) : 0),
              0,
            ) / fleetMetrics.length
          : 0;

      const sensorData = {
        equipmentId,
        collectionPeriod: timeRange,
        dataPointsCollected: historicalMetrics.length,
        currentReadings: {
          temperature: null,
          humidity: null,
          vibration: null,
          acousticLevel: null,
          powerDraw: null,
          networkSignal: latestMetrics?.response_time || null,
          ambientLight: null,
        },
        historicalData: {
          temperature: [],
          powerConsumption: [],
          utilizationRate: utilizationHistory,
          pageActivity: pageCountHistory,
          errorEvents,
        },
        predictions: {
          nextMaintenanceRequired: null,
          estimatedTonerReplacementDates: tonerReplacementDates,
          probabilityOfFailure: {
            next7Days: errorEvents.length > 5 ? 20 : avgUptime < 90 ? 15 : 5,
            next30Days: errorEvents.length > 5 ? 40 : avgUptime < 90 ? 30 : 15,
            next90Days: errorEvents.length > 5 ? 60 : avgUptime < 90 ? 50 : 35,
          },
          recommendedActions,
        },
        benchmarks: {
          industryAverage: {
            uptime: 94.5,
            efficiency: 87.2,
            energyEfficiency: 'B+',
            maintenanceCost: 1200,
          },
          fleetAverage: {
            uptime: Math.round(fleetAvgUptime * 10) / 10,
            efficiency: 0,
            energyEfficiency: 'N/A',
            maintenanceCost: 0,
          },
          thisEquipment: {
            uptime: Math.round(avgUptime * 10) / 10,
            efficiency: 0,
            energyEfficiency: 'N/A',
            maintenanceCost: 0,
          },
        },
      };

      return createCorsResponse(sensorData, 200, req);
    }

    // ----------------------------------------------------------------
    // POST /remote-monitoring/acknowledge-alert
    // Frontend posts { alertId, acknowledgmentNote }. Acknowledge the
    // real device_alerts row (status -> acknowledged); degrade to an ack
    // payload if the alert id isn't a persisted row (computed alert ids).
    // ----------------------------------------------------------------
    if (req.method === 'POST' && endpoint === 'acknowledge-alert') {
      const body = await req.json().catch(() => ({}));
      const alertId = body.alertId || body.alert_id;
      const note = body.acknowledgmentNote || body.note || null;

      if (alertId) {
        const { data: updated, error: ackErr } = await admin
          .from('device_alerts')
          .update({
            status: 'acknowledged',
            acknowledged_by: user.id,
            acknowledged_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', alertId)
          .eq('tenant_id', tenantId)
          .select()
          .maybeSingle();

        if (!ackErr && updated) {
          return createCorsResponse(
            {
              success: true,
              acknowledgment: {
                alertId,
                acknowledgedBy: user.id,
                acknowledgedAt: updated.acknowledged_at,
                note,
                status: 'acknowledged',
              },
              message: 'Alert acknowledged successfully',
            },
            200,
            req,
          );
        }
      }

      // Degrade: computed/non-persisted alert ids (e.g. alert-toner-*) have
      // no device_alerts row. Return a shape-compatible ack.
      return createCorsResponse(
        {
          success: true,
          acknowledgment: {
            alertId,
            acknowledgedBy: user.id,
            acknowledgedAt: new Date().toISOString(),
            note,
            status: 'acknowledged',
          },
          message: 'Alert acknowledged successfully',
          degraded: true,
        },
        200,
        req,
      );
    }

    // ================================================================
    // Existing routes (monitored_devices / device_readings / device_alerts)
    // ================================================================

    // GET /remote-monitoring/devices/:id - Get device details (before list)
    if (req.method === 'GET' && endpoint === 'devices' && resourceId) {
      const { data: device, error } = await admin
        .from('monitored_devices')
        .select('*')
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        return createCorsResponse({ error: 'Device not found' }, 404, req);
      }

      const { data: readings } = await admin
        .from('device_readings')
        .select('*')
        .eq('device_id', resourceId)
        .order('timestamp', { ascending: false })
        .limit(100);

      const { data: alerts } = await admin
        .from('device_alerts')
        .select('*')
        .eq('device_id', resourceId)
        .order('created_at', { ascending: false })
        .limit(20);

      return createCorsResponse(
        { ...device, readings: readings || [], alerts: alerts || [] },
        200,
        req,
      );
    }

    // GET /remote-monitoring/devices - List monitored devices
    if (req.method === 'GET' && endpoint === 'devices') {
      const status = url.searchParams.get('status');
      const customerId = url.searchParams.get('customerId');

      let query = admin
        .from('monitored_devices')
        .select(
          `
          *,
          equipment:equipment_id (
            id,
            name,
            serial_number,
            model
          )
        `,
        )
        .eq('tenant_id', tenantId)
        .order('last_seen', { ascending: false });

      if (status) query = query.eq('status', status);
      if (customerId) query = query.eq('customer_id', customerId);

      const { data: devices, error } = await query;

      if (error) {
        console.error('Error fetching monitored devices:', error);
        return createCorsResponse({ error: 'Failed to fetch devices' }, 500, req);
      }

      return createCorsResponse(devices || [], 200, req);
    }

    // GET /remote-monitoring/alerts - Get active alerts
    if (req.method === 'GET' && endpoint === 'alerts') {
      const severity = url.searchParams.get('severity');
      const acknowledged = url.searchParams.get('acknowledged');

      let query = admin
        .from('device_alerts')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (severity) query = query.eq('severity', severity);
      if (acknowledged === 'false') query = query.eq('acknowledged', false);
      if (acknowledged === 'true') query = query.eq('acknowledged', true);

      const { data: alerts, error } = await query.limit(100);

      if (error) {
        console.error('Error fetching alerts:', error);
        return createCorsResponse({ error: 'Failed to fetch alerts' }, 500, req);
      }

      return createCorsResponse(alerts || [], 200, req);
    }

    // GET /remote-monitoring/status - Get overall monitoring status
    if (req.method === 'GET' && endpoint === 'status') {
      const { count: totalDevices } = await admin
        .from('monitored_devices')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      const { count: onlineDevices } = await admin
        .from('monitored_devices')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'online');

      const { count: activeAlerts } = await admin
        .from('device_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('acknowledged', false);

      const { count: criticalAlerts } = await admin
        .from('device_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('acknowledged', false)
        .eq('severity', 'critical');

      return createCorsResponse(
        {
          totalDevices: totalDevices || 0,
          onlineDevices: onlineDevices || 0,
          offlineDevices: (totalDevices || 0) - (onlineDevices || 0),
          activeAlerts: activeAlerts || 0,
          criticalAlerts: criticalAlerts || 0,
          healthScore: totalDevices ? Math.round(((onlineDevices || 0) / totalDevices) * 100) : 100,
        },
        200,
        req,
      );
    }

    // POST /remote-monitoring/devices - Register device for monitoring
    if (req.method === 'POST' && endpoint === 'devices') {
      const body = await req.json();

      const deviceData = {
        tenant_id: tenantId,
        equipment_id: body.equipmentId || body.equipment_id,
        customer_id: body.customerId || body.customer_id,
        ip_address: body.ipAddress || body.ip_address,
        hostname: body.hostname,
        device_type: body.deviceType || body.device_type,
        status: 'pending',
        monitoring_enabled: true,
        poll_interval: body.pollInterval || body.poll_interval || 300,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data: device, error } = await admin
        .from('monitored_devices')
        .insert(deviceData)
        .select()
        .single();

      if (error) {
        console.error('Error registering device:', error);
        return createCorsResponse({ error: 'Failed to register device' }, 500, req);
      }

      return createCorsResponse(device, 201, req);
    }

    // POST /remote-monitoring/alerts/:id/acknowledge - Acknowledge alert
    if (
      req.method === 'POST' &&
      endpoint === 'alerts' &&
      resourceId &&
      parts[2] === 'acknowledge'
    ) {
      const { data: alert, error } = await admin
        .from('device_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', resourceId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to acknowledge alert' }, 500, req);
      }

      return createCorsResponse(alert, 200, req);
    }

    // POST /remote-monitoring/readings - Record device reading (webhook endpoint)
    if (req.method === 'POST' && endpoint === 'readings') {
      const body = await req.json();

      const { data: reading, error } = await admin
        .from('device_readings')
        .insert({
          tenant_id: tenantId,
          device_id: body.deviceId || body.device_id,
          reading_type: body.readingType || body.reading_type,
          value: body.value,
          unit: body.unit,
          metadata: body.metadata || {},
          timestamp: body.timestamp || new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        return createCorsResponse({ error: 'Failed to record reading' }, 500, req);
      }

      await admin
        .from('monitored_devices')
        .update({ last_seen: new Date().toISOString(), status: 'online' })
        .eq('id', body.deviceId || body.device_id);

      return createCorsResponse(reading, 201, req);
    }

    return createCorsResponse({ error: 'Endpoint not found' }, 404, req);
  } catch (error) {
    console.error('Unexpected error in remote-monitoring function:', error);
    return createCorsResponse(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      500,
      req,
    );
  }
}
