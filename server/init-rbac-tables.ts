import { db } from './db';
import { sql } from 'drizzle-orm';

/**
 * Initialize Enhanced RBAC Database Tables
 * 
 * This script creates all necessary tables for the Enhanced RBAC system
 * if they don't exist. Run this script to set up the database schema.
 */

async function initRBACTables() {
  console.log('🔄 Initializing Enhanced RBAC database tables...');

  try {
    // Create Organizational Units table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS organizational_units (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) NOT NULL,
        tier VARCHAR(50) NOT NULL CHECK (tier IN ('PLATFORM', 'COMPANY', 'REGIONAL', 'LOCATION')),
        parent_unit_id VARCHAR(255),
        lft INTEGER NOT NULL,
        rgt INTEGER NOT NULL,
        depth INTEGER NOT NULL DEFAULT 0,
        description TEXT,
        manager_id VARCHAR(255),
        location_id VARCHAR(255),
        region_id VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        FOREIGN KEY (parent_unit_id) REFERENCES organizational_units(id) ON DELETE SET NULL,
        UNIQUE(tenant_id, code),
        CONSTRAINT valid_nested_set CHECK (lft < rgt)
      )
    `);

    // Create Enhanced Roles table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS enhanced_roles (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(255) NOT NULL,
        organizational_unit_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(100) NOT NULL,
        description TEXT,
        hierarchy_level VARCHAR(50) NOT NULL CHECK (hierarchy_level IN ('PLATFORM', 'ROOT', 'COMPANY', 'REGIONAL', 'LOCATION', 'DEPARTMENT', 'TEAM', 'INDIVIDUAL')),
        department VARCHAR(100) NOT NULL,
        organizational_tier VARCHAR(50) NOT NULL CHECK (organizational_tier IN ('PLATFORM', 'COMPANY', 'REGIONAL', 'LOCATION')),
        is_customizable BOOLEAN NOT NULL DEFAULT true,
        is_system_role BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        max_assignments INTEGER,
        assignment_rules JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id) ON DELETE CASCADE,
        UNIQUE(tenant_id, code)
      )
    `);

    // Create System Permissions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_permissions (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        code VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        module VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        action VARCHAR(100) NOT NULL,
        scope_level VARCHAR(50) NOT NULL CHECK (scope_level IN ('PLATFORM', 'COMPANY', 'REGIONAL', 'LOCATION', 'DEPARTMENT', 'TEAM', 'INDIVIDUAL')),
        is_sensitive BOOLEAN NOT NULL DEFAULT false,
        business_impact VARCHAR(50) CHECK (business_impact IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
        compliance_tags TEXT[],
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create Role Permissions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id VARCHAR(255) PRIMARY KEY,
        role_id VARCHAR(255) NOT NULL,
        permission_id VARCHAR(255) NOT NULL,
        effect VARCHAR(10) NOT NULL CHECK (effect IN ('ALLOW', 'DENY')),
        conditions JSONB DEFAULT '{}',
        granted_by VARCHAR(255) NOT NULL,
        granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        assignment_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        FOREIGN KEY (role_id) REFERENCES enhanced_roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES system_permissions(id) ON DELETE CASCADE,
        UNIQUE(role_id, permission_id)
      )
    `);

    // Create User Role Assignments table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_role_assignments (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        role_id VARCHAR(255) NOT NULL,
        tenant_id VARCHAR(255) NOT NULL,
        organizational_unit_id VARCHAR(255) NOT NULL,
        assigned_by VARCHAR(255) NOT NULL,
        assignment_reason TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
        effective_until TIMESTAMP WITH TIME ZONE,
        territory_restrictions JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        FOREIGN KEY (role_id) REFERENCES enhanced_roles(id) ON DELETE CASCADE,
        FOREIGN KEY (organizational_unit_id) REFERENCES organizational_units(id) ON DELETE CASCADE
      )
    `);

    // Create Permission Cache table for O(1) lookups
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS permission_cache (
        cache_key VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        tenant_id VARCHAR(255) NOT NULL,
        permission_code VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        context_data JSONB DEFAULT '{}',
        result BOOLEAN NOT NULL,
        computed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
        hit_count INTEGER DEFAULT 1,
        INDEX(user_id, tenant_id),
        INDEX(expires_at)
      )
    `);

    // Create indexes for optimal performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_org_units_tenant ON organizational_units(tenant_id);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_org_units_hierarchy ON organizational_units(tenant_id, lft, rgt);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_enhanced_roles_tenant ON enhanced_roles(tenant_id);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_enhanced_roles_dept ON enhanced_roles(tenant_id, department, is_active);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id, is_active);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_user_assignments_user ON user_role_assignments(user_id, tenant_id, is_active);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_permission_cache_lookup ON permission_cache(user_id, tenant_id, permission_code, expires_at);
    `);

    console.log('✅ Enhanced RBAC database tables initialized successfully!');
    console.log('📊 Created tables:');
    console.log('  - organizational_units');
    console.log('  - enhanced_roles');
    console.log('  - system_permissions');
    console.log('  - role_permissions');
    console.log('  - user_role_assignments');
    console.log('  - permission_cache');
    console.log('🚀 Ready for RBAC system initialization');

  } catch (error) {
    console.error('❌ Error initializing RBAC tables:', error);
    throw error;
  }
}

// Run if this script is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initRBACTables()
    .then(() => {
      console.log('Database initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database initialization failed:', error);
      process.exit(1);
    });
}

export { initRBACTables };