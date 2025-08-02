# Printyx Database Schema Hierarchy & Reference

## Overview
This document provides a comprehensive hierarchy of all database tables, their relationships, functions, and available fields in the Printyx system. Use this reference for understanding data structure and planning manual additions.

## Core System Architecture

### Multi-Tenancy & Authentication Layer

#### `sessions` (Required for Replit Auth)
**Purpose**: Stores user session data for authentication
**Function**: Session management and user authentication persistence
**Headers/Fields**:
- `sid` (varchar, PRIMARY KEY) - Session identifier
- `sess` (jsonb, NOT NULL) - Session data in JSON format
- `expire` (timestamp, NOT NULL) - Session expiration time
**Indexes**: IDX_session_expire on expire column
**Relationships**: None (system table)

#### `users` (Core Authentication)
**Purpose**: Stores user account information and profiles
**Function**: User authentication, profile management, role assignment
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Unique user identifier
- `email` (varchar, UNIQUE) - User email address
- `firstName` (varchar) - User's first name
- `lastName` (varchar) - User's last name
- `profileImageUrl` (varchar) - URL to user's profile image
- `createdAt` (timestamp, default: now()) - Account creation timestamp
- `updatedAt` (timestamp, default: now()) - Last update timestamp
- `tenantId` (varchar, FOREIGN KEY) - References tenants.id
- `roleId` (varchar, FOREIGN KEY) - References roles.id
- `locationId` (varchar, FOREIGN KEY) - References locations.id (optional)
- `regionId` (varchar, FOREIGN KEY) - References regions.id (optional)
**Relationships**: 
- Many-to-One with tenants
- Many-to-One with roles
- Many-to-One with locations (optional)
- Many-to-One with regions (optional)

#### `tenants` (Multi-Tenancy Core)
**Purpose**: Represents Printyx client companies (copier dealers)
**Function**: Multi-tenant isolation, company-level data segregation
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Tenant identifier
- `name` (varchar, NOT NULL) - Company/tenant name
- `domain` (varchar) - Company domain for subdomain routing
- `createdAt` (timestamp, default: now()) - Tenant creation date
- `updatedAt` (timestamp, default: now()) - Last update timestamp
- `status` (varchar, default: 'active') - Tenant status (active/inactive/suspended)
- `subscriptionTier` (varchar) - Subscription level
**Relationships**: 
- One-to-Many with users
- One-to-Many with all business entities

### Role-Based Access Control (RBAC)

#### `roles` (8-Level Hierarchy)
**Purpose**: Defines user roles with hierarchical permissions
**Function**: Role-based access control across platform/company/regional/location levels
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Role identifier
- `name` (varchar, NOT NULL) - Role display name
- `code` (varchar, NOT NULL) - Role code for programmatic use
- `description` (text) - Role description
- `level` (integer, NOT NULL) - Hierarchy level (1-8)
- `department` (varchar) - Department assignment
- `accessScope` (varchar, NOT NULL) - Access scope (platform/company/regional/location)
- `canAccessAllTenants` (boolean, default: false) - Platform-level access flag
- `permissions` (jsonb) - Module permissions object
- `tenantId` (varchar, FOREIGN KEY) - References tenants.id (null for platform roles)
**Relationships**: 
- One-to-Many with users
- Many-to-One with tenants (optional)

#### `locations` (Multi-Location Support)
**Purpose**: Physical business locations within tenant companies
**Function**: Location-based data segregation and management
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Location identifier
- `name` (varchar, NOT NULL) - Location name
- `address` (text) - Physical address
- `city` (varchar) - City
- `state` (varchar) - State/province
- `zipCode` (varchar) - Postal code
- `phone` (varchar) - Location phone number
- `managerId` (varchar, FOREIGN KEY) - References users.id
- `regionId` (varchar, FOREIGN KEY) - References regions.id
- `tenantId` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `isActive` (boolean, default: true) - Location status
- `createdAt` (timestamp, default: now()) - Creation timestamp
**Relationships**:
- Many-to-One with tenants
- Many-to-One with regions
- Many-to-One with users (manager)
- One-to-Many with users (employees)

