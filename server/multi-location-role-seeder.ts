import { db } from "./db";
import { roles } from "@shared/schema";

// Comprehensive multi-location role definitions for 1000+ employee scaling
const multiLocationRoles = [
  // Level 8: Platform Admin
  {
    name: "Root Admin",
    code: "ROOT_ADMIN",
    roleType: "platform_admin" as const,
    department: "platform",
    level: 8,
    description: "Printyx system administrator with full platform access",
    permissions: {
      modules: ["all"],
      actions: ["all"]
    },
    canAccessAllTenants: true,
    canViewSystemMetrics: true,
    canAccessAuditLogs: true,
    canManageIntegrations: true,
    isSystemRole: true
  },
  {
    name: "Platform Support",
    code: "PLATFORM_SUPPORT",
    roleType: "platform_admin" as const,
    department: "platform",
    level: 8,
    description: "Printyx customer support with tenant access",
    permissions: {
      modules: ["all"],
      actions: ["read", "support"]
    },
    canAccessAllTenants: true,
    canViewSystemMetrics: true,
    isSystemRole: true
  },

  // Level 7: Company Admin (C-Level)
  {
    name: "CEO",
    code: "CEO",
    roleType: "company_admin" as const,
    department: "executive",
    level: 7,
    description: "Chief Executive Officer with full company access",
    permissions: {
      modules: ["all"],
      actions: ["all"]
    },
    canAccessAllLocations: true,
    canManageCompanyUsers: true,
    canCreateLocations: true,
    canViewCompanyFinancials: true,
    canAccessAuditLogs: true,
    isSystemRole: true
  },
  {
    name: "President",
    code: "PRESIDENT",
    roleType: "company_admin" as const,
    department: "executive",
    level: 7,
    description: "Company President with full operational access",
    permissions: {
      modules: ["all"],
      actions: ["all"]
    },
    canAccessAllLocations: true,
    canManageCompanyUsers: true,
    canCreateLocations: true,
    canViewCompanyFinancials: true,
    isSystemRole: true
  },
  {
    name: "COO",
    code: "COO",
    roleType: "company_admin" as const,
    department: "operations",
    level: 7,
    description: "Chief Operating Officer with operational oversight",
    permissions: {
      modules: ["operations", "service", "inventory", "reports"],
      actions: ["all"]
    },
    canAccessAllLocations: true,
    canManageCompanyUsers: true,
    canViewCompanyFinancials: true,
    isSystemRole: true
  },
  {
    name: "CFO",
    code: "CFO",
    roleType: "company_admin" as const,
    department: "finance",
    level: 7,
    description: "Chief Financial Officer with financial oversight",
    permissions: {
      modules: ["finance", "billing", "contracts", "reports"],
      actions: ["all"]
    },
    canAccessAllLocations: true,
    canManageCompanyUsers: true,
    canViewCompanyFinancials: true,
    isSystemRole: true
  },

  // Level 6: Company Directors
  {
    name: "VP Sales",
    code: "VP_SALES",
    roleType: "company_admin" as const,
    department: "sales",
    level: 6,
    description: "Vice President of Sales with company-wide sales oversight",
    permissions: {
      modules: ["sales", "crm", "leads", "customers", "contracts", "reports"],
      actions: ["all"]
    },
    canAccessAllLocations: true,
    canManageCompanyUsers: true,
    canViewCompanyFinancials: true
  },
  {
    name: "VP Service",
    code: "VP_SERVICE",
    roleType: "company_admin" as const,
    department: "service",
    level: 6,
    description: "Vice President of Service with company-wide service oversight",
    permissions: {
      modules: ["service", "dispatch", "technicians", "parts", "reports"],
      actions: ["all"]
    },
    canAccessAllLocations: true,
    canManageCompanyUsers: true
  },
  {
    name: "Compliance Officer",
    code: "COMPLIANCE_OFFICER",
    roleType: "company_admin" as const,
    department: "compliance",
    level: 6,
    description: "Company-wide compliance monitoring and audit coordination",
    permissions: {
      modules: ["compliance", "audit", "reports", "users"],
      actions: ["read", "audit", "report"]
    },
    canAccessAllLocations: true,
    canManageCompliance: true,
    canAccessAuditLogs: true
  },
  {
    name: "IT Administrator",
    code: "IT_ADMIN",
    roleType: "company_admin" as const,
    department: "it",
    level: 6,
    description: "Technical systems management across all locations",
    permissions: {
      modules: ["system", "integrations", "users", "security"],
      actions: ["all"]
    },
    canAccessAllLocations: true,
    canManageIT: true,
    canManageIntegrations: true,
    canAccessAuditLogs: true
  },
  {
    name: "HR Director",
    code: "HR_DIRECTOR",
    roleType: "company_admin" as const,
    department: "hr",
    level: 6,
    description: "Human resources policies and management company-wide",
    permissions: {
      modules: ["hr", "users", "training", "compliance", "reports"],
      actions: ["all"]
    },
    canAccessAllLocations: true,
    canManageCompanyUsers: true,
    canManageHR: true,
    canManageTraining: true
  },

  // Level 6: Regional Managers
  {
    name: "Regional Sales Manager",
    code: "REGIONAL_SALES_MGR",
    roleType: "regional_manager" as const,
    department: "sales",
    level: 6,
    description: "Regional sales management and oversight",
    permissions: {
      modules: ["sales", "crm", "leads", "customers", "reports"],
      actions: ["manage", "approve_regional"]
    },
    canManageRegionalUsers: true,
    canViewRegionalReports: true,
    canApproveRegionalDeals: true
  },
  {
    name: "Regional Service Manager",
    code: "REGIONAL_SERVICE_MGR",
    roleType: "regional_manager" as const,
    department: "service",
    level: 6,
    description: "Regional service operations and technician oversight",
    permissions: {
      modules: ["service", "dispatch", "technicians", "parts", "reports"],
      actions: ["manage", "approve_regional"]
    },
    canManageRegionalUsers: true,
    canViewRegionalReports: true
  },

  // Level 5: Regional Directors and Location Managers
  {
    name: "Regional Training Manager",
    code: "REGIONAL_TRAINING_MGR",
    roleType: "regional_manager" as const,
    department: "training",
    level: 5,
    description: "Training programs across multiple regions",
    permissions: {
      modules: ["training", "users", "reports"],
      actions: ["manage", "train"]
    },
    canViewRegionalReports: true,
    canManageTraining: true
  },
  {
    name: "Regional HR Manager",
    code: "REGIONAL_HR_MGR",
    roleType: "regional_manager" as const,
    department: "hr",
    level: 5,
    description: "HR support and coordination for regional locations",
    permissions: {
      modules: ["hr", "users", "training", "reports"],
      actions: ["manage", "support"]
    },
    canManageRegionalUsers: true,
    canViewRegionalReports: true,
    canManageHR: true
  },
  {
    name: "Regional QA Manager",
    code: "REGIONAL_QA_MGR",
    roleType: "regional_manager" as const,
    department: "quality",
    level: 5,
    description: "Quality assurance and process improvement across regions",
    permissions: {
      modules: ["quality", "service", "reports", "compliance"],
      actions: ["audit", "improve", "report"]
    },
    canViewRegionalReports: true,
    canManageQuality: true
  },
  {
    name: "Location Manager",
    code: "LOCATION_MGR",
    roleType: "location_manager" as const,
    department: "admin",
    level: 5,
    description: "Branch manager with full location oversight",
    permissions: {
      modules: ["all"],
      actions: ["manage_location"]
    },
    canManageLocationUsers: true,
    canViewLocationReports: true,
    canApproveLocationDeals: true
  },

  // Level 4: Department Managers (Location-Specific)
  {
    name: "Sales Manager",
    code: "SALES_MGR",
    roleType: "location_manager" as const,
    department: "sales",
    level: 4,
    description: "Location sales team management",
    permissions: {
      modules: ["sales", "crm", "leads", "customers"],
      actions: ["manage", "approve_location"]
    },
    canManageLocationUsers: true,
    canViewLocationReports: true,
    canApproveLocationDeals: true
  },
  {
    name: "Service Manager",
    code: "SERVICE_MGR",
    roleType: "location_manager" as const,
    department: "service",
    level: 4,
    description: "Location service operations management",
    permissions: {
      modules: ["service", "dispatch", "technicians", "parts"],
      actions: ["manage", "approve_location"]
    },
    canManageLocationUsers: true,
    canViewLocationReports: true
  },
  {
    name: "Business Analyst",
    code: "BUSINESS_ANALYST",
    roleType: "department_role" as const,
    department: "admin",
    level: 4,
    description: "Data analysis and reporting for location performance",
    permissions: {
      modules: ["reports", "analytics", "dashboard"],
      actions: ["analyze", "report"]
    },
    canViewLocationReports: true,
    canViewAnalytics: true
  },
  {
    name: "Location Training Coordinator",
    code: "LOC_TRAINING_COORD",
    roleType: "department_role" as const,
    department: "training",
    level: 4,
    description: "Training delivery and coordination at location level",
    permissions: {
      modules: ["training", "users"],
      actions: ["train", "coordinate"]
    },
    canManageTraining: true
  },
  {
    name: "Location IT Specialist",
    code: "LOC_IT_SPECIALIST",
    roleType: "department_role" as const,
    department: "it",
    level: 4,
    description: "Technical support and system maintenance for location",
    permissions: {
      modules: ["system", "integrations", "support"],
      actions: ["support", "maintain"]
    },
    canManageIT: true
  },

  // Level 3: Supervisors/Team Leads
  {
    name: "Senior Sales Rep",
    code: "SR_SALES_REP",
    roleType: "department_role" as const,
    department: "sales",
    level: 3,
    description: "Senior sales representative with team leadership",
    permissions: {
      modules: ["sales", "crm", "leads", "customers"],
      actions: ["sell", "lead_team"]
    }
  },
  {
    name: "Lead Technician",
    code: "LEAD_TECH",
    roleType: "department_role" as const,
    department: "service",
    level: 3,
    description: "Lead service technician with team oversight",
    permissions: {
      modules: ["service", "dispatch", "parts"],
      actions: ["service", "lead_team"]
    }
  },
  {
    name: "Installation Supervisor",
    code: "INSTALL_SUPERVISOR",
    roleType: "department_role" as const,
    department: "service",
    level: 3,
    description: "Oversee equipment installations and coordinate with technicians",
    permissions: {
      modules: ["service", "installation", "equipment"],
      actions: ["install", "supervise"]
    }
  },
  {
    name: "Parts Specialist",
    code: "PARTS_SPECIALIST",
    roleType: "department_role" as const,
    department: "service",
    level: 3,
    description: "Manage parts inventory and coordinate with suppliers",
    permissions: {
      modules: ["parts", "inventory", "suppliers"],
      actions: ["manage_parts", "order"]
    }
  },

  // Level 1: Individual Contributors
  {
    name: "Sales Rep",
    code: "SALES_REP",
    roleType: "department_role" as const,
    department: "sales",
    level: 1,
    description: "Individual sales representative",
    permissions: {
      modules: ["sales", "crm", "leads", "customers"],
      actions: ["sell", "manage_assigned"]
    }
  },
  {
    name: "Technician",
    code: "TECHNICIAN",
    roleType: "department_role" as const,
    department: "service",
    level: 1,
    description: "Service technician",
    permissions: {
      modules: ["service", "dispatch", "mobile"],
      actions: ["service", "update_tickets"]
    }
  },
  {
    name: "Customer Service Rep",
    code: "CUSTOMER_SERVICE_REP",
    roleType: "department_role" as const,
    department: "service",
    level: 1,
    description: "Handle customer inquiries and support requests",
    permissions: {
      modules: ["customers", "service", "support"],
      actions: ["support", "communicate"]
    }
  },
  {
    name: "Installation Technician",
    code: "INSTALL_TECH",
    roleType: "department_role" as const,
    department: "service",
    level: 1,
    description: "Install and configure equipment at customer sites",
    permissions: {
      modules: ["installation", "equipment", "service"],
      actions: ["install", "configure"]
    }
  },
  {
    name: "Parts Clerk",
    code: "PARTS_CLERK",
    roleType: "department_role" as const,
    department: "service",
    level: 1,
    description: "Handle parts orders and inventory management",
    permissions: {
      modules: ["parts", "inventory", "orders"],
      actions: ["manage_inventory", "process_orders"]
    }
  },
  {
    name: "Meter Reader",
    code: "METER_READER",
    roleType: "department_role" as const,
    department: "service",
    level: 1,
    description: "Collect meter readings and manage billing data",
    permissions: {
      modules: ["meters", "billing", "customers"],
      actions: ["read_meters", "update_billing"]
    }
  },
  {
    name: "Delivery Driver",
    code: "DELIVERY_DRIVER",
    roleType: "department_role" as const,
    department: "operations",
    level: 1,
    description: "Manage deliveries and coordinate with customers",
    permissions: {
      modules: ["delivery", "customers", "mobile"],
      actions: ["deliver", "coordinate"]
    }
  }
];

