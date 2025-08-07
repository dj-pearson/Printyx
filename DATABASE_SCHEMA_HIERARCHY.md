# Printyx Database Schema Hierarchy & Reference
*Updated: August 6, 2025*

## Overview
This document provides a comprehensive hierarchy of all database tables, their relationships, functions, and available fields in the Printyx system. Use this reference for understanding data structure and planning manual additions.

**Total Tables**: 162 tables across all business modules

## Recent Schema Updates
- **Comprehensive Onboarding System (Aug 7, 2025)**: Added comprehensive onboarding checklist system with `onboarding_checklists`, `onboarding_checklist_sections`, and `onboarding_checklist_items` tables for managing equipment installation and customer onboarding processes. Includes multi-step workflow with equipment details, network configuration, security setup, and dynamic sections
- **Database Schema Alignment (Aug 7, 2025)**: Fixed schema inconsistencies by adding missing columns to onboarding_checklists table (customer_id, equipment_details, assigned_technician_id, estimated_duration, business_hours, description, quote_id, order_id)
- **Proposal Builder System (Aug 6, 2025)**: Enhanced proposals and quotes system with comprehensive quote-to-proposal conversion, template management, section configuration, and content management
- **Customer Self-Service Portal**: Added 8 comprehensive tables for customer portal functionality including access management, service requests, meter submissions, supply orders, payments, notifications, and activity logging
- **Manufacturer Integration System**: Enhanced device registration and metrics tracking with manufacturer_integrations, device_registrations, device_metrics, and integration_audit_logs tables
- **Service Dispatch System**: Connected to real database with proper authentication using service_tickets and technicians tables
- **Multi-tenant Architecture**: Full tenant isolation across all new tables with proper foreign key relationships
- **Enum Types**: Added customer portal specific enums (customer_portal_status, service_request_status, service_request_priority, service_request_type, supply_order_status, payment_status, payment_method, notification_type, meter_submission_method)

## Core System Architecture

### Multi-Tenancy & Authentication Layer

#### `sessions` (Required for Replit Auth)
**Purpose**: Stores user session data for authentication
**Function**: Session management and user authentication persistence
**Fields**:
- `sid` (varchar, PRIMARY KEY) - Session identifier
- `sess` (jsonb, NOT NULL) - Session data in JSON format  
- `expire` (timestamp, NOT NULL) - Session expiration time

#### `users` (Core Authentication)
**Purpose**: Stores user account information and profiles
**Function**: User authentication, profile management, role assignment
**Fields**:
- `id` (varchar, PRIMARY KEY) - Unique user identifier
- `email` (varchar) - User email address
- `first_name` (varchar) - User's first name
- `last_name` (varchar) - User's last name
- `profile_image_url` (varchar) - URL to user's profile image
- `password_hash` (varchar) - Encrypted password
- `role` (varchar) - Legacy role field
- `role_id` (varchar, FK → roles.id) - Role assignment
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `team_id` (varchar, FK → teams.id) - Team assignment
- `manager_id` (varchar, FK → users.id) - Manager assignment
- `employee_id` (varchar) - Employee identifier
- `primary_location_id` (varchar, FK → locations.id) - Primary location
- `region_id` (varchar, FK → regions.id) - Region assignment  
- `access_scope` (varchar) - Access scope level
- `is_active` (boolean) - Account status
- `is_platform_user` (boolean) - Platform user flag
- `last_login_at` (timestamp) - Last login timestamp
- `created_at` (timestamp) - Account creation
- `updated_at` (timestamp) - Last update

#### `tenants` (Multi-Tenancy Core)  
**Purpose**: Represents Printyx client companies (copier dealers)
**Function**: Multi-tenant isolation, company-level data segregation
**Fields**:
- `id` (varchar, PRIMARY KEY) - Tenant identifier
- `name` (varchar) - Company/tenant name
- `domain` (varchar) - Company domain
- `settings` (jsonb) - Tenant configuration
- `subscription_tier` (varchar) - Subscription level
- `status` (varchar) - Tenant status
- `last_activity` (timestamp) - Recent activity
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

### Role-Based Access Control (RBAC)

#### `roles` (Hierarchical Permissions)
**Purpose**: Defines user roles with hierarchical permissions
**Function**: Role-based access control across platform/company/regional/location levels  
**Fields**:
- `id` (varchar, PRIMARY KEY) - Role identifier
- `name` (varchar) - Role display name
- `code` (varchar) - Role code
- `description` (text) - Role description
- `department` (varchar) - Department assignment
- `level` (integer) - Hierarchy level (1-8)
- `role_type` (varchar) - Role type classification
- `permissions` (jsonb) - Module permissions
- `can_access_all_tenants` (boolean) - Platform access
- `can_manage_users` (boolean) - User management
- `can_view_system_metrics` (boolean) - System metrics access
- `is_system_role` (boolean) - System role flag
- Plus 20+ granular permission flags for specific capabilities
- `created_at` (timestamp) - Creation date

#### `locations` (Multi-Location Support)
**Purpose**: Physical business locations within tenant companies
**Fields**:
- `id` (varchar, PRIMARY KEY) - Location identifier
- `name` (varchar) - Location name
- `address` (text) - Physical address
- `city` (varchar) - City
- `state` (varchar) - State/province
- `zip_code` (varchar) - Postal code
- `phone` (varchar) - Location phone
- `manager_id` (varchar, FK → users.id) - Location manager
- `region_id` (varchar, FK → regions.id) - Region assignment
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `is_active` (boolean) - Location status
- `created_at` (timestamp) - Creation date

#### `regions` (Regional Management)
**Purpose**: Regional groupings of locations for management hierarchy
**Fields**:
- `id` (varchar, PRIMARY KEY) - Region identifier
- `name` (varchar) - Region name  
- `description` (text) - Region description
- `manager_id` (varchar, FK → users.id) - Regional manager
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `is_active` (boolean) - Region status
- `created_at` (timestamp) - Creation date

#### `teams` (Team Organization)
**Purpose**: Team-based organization within locations
**Fields**:
- `id` (varchar, PRIMARY KEY) - Team identifier
- `name` (varchar) - Team name
- `description` (text) - Team description
- `team_lead_id` (varchar, FK → users.id) - Team leader
- `location_id` (varchar, FK → locations.id) - Location assignment
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `is_active` (boolean) - Team status
- `created_at` (timestamp) - Creation date

## Business Management Layer

### Customer Relationship Management (CRM)