#### `regions` (Regional Management)
**Purpose**: Regional groupings of locations for management hierarchy
**Function**: Regional-level data access and management oversight
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Region identifier
- `name` (varchar, NOT NULL) - Region name
- `description` (text) - Region description
- `managerId` (varchar, FOREIGN KEY) - References users.id
- `tenantId` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `isActive` (boolean, default: true) - Region status
- `createdAt` (timestamp, default: now()) - Creation timestamp
**Relationships**:
- Many-to-One with tenants
- Many-to-One with users (manager)
- One-to-Many with locations
- One-to-Many with users (regional staff)

## Business Management Layer

### Customer Relationship Management (CRM)

#### `business_records` (Unified Leads/Customers)
**Purpose**: Central table for all business relationships (leads → customers lifecycle)
**Function**: Zero-data-loss lead-to-customer conversion, relationship management
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Record identifier
- `recordType` (varchar, NOT NULL) - Type: 'lead' or 'customer'
- `leadStatus` (varchar) - Lead stage: new/contacted/qualified/active/inactive/churned/competitor_switch/non_payment
- `companyName` (varchar) - Business name
- `firstName` (varchar) - Primary contact first name
- `lastName` (varchar) - Primary contact last name
- `email` (varchar) - Primary email
- `phone` (varchar) - Primary phone
- `address` (text) - Business address
- `city` (varchar) - City
- `state` (varchar) - State/province
- `zipCode` (varchar) - Postal code
- `industry` (varchar) - Business industry
- `employeeCount` (integer) - Number of employees
- `annualRevenue` (decimal) - Annual revenue
- `leadSource` (varchar) - How lead was acquired
- `leadScore` (integer) - Lead scoring (0-100)
- `lastContactDate` (timestamp) - Last interaction date
- `nextFollowUpDate` (timestamp) - Scheduled follow-up
- `notes` (text) - General notes
- `priority` (varchar) - Priority level (high/medium/low)
- `assignedTo` (varchar, FOREIGN KEY) - References users.id
- `createdBy` (varchar, FOREIGN KEY) - References users.id
- `tenantId` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `locationId` (varchar, FOREIGN KEY) - References locations.id
- `createdAt` (timestamp, default: now()) - Creation timestamp
- `updatedAt` (timestamp, default: now()) - Last update timestamp
**E-Automate Integration Fields**:
- `external_customer_id` (varchar) - E-Automate customer ID for migration
- `external_system_id` (varchar) - Source system identifier
- `migration_status` (varchar) - Migration status tracking
- `external_data` (jsonb) - Additional E-Automate fields
**Relationships**:
- Many-to-One with tenants
- Many-to-One with users (assigned, created by)
- Many-to-One with locations
- One-to-Many with companies (as business relationship)
- One-to-Many with contracts
- One-to-Many with service_tickets
- One-to-Many with invoices

#### `companies` (Business Entities)
**Purpose**: Represents client companies that business_records belong to
**Function**: Company profile management, hierarchical business relationships
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Company identifier
- `name` (varchar, NOT NULL) - Company name
- `description` (text) - Company description
- `industry` (varchar) - Industry classification
- `website` (varchar) - Company website
- `employeeCount` (integer) - Number of employees
- `annualRevenue` (decimal) - Annual revenue
- `address` (text) - Primary address
- `city` (varchar) - City
- `state` (varchar) - State/province
- `zipCode` (varchar) - Postal code
- `phone` (varchar) - Main phone number
- `email` (varchar) - Main email
- `tenantId` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `createdAt` (timestamp, default: now()) - Creation timestamp
- `updatedAt` (timestamp, default: now()) - Last update timestamp
**Relationships**:
- Many-to-One with tenants
- One-to-Many with company_contacts
- One-to-Many with business_records

#### `company_contacts` (Contact Management)
**Purpose**: Individual contacts within companies
**Function**: Contact relationship management, communication tracking
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Contact identifier
- `firstName` (varchar) - First name
- `lastName` (varchar) - Last name
- `email` (varchar) - Email address
- `phone` (varchar) - Phone number
- `title` (varchar) - Job title
- `department` (varchar) - Department
- `isPrimary` (boolean, default: false) - Primary contact flag
- `companyId` (varchar, NOT NULL, FOREIGN KEY) - References companies.id
- `tenantId` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `createdAt` (timestamp, default: now()) - Creation timestamp
- `updatedAt` (timestamp, default: now()) - Last update timestamp
**Relationships**:
- Many-to-One with companies
- Many-to-One with tenants

### Equipment & Asset Management

