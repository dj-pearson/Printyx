// Auto-order service.
//
// Called by the alert materialiser when a NEW critical/empty supply
// alert is created (transition from no-open-alert → open critical).
// We:
//   1. Resolve the alert's tenant + customer from the device row
//      (`device_registrations.customer_id`, denormalised at /submit time).
//   2. Check the tenant / monitoring-client config flag
//      `autoOrderEnabled` — must be explicitly opted in.
//   3. Skip if there's already a non-cancelled order for the same
//      (device, supply) — avoids double-ordering when alerts oscillate.
//   4. Look up the right toner product via supplies catalog.
//   5. Insert a `device_supply_orders` row (status=pending) and
//      stamp the alert with `triggered_order_id`.
//
// The function is best-effort: any failure is logged and the alert is
// still materialised. Operators can always click Order manually.

import { db } from '../db';
import {
  deviceRegistrations,
  deviceAlerts,
  deviceSupplyOrders,
  monitoringClients,
  manufacturerIntegrations,
  supplies,
  clientDiscoveredDevices,
} from '@shared/schema';
import { eq, and, inArray, like, or } from 'drizzle-orm';
import { createModuleLogger } from '../lib/logger';

const log = createModuleLogger('auto-order');

export interface AutoOrderInput {
  alertId: string;
  tenantId: string;
  deviceId: string;
  supplyType: string;
  alertType: 'low' | 'critical' | 'empty';
}

export async function maybeAutoOrder(
  input: AutoOrderInput,
): Promise<{ ordered: boolean; reason?: string }> {
  // Only auto-order on critical / empty. 'low' is too noisy.
  if (input.alertType !== 'critical' && input.alertType !== 'empty') {
    return { ordered: false, reason: 'severity below threshold' };
  }

  try {
    const device = await db.query.deviceRegistrations.findFirst({
      where: and(
        eq(deviceRegistrations.id, input.deviceId),
        eq(deviceRegistrations.tenantId, input.tenantId),
      ),
    });
    if (!device) {
      return { ordered: false, reason: 'device not found' };
    }

    // Resolve the monitoring client that owns this device. The integration
    // name is "Client: <clientName>" (set by routes-client-monitoring.ts
    // on the first /submit). We use it as the bridge.
    const integration = await db.query.manufacturerIntegrations.findFirst({
      where: eq(manufacturerIntegrations.id, device.integrationId),
    });
    if (!integration) {
      return { ordered: false, reason: 'integration not found' };
    }
    const clientName = integration.integrationName?.replace(/^Client:\s*/, '') || '';
    const monitoringClient = await db.query.monitoringClients.findFirst({
      where: and(
        eq(monitoringClients.tenantId, input.tenantId),
        eq(monitoringClients.clientName, clientName),
      ),
    });

    // Opt-in: only auto-order when the agent's configuration explicitly
    // sets autoOrderEnabled=true. The flag lives in monitoring_clients.
    // configuration JSON. Default off — deliberate friction so a fresh
    // tenant doesn't get unexpected orders the first time it ships an
    // empty cartridge alert.
    const cfg = (monitoringClient?.configuration as any) || {};
    if (cfg.autoOrderEnabled !== true) {
      return { ordered: false, reason: 'auto-order disabled for this client' };
    }

    // Don't double-order: if there's already a non-cancelled order for
    // (device, supply), skip.
    const existing = await db.query.deviceSupplyOrders.findFirst({
      where: and(
        eq(deviceSupplyOrders.tenantId, input.tenantId),
        eq(deviceSupplyOrders.deviceId, input.deviceId),
        eq(deviceSupplyOrders.supplyType, input.supplyType),
        inArray(deviceSupplyOrders.status, ['pending', 'approved', 'ordered', 'shipped']),
      ),
    });
    if (existing) {
      return { ordered: false, reason: `existing order ${existing.id} (${existing.status})` };
    }

    // Look up the toner product. Reuses the same matching heuristic the
    // agent's customer portal flow uses.
    // device_registrations has no manufacturer column: this read
    // device.manufacturer, which was always undefined, so the lookup fell to a
    // colour-only pattern and would order whichever toner of that colour it
    // found first (round 239). The maker is recorded on the discovered-device
    // row /submit writes beside the registration.
    const discovered = await db.query.clientDiscoveredDevices.findFirst({
      where: and(
        eq(clientDiscoveredDevices.tenantId, input.tenantId),
        eq(clientDiscoveredDevices.registeredDeviceId, device.id),
      ),
    });
    const manufacturer = discovered?.manufacturer || null;
    const model = device.model || discovered?.model || null;

    const product = await lookupTonerProduct(input.tenantId, manufacturer, model, input.supplyType);
    if (!product) {
      log.info(`auto-order: no product match for ${manufacturer}/${model}/${input.supplyType}`);
      return {
        ordered: false,
        reason: model ? 'no product match' : 'device model not recorded',
      };
    }
    if (product.unitPrice === null) {
      // It used to order at an invented 99.99. An order carries a price a
      // customer is billed; with none recorded, a person decides.
      return { ordered: false, reason: `product ${product.productSku} has no price` };
    }

    const unitPrice = product.unitPrice;
    const totalPrice = (Number(unitPrice) * 1).toFixed(2);

    const [order] = await db
      .insert(deviceSupplyOrders)
      .values({
        tenantId: input.tenantId,
        customerId: device.customerId || null,
        deviceId: device.id,
        alertId: input.alertId,
        supplyType: input.supplyType,
        productId: product.productId,
        productSku: product.productSku,
        productName: product.productName,
        quantity: 1,
        unitPrice,
        totalPrice,
        status: 'pending',
        triggeredBy: 'auto',
        notes: `Auto-generated from ${input.alertType} alert on ${device.serialNumber || device.id}`,
      })
      .returning();

    // Stamp the alert with the order id so the UI can show "Order #X" inline.
    await db
      .update(deviceAlerts)
      .set({ triggeredOrderId: order.id, updatedAt: new Date() })
      .where(and(eq(deviceAlerts.id, input.alertId), eq(deviceAlerts.tenantId, input.tenantId)));

    log.info(
      `auto-order: created ${order.id} (${product.productSku}) for device=${device.id} supply=${input.supplyType}`,
    );
    return { ordered: true };
  } catch (error) {
    log.warn('auto-order failed (non-fatal)', { error });
    return { ordered: false, reason: 'error' };
  }
}

