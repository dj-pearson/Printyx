-- Roles for the middle of the workflow (WF-R-11).
--
-- The catalogue migration 0072 seeds 45 roles and covers sales, service,
-- finance, warehouse and administration. It has nothing for a buyer, a project
-- coordinator, a delivery and install crew, or a network setup technician - the
-- people between "the deal closed" and "the machine prints". Seven roles, in the
-- same shape as 0072 and idempotent for the same reason.
--
-- THE PERMISSIONS BLOB IS FILLED HERE, not left to 0073. That migration only
-- touches a blob that is still empty and it has already shipped, so a role
-- seeded after it would keep an empty blob forever - and per WF-R-09 an empty
-- blob expands to an EMPTY PERMISSION SET at any level, which is a lockout
-- rather than a gap. The module sets follow 0073's own rule, with purchasing
-- treated as its own department rather than folded into operations.
--
-- NO NEW PERMISSION CODES. client/src/lib/navigation-permissions.ts derives every
-- granular code from the MODULE booleans in this blob plus the role's level;
-- there is no table of codes to add to. Inventing one would reproduce
-- SEC-EDGE-002 - 77 route gates already name codes no seeder creates, so they
-- deny everyone below platform admin - and that file says so at its /handoffs
-- entry, which was written waiting for exactly these roles.
--
-- LEVELS. The two manager roles sit at 4 because that is where
-- expandLegacyPermissions grants operations.po.approve and
-- operations.inventory.manage. DELIVERY_INSTALL_SUPERVISOR is 3, the service
-- supervisor rung. The three individual contributors are 1 and 2.

INSERT INTO roles (name, code, role_type, department, level, description, permissions, can_access_all_tenants, can_view_system_metrics, can_access_all_locations, can_manage_company_users, can_create_locations, can_view_company_financials, can_manage_regional_users, can_view_regional_reports, can_approve_regional_deals, can_manage_location_users, can_view_location_reports, can_approve_location_deals)
VALUES
  ('Purchasing Agent', 'PURCHASING_AGENT', 'department_role', 'purchasing', 1,
   'Purchasing Agent - raises purchase orders and chases supplier delivery',
   '{"purchasing":true,"inventory":true,"products":true,"reports":true}'::jsonb,
   false, false, false, false, false, false, false, false, false, false, false, false),

  ('Purchasing Manager', 'PURCHASING_MANAGER', 'department_role', 'purchasing', 4,
   'Purchasing Manager - approves purchase orders and owns supplier relationships',
   '{"purchasing":true,"inventory":true,"products":true,"reports":true}'::jsonb,
   false, false, false, false, false, false, false, false, false, false, true, true),

  ('Project Coordinator', 'PROJECT_COORDINATOR', 'department_role', 'operations', 2,
   'Project Coordinator - schedules installs and tracks a handoff to completion',
   '{"service":true,"inventory":true,"products":true,"reports":true}'::jsonb,
   false, false, false, false, false, false, false, false, false, false, false, false),

  ('Project Manager', 'PROJECT_MANAGER', 'department_role', 'operations', 4,
   'Project Manager - owns delivery of a sold configuration end to end',
   '{"service":true,"inventory":true,"purchasing":true,"products":true,"reports":true}'::jsonb,
   false, false, false, false, false, false, false, false, false, false, true, true),

  ('Delivery & Installation Technician', 'DELIVERY_INSTALL_TECH', 'department_role', 'service', 1,
   'Delivery and Installation Technician - places and commissions equipment on site',
   '{"service":true,"inventory":true,"products":true}'::jsonb,
   false, false, false, false, false, false, false, false, false, false, false, false),

  ('Delivery & Installation Supervisor', 'DELIVERY_INSTALL_SUPERVISOR', 'department_role', 'service', 3,
   'Delivery and Installation Supervisor - schedules crews and signs off installs',
   '{"service":true,"inventory":true,"products":true,"reports":true}'::jsonb,
   false, false, false, false, false, false, false, false, false, false, true, false),

  ('Network Setup Technician', 'NETWORK_SETUP_TECH', 'department_role', 'service', 2,
   'Network Setup Technician - connects equipment to the customer network and print queues',
   '{"service":true,"products":true}'::jsonb,
   false, false, false, false, false, false, false, false, false, false, false, false)
ON CONFLICT (code) DO NOTHING;