#### `equipment` (Asset Tracking)
**Purpose**: Track copiers, printers, and other equipment
**Function**: Equipment lifecycle management, maintenance tracking
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Equipment identifier
- `serialNumber` (varchar, UNIQUE) - Manufacturer serial number
- `model` (varchar) - Equipment model
- `manufacturer` (varchar) - Equipment manufacturer
- `category` (varchar) - Equipment category
- `status` (varchar) - Current status (active/maintenance/retired)
- `installDate` (timestamp) - Installation date
- `warrantyEndDate` (timestamp) - Warranty expiration
- `location` (varchar) - Physical location description
- `customerId` (varchar, FOREIGN KEY) - References business_records.id
- `tenantId` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `createdAt` (timestamp, default: now()) - Creation timestamp
- `updatedAt` (timestamp, default: now()) - Last update timestamp
**Relationships**:
- Many-to-One with business_records (customers)
- Many-to-One with tenants
- One-to-Many with meter_readings
- One-to-Many with service_tickets

### Service Management

#### `service_tickets` (Service Dispatch)
**Purpose**: Track service requests and work orders
**Function**: Service dispatch, technician assignment, work tracking
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Ticket identifier
- `title` (varchar) - Service ticket title
- `description` (text) - Detailed description
- `priority` (varchar) - Priority level (low/medium/high/critical)
- `status` (varchar) - Current status (open/assigned/in_progress/resolved/closed)
- `category` (varchar) - Service category
- `customerId` (varchar, FOREIGN KEY) - References business_records.id
- `equipmentId` (varchar, FOREIGN KEY) - References equipment.id
- `assignedTo` (varchar, FOREIGN KEY) - References users.id (technician)
- `createdBy` (varchar, FOREIGN KEY) - References users.id
- `scheduledDate` (timestamp) - Scheduled service date
- `completedDate` (timestamp) - Completion date
- `estimatedHours` (decimal) - Estimated time
- `actualHours` (decimal) - Actual time spent
- `resolution` (text) - Resolution description
- `customerSatisfaction` (integer) - Satisfaction rating (1-5)
- `tenantId` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `locationId` (varchar, FOREIGN KEY) - References locations.id
- `createdAt` (timestamp, default: now()) - Creation timestamp
- `updatedAt` (timestamp, default: now()) - Last update timestamp
**Relationships**:
- Many-to-One with business_records (customers)
- Many-to-One with equipment
- Many-to-One with users (technician, creator)
- Many-to-One with tenants
- Many-to-One with locations

### Financial Management

#### `contracts` (Service Agreements)
**Purpose**: Manage service contracts and agreements
**Function**: Contract lifecycle, billing automation, renewal tracking
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Contract identifier
- `contractNumber` (varchar, UNIQUE) - Contract reference number
- `type` (varchar) - Contract type (service/lease/purchase)
- `status` (varchar) - Contract status (active/expired/cancelled/pending)
- `customerId` (varchar, NOT NULL, FOREIGN KEY) - References business_records.id
- `startDate` (timestamp) - Contract start date
- `endDate` (timestamp) - Contract end date
- `monthlyValue` (decimal) - Monthly contract value
- `totalValue` (decimal) - Total contract value
- `billingFrequency` (varchar) - Billing frequency (monthly/quarterly/annual)
- `terms` (text) - Contract terms and conditions
- `autoRenewal` (boolean, default: false) - Auto-renewal flag
- `tenantId` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `createdAt` (timestamp, default: now()) - Creation timestamp
- `updatedAt` (timestamp, default: now()) - Last update timestamp
**Relationships**:
- Many-to-One with business_records (customers)
- Many-to-One with tenants
- One-to-Many with meter_readings
- One-to-Many with invoices

#### `invoices` (Billing Management)
**Purpose**: Track invoices and billing
**Function**: Automated billing, payment tracking, accounts receivable
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Invoice identifier
- `invoiceNumber` (varchar, UNIQUE) - Invoice reference number
- `customerId` (varchar, NOT NULL, FOREIGN KEY) - References business_records.id
- `contractId` (varchar, FOREIGN KEY) - References contracts.id
- `amount` (decimal, NOT NULL) - Invoice amount
- `taxAmount` (decimal) - Tax amount
- `totalAmount` (decimal) - Total including tax
- `status` (varchar) - Payment status (pending/paid/overdue/cancelled)
- `issueDate` (timestamp) - Invoice issue date
- `dueDate` (timestamp) - Payment due date
- `paidDate` (timestamp) - Payment received date
- `description` (text) - Invoice description
- `lineItems` (jsonb) - Detailed line items
- `tenantId` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `createdAt` (timestamp, default: now()) - Creation timestamp
- `updatedAt` (timestamp, default: now()) - Last update timestamp
**Relationships**:
- Many-to-One with business_records (customers)
- Many-to-One with contracts
- Many-to-One with tenants

