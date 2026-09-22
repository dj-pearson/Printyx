/**
 * The role structure a new tenant starts with, and why none of it ever landed.
 *
 * ROLE MANAGEMENT HAS NEVER BEEN INITIALIZABLE, ON EITHER HOST (round 127).
 * `GET /rbac/status` gates the whole page on `enhanced_roles` holding a row
 * for the tenant, and the only thing that would create one is
 * `POST /rbac/seed` - which 501s on the edge function ("not ported yet, dev
 * can still run it through Express in the meantime") and, on Express, dies on
 * its FIRST statement. Three independent reasons, each sufficient:
 *
 *   1. NOT NULL COLUMNS IT NEVER SUPPLIED. `organizational_units` and
 *      `enhanced_roles` both declare `lft`, `rght` and `depth` NOT NULL with
 *      no default - they are a nested set, and both read paths here
 *      `.order('lft')` - and `enhanced_roles` adds `organizational_tier` and
 *      `created_by`. The insert named none of them: 23502 before anything
 *      else could go wrong.
 *
 *   2. EVERY ENUM VALUE WAS OUTSIDE ITS ENUM. It wrote `hierarchy_level`
 *      'COMPANY'/'REGIONAL'/'LOCATION'/'DEPARTMENT'/'INDIVIDUAL', and
 *      `role_hierarchy_level` is level_1..level_8; it wrote `unit_type`
 *      'COMPANY', and `organizational_tier` is platform|company|regional|
 *      location. Every one is a 22P02 - migration 0072's defect (round 89) in
 *      handler code, where `check:migration-enums` cannot see it.
 *
 *   3. FOUR OF ITS TEN ROLE CODES ARE IN NO CATALOGUE. OWNER, MANAGER,
 *      SERVICE_TECH and ADMIN_ASSISTANT appear in migration 0072's 45-role
 *      catalogue nowhere, so even a working insert would have created a third
 *      role vocabulary beside `roles` and `enhanced_roles`.
 *
 * So the edge function's 501 pointed at a fallback nobody had run, and the
 * setup prompt on Role Management has been a dead button for every tenant
 * since it shipped - which matters more since LAUNCH-008 (round 116) made
 * self-service signup actually provision a tenant.
 *
 * WHAT THIS MODULE DOES DIFFERENTLY, and each rule is why a number here is
 * derived rather than chosen:
 *
 * THE CATALOGUE DECIDES THE LEVEL. Every template code must exist in
 * migration 0072, and `hierarchy_level` is `level_${catalogue level}`. A code
 * the catalogue does not carry is REFUSED rather than given a level somebody
 * picked (COP-B00) - a seeded role's level is what every gate in the product
 * compares against, so inventing one hands out access nobody granted.
 *
 * THE TIER COMES FROM THE ROLE TYPE, not from a parallel list: 0072 already
 * records each code as company_admin / regional_manager / location_manager /
 * department_role, and `organizational_tier` is company|regional|location. A
 * department role sits at the location tier, because a department is not a
 * tier in this model and there is nowhere else for it to be.
 *
 * THE NESTED SET IS COMPUTED, not omitted. Roles nest by catalogue level: the
 * highest is the root and each subsequent role hangs off the nearest
 * preceding role above it. That is a derivation from data the template
 * already carries, so `.order('lft')` renders the hierarchy the two read
 * branches promise rather than an arbitrary order over nulls.
 */

export type RbacRoleTemplate = {
  code: string;
  name: string;
  description: string;
  department: string;
};

/**
 * Codes only - the level, tier and hierarchy come from the catalogue, so a
 * template cannot disagree with it.
 */
export const RBAC_SEED_TEMPLATES: Record<string, RbacRoleTemplate[]> = {
  standard: [
    {
      code: 'COMPANY_ADMIN',
      name: 'Company Administrator',
      description: 'Company administrator with full access',
      department: 'administration',
    },
    {
      code: 'REGIONAL_MANAGER',
      name: 'Regional Manager',
      description: 'Regional operations manager',
      department: 'administration',
    },
    {
      code: 'LOCATION_MANAGER',
      name: 'Location Manager',
      description: 'Location manager',
      department: 'administration',
    },
    {
      code: 'SALES_MANAGER',
      name: 'Sales Manager',
      description: 'Sales team manager',
      department: 'sales',
    },
    {
      code: 'SERVICE_MANAGER',
      name: 'Service Manager',
      description: 'Service team manager',
      department: 'service',
    },
    {
      code: 'SALES_REP',
      name: 'Sales Representative',
      description: 'Sales representative',
      department: 'sales',
    },
    {
      code: 'TECHNICIAN',
      name: 'Service Technician',
      description: 'Service technician',
      department: 'service',
    },
  ],
  small: [
    {
      code: 'COMPANY_ADMIN',
      name: 'Owner',
      description: 'Business owner with full access',
      department: 'administration',
    },
    {
      code: 'LOCATION_MANAGER',
      name: 'Manager',
      description: 'General manager',
      department: 'administration',
    },
    {
      code: 'SALES_REP',
      name: 'Sales Representative',
      description: 'Sales representative',
      department: 'sales',
    },
    {
      code: 'TECHNICIAN',
      name: 'Service Technician',
      description: 'Service technician',
      department: 'service',
    },
  ],
};

