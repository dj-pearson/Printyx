# Multi-Location Role Architecture for Printyx

## Overview
This document defines the comprehensive role hierarchy for Printyx's multi-location support, designed to scale to 1000+ employees across multiple locations within individual company tenants.

## Architecture Layers

### 1. Platform Level (Printyx System)
**Level 8: Platform Admin**
- **Role**: Root Admin
- **Access**: All tenants, all system metrics, platform management
- **Users**: Printyx engineering team, system administrators

**Level 8: Platform Support**
- **Role**: Printyx Support Staff
- **Access**: All tenants (support mode), limited system metrics
- **Users**: Customer support representatives

### 2. Company Level (Tenant-wide)
**Level 7: Company Admin (C-Level Executive)**
- **Roles**: CEO, President, COO, CFO
- **Access**: All locations within company, all departments, financial reports
- **Permissions**: 
  - Create/manage locations and regions
  - Assign regional managers
  - View company-wide financials and metrics
  - Manage company-wide users
  - Set company policies and configurations

**Level 6: Company Director**
- **Roles**: VP Sales, VP Service, VP Operations, Corporate Controller
- **Access**: All locations within their department across the company
- **Permissions**:
  - Department-wide reporting across all locations
  - Cross-location resource allocation
  - Department policy setting
  - Approve high-value deals company-wide

### 3. Regional Level (Multi-Location Management)
**Level 6: Regional Manager**
- **Roles**: Regional Sales Manager, Regional Service Manager, Regional Operations Manager
- **Access**: Assigned region(s) and their locations only
- **Permissions**:
  - Manage users within assigned locations
  - View regional performance reports
  - Approve regional deals and budgets
  - Coordinate cross-location operations
  - Assign location managers

**Level 5: Regional Director**
- **Roles**: Area Director, District Manager
- **Access**: Multiple regions (broader than Regional Manager)
- **Permissions**: Similar to Regional Manager but across multiple regions

### 4. Location Level (Single Location Management)
**Level 5: Location Manager**
- **Roles**: Branch Manager, Location General Manager, Site Manager
- **Access**: Specific location only
- **Permissions**:
  - Manage all users at their location
  - View location-specific reports
  - Approve location deals up to set limits
  - Manage location inventory and resources
  - Assign department managers

**Level 4: Department Manager (Location-Specific)**
- **Roles**: Sales Manager, Service Manager, Operations Manager, Finance Manager
- **Access**: Their department within their location
- **Permissions**:
  - Manage department team members
  - Approve department-specific actions
  - Access department reports and metrics
  - Assign team leads and supervisors

### 5. Team Level (Department Subdivisions)
**Level 3: Supervisor/Team Lead**
- **Roles**: Senior Sales Rep, Lead Technician, Warehouse Supervisor, Accounting Supervisor
- **Access**: Their team within their department/location
- **Permissions**:
  - Assign work to team members
  - Approve basic team actions
  - View team performance metrics
  - Mentor individual contributors

**Level 2: Team Lead**
- **Roles**: Team Lead, Senior Associate
- **Access**: Small team or project within location
- **Permissions**:
  - Coordinate small team activities
  - Basic approval authority
  - Training responsibilities

### 6. Individual Contributor Level
**Level 1: Individual Contributor**
- **Roles**: Sales Rep, Technician, Admin Assistant, Accounting Clerk
- **Access**: Their assigned tasks and customers within location
- **Permissions**:
  - Execute assigned work
  - Access customer records within territory
  - Create/update records within scope
  - View personal performance metrics

## Access Scope Definitions

### Platform Scope
- **Who**: Platform Admins, Platform Support
- **Access**: All tenants, all locations, system-wide metrics

### Company Scope  
- **Who**: C-Level Executives, Company Directors
- **Access**: All locations and departments within their company tenant

### Regional Scope
- **Who**: Regional Managers, Regional Directors
- **Access**: All locations within assigned region(s)

### Location Scope
- **Who**: Location Managers, Department Managers, and below
- **Access**: Single location and its departments/teams

## Data Segmentation Strategy

### 1. Tenant Isolation
- All business data filtered by `tenantId`
- Platform users can access multiple tenants

### 2. Location Filtering
- Users with `location` scope see only their location's data
- Users with `regional` scope see all locations in their region
- Users with `company` scope see all locations in their tenant

### 3. Department Filtering
- Sales users see sales data, Service users see service data
- Managers can see their department + some cross-department data
- C-Level sees all departments

### 4. Hierarchical Data Access
- Managers can see their direct reports' data
- Regional managers can see all location managers' data in their region
- Company admins can see all data in their tenant

## Permission Examples

### Sales Rep (Level 1, Location Scope)
```json
{
  "customers": ["read", "create", "update"],
  "leads": ["read", "create", "update"], 
  "contracts": ["read"],
  "service_tickets": ["read_assigned"],
  "reports": ["personal_metrics"],
  "location_scope": ["primary_location_only"]
}
```

### Regional Sales Manager (Level 6, Regional Scope)
```json
{
  "customers": ["read", "create", "update", "reassign"],
  "leads": ["read", "create", "update", "reassign"],
  "contracts": ["read", "approve_regional"],
  "service_tickets": ["read_all"],
  "reports": ["regional_metrics", "location_comparisons"],
  "users": ["manage_regional_sales"],
  "location_scope": ["assigned_regions"]
}
```

### CEO (Level 7, Company Scope)
```json
{
  "all_modules": ["full_access"],
  "financials": ["company_wide"],
  "reports": ["executive_dashboard"],
  "users": ["manage_all_company"],
  "locations": ["create", "modify", "deactivate"],
  "regions": ["create", "modify", "assign_managers"],
  "location_scope": ["all_company_locations"]
}
```

## Scaling Considerations

### Performance
- Indexed by tenantId, locationId, regionId for fast filtering
- Role-based query optimization
- Cached permission lookups

### Security
- Row-level security enforced at database level
- Multi-layered permission checks
- Audit trail for cross-location access

### Management
- Automated role assignment based on hierarchy
- Bulk user management tools for Regional/Company admins
- Role inheritance and delegation features

### Growth Path
- Additional middle management levels can be added
- Specialized roles (e.g., Technical Specialist, Account Executive)
- Matrix organization support (users reporting to multiple managers)

## Implementation Priority

1. **Phase 1**: Core role structure and location tables
2. **Phase 2**: Basic permission enforcement and data filtering  
3. **Phase 3**: Advanced regional management and reporting
4. **Phase 4**: Cross-location workflows and resource sharing
5. **Phase 5**: Advanced analytics and performance management across locations