#### `meter_readings` (Usage Billing)
**Purpose**: Track equipment usage for billing
**Function**: Automated meter billing, usage monitoring
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Reading identifier
- `equipmentId` (varchar, NOT NULL, FOREIGN KEY) - References equipment.id
- `customerId` (varchar, NOT NULL, FOREIGN KEY) - References business_records.id
- `contractId` (varchar, FOREIGN KEY) - References contracts.id
- `readingDate` (timestamp) - Date of reading
- `previousMeterCount` (integer) - Previous meter count
- `currentMeterCount` (integer) - Current meter count
- `printVolume` (integer) - Calculated print volume
- `colorPages` (integer) - Color page count
- `blackWhitePages` (integer) - Black & white page count
- `readingType` (varchar) - Reading type (manual/automatic)
- `notes` (text) - Reading notes
- `tenantId` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `createdAt` (timestamp, default: now()) - Creation timestamp
**Relationships**:
- Many-to-One with equipment
- Many-to-One with business_records (customers)
- Many-to-One with contracts
- Many-to-One with tenants

### Task & Project Management

#### `tasks` (Task Management)
**Purpose**: Individual task tracking and management
**Function**: Personal productivity, work tracking, collaboration
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Task identifier
- `title` (varchar, NOT NULL) - Task title
- `description` (text) - Task description
- `status` (varchar) - Task status (pending/in_progress/completed/cancelled)
- `priority` (varchar) - Priority level (low/medium/high)
- `type` (varchar) - Task type (personal/project/service/sales)
- `assignedTo` (varchar, FOREIGN KEY) - References users.id
- `createdBy` (varchar, FOREIGN KEY) - References users.id
- `projectId` (varchar, FOREIGN KEY) - References projects.id (optional)
- `customerId` (varchar, FOREIGN KEY) - References business_records.id (optional)
- `dueDate` (timestamp) - Due date
- `completedDate` (timestamp) - Completion date
- `estimatedHours` (decimal) - Estimated time
- `actualHours` (decimal) - Actual time spent
- `tags` (text[]) - Task tags array
- `tenantId` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `locationId` (varchar, FOREIGN KEY) - References locations.id
- `createdAt` (timestamp, default: now()) - Creation timestamp
- `updatedAt` (timestamp, default: now()) - Last update timestamp
**Relationships**:
- Many-to-One with users (assigned, creator)
- Many-to-One with projects (optional)
- Many-to-One with business_records (optional)
- Many-to-One with tenants
- Many-to-One with locations

#### `projects` (Project Management)
**Purpose**: Multi-step project tracking and collaboration
**Function**: Project lifecycle management, team collaboration
**Headers/Fields**:
- `id` (varchar, PRIMARY KEY, default: gen_random_uuid()) - Project identifier
- `name` (varchar, NOT NULL) - Project name
- `description` (text) - Project description
- `status` (varchar) - Project status (planning/active/on_hold/completed/cancelled)
- `priority` (varchar) - Priority level (low/medium/high)
- `projectManager` (varchar, FOREIGN KEY) - References users.id
- `customerId` (varchar, FOREIGN KEY) - References business_records.id (optional)
- `startDate` (timestamp) - Project start date
- `endDate` (timestamp) - Project end date
- `estimatedHours` (decimal) - Total estimated hours
- `actualHours` (decimal) - Total actual hours
- `budget` (decimal) - Project budget
- `actualCost` (decimal) - Actual project cost
- `tenantId` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `locationId` (varchar, FOREIGN KEY) - References locations.id
- `createdAt` (timestamp, default: now()) - Creation timestamp
- `updatedAt` (timestamp, default: now()) - Last update timestamp
**Relationships**:
- Many-to-One with users (project manager)
- Many-to-One with business_records (optional)
- Many-to-One with tenants
- Many-to-One with locations
- One-to-Many with tasks

