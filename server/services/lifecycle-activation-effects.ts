/**
 * WF-L-08 side effects, drizzle half.
 *
 * The DECISIONS are in supabase/functions/_shared/lifecycle-activation.ts, which
 * this imports directly rather than copying - the AC asks for one shared module
 * and the file is plain TypeScript with no imports of its own, so both runtimes
 * load it. The edge transition handler has the PostgREST equivalent of this file
 * inline; between them, the two hosts cannot disagree about what acceptance does.
 *
 * Each write is checked on its own. "Registered for monitoring but no baseline
 * captured" is a real state and a different one from "nothing ran", and rolling
 * the whole thing back on one failure would lose the parts that worked.
 */

import { and, eq } from 'drizzle-orm';
import { contracts, equipment, leases, meterReadings } from '@shared/schema';
import { equipmentLifecycle } from '@shared/equipment-schema';
import {
  deviceRegistrations,
  manufacturerIntegrations,
} from '@shared/manufacturer-integration-schema';
import {
  planActivation,
  planRetirement,
  type AcceptanceReading,
} from '../../supabase/functions/_shared/lifecycle-activation';

export interface EffectResult {
  done: string[];
  failed: string[];
  skipped: string[];
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tx = any;

export async function runLifecycleActivation(
  tx: Tx,
  tenantId: string,
  equipmentId: string,
  reading?: AcceptanceReading | null,
): Promise<EffectResult> {
  const [lifecycle] = await tx
    .select()
    .from(equipmentLifecycle)
    .where(
      and(
        eq(equipmentLifecycle.equipmentId, equipmentId),
        eq(equipmentLifecycle.tenantId, tenantId),
      ),
    );

  const [asset] = await tx
    .select()
    .from(equipment)
    .where(and(eq(equipment.id, equipmentId), eq(equipment.tenantId, tenantId)));

  const serialNumber = lifecycle?.serialNumber ?? asset?.serialNumber ?? null;
  const customerId = lifecycle?.customerId ?? asset?.customerId ?? null;

  const integrations = await tx
    .select({
      id: manufacturerIntegrations.id,
      manufacturer: manufacturerIntegrations.manufacturer,
      is_active: manufacturerIntegrations.isActive,
    })
    .from(manufacturerIntegrations)
    .where(eq(manufacturerIntegrations.tenantId, tenantId));

  const existing = serialNumber
    ? await tx
        .select({ id: deviceRegistrations.id, status: deviceRegistrations.status })
        .from(deviceRegistrations)
        .where(
          and(
            eq(deviceRegistrations.tenantId, tenantId),
            eq(deviceRegistrations.serialNumber, serialNumber),
          ),
        )
        .limit(1)
    : [];

  const customerContracts = customerId
    ? await tx
        .select({
          id: contracts.id,
          contract_number: contracts.contractNumber,
          start_date: contracts.startDate,
          lease_id: contracts.leaseId,
        })
        .from(contracts)
        .where(and(eq(contracts.tenantId, tenantId), eq(contracts.customerId, customerId)))
    : [];

  const plan = planActivation({
    unit: {
      equipmentId,
      tenantId,
      serialNumber,
      manufacturer: lifecycle?.manufacturer ?? asset?.manufacturer ?? null,
      model: lifecycle?.model ?? asset?.modelNumber ?? null,
      customerId,
      currentLocation: lifecycle?.currentLocation ?? asset?.locationDescription ?? null,
      ipAddress: asset?.ipAddress ?? null,
      serviceContractNumber: asset?.serviceContractNumber ?? null,
    },
    integrations: integrations.map((i: any) => ({
      id: String(i.id),
      manufacturer: String(i.manufacturer),
      is_active: i.is_active,
    })),
    existingRegistration: existing[0] ?? null,
    contracts: customerContracts.map((c: any) => ({
      id: String(c.id),
      contract_number: c.contract_number,
      start_date: c.start_date ? new Date(c.start_date).toISOString() : null,
      lease_id: c.lease_id,
    })),
    lease: null,
    reading: reading ?? null,
  });

  const done: string[] = [];
  const failed: string[] = [];

  if (plan.deviceRegistration) {
    try {
      const row = plan.deviceRegistration;
      await tx.insert(deviceRegistrations).values({
        tenantId,
        integrationId: String(row.integration_id),
        deviceId: String(row.device_id),
        deviceName: (row.device_name as string) ?? null,
        model: (row.model as string) ?? null,
        serialNumber: (row.serial_number as string) ?? null,
        ipAddress: (row.ip_address as string) ?? null,
        location: (row.location as string) ?? null,
        status: row.status as any,
        customerId: (row.customer_id as string) ?? null,
      });
      done.push('device registration');
    } catch {
      failed.push('device registration');
    }
  }

  let leaseStart = plan.leaseStart;
  if (plan.contractStart) {
    try {
      await tx
        .update(contracts)
        .set({ startDate: new Date(), updatedAt: new Date() })
        .where(and(eq(contracts.id, plan.contractStart.id), eq(contracts.tenantId, tenantId)));
      done.push('contract start date');
    } catch {
      failed.push('contract start date');
    }

    // The lease hangs off the contract, so it is only knowable once the contract
    // is picked - a second pass rather than a guess made before the pick.
    const chosen = customerContracts.find((c: any) => String(c.id) === plan.contractStart!.id);
    if (!leaseStart && chosen?.lease_id) {
      const [lease] = await tx
        .select({ id: leases.id, first_payment_date: leases.firstPaymentDate })
        .from(leases)
        .where(and(eq(leases.id, chosen.lease_id), eq(leases.tenantId, tenantId)));
      if (lease && !lease.first_payment_date) {
        leaseStart = { id: String(lease.id), patch: {} };
      }
    }
  }

  if (leaseStart) {
    try {
      await tx
        .update(leases)
        .set({ firstPaymentDate: new Date(), updatedAt: new Date() })
        .where(and(eq(leases.id, leaseStart.id), eq(leases.tenantId, tenantId)));
      done.push('lease first payment date');
    } catch {
      failed.push('lease first payment date');
    }
  }

  if (plan.baselineReading) {
    try {
      const row = plan.baselineReading;
      await tx.insert(meterReadings).values({
        tenantId,
        equipmentId,
        contractId: (row.contract_id as string) ?? null,
        readingDate: new Date(String(row.reading_date)),
        bwMeterReading: row.bw_meter_reading as number | null,
        colorMeterReading: row.color_meter_reading as number | null,
        scanMeterReading: row.scan_meter_reading as number | null,
        faxMeterReading: row.fax_meter_reading as number | null,
        readingMethod: 'manual',
        collectionMethod: 'manual',
        previousBlackMeter: 0,
        previousColorMeter: 0,
        blackCopies: 0,
        colorCopies: 0,
        notes: row.notes as string,
      });
      done.push('baseline meter reading');
    } catch {
      failed.push('baseline meter reading');
    }
  }

  return { done, failed, skipped: plan.skipped };
}

export async function runLifecycleRetirement(
  tx: Tx,
  tenantId: string,
  equipmentId: string,
): Promise<EffectResult> {
  const [lifecycle] = await tx
    .select({ serialNumber: equipmentLifecycle.serialNumber })
    .from(equipmentLifecycle)
    .where(
      and(
        eq(equipmentLifecycle.equipmentId, equipmentId),
        eq(equipmentLifecycle.tenantId, tenantId),
      ),
    );

  const existing = lifecycle?.serialNumber
    ? await tx
        .select({ id: deviceRegistrations.id, status: deviceRegistrations.status })
        .from(deviceRegistrations)
        .where(
          and(
            eq(deviceRegistrations.tenantId, tenantId),
            eq(deviceRegistrations.serialNumber, lifecycle.serialNumber),
          ),
        )
        .limit(1)
    : [];

  const plan = planRetirement(existing[0] ?? null);
  const done: string[] = [];
  const failed: string[] = [];

  if (plan.deviceRegistration) {
    try {
      await tx
        .update(deviceRegistrations)
        .set({ status: 'offline', updatedAt: new Date() })
        .where(
          and(
            eq(deviceRegistrations.id, plan.deviceRegistration.id),
            eq(deviceRegistrations.tenantId, tenantId),
          ),
        );
      done.push('device deregistration');
    } catch {
      failed.push('device deregistration');
    }
  }

  return { done, failed, skipped: plan.skipped };
}
