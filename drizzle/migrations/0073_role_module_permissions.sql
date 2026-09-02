-- Give the seeded roles their module permissions (WF-R-09).
--
-- WHAT THIS FIXES, AND IT IS A LOCKOUT RATHER THAN A GAP. Migration 0072 seeded
-- 45 roles with permissions = '{}' on purpose: the vocabulary was WF-R-03's to
-- settle and authoring 45 permission sets ahead of it would have been inventing
-- authorization. But client/src/lib/navigation-permissions.ts derives every
-- granular permission from the MODULE booleans in that blob and the role's level -
-- `if (modulePermissions.sales) { if (level >= 1) perms.add('sales.lead.view_own') }`
-- and so on - so an empty blob expands to an EMPTY PERMISSION SET at any level.
-- Measured, not assumed: expandLegacyPermissions({}, 7) returns 0 permissions and
-- the all-modules blob at the same level returns 109. A seeded COMPANY_ADMIN on a
-- fresh database therefore saw nothing but the alwaysVisible sidebar sections.
--
-- WF-R-09 closes the /api/me fallback that was papering over this: an account with
-- no role used to receive EVERY module at level 1. With the fallback closed and
-- the blob empty, everybody would see nothing. So the two have to ship together.
--
-- THE RULE, stated because it is a starting point rather than a policy. Level 7
-- and above gets every module - a C-level or a company admin runs the whole
-- company. Below that the modules come from the role's DEPARTMENT:
--   platform, admin  -> every module (they administer a tenant or the platform)
--   sales            -> sales, products, reports
--   service          -> service, products, inventory, reports
--   finance          -> billing, finance, purchasing, reports
--   operations       -> inventory, purchasing, products, reports
--   it, hr           -> system, reports
-- The LEVEL then decides how far each module reaches, which is what
-- expandLegacyPermissions already does: the `system` module gives
-- admin.settings.view at level 3 and admin.user.view at level 4, which is why
-- IT_ADMIN and HR_MANAGER hold it and a sales manager does not.
--
-- IDEMPOTENT, and deliberately narrow: it fills only a blob that is still empty.
-- An operator who has customised a role's permissions keeps them, and re-running
-- the chain changes nothing. That is also why it is an UPDATE rather than part of
-- 0072 - 0072 has shipped, and rewriting an applied migration would not re-run.
UPDATE roles AS r
SET permissions = v.permissions,
    updated_at = NOW()
FROM (VALUES
  ('PLATFORM_ADMIN', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('ROOT_ADMIN', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('PRINTYX_SUPPORT', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('PRINTYX_TECHNICAL', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('COMPANY_ADMIN', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('EXECUTIVE', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('REGIONAL_MANAGER', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('LOCATION_MANAGER', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('SALES_DIRECTOR', '{"sales":true,"service":false,"products":true,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('SALES_MANAGER', '{"sales":true,"service":false,"products":true,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('SALES_SUPERVISOR', '{"sales":true,"service":false,"products":true,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('SENIOR_SALES_REP', '{"sales":true,"service":false,"products":true,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('SALES_REP', '{"sales":true,"service":false,"products":true,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('SERVICE_DIRECTOR', '{"sales":false,"service":true,"products":true,"inventory":true,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('SERVICE_MANAGER', '{"sales":false,"service":true,"products":true,"inventory":true,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('SERVICE_SUPERVISOR', '{"sales":false,"service":true,"products":true,"inventory":true,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('TECHNICIAN', '{"sales":false,"service":true,"products":true,"inventory":true,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('FINANCE_DIRECTOR', '{"sales":false,"service":false,"products":false,"inventory":false,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":false}'::jsonb),
  ('FINANCE_MANAGER', '{"sales":false,"service":false,"products":false,"inventory":false,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":false}'::jsonb),
  ('CEO', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('CFO', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('COO', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('VP_SALES', '{"sales":true,"service":false,"products":true,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('VP_SERVICE', '{"sales":false,"service":true,"products":true,"inventory":true,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('DIRECTOR_OPERATIONS', '{"sales":false,"service":false,"products":true,"inventory":true,"purchasing":true,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('CONTROLLER', '{"sales":false,"service":false,"products":false,"inventory":false,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":false}'::jsonb),
  ('REGIONAL_SALES_DIRECTOR', '{"sales":true,"service":false,"products":true,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('REGIONAL_SERVICE_MANAGER', '{"sales":false,"service":true,"products":true,"inventory":true,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('OPERATIONS_MANAGER', '{"sales":false,"service":false,"products":true,"inventory":true,"purchasing":true,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('BRANCH_MANAGER', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('WAREHOUSE_SUPERVISOR', '{"sales":false,"service":false,"products":true,"inventory":true,"purchasing":true,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('SENIOR_TECHNICIAN', '{"sales":false,"service":true,"products":true,"inventory":true,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('FIELD_TECHNICIAN', '{"sales":false,"service":true,"products":true,"inventory":true,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('WAREHOUSE_ASSOCIATE', '{"sales":false,"service":false,"products":true,"inventory":true,"purchasing":true,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('ACCOUNTING_CLERK', '{"sales":false,"service":false,"products":false,"inventory":false,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":false}'::jsonb),
  ('AREA_MANAGER', '{"sales":true,"service":false,"products":true,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('DISTRICT_MANAGER', '{"sales":true,"service":false,"products":true,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('IT_ADMIN', '{"sales":false,"service":false,"products":false,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":true}'::jsonb),
  ('HR_MANAGER', '{"sales":false,"service":false,"products":false,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":true}'::jsonb),
  ('VP_ADMIN', '{"sales":true,"service":true,"products":true,"inventory":true,"purchasing":true,"billing":true,"finance":true,"reports":true,"system":true}'::jsonb),
  ('ACCOUNT_EXECUTIVE', '{"sales":true,"service":false,"products":true,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('INSIDE_SALES_REP', '{"sales":true,"service":false,"products":true,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('DISPATCH_COORDINATOR', '{"sales":false,"service":true,"products":true,"inventory":true,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('SOLUTIONS_CONSULTANT', '{"sales":true,"service":false,"products":true,"inventory":false,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb),
  ('CSR', '{"sales":false,"service":true,"products":true,"inventory":true,"purchasing":false,"billing":false,"finance":false,"reports":true,"system":false}'::jsonb)
) AS v(code, permissions)
WHERE r.code = v.code
  AND (r.permissions IS NULL OR r.permissions = '{}'::jsonb);