#### `business_records` (Unified Leads/Customers)
**Purpose**: Central table for all business relationships (leads → customers lifecycle)
**Function**: Zero-data-loss lead-to-customer conversion, relationship management
**Fields**:
- `id` (varchar, PRIMARY KEY) - Record identifier
- `record_type` (varchar) - Type: 'lead' or 'customer'
- `lead_status` (varchar) - Lead stage progression
- `company_name` (varchar) - Business name
- `first_name` (varchar) - Primary contact first name
- `last_name` (varchar) - Primary contact last name
- `email` (varchar) - Primary email
- `phone` (varchar) - Primary phone
- `address` (text) - Business address
- `city` (varchar) - City
- `state` (varchar) - State/province
- `zip_code` (varchar) - Postal code
- `industry` (varchar) - Business industry
- `employee_count` (integer) - Number of employees
- `annual_revenue` (decimal) - Annual revenue
- `lead_source` (varchar) - Acquisition source
- `lead_score` (integer) - Lead scoring (0-100)
- `last_contact_date` (timestamp) - Last interaction
- `next_follow_up_date` (timestamp) - Scheduled follow-up
- `notes` (text) - General notes
- `priority` (varchar) - Priority level
- `assigned_to` (varchar, FK → users.id) - Assigned user
- `created_by` (varchar, FK → users.id) - Creator
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `location_id` (varchar, FK → locations.id) - Location assignment
- **E-Automate Integration Fields**:
  - `external_customer_id` (varchar) - E-Automate customer ID
  - `external_system_id` (varchar) - Source system identifier
  - `migration_status` (varchar) - Migration status
  - `external_data` (jsonb) - Additional E-Automate fields
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `business_record_activities` (CRM Activity Tracking)
**Purpose**: Track all interactions and activities with business records
**Fields**:
- `id` (varchar, PRIMARY KEY) - Activity identifier
- `business_record_id` (varchar, FK → business_records.id) - Related record
- `activity_type` (varchar) - Activity type
- `subject` (varchar) - Activity subject
- `description` (text) - Activity details
- `activity_date` (timestamp) - Activity date
- `duration_minutes` (integer) - Activity duration
- `outcome` (varchar) - Activity outcome
- `next_action` (varchar) - Recommended next action
- `created_by` (varchar, FK → users.id) - Activity creator
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date

#### `companies` (Business Entities)
**Purpose**: Represents client companies that business_records belong to
**Fields**:
- `id` (varchar, PRIMARY KEY) - Company identifier
- `name` (varchar) - Company name
- `description` (text) - Company description
- `industry` (varchar) - Industry classification
- `website` (varchar) - Company website
- `employee_count` (integer) - Number of employees
- `annual_revenue` (decimal) - Annual revenue
- `address` (text) - Primary address
- `city` (varchar) - City
- `state` (varchar) - State/province
- `zip_code` (varchar) - Postal code
- `phone` (varchar) - Main phone
- `email` (varchar) - Main email
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `company_contacts` (Contact Management)
**Purpose**: Individual contacts within companies
**Fields**:
- `id` (varchar, PRIMARY KEY) - Contact identifier
- `first_name` (varchar) - First name
- `last_name` (varchar) - Last name
- `email` (varchar) - Email address
- `phone` (varchar) - Phone number
- `title` (varchar) - Job title
- `department` (varchar) - Department
- `is_primary` (boolean) - Primary contact flag
- `company_id` (varchar, FK → companies.id) - Company assignment
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

### Sales Pipeline Management

#### `leads` (Lead Management)
**Purpose**: Dedicated lead tracking and management
**Fields**:
- `id` (varchar, PRIMARY KEY) - Lead identifier
- `company_name` (varchar) - Prospect company
- `contact_name` (varchar) - Primary contact
- `email` (varchar) - Email address
- `phone` (varchar) - Phone number
- `lead_source` (varchar) - Lead source
- `status` (varchar) - Lead status
- `score` (integer) - Lead score
- `assigned_to` (varchar, FK → users.id) - Assigned salesperson
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `deals` (Deal Pipeline)
**Purpose**: Sales opportunity and deal tracking
**Fields**:
- `id` (varchar, PRIMARY KEY) - Deal identifier
- `title` (varchar) - Deal title
- `description` (text) - Deal description
- `value` (decimal) - Deal value
- `stage` (varchar) - Pipeline stage
- `probability` (integer) - Close probability (0-100)
- `expected_close_date` (date) - Expected close date
- `actual_close_date` (date) - Actual close date
- `lead_source` (varchar) - Lead source
- `business_record_id` (varchar, FK → business_records.id) - Associated record
- `assigned_to` (varchar, FK → users.id) - Deal owner
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `deal_stages` (Pipeline Configuration)
**Purpose**: Configure sales pipeline stages
**Fields**:
- `id` (varchar, PRIMARY KEY) - Stage identifier
- `name` (varchar) - Stage name
- `description` (text) - Stage description
- `stage_order` (integer) - Stage sequence
- `probability_default` (integer) - Default probability
- `is_closed_won` (boolean) - Closed won stage flag
- `is_closed_lost` (boolean) - Closed lost stage flag
- `tenantid` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date

### Product & Service Management

#### `product_models` (Product Catalog - Models)
**Purpose**: Copier and printer model specifications
**Fields**:
- `id` (varchar, PRIMARY KEY) - Model identifier
- `model_name` (varchar) - Model name
- `manufacturer` (varchar) - Manufacturer
- `category` (varchar) - Equipment category
- `specifications` (jsonb) - Technical specifications
- `features` (jsonb) - Feature set
- `default_pricing` (jsonb) - Default pricing structure
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `product_accessories` (Accessories Catalog)
**Purpose**: Equipment accessories and add-ons
**Fields**:
- `id` (varchar, PRIMARY KEY) - Accessory identifier
- `name` (varchar) - Accessory name
- `description` (text) - Description
- `model_compatibility` (jsonb) - Compatible models
- `price` (decimal) - Accessory price
- `category` (varchar) - Accessory category
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `supplies` (Supply Inventory)
**Purpose**: Toner, paper, and supply management
**Fields**:
- `id` (varchar, PRIMARY KEY) - Supply identifier
- `supply_name` (varchar) - Supply name
- `supply_type` (varchar) - Supply type (toner/paper/parts)
- `manufacturer` (varchar) - Manufacturer
- `model_compatibility` (jsonb) - Compatible equipment
- `current_stock` (integer) - Current inventory
- `reorder_level` (integer) - Reorder threshold
- `unit_cost` (decimal) - Unit cost
- `unit_price` (decimal) - Unit price
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `professional_services` (Professional Services)
**Purpose**: Consulting and professional service offerings
**Fields**:
- `id` (varchar, PRIMARY KEY) - Service identifier
- `service_name` (varchar) - Service name
- `description` (text) - Service description
- `category` (varchar) - Service category
- `hourly_rate` (decimal) - Hourly billing rate
- `fixed_price` (decimal) - Fixed price option
- `estimated_hours` (integer) - Estimated duration
- `prerequisites` (jsonb) - Service prerequisites
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `managed_services` (Managed Service Plans)
**Purpose**: Ongoing managed service offerings
**Fields**:
- `id` (varchar, PRIMARY KEY) - Service identifier
- `service_name` (varchar) - Service name
- `description` (text) - Service description
- `service_level` (varchar) - Service level
- `monthly_fee` (decimal) - Monthly service fee
- `included_services` (jsonb) - Included service components
- `sla_terms` (jsonb) - Service level agreement terms
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `software_products` (Software Catalog)
**Purpose**: Software products and licensing
**Fields**:
- `id` (varchar, PRIMARY KEY) - Software identifier
- `product_name` (varchar) - Software name
- `vendor` (varchar) - Software vendor
- `version` (varchar) - Software version
- `license_type` (varchar) - License type
- `per_user_cost` (decimal) - Per-user licensing cost
- `per_device_cost` (decimal) - Per-device licensing cost
- `annual_maintenance` (decimal) - Annual maintenance fee
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

### Equipment & Asset Management