export const RBAC_SEED_DEALER_TYPES = Object.keys(RBAC_SEED_TEMPLATES);

/** `roles.role_type` -> the organizational tier a role of that type sits at. */
const TIER_BY_ROLE_TYPE: Record<string, string> = {
  platform_admin: 'platform',
  company_admin: 'company',
  regional_manager: 'regional',
  location_manager: 'location',
  // A department is not a tier in this model; a department role works at a
  // location, which is the narrowest tier that exists.
  department_role: 'location',
};

/** One row of migration 0072's catalogue, as the caller read it back. */
export type CatalogueRole = { code: string; level: number; role_type: string };

export type SeedUnitRow = Record<string, unknown>;
export type SeedRoleRow = Record<string, unknown>;

export type RbacSeedPlan = {
  unit: SeedUnitRow;
  roles: SeedRoleRow[];
  assignment: Record<string, unknown>;
  /** The role the caller is given - the top of the tree. */
  primaryRoleId: string;
  error?: string;
};

const HIERARCHY_LEVELS = new Set([
  'level_1',
  'level_2',
  'level_3',
  'level_4',
  'level_5',
  'level_6',
  'level_7',
  'level_8',
]);

/**
 * Build every row a seed writes, or refuse with a reason.
 *
 * `catalogue` is the subset of `roles` whose codes this template names, read
 * by the caller. A code missing from it is a refusal, not a default.
 */
export function buildRbacSeedPlan(options: {
  tenantId: string;
  userId: string;
  dealerType: string;
  catalogue: CatalogueRole[];
  now?: Date;
}): RbacSeedPlan {
  const { tenantId, userId, catalogue } = options;
  const now = options.now ?? new Date();
  const empty: RbacSeedPlan = { unit: {}, roles: [], assignment: {}, primaryRoleId: '' };

  const templates = RBAC_SEED_TEMPLATES[options.dealerType];
  if (!templates) {
    return { ...empty, error: `Unknown dealer type: ${options.dealerType}` };
  }

  const byCode = new Map(catalogue.map((row) => [row.code, row]));
  const missing = templates.filter((t) => !byCode.has(t.code)).map((t) => t.code);
  if (missing.length > 0) {
    return {
      ...empty,
      error: `Role catalogue is missing ${missing.join(', ')} - apply the migration chain and retry`,
    };
  }

  // Highest catalogue level first, so the tree has one root and each role
  // hangs off the nearest preceding role above it.
  const ordered = [...templates].sort(
    (a, b) => (byCode.get(b.code)!.level ?? 0) - (byCode.get(a.code)!.level ?? 0),
  );

  const iso = now.toISOString();
  const unitId = `company-${tenantId}`;
  const unit: SeedUnitRow = {
    id: unitId,
    tenant_id: tenantId,
    name: 'Company',
    code: 'COMPANY',
    unit_type: 'company',
    description: 'Main company unit',
    lft: 1,
    rght: 2,
    depth: 0,
    is_active: true,
    created_at: iso,
    updated_at: iso,
  };

  // Nested set over the role tree: pre-order, assigning lft on the way down
  // and rght on the way back up.
  type Node = { template: RbacRoleTemplate; level: number; children: Node[] };
  const roots: Node[] = [];
  const stack: Node[] = [];
  for (const template of ordered) {
    const level = byCode.get(template.code)!.level ?? 0;
    const node: Node = { template, level, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level <= level) stack.pop();
    if (stack.length === 0) roots.push(node);
    else stack[stack.length - 1].children.push(node);
    stack.push(node);
  }

  const roles: SeedRoleRow[] = [];
  let counter = 1;
  const walk = (node: Node, depth: number, parentId: string | null) => {
    const lft = counter++;
    const id = `${node.template.code.toLowerCase().replace(/_/g, '-')}-${tenantId}`;
    const catalogueRow = byCode.get(node.template.code)!;
    const hierarchy = `level_${catalogueRow.level}`;
    const row: SeedRoleRow = {
      id,
      tenant_id: tenantId,
      organizational_unit_id: unitId,
      name: node.template.name,
      code: node.template.code,
      description: node.template.description,
      hierarchy_level: HIERARCHY_LEVELS.has(hierarchy) ? hierarchy : 'level_1',
      organizational_tier: TIER_BY_ROLE_TYPE[catalogueRow.role_type] ?? 'location',
      parent_role_id: parentId,
      department: node.template.department,
      lft,
      depth,
      created_by: userId,
      created_at: iso,
      updated_at: iso,
    };
    roles.push(row);
    for (const child of node.children) walk(child, depth + 1, id);
    // rght is only known once every descendant has taken its bounds.
    row.rght = counter++;
  };
  for (const root of roots) walk(root, 0, null);

  const primaryRoleId = roles[0]?.id as string;

  return {
    unit,
    roles,
    assignment: {
      id: `assignment-${userId}-${now.getTime()}`,
      user_id: userId,
      role_id: primaryRoleId,
      tenant_id: tenantId,
      organizational_unit_id: unitId,
      assigned_by: userId,
      is_active: true,
      created_at: iso,
      updated_at: iso,
    },
    primaryRoleId,
  };
}
