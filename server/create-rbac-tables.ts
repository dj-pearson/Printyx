import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Create basic RBAC tables for immediate use
 * This creates simplified versions of the RBAC tables to get the system working
 */

async function createRBACTables() {
  console.log('Creating RBAC tables...');

  try {
    // Create system_permissions table (using different name to avoid conflicts)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_permissions (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        module VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        scope_level VARCHAR(50) NOT NULL,
        is_sensitive BOOLEAN NOT NULL DEFAULT false,
        business_impact VARCHAR(50) DEFAULT 'MEDIUM',
        compliance_tags TEXT[] DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create organizational_units table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS organizational_units (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) NOT NULL,
        tier VARCHAR(50) NOT NULL CHECK (tier IN ('PLATFORM', 'COMPANY', 'REGIONAL', 'LOCATION')),
        parent_unit_id VARCHAR(255),
        lft INTEGER NOT NULL DEFAULT 1,
        rgt INTEGER NOT NULL DEFAULT 2,
        depth INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        manager_id VARCHAR(255),
        location_id VARCHAR(255),
        region_id VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create enhanced_roles table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS enhanced_roles (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        organizational_unit_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) NOT NULL,
        description TEXT,
        hierarchy_level VARCHAR(50) NOT NULL,
        department VARCHAR(100) NOT NULL DEFAULT 'general',
        organizational_tier VARCHAR(50) NOT NULL DEFAULT 'COMPANY',
        is_customizable BOOLEAN NOT NULL DEFAULT true,
        is_system_role BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        max_assignments INTEGER,
        assignment_rules JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create role_permissions table  
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id VARCHAR(255) PRIMARY KEY,
        role_id VARCHAR(255) NOT NULL,
        permission_id VARCHAR(255) NOT NULL,
        effect VARCHAR(10) NOT NULL CHECK (effect IN ('ALLOW', 'DENY')) DEFAULT 'ALLOW',
        conditions JSONB DEFAULT '{}',
        granted_by VARCHAR(255) NOT NULL,
        granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        assignment_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create user_role_assignments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_role_assignments (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        role_id VARCHAR(255) NOT NULL,
        tenant_id VARCHAR(255) NOT NULL,
        organizational_unit_id VARCHAR(255),
        assigned_by VARCHAR(255) NOT NULL,
        assignment_reason TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        effective_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        effective_until TIMESTAMP WITH TIME ZONE,
        territory_restrictions JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Insert basic permissions
    await db.execute(sql`
      INSERT INTO system_permissions (id, name, code, description, module, resource_type, action, scope_level)
      VALUES 
        ('perm-1', 'View Dashboard', 'dashboard.view', 'View main dashboard', 'dashboard', 'dashboard', 'view', 'INDIVIDUAL'),
        ('perm-2', 'Manage Users', 'user.manage', 'Create, edit, delete users', 'user', 'user', 'manage', 'COMPANY'),
        ('perm-3', 'View Sales', 'sales.view', 'View sales data', 'sales', 'sales', 'view', 'LOCATION'),
        ('perm-4', 'Manage Roles', 'role.manage', 'Create and manage roles', 'rbac', 'role', 'manage', 'COMPANY'),
        ('perm-5', 'View Reports', 'report.view', 'View business reports', 'reports', 'report', 'view', 'LOCATION')
      ON CONFLICT (code) DO NOTHING
    `);

    console.log('✅ RBAC tables created successfully');
  } catch (error) {
    console.error('Error creating RBAC tables:', error);
    throw error;
  }
}

createRBACTables().catch(console.error);