## Data Relationship Patterns

### Multi-Tenant Isolation
All business entities include `tenantId` for complete data isolation:
- tenants → users, roles, locations, regions
- tenants → business_records, companies, equipment
- tenants → service_tickets, contracts, invoices
- tenants → tasks, projects, meter_readings

### Hierarchical Access Control
Role-based access follows organizational hierarchy:
- Platform (Level 8) → All tenants
- Company (Level 6-7) → All locations within tenant
- Regional (Level 4-5) → Locations within assigned regions
- Location (Level 1-3) → Specific location data only

### Business Process Flow
Lead-to-Customer lifecycle through business_records:
1. Lead (recordType: 'lead', status: 'new')
2. Contacted (status: 'contacted')
3. Qualified (status: 'qualified')
4. Customer (recordType: 'customer', status: 'active')
5. Service relationship (contracts, equipment, service_tickets)

### Equipment Lifecycle
Equipment management through related entities:
1. Equipment installation (equipment table)
2. Service contracts (contracts table)
3. Usage monitoring (meter_readings table)
4. Service dispatch (service_tickets table)
5. Billing automation (invoices table)

## Usage Guidelines

### Adding New Tables
1. Always include `tenantId` for multi-tenant isolation
2. Add `locationId` for location-specific data
3. Include standard `createdAt`/`updatedAt` timestamps
4. Use UUID primary keys with `gen_random_uuid()` default
5. Document relationships in this hierarchy

### Extending Existing Tables
1. Use `jsonb` columns for flexible schema extensions
2. Maintain backward compatibility with existing API contracts
3. Update this documentation when adding significant fields
4. Consider E-Automate integration needs for customer-related tables

### E-Automate Integration Strategy
Customer migration fields in business_records:
- `external_customer_id`: Maps to E-Automate customer ID
- `external_system_id`: Identifies source system
- `migration_status`: Tracks migration progress
- `external_data`: Stores additional E-Automate fields as JSON

## Data Enrichment & Lead Intelligence Layer

### `enriched_contacts` (ZoomInfo/Apollo.io Integration)
**Purpose**: Stores enriched contact data from external prospecting platforms
**Function**: Lead intelligence, contact enrichment, prospecting workflow management
**Headers/Fields**:
- `id` (uuid, PRIMARY KEY, default: gen_random_uuid()) - Contact record identifier
- `tenant_id` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `first_name` (varchar) - Contact first name
- `last_name` (varchar) - Contact last name
- `full_name` (varchar) - Complete contact name
- `email` (varchar) - Primary email address
- `phone` (varchar) - Primary phone number
- `job_title` (varchar) - Current job title/position
- `job_function` (varchar) - Functional area (Sales, Marketing, IT, etc.)
- `management_level` (varchar) - Management tier (Entry, Middle, Senior, Executive)
- `department` (varchar) - Department/division
- `seniority` (varchar) - Years of experience level
- `company_name` (varchar) - Associated company name
- `company_linkedin_url` (varchar) - Company LinkedIn profile
- `person_linkedin_url` (varchar) - Personal LinkedIn profile
- `twitter_username` (varchar) - Twitter handle
- `github_username` (varchar) - GitHub username
- `facebook_url` (varchar) - Facebook profile URL
- `lead_score` (integer, default: 0) - Algorithmic lead scoring (0-100)
- `prospecting_status` (varchar, default: 'new') - Workflow status (new/contacted/qualified/opportunity/closed)
- `last_contact_date` (timestamp) - Last outreach attempt
- `next_follow_up_date` (timestamp) - Scheduled follow-up date
- `enrichment_source` (varchar, NOT NULL) - Data source (zoominfo/apollo/manual)
- `source_person_id` (varchar) - External platform person ID
- `last_enriched_date` (timestamp, default: now()) - Last data refresh
- `created_at` (timestamp, default: now()) - Record creation timestamp
- `updated_at` (timestamp, default: now()) - Last update timestamp
**Relationships**:
- Many-to-One with tenants
- Can be converted to business_records upon qualification

