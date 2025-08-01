import { db } from "./db";
import { roles, users, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

// Define the comprehensive role hierarchy
const ROLE_DEFINITIONS = [
  // Printyx Platform-Level Roles (Level 6+)
  {
    id: "root-admin-role",
    name: "Root Administrator",
    code: "ROOT_ADMIN",
    roleType: "platform_admin" as const,
    department: "platform",
    level: 7,
    description: "Ultimate system access for backend Printyx operations and system setup",
    permissions: {
      platform: ["*"],
      admin: ["*"],
      sales: ["*"],
      service: ["*"],
      finance: ["*"],
      purchasing: ["*"],
      reports: ["*"],
      system: ["*"]
    },
    canAccessAllTenants: true,
    canManageUsers: true,
    canViewSystemMetrics: true,
    isSystemRole: true
  },
  {
    id: "printyx-support-role",
    name: "Printyx Support Specialist",
    code: "PRINTYX_SUPPORT",
    roleType: "platform_admin" as const,
    department: "platform",
    level: 6,
    description: "Customer troubleshooting and support access across all tenant companies",
    permissions: {
      platform: ["read", "support"],
      admin: ["read"],
      sales: ["read"],
      service: ["read", "write"],
      finance: ["read"],
      purchasing: ["read"],
      reports: ["read"],
      system: ["read"]
    },
    canAccessAllTenants: true,
    canManageUsers: false,
    canViewSystemMetrics: true,
    isSystemRole: true
  },
  {
    id: "printyx-technical-role",
    name: "Printyx Technical Specialist",
    code: "PRINTYX_TECHNICAL",
    roleType: "platform_admin" as const,
    department: "platform",
    level: 6,
    description: "System diagnostics and technical troubleshooting across tenant environments",
    permissions: {
      platform: ["read", "diagnose"],
      admin: ["read"],
      sales: ["read"],
      service: ["read", "write", "diagnose"],
      finance: ["read"],
      purchasing: ["read"],
      reports: ["read"],
      system: ["read", "diagnose"]
    },
    canAccessAllTenants: true,
    canManageUsers: false,
    canViewSystemMetrics: true,
    isSystemRole: true
  },

  // Company Tenant Admin Roles (Level 5)
  {
    id: "company-admin-role",
    name: "Company Administrator",
    code: "COMPANY_ADMIN",
    roleType: "company_admin" as const,
    department: "admin",
    level: 5,
    description: "High-level company management with full access to company tenant features",
    permissions: {
      admin: ["*"],
      sales: ["*"],
      service: ["*"],
      finance: ["*"],
      purchasing: ["*"],
      reports: ["*"]
    },
    canAccessAllTenants: false,
    canManageUsers: true,
    canViewSystemMetrics: false,
    isSystemRole: true
  },

  // Department-Level Roles (Level 1-4)
  // Sales Department
  {
    id: "sales-director-role",
    name: "Sales Director",
    code: "SALES_DIRECTOR",
    roleType: "department_role" as const,
    department: "sales",
    level: 4,
    description: "Sales department leadership with full sales and pricing authority",
    permissions: {
      sales: ["*"],
      finance: ["read", "pricing"],
      reports: ["read", "sales"],
      admin: ["read"]
    },
    canAccessAllTenants: false,
    canManageUsers: true,
    canViewSystemMetrics: false,
    isSystemRole: true
  },
  {
    id: "sales-manager-role",
    name: "Sales Manager",
    code: "SALES_MANAGER",
    roleType: "department_role" as const,
    department: "sales",
    level: 3,
    description: "Sales team management with pricing approval authority",
    permissions: {
      sales: ["read", "write", "approve_pricing"],
      finance: ["read"],
      reports: ["read", "sales"],
      admin: ["read"]
    },
    canAccessAllTenants: false,
    canManageUsers: false,
    canViewSystemMetrics: false,
    isSystemRole: true
  },
  {
    id: "sales-rep-role",
    name: "Sales Representative",
    code: "SALES_REP",
    roleType: "department_role" as const,
    department: "sales",
    level: 1,
    description: "Individual sales representative with limited pricing authority (requires approval)",
    permissions: {
      sales: ["read", "write", "request_pricing"],
      finance: ["read_limited"],
      reports: ["read", "sales_limited"],
      admin: ["read_limited"]
    },
    canAccessAllTenants: false,
    canManageUsers: false,
    canViewSystemMetrics: false,
    isSystemRole: true
  },

  // Service Department
  {
    id: "service-director-role",
    name: "Service Director",
    code: "SERVICE_DIRECTOR",
    roleType: "department_role" as const,
    department: "service",
    level: 4,
    description: "Service department leadership with full service operations authority",
    permissions: {
      service: ["*"],
      finance: ["read"],
      reports: ["read", "service"],
      admin: ["read"]
    },
    canAccessAllTenants: false,
    canManageUsers: true,
    canViewSystemMetrics: false,
    isSystemRole: true
  },
  {
    id: "service-manager-role",
    name: "Service Manager",
    code: "SERVICE_MANAGER",
    roleType: "department_role" as const,
    department: "service",
    level: 3,
    description: "Service team management with technician scheduling authority",
    permissions: {
      service: ["read", "write", "schedule"],
      finance: ["read"],
      reports: ["read", "service"],
      admin: ["read"]
    },
    canAccessAllTenants: false,
    canManageUsers: false,
    canViewSystemMetrics: false,
    isSystemRole: true
  },
  {
    id: "service-tech-role",
    name: "Service Technician",
    code: "SERVICE_TECH",
    roleType: "department_role" as const,
    department: "service",
    level: 1,
    description: "Field service technician with work order and maintenance access",
    permissions: {
      service: ["read", "write", "field_access"],
      finance: ["read_limited"],
      reports: ["read", "service_limited"],
      admin: ["read_limited"]
    },
    canAccessAllTenants: false,
    canManageUsers: false,
    canViewSystemMetrics: false,
    isSystemRole: true
  },

  // Finance Department
  {
    id: "finance-director-role",
    name: "Finance Director",
    code: "FINANCE_DIRECTOR",
    roleType: "department_role" as const,
    department: "finance",
    level: 4,
    description: "Financial operations leadership with full accounting authority",
    permissions: {
      finance: ["*"],
      sales: ["read", "pricing"],
      service: ["read"],
      reports: ["read", "finance"],
      admin: ["read"]
    },
    canAccessAllTenants: false,
    canManageUsers: true,
    canViewSystemMetrics: false,
    isSystemRole: true
  },
  {
    id: "finance-manager-role",
    name: "Finance Manager",
    code: "FINANCE_MANAGER",
    roleType: "department_role" as const,
    department: "finance",
    level: 3,
    description: "Financial management with billing and accounts authority",
    permissions: {
      finance: ["read", "write", "billing"],
      sales: ["read"],
      service: ["read"],
      reports: ["read", "finance"],
      admin: ["read"]
    },
    canAccessAllTenants: false,
    canManageUsers: false,
    canViewSystemMetrics: false,
    isSystemRole: true
  }
];

export async function seedRoles() {
  console.log("Seeding role hierarchy...");
  
  // Create/update all role definitions
  for (const roleDef of ROLE_DEFINITIONS) {
    try {
      // Check if role already exists
      const existingRole = await db.select().from(roles).where(eq(roles.code, roleDef.code)).limit(1);
      
      if (existingRole.length === 0) {
        // Create new role
        await db.insert(roles).values({
          id: roleDef.id,
          name: roleDef.name,
          code: roleDef.code,
          roleType: roleDef.roleType,
          department: roleDef.department,
          level: roleDef.level,
          description: roleDef.description,
          permissions: roleDef.permissions,
          canAccessAllTenants: roleDef.canAccessAllTenants,
          canManageUsers: roleDef.canManageUsers,
          canViewSystemMetrics: roleDef.canViewSystemMetrics,
          isSystemRole: roleDef.isSystemRole
        });
        console.log(`✓ Created role: ${roleDef.name}`);
      } else {
        // Update existing role
        await db.update(roles)
          .set({
            name: roleDef.name,
            roleType: roleDef.roleType,
            department: roleDef.department,
            level: roleDef.level,
            description: roleDef.description,
            permissions: roleDef.permissions,
            canAccessAllTenants: roleDef.canAccessAllTenants,
            canManageUsers: roleDef.canManageUsers,
            canViewSystemMetrics: roleDef.canViewSystemMetrics,
            isSystemRole: roleDef.isSystemRole
          })
          .where(eq(roles.code, roleDef.code));
        console.log(`✓ Updated role: ${roleDef.name}`);
      }
    } catch (error) {
      console.error(`Error seeding role ${roleDef.name}:`, error);
    }
  }
}

export async function createDemoTenant() {
  console.log("Creating demo tenant...");
  
  const demoTenantId = "550e8400-e29b-41d4-a716-446655440000";
  
  // Check if demo tenant exists
  const existingTenant = await db.select().from(tenants).where(eq(tenants.id, demoTenantId)).limit(1);
  
  if (existingTenant.length === 0) {
    await db.insert(tenants).values({
      id: demoTenantId,
      name: "Demo Copier Company",
      domain: "demo.printyx.com"
    });
    console.log("✓ Created demo tenant");
  }
  
  return demoTenantId;
}

export async function seedDemoUsers(tenantId: string) {
  console.log("Seeding demo users with new role hierarchy...");
  
  const demoUsers = [
    // Printyx Platform Users (no tenantId)
    {
      id: "58c36f26-c458-400b-8055-5dfa31afa88a",
      email: "Pearsonperformance@gmail.com",
      firstName: "Root",
      lastName: "Admin",
      password: "Infomax1!",
      roleCode: "ROOT_ADMIN",
      tenantId: null,
      isPlatformUser: true
    },
    {
      id: "platform-support-1",
      email: "support@printyx.com",
      firstName: "Sarah",
      lastName: "Support",
      password: "PrintyxSupport123!",
      roleCode: "PRINTYX_SUPPORT",
      tenantId: null,
      isPlatformUser: true
    },
    {
      id: "platform-tech-1",
      email: "tech@printyx.com",
      firstName: "Marcus",
      lastName: "Technical",
      password: "PrintyxTech123!",
      roleCode: "PRINTYX_TECHNICAL",
      tenantId: null,
      isPlatformUser: true
    },
    
    // Company Tenant Users
    {
      id: "company-admin-1",
      email: "admin@democopier.com",
      firstName: "Jennifer",
      lastName: "Administrator",
      password: "CompanyAdmin123!",
      roleCode: "COMPANY_ADMIN",
      tenantId: tenantId,
      isPlatformUser: false
    },
    {
      id: "sales-director-1",
      email: "sales.director@democopier.com",
      firstName: "Michael",
      lastName: "SalesDirector",
      password: "SalesDir123!",
      roleCode: "SALES_DIRECTOR",
      tenantId: tenantId,
      isPlatformUser: false
    },
    {
      id: "sales-manager-1",
      email: "sales.manager@democopier.com",
      firstName: "Lisa",
      lastName: "SalesManager",
      password: "SalesMgr123!",
      roleCode: "SALES_MANAGER",
      tenantId: tenantId,
      isPlatformUser: false
    },
    {
      id: "sales-rep-1",
      email: "sales.rep@democopier.com",
      firstName: "David",
      lastName: "SalesRep",
      password: "SalesRep123!",
      roleCode: "SALES_REP",
      tenantId: tenantId,
      isPlatformUser: false
    },
    {
      id: "service-director-1",
      email: "service.director@democopier.com",
      firstName: "Patricia",
      lastName: "ServiceDirector",
      password: "ServiceDir123!",
      roleCode: "SERVICE_DIRECTOR",
      tenantId: tenantId,
      isPlatformUser: false
    },
    {
      id: "service-tech-1",
      email: "service.tech@democopier.com",
      firstName: "Robert",
      lastName: "ServiceTech",
      password: "ServiceTech123!",
      roleCode: "SERVICE_TECH",
      tenantId: tenantId,
      isPlatformUser: false
    },
    {
      id: "finance-director-1",
      email: "finance.director@democopier.com",
      firstName: "Karen",
      lastName: "FinanceDirector",
      password: "FinanceDir123!",
      roleCode: "FINANCE_DIRECTOR",
      tenantId: tenantId,
      isPlatformUser: false
    }
  ];

  for (const userData of demoUsers) {
    try {
      // Get role ID
      const roleResult = await db.select().from(roles).where(eq(roles.code, userData.roleCode)).limit(1);
      if (roleResult.length === 0) {
        console.error(`Role not found: ${userData.roleCode}`);
        continue;
      }
      const roleId = roleResult[0].id;

      // Check if user exists
      const existingUser = await db.select().from(users).where(eq(users.email, userData.email)).limit(1);
      
      if (existingUser.length === 0) {
        // Hash password
        const passwordHash = await bcrypt.hash(userData.password, 10);
        
        // Create user
        await db.insert(users).values({
          id: userData.id,
          tenantId: userData.tenantId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          passwordHash: passwordHash,
          roleId: roleId,
          isPlatformUser: userData.isPlatformUser,
          isActive: true
        });
        console.log(`✓ Created user: ${userData.email} (${userData.roleCode})`);
      } else {
        // Update existing user's role
        await db.update(users)
          .set({
            roleId: roleId,
            isPlatformUser: userData.isPlatformUser
          })
          .where(eq(users.email, userData.email));
        console.log(`✓ Updated user: ${userData.email} (${userData.roleCode})`);
      }
    } catch (error) {
      console.error(`Error creating user ${userData.email}:`, error);
    }
  }
}

export async function initializeRoleHierarchy() {
  console.log("Initializing comprehensive role hierarchy...");
  
  try {
    // Step 1: Seed all roles
    await seedRoles();
    
    // Step 2: Create demo tenant
    const tenantId = await createDemoTenant();
    
    // Step 3: Seed demo users with new hierarchy
    await seedDemoUsers(tenantId);
    
    console.log("✓ Role hierarchy initialization complete!");
    console.log("\nRole Hierarchy Summary:");
    console.log("├── Printyx Platform Roles (Level 6-7)");
    console.log("│   ├── Root Administrator (Level 7) - Backend system control");
    console.log("│   ├── Printyx Support Specialist (Level 6) - Customer troubleshooting");
    console.log("│   └── Printyx Technical Specialist (Level 6) - System diagnostics");
    console.log("├── Company Admin Roles (Level 5)");
    console.log("│   └── Company Administrator - High-level company management");
    console.log("└── Department Roles (Level 1-4)");
    console.log("    ├── Sales: Director (4) → Manager (3) → Representative (1)");
    console.log("    ├── Service: Director (4) → Manager (3) → Technician (1)");
    console.log("    └── Finance: Director (4) → Manager (3)");
    
    console.log("\nPricing Permission Hierarchy:");
    console.log("├── Sales Director/Finance Director: Full pricing authority");
    console.log("├── Sales Manager: Pricing approval authority");
    console.log("└── Sales Rep: Request pricing approval (manual overrides)");
    
  } catch (error) {
    console.error("Error initializing role hierarchy:", error);
    throw error;
  }
}