// ── Toner product lookup (subset of routes-client-monitoring.ts logic).
// Duplicated here so the materialiser doesn't import a route file.

async function lookupTonerProduct(
  tenantId: string,
  manufacturer: string | null,
  model: string | null,
  color: string,
): Promise<{
  productId: string;
  productSku: string;
  productName: string;
  unitPrice: string | null;
} | null> {
  const patterns = tonerPatterns(manufacturer, model, color);
  if (!patterns) return null;

  const conditions = patterns.map((p) =>
    or(like(supplies.productCode, p), like(supplies.productName, p)),
  );

  const results = await db
    .select()
    .from(supplies)
    .where(and(eq(supplies.tenantId, tenantId), eq(supplies.isActive, true), or(...conditions)))
    .limit(1);

  if (results.length === 0) return null;
  const product = results[0];

  let unitPrice: string | null = null;
  if (product.newRepPrice) unitPrice = product.newRepPrice;
  else if (product.upgradeRepPrice) unitPrice = product.upgradeRepPrice;
  else if (product.lexmarkRepPrice) unitPrice = product.lexmarkRepPrice;
  else if (product.graphicRepPrice) unitPrice = product.graphicRepPrice;

  return {
    productId: product.id,
    productSku: product.productCode || '',
    productName: product.productName || '',
    unitPrice,
  };
}

/**
 * LIKE patterns naming this machine's cartridge, or null when the machine's
 * model is unknown. A colour-only pattern matches every cartridge of that
 * colour in the catalogue, so without a model there is nothing to order
 * (round 239). Exported for its test.
 */
export function tonerPatterns(
  manufacturer: string | null,
  model: string | null,
  color: string,
): string[] | null {
  if (!model || !model.trim()) return null;
  const c = color.toUpperCase();
  const cleanModel = model.trim().replace(/\s+/g, '-').toUpperCase();
  if (manufacturer && manufacturer.trim()) {
    const m = manufacturer.trim().replace(/\s+/g, '-').toUpperCase();
    return [
      `%TONER%${c}%${m}%${cleanModel}%`,
      `%${m}%${cleanModel}%${c}%TONER%`,
      `%${c}%${m}%${cleanModel}%`,
    ];
  }
  return [`%TONER%${c}%${cleanModel}%`, `%${cleanModel}%${c}%TONER%`, `%${c}%${cleanModel}%`];
}