#### `equipment` (Asset Tracking)
**Purpose**: Track copiers, printers, and other equipment
**Fields**:
- `id` (varchar, PRIMARY KEY) - Equipment identifier
- `serial_number` (varchar) - Manufacturer serial number
- `model` (varchar) - Equipment model
- `manufacturer` (varchar) - Equipment manufacturer
- `category` (varchar) - Equipment category
- `status` (varchar) - Current status
- `install_date` (timestamp) - Installation date
- `warranty_end_date` (timestamp) - Warranty expiration
- `location` (varchar) - Physical location
- `customer_id` (varchar, FK → business_records.id) - Customer assignment
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `customer_equipment` (Customer Equipment Assignments)
**Purpose**: Link equipment to specific customers
**Fields**:
- `id` (varchar, PRIMARY KEY) - Assignment identifier
- `customer_id` (varchar, FK → business_records.id) - Customer
- `equipment_id` (varchar, FK → equipment.id) - Equipment
- `installation_date` (date) - Installation date
- `warranty_end_date` (date) - Warranty end
- `service_level` (varchar) - Service level agreement
- `monthly_rate` (decimal) - Monthly service rate
- `meter_billing_enabled` (boolean) - Meter billing flag
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date

#### `equipment_asset_tracking` (Asset Lifecycle)
**Purpose**: Track equipment through its complete lifecycle
**Fields**:
- `id` (varchar, PRIMARY KEY) - Tracking identifier
- `equipment_id` (varchar, FK → equipment.id) - Equipment reference
- `status_change_date` (timestamp) - Status change date
- `previous_status` (varchar) - Previous status
- `new_status` (varchar) - New status
- `reason` (varchar) - Change reason
- `location_change` (varchar) - Location change details
- `cost_impact` (decimal) - Financial impact
- `notes` (text) - Change notes
- `updated_by` (varchar, FK → users.id) - User who made change
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date

## Customer Self-Service Portal System

### Customer Portal Access & Management

#### `customer_portal_access` (Portal Authentication)
**Purpose**: Manages customer portal user accounts and authentication
**Function**: Secure customer access to self-service portal with role-based permissions
**Fields**:
- `id` (uuid, PRIMARY KEY) - Portal user identifier
- `tenant_id` (uuid, FK → tenants.id) - Dealer's tenant ID
- `customer_id` (uuid, FK → business_records.id) - Associated customer record
- `username` (varchar(100), UNIQUE) - Portal login username
- `password_hash` (varchar(255)) - Encrypted password
- `email` (varchar(255)) - Portal email address
- `status` (customer_portal_status) - Account status (active/inactive/suspended/pending_activation)
- `is_email_verified` (boolean) - Email verification status
- `email_verification_token` (varchar(255)) - Email verification token
- `password_reset_token` (varchar(255)) - Password reset token
- `password_reset_expires` (timestamp) - Password reset expiration
- `last_login_at` (timestamp) - Last login timestamp
- `session_token` (varchar(255)) - Active session token
- `session_expires` (timestamp) - Session expiration
- `permissions` (jsonb) - Portal permissions (view invoices, submit requests, order supplies, etc.)
- `preferences` (jsonb) - User preferences (notifications, language, timezone)
- `created_at` (timestamp) - Account creation date
- `updated_at` (timestamp) - Last update
- `created_by` (uuid, FK → users.id) - Staff member who created access

#### `customer_portal_activity_log` (Activity Tracking)
**Purpose**: Comprehensive audit log of all customer portal activities
**Function**: Security tracking, compliance monitoring, and user behavior analytics
**Fields**:
- `id` (uuid, PRIMARY KEY) - Activity log identifier
- `tenant_id` (uuid, FK → tenants.id) - Tenant assignment
- `customer_id` (uuid, FK → business_records.id) - Customer reference
- `customer_portal_user_id` (uuid, FK → customer_portal_access.id) - Portal user
- `action` (varchar(100)) - Action performed (login, logout, view_invoice, submit_request, etc.)
- `description` (text) - Activity description
- `ip_address` (varchar(45)) - User IP address
- `user_agent` (text) - Browser/device information
- `related_record_type` (varchar(50)) - Type of related record (invoice, service_request, etc.)
- `related_record_id` (uuid) - Related record identifier
- `timestamp` (timestamp) - Activity timestamp

### Service Request Management

#### `customer_service_requests` (Self-Service Requests)
**Purpose**: Customer-initiated service requests through the portal
**Function**: Complete service request workflow from submission to completion
**Fields**:
- `id` (uuid, PRIMARY KEY) - Request identifier
- `tenant_id` (uuid, FK → tenants.id) - Tenant assignment
- `customer_id` (uuid, FK → business_records.id) - Customer reference
- `customer_portal_user_id` (uuid, FK → customer_portal_access.id) - Portal user who submitted
- `request_number` (varchar(50), UNIQUE) - Auto-generated request number
- `title` (varchar(255)) - Service request title
- `description` (text) - Detailed description
- `type` (service_request_type) - Request type (maintenance/repair/installation/training/supplies/technical_support/other)
- `priority` (service_request_priority) - Priority level (low/normal/high/urgent/emergency)
- `status` (service_request_status) - Current status (submitted/acknowledged/assigned/in_progress/on_hold/completed/cancelled)
- `equipment_id` (uuid, FK → equipment.id) - Related equipment
- `equipment_serial_number` (varchar(100)) - Equipment serial number
- `equipment_model` (varchar(100)) - Equipment model
- `equipment_location` (varchar(255)) - Equipment location
- `contact_name` (varchar(100)) - Primary contact name
- `contact_phone` (varchar(20)) - Contact phone
- `contact_email` (varchar(255)) - Contact email
- `preferred_date` (timestamp) - Customer preferred service date
- `preferred_time` (varchar(50)) - Preferred time window
- `urgency_notes` (text) - Urgency explanation
- `assigned_technician_id` (uuid, FK → technicians.id) - Assigned technician
- `service_ticket_id` (uuid, FK → service_tickets.id) - Internal service ticket link
- `estimated_completion_date` (timestamp) - Estimated completion
- `actual_completion_date` (timestamp) - Actual completion
- `customer_notes` (text) - Customer-provided notes
- `internal_notes` (text) - Internal staff notes
- `resolution_notes` (text) - Resolution details
- `attachments` (jsonb) - File attachments array
- `customer_rating` (integer) - Customer satisfaction rating (1-5)
- `customer_feedback` (text) - Customer feedback
- `submitted_at` (timestamp) - Submission timestamp
- `acknowledged_at` (timestamp) - Staff acknowledgment timestamp
- `completed_at` (timestamp) - Completion timestamp
- `updated_at` (timestamp) - Last update

### Meter Reading Submissions

#### `customer_meter_submissions` (Self-Service Meter Readings)
**Purpose**: Customer-submitted meter readings for billing and monitoring
**Function**: Multiple submission methods with validation workflow and billing integration
**Fields**:
- `id` (uuid, PRIMARY KEY) - Submission identifier
- `tenant_id` (uuid, FK → tenants.id) - Tenant assignment
- `customer_id` (uuid, FK → business_records.id) - Customer reference
- `customer_portal_user_id` (uuid, FK → customer_portal_access.id) - Submitting portal user
- `equipment_id` (uuid, FK → equipment.id) - Equipment reference
- `equipment_serial_number` (varchar(100)) - Equipment serial number
- `total_impressions` (integer) - Total impression count
- `black_white_impressions` (integer) - B&W impression count
- `color_impressions` (integer) - Color impression count
- `large_format_impressions` (integer) - Large format count
- `scan_impressions` (integer) - Scan count
- `fax_impressions` (integer) - Fax count
- `submission_method` (meter_submission_method) - Submission method (manual_entry/photo_upload/email/automated)
- `reading_date` (timestamp) - Date of actual meter reading
- `submission_date` (timestamp) - Portal submission date
- `photo_urls` (jsonb) - Array of photo evidence URLs
- `is_validated` (boolean) - Staff validation status
- `validated_by` (uuid, FK → users.id) - Staff member who validated
- `validated_at` (timestamp) - Validation timestamp
- `validation_notes` (text) - Validation notes
- `is_billed` (boolean) - Billing integration status
- `billing_date` (timestamp) - Date processed for billing
- `invoice_id` (uuid, FK → invoices.id) - Related invoice
- `customer_notes` (text) - Customer-provided notes
- `internal_notes` (text) - Internal processing notes