export async function seedMultiLocationRoles() {
  console.log("Seeding multi-location roles...");
  
  try {
    // Insert all roles
    for (const role of multiLocationRoles) {
      await db.insert(roles).values({
        name: role.name,
        code: role.code,
        roleType: role.roleType,
        department: role.department,
        level: role.level,
        description: role.description,
        permissions: role.permissions,
        canAccessAllTenants: role.canAccessAllTenants || false,
        canViewSystemMetrics: role.canViewSystemMetrics || false,
        canAccessAllLocations: role.canAccessAllLocations || false,
        canManageCompanyUsers: role.canManageCompanyUsers || false,
        canCreateLocations: role.canCreateLocations || false,
        canViewCompanyFinancials: role.canViewCompanyFinancials || false,
        canManageRegionalUsers: role.canManageRegionalUsers || false,
        canViewRegionalReports: role.canViewRegionalReports || false,
        canApproveRegionalDeals: role.canApproveRegionalDeals || false,
        canManageLocationUsers: role.canManageLocationUsers || false,
        canViewLocationReports: role.canViewLocationReports || false,
        canApproveLocationDeals: role.canApproveLocationDeals || false,
        canManageCompliance: role.canManageCompliance || false,
        canManageTraining: role.canManageTraining || false,
        canManageHR: role.canManageHR || false,
        canManageIT: role.canManageIT || false,
        canViewAnalytics: role.canViewAnalytics || false,
        canManageQuality: role.canManageQuality || false,
        canAccessAuditLogs: role.canAccessAuditLogs || false,
        canManageIntegrations: role.canManageIntegrations || false,
        canManageUsers: false, // Deprecated
        isSystemRole: role.isSystemRole || false
      }).onConflictDoNothing();
    }
    
    console.log(`Successfully seeded ${multiLocationRoles.length} multi-location roles`);
  } catch (error) {
    console.error("Error seeding multi-location roles:", error);
    throw error;
  }
}

// Export role definitions for reference
export { multiLocationRoles };