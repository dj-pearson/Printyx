// The network and print-management steps, mapped onto their own tables
// (WF-L-10).
//
// EnhancedOnboardingForm collects a networkConfig step and a printManagement
// step - twenty-two fields and twenty-one - and POST /onboarding/checklists
// dropped both on the floor. Nothing wrote onboarding_network_config or
// onboarding_print_management, the storage methods for them in
// server/storage.ts were called by nothing, and the checklist PDF renderer
// already READ both tables, so it printed an empty section every time.
//
// The cost was not only a blank PDF. "Which devices have SNMP disabled, or
// scan-to-email unset" is a question a dealer's IT team asks constantly, and
// answering it means a column, not a key buried in an equipment_details blob.
//
// WHAT is_configured MEANS, and it is the field WF-L-13 gates on. It is NOT
// "the step was submitted" - a form posts its defaults whether or not anybody
// filled anything in, so that would mark every checklist configured and make
// the installed -> active gate meaningless the day it starts blocking. It means
// the fields that make the configuration ACTIONABLE are present: an address the
// device can actually be given, or a print server it can actually reach.

/** The subset of the form's networkConfig step that has a column. */
export interface NetworkConfigInput {
  ipAssignment?: string;
  staticIpAddress?: string;
  subnetMask?: string;
  gateway?: string;
  dnsServers?: string;
  vlanConfig?: string;
  switchPort?: string;
  switchLocation?: string;
  namingConvention?: string;
  dnsUpdate?: boolean;
  firewallRules?: string;
  qosSettings?: string;
  [key: string]: unknown;
}

export interface PrintManagementInput {
  system?: string;
  systemVersion?: string;
  serverAddress?: string;
  queueName?: string;
  costCenter?: string;
  deviceType?: string;
  userGroups?: string[];
  printQuotas?: Record<string, unknown>;
  restrictions?: Record<string, unknown>;
  accountCodes?: { required?: boolean; validCodes?: string[]; defaultCode?: string };
  [key: string]: unknown;
}

const text = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Can this network configuration be applied to a device?
 *
 * A static assignment needs an address. A DHCP or reserved one does not, but it
 * needs SOMETHING - a VLAN, a switch port, a naming convention - or the step
 * carries nothing an installer could act on.
 */
export function networkIsConfigured(input: NetworkConfigInput): boolean {
  const assignment = text(input.ipAssignment);
  if (assignment === 'static') return Boolean(text(input.staticIpAddress));
  if (!assignment) return false;
  return Boolean(
    text(input.vlanConfig) ||
      text(input.switchPort) ||
      text(input.switchLocation) ||
      text(input.gateway) ||
      text(input.dnsServers) ||
      text(input.namingConvention),
  );
}

/** Is there a print system to configure, and somewhere to reach it? */
export function printIsConfigured(input: PrintManagementInput): boolean {
  const system = text(input.system);
  // 'none' is a real answer - this site does not use print management - and it
  // is not a configuration.
  if (!system || system === 'none') return false;
  return Boolean(text(input.serverAddress) || text(input.queueName));
}

export function buildNetworkConfigRow(
  input: NetworkConfigInput,
  ctx: { tenantId: string; checklistId: string; equipmentId?: string | null },
): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    tenant_id: ctx.tenantId,
    checklist_id: ctx.checklistId,
    equipment_id: ctx.equipmentId ?? null,
    // The form calls it staticIpAddress and the column is ip_address; a static
    // assignment is the only one that carries one.
    ip_address: text(input.staticIpAddress),
    subnet_mask: text(input.subnetMask),
    gateway: text(input.gateway),
    // dns_servers is jsonb. The form collects one comma-separated line, which
    // is what an installer types, so it is split rather than stored as prose.
    dns_servers: splitList(input.dnsServers),
    vlan_id: text(input.vlanConfig),
    switch_port: text(input.switchPort),
    switch_location: text(input.switchLocation),
    hostname_convention: text(input.namingConvention),
    dns_update_required: input.dnsUpdate === true,
    firewall_rules: text(input.firewallRules),
    qos_settings: text(input.qosSettings),
    is_configured: networkIsConfigured(input),
    created_at: now,
    updated_at: now,
  };
}

export function buildPrintManagementRow(
  input: PrintManagementInput,
  ctx: { tenantId: string; checklistId: string; equipmentId?: string | null },
): Record<string, unknown> {
  const now = new Date().toISOString();
  const accountCodes = input.accountCodes ?? {};
  return {
    tenant_id: ctx.tenantId,
    checklist_id: ctx.checklistId,
    equipment_id: ctx.equipmentId ?? null,
    // system is NOT NULL. 'none' is a real answer and is stored as one.
    system: text(input.system) ?? 'none',
    system_version: text(input.systemVersion),
    server_address: text(input.serverAddress),
    queue_name: text(input.queueName),
    cost_center: text(input.costCenter),
    device_type: text(input.deviceType),
    authorized_groups: Array.isArray(input.userGroups) ? input.userGroups : [],
    print_quotas: input.printQuotas ?? null,
    print_restrictions: input.restrictions ?? null,
    account_codes_required: accountCodes.required === true,
    valid_account_codes: Array.isArray(accountCodes.validCodes) ? accountCodes.validCodes : [],
    default_account_code: text(accountCodes.defaultCode),
    is_configured: printIsConfigured(input),
    created_at: now,
    updated_at: now,
  };
}

/** A comma or newline separated line to a trimmed list. */
export function splitList(value: unknown): string[] {
  if (Array.isArray(value))
    return value
      .map(String)
      .map((v) => v.trim())
      .filter(Boolean);
  if (typeof value !== 'string') return [];
  return value
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Fields the form collects that NO column can hold.
 *
 * Reported back rather than dropped, which is the rule this repository keeps
 * arriving at: a caller that sends a wireless password should be told it was
 * not stored, not left to assume it was. Several of these are things nobody
 * should be persisting anyway - wirelessPassword above all - and saying so is
 * better than silence either way.
 */
export const NETWORK_FIELDS_WITHOUT_COLUMNS = [
  'networkType',
  'alternateIPs',
  'wirelessSSID',
  'wirelessPassword',
  'portConfiguration',
  'trunkingRequired',
  'hostsFileEntry',
];

export const PRINT_FIELDS_WITHOUT_COLUMNS = [
  'authenticationType',
  'driverInstallation',
  'queueSetup',
  'capabilities',
  'userPermissions',
  'defaultSettings',
  'colorManagement',
  'paperSettings',
  'finishingOptions',
];

export function unpersistedFields(input: Record<string, unknown>, known: string[]): string[] {
  return known.filter((field) => {
    const value = input[field];
    if (value === undefined || value === null || value === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (value === false) return false;
    return true;
  });
}