### Supply Ordering System

#### `customer_supply_orders` (Self-Service Supply Orders)
**Purpose**: Customer-initiated supply orders through portal
**Function**: Complete ordering workflow from cart to delivery tracking
**Fields**:
- `id` (uuid, PRIMARY KEY) - Order identifier
- `tenant_id` (uuid, FK → tenants.id) - Tenant assignment
- `customer_id` (uuid, FK → business_records.id) - Customer reference
- `customer_portal_user_id` (uuid, FK → customer_portal_access.id) - Ordering portal user
- `order_number` (varchar(50), UNIQUE) - Auto-generated order number
- `status` (supply_order_status) - Order status (draft/submitted/confirmed/processing/shipped/delivered/cancelled)
- `delivery_address` (jsonb) - Delivery address object
- `delivery_instructions` (text) - Special delivery instructions
- `requested_delivery_date` (timestamp) - Customer requested delivery date
- `actual_delivery_date` (timestamp) - Actual delivery date
- `subtotal` (decimal(10,2)) - Order subtotal
- `tax` (decimal(10,2)) - Tax amount
- `shipping` (decimal(10,2)) - Shipping cost
- `total` (decimal(10,2)) - Total order amount
- `is_contract_covered` (boolean) - Contract coverage flag
- `contract_id` (uuid, FK → contracts.id) - Related service contract
- `purchase_order_number` (varchar(100)) - Customer PO number
- `tracking_number` (varchar(100)) - Shipping tracking number
- `carrier` (varchar(50)) - Shipping carrier
- `shipped_at` (timestamp) - Ship date
- `customer_notes` (text) - Customer order notes
- `internal_notes` (text) - Internal processing notes
- `created_at` (timestamp) - Order creation
- `submitted_at` (timestamp) - Order submission
- `updated_at` (timestamp) - Last update

#### `customer_supply_order_items` (Order Line Items)
**Purpose**: Individual items within customer supply orders
**Function**: Detailed product information, pricing, and availability tracking
**Fields**:
- `id` (uuid, PRIMARY KEY) - Line item identifier
- `order_id` (uuid, FK → customer_supply_orders.id, CASCADE DELETE) - Parent order
- `product_id` (uuid, FK → supplies.id) - Product reference
- `product_sku` (varchar(100)) - Product SKU
- `product_name` (varchar(255)) - Product name
- `product_description` (text) - Product description
- `compatible_equipment_id` (uuid, FK → equipment.id) - Compatible equipment
- `quantity` (integer) - Ordered quantity
- `unit_price` (decimal(10,2)) - Unit price
- `total_price` (decimal(10,2)) - Line total
- `in_stock` (boolean) - Availability status
- `estimated_ship_date` (timestamp) - Estimated ship date
- `customer_notes` (text) - Customer item notes

### Payment Processing

#### `customer_payments` (Self-Service Payments)
**Purpose**: Customer-initiated payments through portal
**Function**: Multiple payment methods with processing workflow and integration
**Fields**:
- `id` (uuid, PRIMARY KEY) - Payment identifier
- `tenant_id` (uuid, FK → tenants.id) - Tenant assignment
- `customer_id` (uuid, FK → business_records.id) - Customer reference
- `customer_portal_user_id` (uuid, FK → customer_portal_access.id) - Portal user making payment
- `payment_number` (varchar(50), UNIQUE) - Auto-generated payment number
- `amount` (decimal(10,2)) - Payment amount
- `payment_method` (payment_method) - Payment method (credit_card/ach/wire_transfer/check/auto_pay)
- `status` (payment_status) - Payment status (pending/processing/completed/failed/refunded/partially_paid)
- `invoice_id` (uuid, FK → invoices.id) - Related invoice
- `invoice_number` (varchar(100)) - Invoice reference number
- `transaction_id` (varchar(255)) - External payment processor transaction ID
- `processor_name` (varchar(100)) - Payment processor (Stripe, PayPal, etc.)
- `processor_response` (jsonb) - Full processor response
- `payment_method_details` (jsonb) - Encrypted payment method details
- `payment_date` (timestamp) - Payment date
- `processed_at` (timestamp) - Processing completion timestamp
- `customer_notes` (text) - Customer payment notes
- `internal_notes` (text) - Internal processing notes
- `failure_reason` (text) - Failure explanation if applicable
- `retry_count` (integer) - Number of retry attempts
- `next_retry_at` (timestamp) - Next retry scheduled time

### Notification System

#### `customer_notifications` (Portal Notifications)
**Purpose**: Multi-channel customer notifications and communication
**Function**: Email, SMS, and portal notifications with delivery tracking
**Fields**:
- `id` (uuid, PRIMARY KEY) - Notification identifier
- `tenant_id` (uuid, FK → tenants.id) - Tenant assignment
- `customer_id` (uuid, FK → business_records.id) - Customer reference
- `customer_portal_user_id` (uuid, FK → customer_portal_access.id) - Portal user
- `type` (notification_type) - Notification type (service_update/invoice_ready/payment_due/supply_low/maintenance_reminder/system_alert)
- `title` (varchar(255)) - Notification title
- `message` (text) - Notification content
- `is_email_sent` (boolean) - Email delivery status
- `email_sent_at` (timestamp) - Email send timestamp
- `is_sms_capable` (boolean) - SMS capability flag
- `is_sms_sent` (boolean) - SMS delivery status
- `sms_sent_at` (timestamp) - SMS send timestamp
- `is_portal_read` (boolean) - Portal read status
- `portal_read_at` (timestamp) - Portal read timestamp
- `related_service_request_id` (uuid, FK → customer_service_requests.id) - Related service request
- `related_invoice_id` (uuid, FK → invoices.id) - Related invoice
- `related_payment_id` (uuid, FK → customer_payments.id) - Related payment
- `related_supply_order_id` (uuid, FK → customer_supply_orders.id) - Related supply order
- `priority` (varchar(20)) - Notification priority
- `scheduled_send_at` (timestamp) - Scheduled delivery time
- `expires_at` (timestamp) - Notification expiration
- `created_at` (timestamp) - Creation timestamp
- `sent_at` (timestamp) - Actual send timestamp

### Service Management

#### `service_tickets` (Service Dispatch)
**Purpose**: Track service requests and work orders
**Fields**:
- `id` (varchar, PRIMARY KEY) - Ticket identifier
- `title` (varchar) - Service ticket title
- `description` (text) - Detailed description
- `priority` (varchar) - Priority level
- `status` (varchar) - Current status
- `category` (varchar) - Service category
- `customer_id` (varchar, FK → business_records.id) - Customer
- `equipment_id` (varchar, FK → equipment.id) - Equipment
- `assigned_to` (varchar, FK → users.id) - Assigned technician
- `created_by` (varchar, FK → users.id) - Ticket creator
- `scheduled_date` (timestamp) - Scheduled service date
- `completed_date` (timestamp) - Completion date
- `estimated_hours` (decimal) - Estimated time
- `actual_hours` (decimal) - Actual time spent
- `resolution` (text) - Resolution description
- `customer_satisfaction` (integer) - Satisfaction rating (1-5)
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `location_id` (varchar, FK → locations.id) - Location assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `service_ticket_updates` (Ticket Activity Log)
**Purpose**: Track all updates and communications on service tickets
**Fields**:
- `id` (varchar, PRIMARY KEY) - Update identifier
- `ticket_id` (varchar, FK → service_tickets.id) - Service ticket
- `update_type` (varchar) - Update type
- `message` (text) - Update message
- `status_change` (varchar) - Status change details
- `time_spent` (decimal) - Time spent on update
- `created_by` (varchar, FK → users.id) - Update creator
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date

