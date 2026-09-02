/**
 * WF-L-09: an onboarded device has to BE the equipment row.
 *
 * `onboarding_equipment.equipment_id` was nullable, unconstrained and set only
 * when a caller already had an id to pass - and no caller did. So a device could
 * carry a real serial, IP, hostname, MAC and install location through a whole
 * onboarding checklist and never exist in `equipment`, which is the table meter
 * reads, service tickets, contracts and toner replenishment all query. The
 * install completed and the machine was invisible to every downstream system.
 *
 * This module owns the decision - link, match or create - and takes its three IO
 * calls as arguments so both hosts share one behaviour and it can be tested
 * without a database. server/lib/onboarding-equipment-link.ts is the Node twin;
 * server/tests/unit/onboarding-equipment-link.test.ts locks the two together.
 *
 * ON MATCHING BY SERIAL: `equipment.serial_number` is UNIQUE across the whole
 * table, not per tenant. A serial already registered to another tenant therefore
 * can neither be linked (it is not their row) nor inserted (23505), so the link
 * is skipped and the reason is reported on the response rather than surfacing as
 * a 500 the installer reads as a server fault.
 */

export interface OnboardingDeviceInput {
  equipmentId?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  assetTag?: string | null;
  targetIpAddress?: string | null;
  buildingLocation?: string | null;
  roomLocation?: string | null;
  specificLocation?: string | null;
  installDate?: string | null;
}

export interface EquipmentLinkContext {
  tenantId: string;
  customerId: string;
  now?: string;
}

export interface EquipmentRowLike {
  id: string;
  tenant_id?: string | null;
  serial_number?: string | null;
}

export interface EquipmentLinkDeps {
  /** Equipment by id, scoped to the tenant by the caller. Null when absent. */
  findById(id: string): Promise<EquipmentRowLike | null>;
  /** Equipment by serial across ALL tenants - the column is globally unique. */
  findBySerial(serial: string): Promise<EquipmentRowLike | null>;
  /** Insert and return the new row. */
  insertEquipment(row: Record<string, unknown>): Promise<EquipmentRowLike>;
}

export type EquipmentLinkAction = 'explicit' | 'matched' | 'created' | 'skipped';

export interface EquipmentLinkResult {
  equipmentId: string | null;
  action: EquipmentLinkAction;
  /** Present only when action is 'skipped'; safe to show a human. */
  reason?: string;
}

/** The single free-text location `equipment` records, from three onboarding fields. */
export function onboardingLocationDescription(device: OnboardingDeviceInput): string | null {
  const parts = [device.buildingLocation, device.roomLocation, device.specificLocation]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts.join(' - ') : null;
}

/**
 * The `equipment` insert for a device configured during onboarding. Only columns
 * that exist: onboarding's hostname, MAC address and network assignment have no
 * home on `equipment` and are deliberately not smuggled into `notes`.
 */
export function equipmentRowFromOnboardingDevice(
  device: OnboardingDeviceInput,
  ctx: EquipmentLinkContext,
): Record<string, unknown> {
  const now = ctx.now ?? new Date().toISOString();
  return {
    tenant_id: ctx.tenantId,
    customer_id: ctx.customerId,
    serial_number: device.serialNumber || null,
    model_number: device.model || null,
    manufacturer: device.manufacturer || null,
    asset_tag: device.assetTag || null,
    ip_address: device.targetIpAddress || null,
    location_description: onboardingLocationDescription(device),
    install_date: device.installDate || null,
    equipment_status: 'active',
    created_at: now,
    updated_at: now,
  };
}

/** Fields onboarding collects that `equipment` has no column for. */
export const UNMAPPED_ONBOARDING_FIELDS = ['hostname', 'macAddress', 'networkAssignment'];

export async function linkOnboardingEquipment(
  device: OnboardingDeviceInput,
  ctx: EquipmentLinkContext,
  deps: EquipmentLinkDeps,
): Promise<EquipmentLinkResult> {
  // A caller that already knows the equipment row wins, but the id is verified
  // rather than trusted: an unchecked one becomes a foreign-key violation at
  // insert time, reported as a failure to add equipment to the checklist.
  if (device.equipmentId) {
    const existing = await deps.findById(device.equipmentId);
    if (existing) return { equipmentId: existing.id, action: 'explicit' };
    return {
      equipmentId: null,
      action: 'skipped',
      reason: `equipmentId ${device.equipmentId} is not an equipment row in this tenant`,
    };
  }

  const serial = typeof device.serialNumber === 'string' ? device.serialNumber.trim() : '';
  if (serial) {
    const bySerial = await deps.findBySerial(serial);
    if (bySerial) {
      if (bySerial.tenant_id && bySerial.tenant_id !== ctx.tenantId) {
        return {
          equipmentId: null,
          action: 'skipped',
          reason: `serial ${serial} is already registered to another tenant`,
        };
      }
      return { equipmentId: bySerial.id, action: 'matched' };
    }
  }

  // No customer, no equipment row: equipment.customer_id is NOT NULL, and
  // inventing one would attach the machine to the wrong account.
  if (!ctx.customerId) {
    return {
      equipmentId: null,
      action: 'skipped',
      reason: 'the checklist has no customer, so the equipment row has no owner',
    };
  }

  const created = await deps.insertEquipment(equipmentRowFromOnboardingDevice(device, ctx));
  return { equipmentId: created.id, action: 'created' };
}