### `enriched_companies` (Company Intelligence)
**Purpose**: Stores enriched company data and firmographic information
**Function**: Account intelligence, target account identification, company profiling
**Headers/Fields**:
- `id` (uuid, PRIMARY KEY, default: gen_random_uuid()) - Company record identifier
- `tenant_id` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `company_name` (varchar, NOT NULL) - Official company name
- `primary_industry` (varchar) - Primary industry classification
- `secondary_industries` (text[]) - Additional industry categories
- `employee_count` (integer) - Total employee count
- `annual_revenue` (bigint) - Annual revenue in USD
- `company_stage` (varchar) - Business stage (Startup/Growth/Established/Enterprise)
- `headquarters_country` (varchar) - HQ country
- `headquarters_state` (varchar) - HQ state/province
- `headquarters_city` (varchar) - HQ city
- `website` (varchar) - Primary company website
- `company_linkedin_url` (varchar) - Company LinkedIn page
- `technology_stack` (text[]) - Known technologies used
- `target_account_tier` (varchar) - Sales classification (SMB/Mid-Market/Enterprise)
- `lead_score` (integer, default: 0) - Company-level lead score
- `enrichment_source` (varchar, NOT NULL) - Data source (zoominfo/apollo/manual)
- `source_company_id` (varchar) - External platform company ID
- `last_enriched_date` (timestamp, default: now()) - Last data refresh
- `created_at` (timestamp, default: now()) - Record creation timestamp
- `updated_at` (timestamp, default: now()) - Last update timestamp
**Relationships**:
- Many-to-One with tenants
- One-to-Many with enriched_contacts (implicit via company_name)

### `prospecting_campaigns` (Campaign Management)
**Purpose**: Manages prospecting campaigns and outreach workflows
**Function**: Campaign tracking, performance metrics, ROI analysis
**Headers/Fields**:
- `id` (uuid, PRIMARY KEY, default: gen_random_uuid()) - Campaign identifier
- `tenant_id` (varchar, NOT NULL, FOREIGN KEY) - References tenants.id
- `campaign_name` (varchar, NOT NULL) - Campaign display name
- `campaign_type` (varchar, NOT NULL) - Campaign type (email_sequence/phone_campaign/linkedin_outreach/mixed)
- `campaign_description` (text) - Campaign description and notes
- `target_industry` (varchar) - Targeted industry vertical
- `target_company_size` (varchar) - Target company size range
- `target_job_titles` (text[]) - Targeted job titles/roles
- `status` (varchar, default: 'active') - Campaign status (draft/active/paused/completed/cancelled)
- `total_contacts` (integer, default: 0) - Total contacts in campaign
- `contacted_count` (integer, default: 0) - Contacts reached
- `response_count` (integer, default: 0) - Positive responses received
- `response_rate` (decimal(5,4)) - Response rate percentage
- `conversion_count` (integer, default: 0) - Qualified leads generated
- `conversion_rate` (decimal(5,4)) - Conversion rate percentage
- `start_date` (timestamp, default: now()) - Campaign start date
- `end_date` (timestamp) - Campaign end date
- `created_at` (timestamp, default: now()) - Record creation timestamp
- `updated_at` (timestamp, default: now()) - Last update timestamp
**Relationships**:
- Many-to-One with tenants
- One-to-Many with enriched_contacts (via campaign association)

## Salesforce Integration Layer

### Salesforce Field Mappings (140+ Fields)
**Purpose**: Complete field mapping compatibility for Salesforce data migration
**Function**: Dual-platform support enabling seamless CRM transitions

#### Account Mappings (35+ Fields)
**Salesforce → Printyx business_records mapping**:
- `Id` → `external_customer_id`
- `Name` → `company_name`
- `Website` → `website`
- `Phone` → `phone`
- `Industry` → `industry`
- `AnnualRevenue` → `annual_revenue`
- `NumberOfEmployees` → `employee_count`
- `BillingAddress` → `address` (structured)
- `ShippingAddress` → `shipping_address` (structured)
- `Description` → `description`
- `AccountSource` → `lead_source`
- `Rating` → `account_rating`
- `Type` → `account_type`
- `ParentId` → `parent_account_id`
- `AccountNumber` → `account_number`
- `Site` → `site_location`
- `TickerSymbol` → `ticker_symbol`
- `Ownership` → `ownership_type`
- `Fax` → `fax`
- `SicDesc` → `sic_description`
- Plus 15+ custom fields and additional metadata

