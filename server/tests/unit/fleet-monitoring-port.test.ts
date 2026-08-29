/**
 * FleetMonitoringDashboard was broken three ways in production (AUDIT-031).
 *
 * The page called /api/fleet/dashboard and /api/fleet/devices. /api/fleet is not
 * proxied, so dev was served by three Express handlers in routes-client-monitoring
 * and looked fine; production resolves the segment to supabase/functions/fleet/,
 * which is about VEHICLES. So /dashboard answered 200 with totalVehicles /
 * availableVehicles under keys the page does not read - every card rendered zero -
 * and /devices 404'd, because the vehicle function has no such branch. A 200 of
 * the wrong domain is worse than a 404: nothing errors and nothing logs.
 *
 * Third defect, independent of the collision: Order Toner posted to
 * /api/devices/:id/order-toner, which inserted device_id / order_type / items /
 * requested_by into supply_orders. supply_orders has none of those columns
 * (machine_id / color / part_number / quantity / created_by_user_id, machine_id
 * NOT NULL), so the insert was always a PGRST204 reported as "Failed to create
 * toner order". Ordering toner from this screen has never worked.
 *
 * The fix moves all four endpoints onto /api/device-monitoring, the proxied
 * prefix whose function already owns device_registrations, device_metrics,
 * device_alerts and device_supply_orders - so dev and production run one
 * implementation.
 *
 * The arithmetic is tested directly; the handler needs a live Postgres, so what
 * is asserted of it is coverage and the columns it names. Comments are stripped
 * before matching, or an assertion that a string is absent matches the comment
 * explaining why it was removed.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildFleetDashboard,
  enrichDeviceWithMetrics,
} from '../../../supabase/functions/_shared/device-monitoring-shape';

const repo = join(__dirname, '..', '..', '..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const read = (p: string) => stripComments(readFileSync(join(repo, p), 'utf8'));

const edge = read('supabase/functions/device-monitoring/index.ts');
const page = read('client/src/pages/FleetMonitoringDashboard.tsx');
const express = read('server/routes-client-monitoring.ts');

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-08-29T12:00:00.000Z');
const ts = (hoursAgo: number) => new Date(NOW - hoursAgo * HOUR).toISOString();

describe('buildFleetDashboard', () => {
  it('counts the registration list, not the devices that reported', () => {
    const dash = buildFleetDashboard(
      [
        { id: 'a', status: 'online' },
        { id: 'b', status: 'online' },
        { id: 'c', status: 'offline' },
      ],
      [{ deviceId: 'a', collectionTimestamp: ts(1) }],
      [],
      { now: NOW },
    );
    // A monitoring outage must read as an outage, not as a smaller fleet.
    expect(dash.summary.totalDevices).toBe(3);
    expect(dash.summary.reportingDevices).toBe(1);
  });

  it('leaves unknown and error out of both online and offline', () => {
    const dash = buildFleetDashboard(
      [
        { id: 'a', status: 'online' },
        { id: 'b', status: 'offline' },
        { id: 'c', status: 'unknown' },
        { id: 'd', status: 'error' },
      ],
      [],
      [],
      { now: NOW },
    );
    expect(dash.summary.onlineDevices).toBe(1);
    expect(dash.summary.offlineDevices).toBe(1);
    expect(dash.summary.onlineDevices + dash.summary.offlineDevices).toBeLessThan(
      dash.summary.totalDevices,
    );
  });

  it('excludes a reading older than the window from reportingRate', () => {
    const dash = buildFleetDashboard(
      [
        { id: 'a', status: 'online' },
        { id: 'b', status: 'online' },
        { id: 'c', status: 'online' },
        { id: 'd', status: 'online' },
      ],
      [
        { deviceId: 'a', collectionTimestamp: ts(1) },
        { deviceId: 'b', collectionTimestamp: ts(23) },
        { deviceId: 'c', collectionTimestamp: ts(25) },
        { deviceId: 'd', collectionTimestamp: ts(400) },
      ],
      [],
      { now: NOW },
    );
    expect(dash.summary.reportingDevices).toBe(2);
    expect(dash.summary.reportingRate).toBe(50);
    expect(dash.summary.reportingWindowHours).toBe(24);
  });

  it('ignores metrics whose device is no longer registered', () => {
    const dash = buildFleetDashboard(
      [{ id: 'a', status: 'online' }],
      [
        { deviceId: 'a', bwImpressions: 100, colorImpressions: 10, collectionTimestamp: ts(1) },
        {
          deviceId: 'gone',
          bwImpressions: 9999,
          colorImpressions: 9999,
          collectionTimestamp: ts(1),
        },
      ],
      [],
      { now: NOW },
    );
    expect(dash.impressions).toEqual({ totalBW: 100, totalColor: 10 });
    expect(dash.summary.reportingDevices).toBe(1);
  });

  it('counts only critical alerts as critical, and joins the device names on', () => {
    const dash = buildFleetDashboard(
      [{ id: 'a', status: 'online', deviceName: 'Front desk', serialNumber: 'SN-1' }],
      [],
      [
        {
          deviceId: 'a',
          supplyType: 'black',
          severity: 'critical',
          currentValue: 4,
          message: 'low',
        },
        {
          deviceId: 'a',
          supplyType: 'cyan',
          severity: 'warning',
          currentValue: 18,
          message: 'low',
        },
      ],
      { now: NOW },
    );
    expect(dash.summary.criticalAlerts).toBe(1);
    expect(dash.tonerAlerts).toHaveLength(2);
    expect(dash.tonerAlerts[0]).toMatchObject({
      color: 'black',
      level: 4,
      deviceName: 'Front desk',
      serialNumber: 'SN-1',
    });
  });

  it('sorts critical alerts ahead of warnings, then by how empty the supply is', () => {
    const dash = buildFleetDashboard(
      [{ id: 'a', status: 'online' }],
      [],
      [
        // The warning is the emptiest of the three on purpose: sorting by level
        // alone would put it first, so severity has to be the outer key.
        { deviceId: 'a', supplyType: 'yellow', severity: 'warning', currentValue: 1 },
        { deviceId: 'a', supplyType: 'black', severity: 'critical', currentValue: 8 },
        { deviceId: 'a', supplyType: 'cyan', severity: 'critical', currentValue: 2 },
      ],
      { now: NOW },
    );
    expect(dash.tonerAlerts.map((a) => a.color)).toEqual(['cyan', 'black', 'yellow']);
  });

  it('reads snake_case rows identically', () => {
    const dash = buildFleetDashboard(
      [{ id: 'a', status: 'online', device_name: 'Copier 1' }],
      [{ device_id: 'a', bw_impressions: 7, collection_timestamp: ts(2) }],
      [{ device_id: 'a', supply_type: 'black', severity: 'critical', current_value: 3 }],
      { now: NOW },
    );
    expect(dash.impressions.totalBW).toBe(7);
    expect(dash.summary.reportingDevices).toBe(1);
    expect(dash.tonerAlerts[0].deviceName).toBe('Copier 1');
  });

  it('reports zero rather than dividing by an empty fleet', () => {
    const dash = buildFleetDashboard([], [], [], { now: NOW });
    expect(dash.summary.reportingRate).toBe(0);
    expect(dash.summary.totalDevices).toBe(0);
  });
});

describe('enrichDeviceWithMetrics', () => {
  it('leaves currentMetrics null for a device that has never reported', () => {
    // Not an object of zeroes: the page branches on null to say "no data", and
    // zeroes would read as real meter readings of zero.
    const device = enrichDeviceWithMetrics({ id: 'a', device_name: 'X', status: 'unknown' }, null);
    expect(device.currentMetrics).toBeNull();
    expect(device.deviceName).toBe('X');
  });

  it('flattens the toner and paper jsonb onto the reading', () => {
    const device = enrichDeviceWithMetrics(
      { id: 'a', serial_number: 'SN-9' },
      {
        toner_levels: { black: 40 },
        paper_levels: { tray1: 80 },
        total_impressions: 12,
        collection_timestamp: ts(1),
      },
    );
    expect(device.serialNumber).toBe('SN-9');
    expect(device.currentMetrics?.tonerLevels).toEqual({ black: 40 });
    expect(device.currentMetrics?.paperLevels).toEqual({ tray1: 80 });
    expect(device.currentMetrics?.totalImpressions).toBe(12);
  });
});

describe('the edge function serves what the page calls', () => {
  it.each(['fleet-dashboard', 'fleet-devices'])('serves /%s', (resource) => {
    expect(edge).toContain(`resource === '${resource}'`);
  });

  it('serves the per-device metrics history and the toner order', () => {
    expect(edge).toMatch(/resource === 'fleet-devices'/);
    expect(edge).toMatch(/parts\[2\] === 'metrics'/);
    expect(edge).toMatch(/parts\[2\] === 'order-toner'/);
  });

  it('orders toner into device_supply_orders on its real columns', () => {
    const order = edge.slice(edge.indexOf("parts[2] === 'order-toner'"));
    expect(order).toContain("from('device_supply_orders')");
    for (const column of ['supply_type', 'triggered_by', 'triggered_by_user_id', 'quantity']) {
      expect(order).toContain(column);
    }
  });

  it('never writes to supply_orders, whose columns this payload does not have', () => {
    // machine_id is NOT NULL there and device_id / order_type / items are not
    // columns at all, so the old insert could only ever be a PGRST204.
    expect(edge).not.toContain("from('supply_orders')");
    expect(edge).not.toContain('order_type');
    expect(edge).not.toContain('requested_by');
  });

  it('refuses an order with no colour instead of writing an empty row', () => {
    expect(edge).toMatch(/colors\.length === 0/);
  });

  it('scopes every fleet query to the tenant', () => {
    const fleet = edge.slice(
      edge.indexOf("resource === 'fleet-dashboard'"),
      edge.indexOf("resource === 'alerts'"),
    );
    // Each .from() up to the end of its statement: a read must filter on
    // tenant_id, and the one write must stamp it into the row.
    const statements = fleet.split(".from('").slice(1);
    expect(statements.length).toBe(9);
    for (const statement of statements) {
      const chain = statement.slice(0, statement.indexOf(';'));
      expect(/\.eq\('tenant_id', tenantId\)/.test(chain) || /tenant_id: tenantId/.test(chain)).toBe(
        true,
      );
    }
  });
});

describe('the page and dev agree with production', () => {
  it('no longer names the /api/fleet prefix, which belongs to the vehicle function', () => {
    expect(page).not.toContain('/api/fleet/');
    expect(page).toContain('/api/device-monitoring/fleet-dashboard');
    expect(page).toContain('/api/device-monitoring/fleet-devices');
  });

  it('keeps the search term out of the query key', () => {
    // The default queryFn joins key elements with '/', so a term here would
    // arrive as a path segment and be read as a device id.
    expect(page).not.toMatch(/fleet-devices',\s*searchQuery/);
  });

  it('drops the summary fields it never rendered', () => {
    // averageUptime was online/total under a name promising uptime - AUDIT-019's
    // rule is to delete a claim with no backing measurement, not to relabel it.
    for (const field of ['averageUptime', 'fleetUtilization', 'statusDistribution']) {
      expect(page).not.toContain(field);
      expect(edge).not.toContain(field);
    }
  });

  it('says what the reporting percentage counts', () => {
    expect(page).toContain('reportingRate');
    expect(page).toMatch(/reportingDevices/);
    expect(page).toMatch(/reportingWindowHours/);
  });

  it('leaves no Express handler on the retired prefix', () => {
    expect(express).not.toContain("'/api/fleet/");
  });
});