#### `technicians` (Technician Management)
**Purpose**: Manage field service technicians
**Fields**:
- `id` (varchar, PRIMARY KEY) - Technician identifier
- `user_id` (varchar, FK → users.id) - User account
- `employee_id` (varchar) - Employee identifier
- `specializations` (jsonb) - Technical specializations
- `certifications` (jsonb) - Professional certifications
- `skill_level` (integer) - Skill level (1-5)
- `hourly_rate` (decimal) - Billing rate
- `is_active` (boolean) - Active status
- `territory` (varchar) - Service territory
- `contact_phone` (varchar) - Contact phone
- `emergency_contact` (jsonb) - Emergency contact info
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

### Customer Onboarding & Installation Management

#### `onboarding_checklists` (Installation Checklists)
**Purpose**: Comprehensive customer onboarding and equipment installation management
**Function**: Multi-step workflow for managing equipment deployment, configuration, and customer training
**Fields**:
- `id` (uuid, PRIMARY KEY) - Checklist identifier
- `tenant_id` (uuid, FK → tenants.id) - Tenant assignment
- `customer_id` (varchar, FK → business_records.id) - Customer reference
- `quote_id` (varchar, FK → quotes.id) - Associated quote
- `order_id` (varchar, FK → purchase_orders.id) - Associated order
- `checklist_title` (varchar) - Checklist title/name
- `description` (text) - Checklist description
- `installation_type` (varchar) - Installation type (new_site/equipment_upgrade/relocation/expansion)
- `status` (varchar) - Checklist status (draft/in_progress/completed/cancelled)
- `customer_data` (jsonb) - Customer information (company, contacts, billing)
- `site_information` (jsonb) - Installation site details (address, access, requirements)
- `equipment_details` (jsonb) - Equipment specifications and configuration
- `scheduled_install_date` (date) - Planned installation date
- `actual_install_date` (date) - Actual installation date
- `assigned_technician_id` (varchar, FK → technicians.id) - Assigned technician
- `estimated_duration` (integer) - Estimated duration in hours
- `access_requirements` (text) - Site access instructions
- `business_hours` (jsonb) - Customer business hours and timezone
- `special_instructions` (text) - Special installation notes
- `progress_percentage` (decimal) - Completion percentage (0-100)
- `total_sections` (integer) - Total checklist sections
- `completed_sections` (integer) - Completed sections count
- `pdf_url` (varchar) - Generated PDF checklist URL
- `pdf_generated_at` (timestamp) - PDF generation timestamp
- `created_by` (uuid, FK → users.id) - Checklist creator
- `last_modified_by` (uuid, FK → users.id) - Last modifier
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