#### Contact Mappings (40+ Fields)
**Salesforce → Printyx enriched_contacts mapping**:
- `Id` → `source_person_id`
- `FirstName` → `first_name`
- `LastName` → `last_name`
- `Email` → `email`
- `Phone` → `phone`
- `Title` → `job_title`
- `Department` → `department`
- `AccountId` → Links to company via `company_name`
- `MailingAddress` → `mailing_address` (structured)
- `OtherAddress` → `other_address` (structured)
- `MobilePhone` → `mobile_phone`
- `HomePhone` → `home_phone`
- `OtherPhone` → `other_phone`
- `AssistantName` → `assistant_name`
- `AssistantPhone` → `assistant_phone`
- `Birthdate` → `birth_date`
- `LeadSource` → `lead_source`
- `Level__c` → `management_level`
- `LinkedInProfile__c` → `person_linkedin_url`
- `TwitterHandle__c` → `twitter_username`
- Plus 20+ custom fields and social profiles

#### Opportunity Mappings (35+ Fields)
**Salesforce → Printyx opportunities/deals mapping**:
- `Id` → `external_opportunity_id`
- `Name` → `deal_name`
- `Amount` → `deal_value`
- `CloseDate` → `expected_close_date`
- `StageName` → `deal_stage`
- `Probability` → `win_probability`
- `AccountId` → Links to business_records
- `Type` → `opportunity_type`
- `LeadSource` → `lead_source`
- `NextStep` → `next_step`
- `Description` → `description`
- `IsWon` → `is_won`
- `IsClosed` → `is_closed`
- `ForecastCategory` → `forecast_category`
- `ForecastCategoryName` → `forecast_category_name`
- `ExpectedRevenue` → `expected_revenue`
- `TotalOpportunityQuantity` → `total_quantity`
- `CampaignId` → `campaign_id`
- `Pricebook2Id` → `price_book_id`
- `ContractId` → Links to contracts table
- Plus 15+ custom opportunity fields

#### Activity Mappings (30+ Fields)
**Salesforce → Printyx activities/tasks mapping**:
- `Id` → `external_activity_id`
- `Subject` → `task_title`
- `Description` → `description`
- `Status` → `status`
- `Priority` → `priority`
- `ActivityDate` → `due_date`
- `WhoId` → Links to contacts
- `WhatId` → Links to accounts/opportunities
- `Type` → `activity_type`
- `IsTask` → `is_task`
- `IsEvent` → `is_event`
- `StartDateTime` → `start_date`
- `EndDateTime` → `end_date`
- `DurationInMinutes` → `duration_minutes`
- `Location` → `location`
- `IsAllDayEvent` → `is_all_day`
- `IsRecurrence` → `is_recurring`
- `CallDurationInSeconds` → `call_duration`
- `CallType` → `call_type`
- `CallDisposition` → `call_outcome`
- Plus 10+ custom activity fields

### Migration Workflow Support
**Data Migration Process**:
1. **Extract**: Pull data from Salesforce APIs using field mappings
2. **Transform**: Convert Salesforce schema to Printyx schema
3. **Load**: Insert into appropriate Printyx tables with tenant isolation
4. **Validate**: Ensure data integrity and relationship consistency
5. **Reconcile**: Handle conflicts and duplicate detection

**Migration Status Tracking**:
- `migration_status` field in business_records
- `external_system_id` for source system identification
- `external_data` JSONB field for unmapped custom fields
- Comprehensive audit trail for data lineage

## Integration Architecture Summary

### Dual-Platform Strategy
**Complete Market Coverage**:
- **E-Automate**: 90% of copier dealer market
- **Salesforce**: Enterprise and growth dealers
- **Combined**: 100% dealer market coverage

### Data Enrichment Workflow
**Lead Intelligence Pipeline**:
1. **Prospecting**: ZoomInfo/Apollo.io contact discovery
2. **Enrichment**: Company and contact data enhancement
3. **Scoring**: Algorithmic lead qualification
4. **Campaigns**: Automated outreach workflows
5. **Conversion**: Qualified leads → business_records
6. **Analytics**: Performance tracking and ROI measurement

### Schema Design Principles
**Multi-Tenant Isolation**: All enrichment tables include tenant_id
**Source Attribution**: Track data origin and refresh timestamps
**Flexible Schema**: JSONB fields for platform-specific extensions
**Relationship Integrity**: Foreign key constraints with proper cascading
**Performance Optimization**: Indexed columns for common queries

Last Updated: August 2, 2025