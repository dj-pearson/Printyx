import { db } from "./db";
import { storage } from "./storage";
import { users, roles, teams, tenants } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcrypt";

// Demo users with different role levels for testing
const demoUsers = [
  {
    email: "Pearsonperformance@gmail.com",
    password: "Infomax1!",
    firstName: "Root",
    lastName: "Admin",
    role: "SYSTEM_ADMIN",
    department: "admin",
    level: 5
  },
  {
    email: "director@printyx.com",
    password: "director123",
    firstName: "Sarah",
    lastName: "Director",
    role: "DIRECTOR",
    department: "operations",
    level: 4
  },
  {
    email: "sales.manager@printyx.com",
    password: "manager123",
    firstName: "Mike",
    lastName: "Johnson",
    role: "SALES_MANAGER",
    department: "sales",
    level: 3
  },
  {
    email: "service.manager@printyx.com",
    password: "manager123",
    firstName: "Lisa",
    lastName: "Chen",
    role: "SERVICE_MANAGER",
    department: "service",
    level: 3
  },
  {
    email: "team.lead@printyx.com",
    password: "lead123",
    firstName: "David",
    lastName: "Wilson",
    role: "TEAM_LEAD",
    department: "sales",
    level: 2
  },
  {
    email: "sales.rep@printyx.com",
    password: "rep123",
    firstName: "Jennifer",
    lastName: "Smith",
    role: "SALES_REP",
    department: "sales",
    level: 1
  },
  {
    email: "technician@printyx.com",
    password: "tech123",
    firstName: "Robert",
    lastName: "Garcia",
    role: "TECHNICIAN",
    department: "service",
    level: 1
  }
];

// Role definitions with permissions
const roleDefinitions = [
  {
    name: "System Administrator",
    code: "SYSTEM_ADMIN",
    department: "admin",
    level: 5,
    description: "Full system access and user management",
    permissions: {
      admin: ["*"],
      sales: ["*"],
      service: ["*"],
      finance: ["*"],
      purchasing: ["*"],
      reports: ["*"]
    }
  },
  {
    name: "Director",
    code: "DIRECTOR",
    department: "operations",
    level: 4,
    description: "Cross-department access and strategic oversight",
    permissions: {
      sales: ["*"],
      service: ["*"],
      finance: ["view-reports", "approve-invoices"],
      purchasing: ["view-inventory", "approve-orders"],
      reports: ["*"]
    }
  },
  {
    name: "Sales Manager",
    code: "SALES_MANAGER",
    department: "sales",
    level: 3,
    description: "Manages sales team and operations",
    permissions: {
      sales: ["*"],
      service: ["view-tickets", "create-tickets"],
      reports: ["team-sales-reports", "team-performance"]
    }
  },
  {
    name: "Service Manager",
    code: "SERVICE_MANAGER",
    department: "service",
    level: 3,
    description: "Manages service team and dispatch",
    permissions: {
      service: ["*"],
      sales: ["view-customers", "view-contracts"],
      purchasing: ["manage-parts", "create-orders"],
      reports: ["service-reports", "technician-performance"]
    }
  },
  {
    name: "Team Lead",
    code: "TEAM_LEAD",
    department: "sales",
    level: 2,
    description: "Leads a specific team within department",
    permissions: {
      sales: ["manage-team-leads", "view-team-customers", "create-quotes"],
      service: ["view-tickets"],
      reports: ["team-reports"]
    }
  },
  {
    name: "Sales Representative",
    code: "SALES_REP",
    department: "sales",
    level: 1,
    description: "Individual sales contributor",
    permissions: {
      sales: ["manage-assigned-customers", "create-leads", "create-quotes"],
      service: ["view-customer-tickets"],
      reports: ["personal-reports"]
    }
  },
  {
    name: "Service Technician",
    code: "TECHNICIAN",
    department: "service",
    level: 1,
    description: "Field service technician",
    permissions: {
      service: ["manage-assigned-tickets", "update-work-orders", "record-parts"],
      sales: ["view-customer-info"],
      reports: ["personal-reports"]
    }
  }
];

// Team structure
const teamDefinitions = [
  {
    name: "West Coast Sales",
    department: "sales",
    managerId: null, // Will be set to sales manager ID
    description: "Sales team covering western territories"
  },
  {
    name: "East Coast Sales",
    department: "sales", 
    managerId: null,
    description: "Sales team covering eastern territories"
  },
  {
    name: "Field Service Team A",
    department: "service",
    managerId: null, // Will be set to service manager ID
    description: "Primary field service team"
  },
  {
    name: "Field Service Team B",
    department: "service",
    managerId: null,
    description: "Secondary field service team"
  }
];