#### `onboarding_dynamic_sections` (Custom Checklist Sections)
**Purpose**: Configurable sections for specialized installation requirements
**Function**: Dynamic checklist sections for custom workflows, training modules, and special configurations
**Fields**:
- `id` (uuid, PRIMARY KEY) - Section identifier
- `checklist_id` (uuid, FK → onboarding_checklists.id) - Parent checklist
- `section_title` (varchar) - Section title
- `section_type` (varchar) - Section type (installation/training/maintenance/configuration/other)
- `description` (text) - Section description
- `sort_order` (integer) - Section display order
- `is_required` (boolean) - Required section flag
- `completion_criteria` (text) - Completion requirements
- `assigned_to` (uuid, FK → users.id) - Section assignee
- `estimated_duration` (integer) - Estimated completion time (minutes)
- `actual_duration` (integer) - Actual completion time (minutes)
- `status` (varchar) - Section status (pending/in_progress/completed/skipped)
- `completed_at` (timestamp) - Completion timestamp
- `completed_by` (uuid, FK → users.id) - Section completer
- `notes` (text) - Section notes and comments
- `attachments` (jsonb) - Related files and documents
- `tenant_id` (uuid, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

#### `onboarding_equipment` (Equipment Installation Tracking)
**Purpose**: Detailed tracking of individual equipment items during installation
**Function**: Equipment-specific configuration, network setup, and testing verification
**Fields**:
- `id` (uuid, PRIMARY KEY) - Equipment record identifier
- `checklist_id` (uuid, FK → onboarding_checklists.id) - Parent checklist
- `equipment_type` (varchar) - Equipment type (printer/copier/scanner/fax/mfp/other)
- `manufacturer` (varchar) - Equipment manufacturer
- `model` (varchar) - Equipment model number
- `serial_number` (varchar) - Equipment serial number
- `installation_location` (varchar) - Physical installation location
- `network_configuration` (jsonb) - Network settings (IP, WIFI, etc.)
- `print_configuration` (jsonb) - Print settings and drivers
- `security_configuration` (jsonb) - Security settings and access codes
- `features_enabled` (jsonb) - Enabled features list
- `accessories_installed` (jsonb) - Installed accessories list
- `testing_completed` (boolean) - Installation testing status
- `testing_notes` (text) - Testing results and notes
- `warranty_information` (jsonb) - Warranty details and registration
- `maintenance_schedule` (jsonb) - Maintenance schedule setup
- `user_training_completed` (boolean) - User training status
- `installation_status` (varchar) - Equipment status (pending/installing/configured/testing/completed/failed)
- `installed_by` (uuid, FK → technicians.id) - Installing technician
- `installed_at` (timestamp) - Installation completion timestamp
- `tenant_id` (uuid, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

#### `onboarding_tasks` (Installation Task Management)
**Purpose**: Granular task tracking within onboarding checklists
**Function**: Individual task assignment, progress tracking, and quality control
**Fields**:
- `id` (uuid, PRIMARY KEY) - Task identifier
- `checklist_id` (uuid, FK → onboarding_checklists.id) - Parent checklist
- `section_id` (uuid, FK → onboarding_dynamic_sections.id) - Parent section
- `equipment_id` (uuid, FK → onboarding_equipment.id) - Related equipment
- `task_title` (varchar) - Task title
- `task_description` (text) - Detailed task description
- `task_type` (varchar) - Task category (hardware/software/network/training/testing/documentation)
- `priority` (varchar) - Task priority (low/medium/high/critical)
- `sort_order` (integer) - Task sequence order
- `is_required` (boolean) - Required task flag
- `prerequisites` (jsonb) - Task dependencies
- `estimated_duration` (integer) - Estimated completion time (minutes)
- `actual_duration` (integer) - Actual completion time (minutes)
- `instructions` (text) - Task instructions and procedures
- `completion_criteria` (text) - Task completion requirements
- `assigned_to` (uuid, FK → users.id) - Task assignee
- `status` (varchar) - Task status (pending/in_progress/completed/failed/skipped)
- `started_at` (timestamp) - Task start timestamp
- `completed_at` (timestamp) - Task completion timestamp
- `verification_required` (boolean) - Quality verification flag
- `verified_by` (uuid, FK → users.id) - Task verifier
- `verified_at` (timestamp) - Verification timestamp
- `notes` (text) - Task notes and comments
- `attachments` (jsonb) - Task-related files and photos
- `issues_encountered` (text) - Problems and resolutions
- `tenant_id` (uuid, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

#### `onboarding_network_config` (Network Configuration Templates)
**Purpose**: Standardized network configuration templates and settings
**Function**: Reusable network configurations for different customer environments
**Fields**:
- `id` (uuid, PRIMARY KEY) - Configuration identifier
- `tenant_id` (uuid, FK → tenants.id) - Tenant assignment
- `template_name` (varchar) - Configuration template name
- `description` (text) - Template description
- `network_type` (varchar) - Network type (wired/wireless/both)
- `ip_assignment` (varchar) - IP assignment method (static/dhcp)
- `subnet_configuration` (jsonb) - Subnet and VLAN settings
- `dns_configuration` (jsonb) - DNS server settings
- `security_settings` (jsonb) - Network security configuration
- `printer_ports` (jsonb) - Required port configurations
- `protocol_settings` (jsonb) - Network protocol settings
- `bandwidth_requirements` (jsonb) - Bandwidth and QoS settings
- `firewall_rules` (jsonb) - Required firewall configurations
- `is_template` (boolean) - Template flag
- `is_active` (boolean) - Active configuration flag
- `created_by` (uuid, FK → users.id) - Template creator
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

#### `onboarding_print_management` (Print Management Templates)
**Purpose**: Print management configuration templates and policies
**Function**: Standardized print settings, user permissions, and management policies
**Fields**:
- `id` (uuid, PRIMARY KEY) - Configuration identifier
- `tenant_id` (uuid, FK → tenants.id) - Tenant assignment
- `template_name` (varchar) - Template name
- `description` (text) - Template description
- `driver_configuration` (jsonb) - Printer driver settings
- `print_queues` (jsonb) - Print queue configuration
- `user_permissions` (jsonb) - User access permissions
- `default_settings` (jsonb) - Default print settings
- `color_management` (jsonb) - Color management policies
- `paper_settings` (jsonb) - Paper and media settings
- `finishing_options` (jsonb) - Finishing and stapling options
- `cost_tracking` (jsonb) - Print cost tracking settings
- `security_policies` (jsonb) - Print security policies
- `quota_management` (jsonb) - Print quota and limits
- `reporting_settings` (jsonb) - Print reporting configuration
- `is_template` (boolean) - Template flag
- `is_active` (boolean) - Active configuration flag
- `created_by` (uuid, FK → users.id) - Template creator
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

### Financial Management

#### `contracts` (Service Agreements)
**Purpose**: Manage service contracts and agreements
**Fields**:
- `id` (varchar, PRIMARY KEY) - Contract identifier
- `contract_number` (varchar) - Contract reference number
- `type` (varchar) - Contract type
- `status` (varchar) - Contract status
- `customer_id` (varchar, FK → business_records.id) - Customer
- `start_date` (timestamp) - Contract start date
- `end_date` (timestamp) - Contract end date
- `monthly_value` (decimal) - Monthly contract value
- `total_value` (decimal) - Total contract value
- `billing_frequency` (varchar) - Billing frequency
- `terms` (text) - Contract terms
- `auto_renewal` (boolean) - Auto-renewal flag
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `invoices` (Billing Management)
**Purpose**: Track invoices and billing
**Fields**:
- `id` (varchar, PRIMARY KEY) - Invoice identifier
- `invoice_number` (varchar) - Invoice reference number
- `customer_id` (varchar, FK → business_records.id) - Customer
- `contract_id` (varchar, FK → contracts.id) - Contract
- `amount` (decimal) - Invoice amount
- `tax_amount` (decimal) - Tax amount
- `total_amount` (decimal) - Total including tax
- `status` (varchar) - Payment status
- `issue_date` (timestamp) - Invoice issue date
- `due_date` (timestamp) - Payment due date
- `paid_date` (timestamp) - Payment received date
- `description` (text) - Invoice description
- `line_items` (jsonb) - Detailed line items
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `invoice_line_items` (Invoice Details)
**Purpose**: Detailed line items for invoices
**Fields**:
- `id` (varchar, PRIMARY KEY) - Line item identifier
- `invoice_id` (varchar, FK → invoices.id) - Parent invoice
- `line_type` (varchar) - Line item type
- `description` (text) - Line item description
- `quantity` (decimal) - Quantity
- `unit_price` (decimal) - Unit price
- `line_total` (decimal) - Line total
- `tax_amount` (decimal) - Tax for line
- `product_id` (varchar) - Product reference
- `service_period_start` (date) - Service period start
- `service_period_end` (date) - Service period end
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date

#### `meter_readings` (Usage Billing)
**Purpose**: Track equipment usage for billing
**Fields**:
- `id` (varchar, PRIMARY KEY) - Reading identifier
- `equipment_id` (varchar, FK → equipment.id) - Equipment
- `customer_id` (varchar, FK → business_records.id) - Customer
- `contract_id` (varchar, FK → contracts.id) - Contract
- `reading_date` (timestamp) - Reading date
- `previous_meter_count` (integer) - Previous count
- `current_meter_count` (integer) - Current count
- `print_volume` (integer) - Calculated volume
- `color_pages` (integer) - Color page count
- `black_white_pages` (integer) - B&W page count
- `reading_type` (varchar) - Reading type
- `notes` (text) - Reading notes
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date

## Advanced Features & Analytics

### Commission Management

#### `commission_structures` (Commission Plans)
**Purpose**: Define commission structures for sales teams
**Fields**:
- `id` (varchar, PRIMARY KEY) - Structure identifier
- `structure_name` (varchar) - Plan name
- `structure_type` (varchar) - Commission type
- `base_rate` (decimal) - Base commission rate
- `tier_rates` (jsonb) - Tiered commission rates
- `threshold_amounts` (jsonb) - Performance thresholds
- `effective_date` (date) - Effective start date
- `expiration_date` (date) - Plan expiration
- `applies_to_roles` (jsonb) - Applicable roles
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date

#### `commission_calculations` (Commission Processing)
**Purpose**: Calculate and track commission payments
**Fields**:
- `id` (varchar, PRIMARY KEY) - Calculation identifier
- `sales_rep_id` (varchar, FK → users.id) - Sales representative
- `calculation_period` (varchar) - Period (monthly/quarterly)
- `period_start` (date) - Period start date
- `period_end` (date) - Period end date
- `total_sales` (decimal) - Total sales for period
- `commission_amount` (decimal) - Commission earned
- `adjustments` (decimal) - Manual adjustments
- `final_amount` (decimal) - Final commission amount
- `status` (varchar) - Processing status
- `paid_date` (date) - Payment date
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date

### Sales & CRM Management

#### `quotes` (Quote Management) 
**Purpose**: Comprehensive quote management system for sales process
**Function**: Quote generation, pricing calculations, status tracking, and quote-to-proposal conversion
**Fields**:
- `id` (varchar, PRIMARY KEY) - Quote identifier
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `lead_id` (varchar, FK → business_records.id) - Lead reference (legacy)
- `customer_id` (varchar, FK → business_records.id) - Customer reference (legacy)
- `quote_number` (varchar, UNIQUE) - Auto-generated quote number
- `title` (varchar) - Quote title/name
- `status` (varchar) - Quote status (draft, sent, accepted, rejected, expired)
- `total_amount` (decimal(10,2)) - Total quote amount
- `valid_until` (timestamp) - Quote expiration date
- `terms` (text) - Quote terms and conditions
- `notes` (text) - Internal notes
- `created_by` (varchar, FK → users.id) - Quote creator
- `sent_date` (timestamp) - Date quote was sent
- `accepted_date` (timestamp) - Date quote was accepted
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

#### `quote_line_items` (Quote Product Details)
**Purpose**: Individual line items and products within quotes
**Function**: Product specification, pricing, quantities for each quote line
**Fields**:
- `id` (varchar, PRIMARY KEY) - Line item identifier
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `quote_id` (varchar, FK → quotes.id) - Parent quote
- `line_number` (integer) - Line item sequence
- `product_id` (varchar, FK → products.id) - Product reference
- `product_name` (varchar) - Product name
- `product_description` (text) - Product description
- `quantity` (integer) - Quantity ordered
- `unit_price` (decimal(10,2)) - Price per unit
- `line_total` (decimal(10,2)) - Total for this line
- `product_category` (varchar) - Product category
- `product_sku` (varchar) - Product SKU
- `created_at` (timestamp) - Creation timestamp

#### `proposals` (Professional Proposal System)
**Purpose**: Comprehensive proposal management with template system and content sections
**Function**: Quote-to-proposal conversion, professional document generation, customer presentation
**Fields**:
- `id` (varchar, PRIMARY KEY) - Proposal identifier
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `proposal_number` (varchar, UNIQUE) - Auto-generated proposal number
- `version` (varchar) - Proposal version (default: "1.0")
- `title` (varchar) - Proposal title
- `business_record_id` (varchar, FK → business_records.id) - Customer reference
- `contact_id` (varchar, FK → enhanced_contacts.id) - Primary contact
- `created_by` (varchar, FK → users.id) - Proposal creator
- `assigned_to` (varchar, FK → users.id) - Assigned sales rep
- `team_id` (varchar, FK → teams.id) - Sales team responsible
- `proposal_type` (varchar) - Proposal type (equipment_lease, service_contract, etc.)
- `description` (text) - Proposal description
- `executive_summary` (text) - Executive summary content
- `company_introduction` (text) - Company introduction content
- `solution_overview` (text) - Solution overview content
- `terms_and_conditions` (text) - Terms and conditions content
- `investment_summary` (text) - Investment summary content
- `next_steps` (text) - Next steps content
- `subtotal_amount` (decimal(12,2)) - Subtotal before taxes
- `tax_amount` (decimal(12,2)) - Tax amount
- `total_amount` (decimal(12,2)) - Total amount including tax
- `status` (varchar) - Proposal status (draft, sent, viewed, accepted, rejected)
- `valid_until` (timestamp) - Proposal expiration date
- `template_id` (varchar) - Template used for proposal
- `template_name` (varchar) - Template name
- `sent_date` (timestamp) - Date proposal was sent
- `viewed_date` (timestamp) - Date proposal was viewed by customer
- `accepted_date` (timestamp) - Date proposal was accepted
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

#### `proposal_line_items` (Proposal Product Details)
**Purpose**: Individual line items and products within proposals
**Function**: Product specification, pricing, quantities for each proposal line with service details
**Fields**:
- `id` (varchar, PRIMARY KEY) - Line item identifier
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `proposal_id` (varchar, FK → proposals.id) - Parent proposal
- `line_number` (integer) - Line item sequence
- `item_type` (varchar) - Item type (equipment, accessory, service, software, supply)
- `product_id` (varchar, FK → products.id) - Product reference
- `product_name` (varchar) - Product name
- `description` (text) - Product description
- `quantity` (integer) - Quantity (default: 1)
- `unit_price` (decimal(10,2)) - Price per unit
- `unit_cost` (decimal(10,2)) - Internal cost per unit
- `total_price` (decimal(10,2)) - Total line amount
- `service_frequency` (varchar) - Service frequency (monthly, quarterly, annually)
- `service_duration` (varchar) - Contract duration
- `equipment_condition` (varchar) - Equipment condition (new, refurbished, demo)
- `warranty_info` (text) - Warranty information
- `is_optional` (boolean) - Optional item flag (default: false)
- `is_alternative` (boolean) - Alternative option flag (default: false)
- `package_id` (varchar) - Equipment package reference
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

#### `proposal_comments` (Proposal Communication)
**Purpose**: Internal and customer communication threads for proposals
**Function**: Comment tracking, communication history, collaboration
**Fields**:
- `id` (varchar, PRIMARY KEY) - Comment identifier
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `proposal_id` (varchar, FK → proposals.id) - Parent proposal
- `comment_type` (varchar) - Comment type (internal, customer, revision_request)
- `author_id` (varchar, FK → users.id) - Comment author
- `author_name` (varchar) - Author display name
- `comment_text` (text) - Comment content
- `is_internal` (boolean) - Internal comment flag (default: true)
- `is_urgent` (boolean) - Urgent flag (default: false)
- `replied_to_id` (varchar, FK → proposal_comments.id) - Reply thread reference
- `created_at` (timestamp) - Creation timestamp

#### `proposal_analytics` (Proposal Performance Tracking)
**Purpose**: Track proposal engagement and performance metrics
**Function**: View tracking, engagement analytics, conversion metrics
**Fields**:
- `id` (varchar, PRIMARY KEY) - Analytics identifier
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `proposal_id` (varchar, FK → proposals.id) - Parent proposal
- `metric_name` (varchar) - Metric name (views, downloads, time_spent, etc.)
- `metric_value` (decimal(10,2)) - Metric value
- `recorded_date` (timestamp) - Metric recording date
- `customer_ip` (varchar) - Customer IP address
- `user_agent` (text) - Browser user agent
- `referrer_url` (varchar) - Referrer URL
- `session_id` (varchar) - Session identifier
- `created_at` (timestamp) - Creation timestamp

#### `proposal_approvals` (Approval Workflow)
**Purpose**: Proposal approval workflow and authorization tracking
**Function**: Multi-level approval process, authorization management
**Fields**:
- `id` (varchar, PRIMARY KEY) - Approval identifier
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `proposal_id` (varchar, FK → proposals.id) - Parent proposal
- `approval_level` (integer) - Approval level (1, 2, 3, etc.)
- `approver_id` (varchar, FK → users.id) - Approver user
- `approver_name` (varchar) - Approver display name
- `approval_status` (varchar) - Status (pending, approved, rejected, escalated)
- `approval_notes` (text) - Approval notes/comments
- `requested_date` (timestamp) - Approval request date
- `approved_date` (timestamp) - Approval completion date
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

### Business Intelligence & Analytics

#### `business_intelligence_dashboards` (BI Dashboards)
**Purpose**: Custom business intelligence dashboards
**Fields**:
- `id` (varchar, PRIMARY KEY) - Dashboard identifier
- `dashboard_name` (varchar) - Dashboard name
- `description` (text) - Dashboard description
- `dashboard_config` (jsonb) - Dashboard configuration
- `widget_layout` (jsonb) - Widget layout settings
- `data_sources` (jsonb) - Connected data sources
- `refresh_frequency` (varchar) - Data refresh frequency
- `access_permissions` (jsonb) - Access control settings
- `created_by` (varchar, FK → users.id) - Dashboard creator
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `performance_benchmarks` (Performance Tracking)
**Purpose**: Track key performance indicators and benchmarks
**Fields**:
- `id` (varchar, PRIMARY KEY) - Benchmark identifier
- `metric_name` (varchar) - Metric name
- `metric_category` (varchar) - Metric category
- `current_value` (decimal) - Current metric value
- `target_value` (decimal) - Target/goal value
- `benchmark_period` (varchar) - Measurement period
- `comparison_period` (varchar) - Comparison period
- `trend_direction` (varchar) - Trend direction
- `department` (varchar) - Department scope
- `location_id` (varchar, FK → locations.id) - Location scope
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `measured_at` (timestamp) - Measurement date
- `created_at` (timestamp) - Creation date

### Workflow Automation

#### `automation_rules` (Automation Engine)
**Purpose**: Define automated business process rules
**Fields**:
- `id` (varchar, PRIMARY KEY) - Rule identifier
- `rule_name` (varchar) - Rule name
- `rule_description` (text) - Rule description
- `rule_category` (varchar) - Rule category
- `trigger_events` (jsonb) - Triggering events
- `conditions` (jsonb) - Rule conditions
- `condition_logic` (varchar) - Condition logic (AND/OR)
- `actions` (jsonb) - Actions to execute
- `action_sequence` (varchar) - Action sequence type
- `delay_before_action` (integer) - Delay in seconds
- `execution_window` (jsonb) - Execution time window
- `cooldown_period` (integer) - Cooldown between executions
- `priority` (integer) - Rule priority
- `is_critical` (boolean) - Critical rule flag
- `bypass_business_hours` (boolean) - After-hours execution
- `applies_to_entities` (jsonb) - Applicable entity types
- `entity_filters` (jsonb) - Entity filtering criteria
- `department_scope` (jsonb) - Department scope
- `max_executions_per_day` (integer) - Daily execution limit
- `max_executions_per_hour` (integer) - Hourly execution limit
- `max_concurrent_executions` (integer) - Concurrent execution limit
- `requires_approval` (boolean) - Manual approval required
- `approved_by` (varchar, FK → users.id) - Approver
- `approval_date` (date) - Approval date
- `governance_notes` (text) - Governance notes
- `execution_count` (integer) - Total executions
- `success_count` (integer) - Successful executions
- `last_executed` (timestamp) - Last execution time
- `last_success` (timestamp) - Last successful execution
- `is_active` (boolean) - Rule active status
- `is_test_mode` (boolean) - Test mode flag
- `effective_from` (date) - Effective start date
- `effective_until` (date) - Effective end date
- `depends_on_rules` (jsonb) - Rule dependencies
- `conflicts_with_rules` (jsonb) - Rule conflicts
- `average_execution_time_ms` (numeric) - Average execution time
- `error_rate` (numeric) - Error rate percentage
- `impact_score` (numeric) - Business impact score
- `created_by` (varchar, FK → users.id) - Rule creator
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

#### `workflow_executions` (Workflow History)
**Purpose**: Track workflow execution history and results
**Fields**:
- `id` (varchar, PRIMARY KEY) - Execution identifier
- `rule_id` (varchar, FK → automation_rules.id) - Automation rule
- `trigger_event` (jsonb) - Triggering event data
- `execution_status` (varchar) - Execution status
- `start_time` (timestamp) - Execution start time
- `end_time` (timestamp) - Execution end time
- `execution_duration_ms` (integer) - Duration in milliseconds
- `actions_executed` (jsonb) - Actions that were executed
- `results` (jsonb) - Execution results
- `error_message` (text) - Error message if failed
- `entity_affected` (varchar) - Affected entity ID
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date

### Integration Management

#### `quickbooks_integrations` (QuickBooks Integration)
**Purpose**: Manage QuickBooks Online integration settings
**Fields**:
- `id` (varchar, PRIMARY KEY) - Integration identifier
- `company_id` (varchar) - QB Company ID
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `access_token` (text) - OAuth access token
- `refresh_token` (text) - OAuth refresh token
- `token_expires_at` (timestamp) - Token expiration
- `realm_id` (varchar) - QB Realm ID
- `base_url` (varchar) - QB API base URL
- `sync_enabled` (boolean) - Sync enabled flag
- `last_sync` (timestamp) - Last sync timestamp
- `sync_frequency` (varchar) - Sync frequency
- `error_count` (integer) - Error count
- `last_error` (text) - Last error message
- `customer_sync_enabled` (boolean) - Customer sync flag
- `vendor_sync_enabled` (boolean) - Vendor sync flag
- `item_sync_enabled` (boolean) - Item sync flag
- `invoice_sync_enabled` (boolean) - Invoice sync flag
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

## System Security & Compliance

#### `audit_logs` (Audit Trail)
**Purpose**: Security audit logging for compliance
**Fields**:
- `id` (varchar, PRIMARY KEY) - Log entry identifier
- `user_id` (varchar, FK → users.id) - User who performed action
- `action` (varchar) - Action performed
- `table_name` (varchar) - Affected table
- `record_id` (varchar) - Affected record ID
- `old_values` (jsonb) - Previous values
- `new_values` (jsonb) - New values
- `timestamp` (timestamp) - Action timestamp
- `ip_address` (varchar) - User IP address
- `user_agent` (text) - User agent string
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment

## Mobile & Field Service

#### `mobile_work_orders` (Mobile Service Orders)
**Purpose**: Mobile app work order management
**Fields**:
- `id` (varchar, PRIMARY KEY) - Work order identifier
- `service_ticket_id` (varchar, FK → service_tickets.id) - Related ticket
- `technician_id` (varchar, FK → technicians.id) - Assigned technician
- `customer_id` (varchar, FK → business_records.id) - Customer
- `equipment_id` (varchar, FK → equipment.id) - Equipment
- `work_type` (varchar) - Type of work
- `priority` (varchar) - Work priority
- `estimated_duration` (integer) - Estimated minutes
- `actual_duration` (integer) - Actual minutes
- `parts_used` (jsonb) - Parts used in service
- `work_performed` (text) - Work description
- `customer_signature` (text) - Digital signature
- `photos` (jsonb) - Service photos
- `gps_checkin` (varchar) - GPS check-in location
- `gps_checkout` (varchar) - GPS check-out location
- `status` (varchar) - Work order status
- `tenant_id` (varchar, FK → tenants.id) - Tenant assignment
- `created_at` (timestamp) - Creation date
- `updated_at` (timestamp) - Last update

## Summary Statistics

- **Core Tables**: 12 (users, tenants, roles, locations, regions, teams, sessions, etc.)
- **CRM Tables**: 15 (business_records, companies, contacts, leads, deals, activities)
- **Product Tables**: 7 (models, accessories, supplies, services, software)
- **Equipment Tables**: 8 (equipment, customer_equipment, asset_tracking, etc.)
- **Service Tables**: 12 (tickets, technicians, work_orders, mobile_orders, etc.)
- **Financial Tables**: 18 (contracts, invoices, billing, commission, accounting)
- **Analytics Tables**: 8 (dashboards, benchmarks, forecasts, reports)
- **Automation Tables**: 6 (rules, executions, workflows, templates)
- **Integration Tables**: 12 (QuickBooks, Salesforce, E-Automate, external systems)
- **Compliance Tables**: 4 (audit_logs, security, compliance tracking)

**Total: 124 database tables** supporting comprehensive copier dealer management operations.

---
*This schema represents a production-ready multi-tenant SaaS platform with enterprise-grade features for copier dealer management, CRM, service dispatch, financial management, and business intelligence.*