export async function setupDemoAuth() {
  try {
    console.log("Setting up demo authentication system...");

    // Create demo tenant
    const demoTenant = {
      id: process.env.DEMO_TENANT_ID || "550e8400-e29b-41d4-a716-446655440000",
      name: "Demo Copier Dealership",
      subdomain: "demo",
      settings: {
        timezone: "America/New_York",
        currency: "USD",
        features: ["meter-billing", "service-dispatch", "crm", "inventory"]
      }
    };

    // Insert tenant
    await db.insert(tenants).values(demoTenant).onConflictDoNothing();
    console.log("✓ Demo tenant created");

    // Create roles
    const createdRoles = [];
    for (const roleDef of roleDefinitions) {
      const [role] = await db.insert(roles).values({
        ...roleDef,
        tenantId: demoTenant.id,
        permissions: JSON.stringify(roleDef.permissions)
      }).onConflictDoNothing().returning();
      
      if (role) {
        createdRoles.push(role);
        console.log(`✓ Created role: ${role.name}`);
      }
    }

    // Create teams
    const createdTeams = [];
    for (const teamDef of teamDefinitions) {
      const [team] = await db.insert(teams).values({
        ...teamDef,
        tenantId: demoTenant.id
      }).onConflictDoNothing().returning();
      
      if (team) {
        createdTeams.push(team);
        console.log(`✓ Created team: ${team.name}`);
      }
    }

    // Create users with hashed passwords
    const createdUsers = [];
    for (const userDef of demoUsers) {
      const hashedPassword = await bcrypt.hash(userDef.password, 10);
      
      // Find matching role
      const userRole = createdRoles.find(r => r.code === userDef.role);
      if (!userRole) {
        console.warn(`Role ${userDef.role} not found for user ${userDef.email}`);
        continue;
      }

      // Assign team based on role
      let teamId = null;
      if (userDef.role === "TEAM_LEAD" || userDef.role === "SALES_REP") {
        const salesTeam = createdTeams.find(t => t.name === "West Coast Sales");
        teamId = salesTeam?.id;
      } else if (userDef.role === "TECHNICIAN") {
        const serviceTeam = createdTeams.find(t => t.name === "Field Service Team A");
        teamId = serviceTeam?.id;
      }

      const [user] = await db.insert(users).values({
        email: userDef.email,
        firstName: userDef.firstName,
        lastName: userDef.lastName,
        tenantId: demoTenant.id,
        roleId: userRole.id,
        teamId,
        passwordHash: hashedPassword,
        isActive: true
      }).onConflictDoNothing().returning();

      if (user) {
        createdUsers.push({ ...user, role: userRole });
        console.log(`✓ Created user: ${user.email} (${userRole.name})`);
      }
    }

    // Update team managers
    const salesManager = createdUsers.find(u => u.role.code === "SALES_MANAGER");
    const serviceManager = createdUsers.find(u => u.role.code === "SERVICE_MANAGER");

    if (salesManager) {
      await db.update(teams)
        .set({ managerId: salesManager.id })
        .where(and(
          eq(teams.department, "sales"),
          eq(teams.tenantId, demoTenant.id)
        ));
      console.log("✓ Assigned sales team managers");
    }

    if (serviceManager) {
      await db.update(teams)
        .set({ managerId: serviceManager.id })
        .where(and(
          eq(teams.department, "service"),
          eq(teams.tenantId, demoTenant.id)
        ));
      console.log("✓ Assigned service team managers");
    }

    console.log("\n🎉 Demo authentication system setup complete!");
    console.log("\nDemo Login Credentials:");
    console.log("========================");
    
    demoUsers.forEach(user => {
      const roleInfo = roleDefinitions.find(r => r.code === user.role);
      console.log(`${roleInfo?.name}:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Password: ${user.password}`);
      console.log(`  Level: ${user.level} (${user.department})\n`);
    });

    return {
      tenant: demoTenant,
      users: createdUsers,
      roles: createdRoles,
      teams: createdTeams
    };

  } catch (error) {
    console.error("Error setting up demo authentication:", error);
    throw error;
  }
}