# Navigation & Page Functionality Testing Checklist

## Overview
This document provides a systematic approach to testing all navigation routes and page functionality in the Printyx application.

**Last Updated**: 2025-12-20
**Status**: In Progress
**Branch**: `claude/navigation-page-functionality-TTTMi`

---

## Navigation Systems

### ✅ Navigation Components to Test

- [ ] **Desktop Sidebar** (`RoleAwareCollapsibleSidebar.tsx`)
  - [ ] All sections expand/collapse correctly
  - [ ] Search functionality works
  - [ ] Active page highlighting works
  - [ ] Role-based section visibility
  - [ ] User profile footer displays correctly

- [ ] **Mobile Bottom Navigation** (`mobile-bottom-nav.tsx`)
  - [ ] All 5 tabs navigate correctly
  - [ ] Active state highlights properly
  - [ ] "More" button opens full menu
  - [ ] Only visible on mobile breakpoints

- [ ] **Command Palette**
  - [ ] Opens with Cmd/Ctrl+K
  - [ ] Search works across all pages
  - [ ] Quick actions function correctly
  - [ ] Keyboard navigation works

---

## Public/Marketing Routes

### Authentication Pages
- [ ] `/login` - Login page loads and functions
  - [ ] Email/password fields work
  - [ ] Form validation displays errors
  - [ ] Submit button triggers login
  - [ ] Redirects to dashboard on success
  - [ ] "Forgot password" link works
  - [ ] "Sign up" link works

- [ ] `/signup` - Signup page loads and functions
  - [ ] All form fields render
  - [ ] Validation works
  - [ ] Submit creates account
  - [ ] Email verification sent
  - [ ] Redirects appropriately

- [ ] `/forgot-password` - Password reset request
  - [ ] Email field works
  - [ ] Submit sends reset email
  - [ ] Success message displays

- [ ] `/reset-password` - Password reset form
  - [ ] Token validation works
  - [ ] New password fields function
  - [ ] Submit resets password
  - [ ] Redirects to login

- [ ] `/verify-email` - Email verification
  - [ ] Verifies email token
  - [ ] Shows success/error messages
  - [ ] Redirects appropriately

- [ ] `/auth/callback` - OAuth callback
  - [ ] Handles Supabase auth callback
  - [ ] Redirects to dashboard

### Marketing Pages
- [ ] `/` - Homepage
  - [ ] Hero section loads
  - [ ] CTAs function
  - [ ] Navigation links work
  - [ ] Images load properly

- [ ] `/predictive-intelligence` - Feature landing page
- [ ] `/modern-architecture` - Feature landing page
- [ ] `/integration-marketplace` - Integrations page
- [ ] `/dealer-expertise` - Expertise page

### Blog Routes
- [ ] `/blog` - Blog index
  - [ ] Articles list displays
  - [ ] Search/filter works
  - [ ] Pagination functions

- [ ] `/blog/:slug` - Individual blog posts
  - [ ] Article content loads
  - [ ] Metadata displays
  - [ ] Related articles show

### Conversion Pages
- [ ] `/roi-calculator` - ROI calculator
  - [ ] Calculator inputs work
  - [ ] Calculations are accurate
  - [ ] Results display properly
  - [ ] Form submission works

- [ ] `/case-studies` - Case studies page
- [ ] `/battle-card` - Competitive battle card

### Legal Pages
- [ ] `/eula` - End User License Agreement
- [ ] `/privacy` - Privacy Policy
- [ ] `/terms` - Terms & Conditions

---

## Authenticated Application Routes

### Dashboard & Core
- [ ] `/` - Main Dashboard
  - [ ] Dashboard widgets load
  - [ ] Role-based widgets display
  - [ ] Data refreshes properly
  - [ ] Filters work
  - [ ] Charts render correctly

- [ ] `/today` - Today Dashboard
  - [ ] Today's tasks display
  - [ ] Calendar integration works
  - [ ] Quick actions function

### Sales Hub Routes

#### Lead & Contact Management
- [ ] `/leads-management` - Leads page
  - [ ] Leads table loads
  - [ ] Search/filter works
  - [ ] Sort functionality works
  - [ ] Bulk operations work
  - [ ] **Add Lead button**
    - [ ] Opens add lead form/modal
    - [ ] All fields render
    - [ ] Validation works
    - [ ] Submit creates lead
    - [ ] Success toast shows
  - [ ] **Edit Lead button**
    - [ ] Opens edit form with pre-filled data
    - [ ] Changes save correctly
  - [ ] **Delete Lead button**
    - [ ] Confirmation modal appears
    - [ ] Delete removes lead
  - [ ] **Lead Status dropdown**
    - [ ] Status options load
    - [ ] Status updates save
  - [ ] **Bulk Actions toolbar**
    - [ ] Multi-select works
    - [ ] Bulk delete works
    - [ ] Bulk status change works
  - [ ] **Export button**
    - [ ] CSV export works
    - [ ] Excel export works
    - [ ] PDF export works
  - [ ] **Inline editing**
    - [ ] Click-to-edit functions
    - [ ] Changes save immediately
    - [ ] Validation works

- [ ] `/data-enrichment` - Lead enrichment
  - [ ] Apollo.io integration works
  - [ ] ZoomInfo integration works
  - [ ] Enrichment data displays
  - [ ] Bulk enrichment functions

- [ ] `/contacts` - Contacts page
  - [ ] Contacts table loads
  - [ ] CRUD operations work
  - [ ] Contact details show
  - [ ] Associated company links work

#### Opportunity & Pipeline Management
- [ ] `/opportunities` - Opportunities page
  - [ ] Opportunities list loads
  - [ ] Pipeline stages display
  - [ ] Drag-and-drop works (if applicable)
  - [ ] **Add Opportunity button**
  - [ ] **Edit Opportunity button**
  - [ ] **Delete Opportunity button**
  - [ ] **Stage dropdown**
  - [ ] **Amount field**
  - [ ] **Close date picker**
  - [ ] **Probability slider**
  - [ ] Filters work

- [ ] `/deals` - Deals Management
  - [ ] Deals pipeline loads
  - [ ] Deal cards render
  - [ ] Stage changes work
  - [ ] Deal details modal works

- [ ] `/sales-pipeline` - Pipeline workflow
  - [ ] Pipeline visualization loads
  - [ ] Stage metrics display
  - [ ] Conversion rates show

- [ ] `/sales-pipeline-forecasting` - Forecasting
  - [ ] Forecast data loads
  - [ ] Predictions display
  - [ ] Historical data shows

- [ ] `/crm-goals-dashboard` - Goals dashboard
  - [ ] Goals display
  - [ ] Progress bars render
  - [ ] Goal creation works

#### Quotes & Proposals
- [ ] `/quote-proposal-generation` - Quote/proposal hub
- [ ] `/quotes` - Quotes management
  - [ ] Quotes list loads
  - [ ] **New Quote button** → `/quotes/new`
  - [ ] **Edit Quote button** → `/quotes/:quoteId`
  - [ ] **View Quote button** → `/quotes/:quoteId/view`
  - [ ] **Delete Quote button**
  - [ ] **Clone Quote button**
  - [ ] **Send Quote button**
  - [ ] **Convert to Proposal button**
  - [ ] Quote status updates work

- [ ] `/quotes/new` - New quote builder
  - [ ] Quote builder UI loads
  - [ ] Product selection works
  - [ ] Pricing calculations accurate
  - [ ] Terms & conditions add
  - [ ] Save as draft works
  - [ ] Submit quote works

- [ ] `/quotes/:quoteId` - Edit quote
  - [ ] Quote data loads
  - [ ] All fields editable
  - [ ] Changes save
  - [ ] Version history shows

- [ ] `/quotes/:quoteId/view` - View quote
  - [ ] Read-only view displays
  - [ ] PDF generation works
  - [ ] Email quote works
  - [ ] Download works

- [ ] `/proposal-builder` - Proposal builder
  - [ ] Template selection works
  - [ ] Content editor functions
  - [ ] Section management works
  - [ ] Save/submit works

#### Deal Management & Approvals
- [ ] `/deal-desk` - Deal desk dashboard
  - [ ] Approval requests load
  - [ ] Pending approvals show
  - [ ] **Approve button**
  - [ ] **Reject button**
  - [ ] **Request Changes button**
  - [ ] Comments/notes work

- [ ] `/deal-desk/requests/:id` - Approval detail
  - [ ] Request details load
  - [ ] Approval workflow displays
  - [ ] History shows
  - [ ] Actions function

- [ ] `/deal-desk/rules` - Approval rules
  - [ ] Rules list loads
  - [ ] **Add Rule button**
  - [ ] **Edit Rule button**
  - [ ] **Delete Rule button**
  - [ ] Rule conditions work

- [ ] `/pipeline-config` - Pipeline configuration
  - [ ] Pipeline stages load
  - [ ] **Add Stage button**
  - [ ] **Edit Stage button**
  - [ ] **Delete Stage button**
  - [ ] **Reorder stages** (drag-and-drop)
  - [ ] Stage probability settings work

#### Other Sales Routes
- [ ] `/demo-scheduling` - Demo scheduler
  - [ ] Calendar loads
  - [ ] **Schedule Demo button**
  - [ ] **Reschedule button**
  - [ ] **Cancel button**
  - [ ] Calendar integration works

- [ ] `/contracts` - Contracts management
- [ ] `/document-builder` - Document builder
- [ ] `/customer-success-management` - Customer success
- [ ] `/sales-command-center` - Sales command center
- [ ] `/commission-management` - Commission tracking

### Service Hub Routes

- [ ] `/service-hub` - Service hub dashboard
  - [ ] Service metrics load
  - [ ] **Create Service Call button**
  - [ ] Open tickets display
  - [ ] Technician availability shows

- [ ] `/onboarding` - Onboarding checklists
  - [ ] Checklists load
  - [ ] **Add Checklist button**
  - [ ] **Complete Item checkbox**
  - [ ] Progress tracking works

- [ ] `/service-dispatch` - Service dispatch
  - [ ] Service calls list loads
  - [ ] **New Service Call button**
    - [ ] Opens service call form
    - [ ] Customer selection works
    - [ ] Equipment selection works
    - [ ] Technician assignment works
    - [ ] Priority dropdown works
    - [ ] Submit creates service call
  - [ ] **Edit Service Call button**
  - [ ] **Assign Technician dropdown**
  - [ ] **Change Status dropdown**
  - [ ] **Add Notes button**
  - [ ] Map view loads (if applicable)
  - [ ] Route optimization works

- [ ] `/technician-management` - Technicians
  - [ ] Technicians list loads
  - [ ] **Add Technician button**
  - [ ] **Edit Technician button**
  - [ ] Schedule management works
  - [ ] Skills tracking works

- [ ] `/vehicle-management` - Vehicles
  - [ ] Vehicles list loads
  - [ ] **Add Vehicle button**
  - [ ] Maintenance tracking works
  - [ ] Assignment works

- [ ] `/asset-management` - Assets
  - [ ] Assets list loads
  - [ ] CRUD operations work
  - [ ] Asset tracking works

- [ ] `/remote-monitoring` - Remote monitoring
  - [ ] Device list loads
  - [ ] Real-time metrics display
  - [ ] Alerts show
  - [ ] **Add Device button**

- [ ] `/fleet-monitoring` - Fleet monitoring
  - [ ] Fleet map loads
  - [ ] GPS tracking works
  - [ ] Vehicle statuses show

- [ ] `/meter-readings` - Meter readings
  - [ ] Readings list loads
  - [ ] **Add Reading button**
  - [ ] **Import Readings button**
  - [ ] Bulk import works

- [ ] `/preventive-maintenance-scheduling` - PM scheduling
  - [ ] PM schedules load
  - [ ] **Create Schedule button**
  - [ ] Calendar integration works
  - [ ] Recurring schedules work

- [ ] `/preventive-maintenance-automation` - PM automation
- [ ] `/mobile-field-service` - Mobile field service
- [ ] `/mobile-field-operations` - Mobile operations
- [ ] `/mobile-service-app` - Mobile app
- [ ] `/service-analytics` - Service analytics
- [ ] `/incident-response-system` - Incident response
- [ ] `/manufacturer-integration` - Manufacturer integration

### Product Hub Routes

- [ ] `/product-hub` - Unified product hub
  - [ ] Product categories load
  - [ ] **Add Product button**
  - [ ] Search works
  - [ ] Filters work

- [ ] `/product-catalog` - Product catalog
  - [ ] Catalog loads
  - [ ] Product cards display
  - [ ] Filters work

- [ ] `/product-models` - Product models
  - [ ] Models list loads
  - [ ] **Add Model button**
  - [ ] **Edit Model button**
  - [ ] **Delete Model button**
  - [ ] Specifications display

- [ ] `/product-accessories` - Accessories
  - [ ] Accessories list loads
  - [ ] CRUD operations work
  - [ ] Compatibility tracking works

- [ ] `/supplies` - Supplies
- [ ] `/software-products` - Software products
- [ ] `/professional-services` - Professional services
- [ ] `/managed-services` - Managed services
- [ ] `/service-products` - Service products

### Equipment Lifecycle Routes

- [ ] `/equipment-lifecycle` - Equipment hub
  - [ ] Equipment lifecycle stages display
  - [ ] Equipment list loads
  - [ ] **Add Equipment button**
  - [ ] Status tracking works

- [ ] `/purchase-orders` - Purchase orders
  - [ ] PO list loads
  - [ ] **Create PO button**
    - [ ] PO form loads
    - [ ] Vendor selection works
    - [ ] Line item addition works
    - [ ] Total calculations work
    - [ ] Submit creates PO
  - [ ] **Edit PO button**
  - [ ] **Delete PO button**
  - [ ] **Approve PO button**
  - [ ] **Receive Items button**
  - [ ] **Print PO button**
  - [ ] Status workflow works

- [ ] `/warehouse-operations` - Warehouse ops
  - [ ] Warehouse dashboard loads
  - [ ] **Add Inventory button**
  - [ ] **Move Stock button**
  - [ ] **Cycle Count button**
  - [ ] Bin locations work

- [ ] `/inventory` - Inventory management
  - [ ] Inventory list loads
  - [ ] **Add Item button**
  - [ ] **Adjust Quantity button**
  - [ ] Stock levels display
  - [ ] Low stock alerts work
  - [ ] **Bulk Actions toolbar**

- [ ] `/equipment-lifecycle-management` - Equipment mgmt

### Billing Hub Routes

- [ ] `/billing` - Billing hub / Meter billing
  - [ ] Billing dashboard loads
  - [ ] Meter billing data shows
  - [ ] **Create Invoice button**
  - [ ] **Process Payment button**
  - [ ] Usage calculations work

- [ ] `/leases` - Leases management
  - [ ] Leases list loads
  - [ ] **New Lease button** → `/leases/new`
  - [ ] **Edit Lease button** → `/leases/:id/edit`
  - [ ] **View Lease button** → `/leases/:id`
  - [ ] Lease schedules work

- [ ] `/leases/new` - New lease form
  - [ ] Lease form loads
  - [ ] All fields render
  - [ ] Payment schedule generator works
  - [ ] Submit creates lease

- [ ] `/leases/:id` - Lease detail
  - [ ] Lease details load
  - [ ] Payment history displays
  - [ ] Documents show
  - [ ] **Edit button**
  - [ ] **Delete button**

- [ ] `/leases/:id/edit` - Edit lease
  - [ ] Pre-filled form loads
  - [ ] Changes save correctly

- [ ] `/chart-of-accounts` - Chart of accounts
  - [ ] Accounts tree loads
  - [ ] **Add Account button**
  - [ ] **Edit Account button**
  - [ ] Account hierarchy works

- [ ] `/advanced-billing` - Advanced billing
  - [ ] Billing rules load
  - [ ] **Add Rule button**
  - [ ] Usage-based billing works
  - [ ] Tiered pricing works

- [ ] `/meter-billing` - Meter billing (duplicate of /billing)
- [ ] `/invoices` - Invoices
  - [ ] Invoices list loads
  - [ ] **Create Invoice button**
  - [ ] **Edit Invoice button**
  - [ ] **Send Invoice button**
  - [ ] **Print Invoice button**
  - [ ] **Record Payment button**
  - [ ] PDF generation works

- [ ] `/accounts-receivable` - A/R
  - [ ] A/R dashboard loads
  - [ ] Aging report shows
  - [ ] **Record Payment button**
  - [ ] Payment matching works

- [ ] `/accounts-payable` - A/P
  - [ ] A/P dashboard loads
  - [ ] Bills list loads
  - [ ] **Create Bill button**
  - [ ] **Pay Bill button**
  - [ ] Approval workflow works

- [ ] `/vendors` - Vendors
  - [ ] Vendors list loads
  - [ ] **Add Vendor button**
  - [ ] **Edit Vendor button**
  - [ ] Vendor details show

- [ ] `/journal-entries` - Journal entries
  - [ ] Entries list loads
  - [ ] **New Entry button**
  - [ ] Debit/credit validation works
  - [ ] Posting works

- [ ] `/financial-forecasting` - Financial forecasting

### Reports Hub Routes

- [ ] `/reports` - Reports hub
  - [ ] Reports list loads
  - [ ] **Run Report button**
  - [ ] **Custom Report button** → `/reports/custom/new`
  - [ ] **Schedule Report button**
  - [ ] Report categories show
  - [ ] Favorites work

- [ ] `/reports/custom/new` - Custom report builder
  - [ ] Report builder loads
  - [ ] Data source selection works
  - [ ] Column selection works
  - [ ] Filter builder works
  - [ ] Chart selection works
  - [ ] Save report works
  - [ ] Run report works

- [ ] `/custom-dashboard` - Custom dashboards
  - [ ] Dashboard builder loads
  - [ ] Widget library shows
  - [ ] Drag-and-drop works
  - [ ] Widget configuration works
  - [ ] Save dashboard works

- [ ] `/performance-monitoring` - Performance monitoring
- [ ] `/advanced-reporting` - Advanced reporting
- [ ] `/advanced-analytics` - Advanced analytics
- [ ] `/predictive-analytics` - Predictive analytics
- [ ] `/ai-analytics-dashboard` - AI analytics

### Task Management Routes

- [ ] `/tasks` - Task hub
  - [ ] Tasks list loads
  - [ ] **Add Task button**
    - [ ] Task form opens
    - [ ] All fields render
    - [ ] Due date picker works
    - [ ] Assignee selection works
    - [ ] Priority dropdown works
    - [ ] Submit creates task
  - [ ] **Edit Task button**
  - [ ] **Delete Task button**
  - [ ] **Complete Task checkbox**
  - [ ] **Assign Task dropdown**
  - [ ] **Change Priority dropdown**
  - [ ] **Change Status dropdown**
  - [ ] **Add Comment button**
  - [ ] Task filters work
  - [ ] My Tasks view works
  - [ ] Team Tasks view works
  - [ ] Calendar view works

- [ ] `/task-management` - Advanced tasks (redirects to /tasks)
- [ ] `/basic-tasks` - Basic tasks (redirects to /tasks)
- [ ] `/my-tasks` - My tasks (redirects to /tasks)

### AI Hub Routes

- [ ] `/ai-hub` - AI hub dashboard
  - [ ] AI features overview loads
  - [ ] Quick actions work
  - [ ] Recent AI interactions show

- [ ] `/ai-employees` - AI employees
  - [ ] AI employee dashboard loads
  - [ ] **Chat interface**
    - [ ] Message input works
    - [ ] Send button functions
    - [ ] Responses stream
    - [ ] History shows
  - [ ] **New Conversation button**
  - [ ] Context selection works

- [ ] `/calendar` - Calendar integration
  - [ ] Calendar loads
  - [ ] **Add Event button**
  - [ ] Google Calendar sync works
  - [ ] Microsoft Calendar sync works
  - [ ] Event CRUD works

- [ ] `/meeting-transcription` - Meeting transcription
  - [ ] Transcription list loads
  - [ ] **Upload Recording button**
  - [ ] **Start Live Transcription button**
  - [ ] Transcripts display
  - [ ] AI summary works

- [ ] `/ai-search` - AI search & knowledge
  - [ ] Search interface loads
  - [ ] **Search bar** functions
  - [ ] AI-powered results show
  - [ ] Semantic search works
  - [ ] Knowledge base integration works

- [ ] `/ai-task-scheduling` - AI task scheduling (redirects to /tasks)

- [ ] `/conversational-ai-dashboard` - Conversational AI
  - [ ] Chatbot interface loads
  - [ ] **Message input**
  - [ ] Conversation history shows
  - [ ] AI suggestions work

### Knowledge Base Routes

- [ ] `/knowledge-base` - KB home
  - [ ] Articles list loads
  - [ ] Categories display
  - [ ] **Search bar** works
  - [ ] **Filter dropdown** works
  - [ ] Article previews show
  - [ ] View count tracking works

- [ ] `/knowledge-base/article/:slug` - Article view
  - [ ] Article content loads
  - [ ] TOC (table of contents) shows
  - [ ] **Was this helpful?** feedback works
  - [ ] Related articles show
  - [ ] **Share button** works
  - [ ] **Print button** works

- [ ] `/knowledge-base/category/:slug` - Category view
  - [ ] Category articles load
  - [ ] Breadcrumbs work
  - [ ] Subcategories show

### Integrations Routes

- [ ] `/integration-hub` - Integrations hub
  - [ ] Available integrations load
  - [ ] **Connect button** works
  - [ ] Active integrations show
  - [ ] **Disconnect button** works
  - [ ] Integration settings work

- [ ] `/quickbooks-integration` - QuickBooks
  - [ ] QuickBooks connection status shows
  - [ ] **Connect QuickBooks button**
  - [ ] **Sync Now button**
  - [ ] Field mapping configuration works
  - [ ] Sync history shows
  - [ ] Error logs display

- [ ] `/erp-integration` - ERP integration
- [ ] `/esignature-integration` - E-signature
- [ ] `/system-integrations` - System integrations

### System Administration Routes

- [ ] `/seo` - SEO management
  - [ ] SEO dashboard loads
  - [ ] **Add Meta Tags button**
  - [ ] **Edit Meta Tags button**
  - [ ] Schema markup editor works
  - [ ] Sitemap generation works

- [ ] `/workflow-automation` - Workflow automation
  - [ ] Workflows list loads
  - [ ] **Create Workflow button**
  - [ ] Workflow builder loads
  - [ ] Trigger configuration works
  - [ ] Action configuration works
  - [ ] **Test Workflow button**
  - [ ] **Activate Workflow button**

- [ ] `/business-process-optimization` - BPO
- [ ] `/document-management` - Document management
- [ ] `/security-compliance-management` - Security & compliance
- [ ] `/deployment-readiness` - Deployment readiness
- [ ] `/customer-number-settings` - Customer number settings

### Platform Admin Routes (Platform Roles Only)

- [ ] `/admin-hub` - Admin hub
- [ ] `/admin-command-center` - Admin command center
- [ ] `/root-admin-dashboard` - Root admin dashboard

#### Tenant & Organization Management
- [ ] `/admin/tenant-management` - Tenant management
  - [ ] Tenants list loads
  - [ ] **Add Tenant button**
  - [ ] **Edit Tenant button**
  - [ ] **Suspend Tenant button**
  - [ ] Tenant details show

- [ ] `/tenant-setup` - Tenant onboarding
  - [ ] Onboarding wizard loads
  - [ ] Step progression works
  - [ ] Configuration saves
  - [ ] Setup completion works

- [ ] `/root-admin-signups-crm` - Signups & trials CRM
  - [ ] Signups list loads
  - [ ] Trial management works
  - [ ] Conversion tracking shows

- [ ] `/customer-self-service-portal` - Customer portal (admin view)

#### User & Access Management
- [ ] `/admin/user-management` - User management
  - [ ] Users list loads
  - [ ] **Add User button**
  - [ ] **Edit User button**
  - [ ] **Deactivate User button**
  - [ ] **Reset Password button**
  - [ ] Role assignment works

- [ ] `/role-management` - Role management
  - [ ] Roles list loads
  - [ ] **Add Role button**
  - [ ] **Edit Role button**
  - [ ] **Clone Role button**
  - [ ] Permission matrix works
  - [ ] Permission assignment works

- [ ] `/admin/root-admin-security` - Security & permissions
- [ ] `/security-compliance-management` - Audit & compliance

#### System Operations
- [ ] `/database-management` - Database management
  - [ ] Database stats load
  - [ ] **Backup button** works
  - [ ] **Restore button** works
  - [ ] Query console works
  - [ ] Migration status shows

- [ ] `/platform-configuration` - System configuration
  - [ ] Config settings load
  - [ ] **Edit Config button**
  - [ ] Settings save correctly
  - [ ] Environment variables show

- [ ] `/mobile-optimization` - Mobile optimization
- [ ] `/system-monitoring` - System monitoring

#### Platform Features
- [ ] `/root-admin/seo` - SEO management (platform)
- [ ] `/social-media-generator` - Social media generator
  - [ ] Template selection works
  - [ ] **Generate Content button**
  - [ ] AI content generation works
  - [ ] **Post to Social button** works
  - [ ] Scheduling works

- [ ] `/gpt5-dashboard` - GPT-5 AI dashboard

### Customers & CRM Routes

- [ ] `/customers` - Customers & CRM hub
  - [ ] Customer list loads
  - [ ] **Add Customer button**
    - [ ] Customer form opens
    - [ ] All fields render
    - [ ] Address autocomplete works
    - [ ] Contact fields work
    - [ ] Submit creates customer
  - [ ] **Edit Customer button**
  - [ ] **Delete Customer button**
  - [ ] **Convert Lead button** (for leads)
  - [ ] **Tab filters** work (Leads, Prospects, Active)
  - [ ] **Search bar** functions
  - [ ] **Export button** works
  - [ ] Bulk operations work

- [ ] `/customers/:slug` - Customer detail
  - [ ] Customer details load
  - [ ] Contact information displays
  - [ ] **Edit button** works
  - [ ] **Add Note button** works
  - [ ] **Add Contact button** works
  - [ ] Activity timeline shows
  - [ ] Related records show (opportunities, quotes, service calls)
  - [ ] Documents tab works
  - [ ] Communication tab works

- [ ] `/customers?tab=leads` - Leads filter
- [ ] `/customers?tab=prospects` - Prospects filter
- [ ] `/customers?tab=active` - Active customers filter

### Settings Routes

- [ ] `/settings` - Settings hub
  - [ ] Settings categories load
  - [ ] **Company Settings** tab
    - [ ] Company info editable
    - [ ] Logo upload works
    - [ ] Branding settings work
  - [ ] **User Profile** tab
    - [ ] Profile fields editable
    - [ ] Avatar upload works
    - [ ] Password change works
    - [ ] 2FA setup works
  - [ ] **Notifications** tab
    - [ ] Notification preferences load
    - [ ] Toggle switches work
    - [ ] Email preferences save
  - [ ] **Integrations** tab
  - [ ] **Billing** tab → `/settings/billing`
  - [ ] **Subscription** tab → `/settings/subscription`
  - [ ] Save button works

- [ ] `/settings/billing` - Billing settings
  - [ ] Current billing info loads
  - [ ] **Update Payment Method button**
  - [ ] Payment history shows
  - [ ] Invoice downloads work

- [ ] `/settings/subscription` - Subscription settings
  - [ ] Current plan shows
  - [ ] **Upgrade Plan button**
  - [ ] **Downgrade Plan button**
  - [ ] **Cancel Subscription button**
  - [ ] Feature comparison works
  - [ ] Usage metrics display

- [ ] `/monitoring-clients` - Monitoring clients
- [ ] `/device-monitoring` - Device monitoring
- [ ] `/oid-management` - OID management
- [ ] `/pricing` - Pricing page

### Other Routes

- [ ] `/import` - CSV import wizard
  - [ ] File upload works
  - [ ] **Upload CSV button**
  - [ ] Column mapping interface loads
  - [ ] Preview shows
  - [ ] Validation works
  - [ ] **Import button** processes data
  - [ ] Error reporting works
  - [ ] Success summary shows

- [ ] `/company-ids-test` - Company IDs test
- [ ] `/customer-access-management` - Customer access management
- [ ] `/apollo-leads` - Apollo lead enrichment

---

## Testing Methodology

### For Each Page:

1. **Navigation Test**
   - [ ] Page loads from sidebar link
   - [ ] Page loads from direct URL
   - [ ] Breadcrumbs show correctly
   - [ ] Back button works

2. **Layout Test**
   - [ ] Header displays correctly
   - [ ] Sidebar/navigation visible
   - [ ] Mobile bottom nav works (on mobile)
   - [ ] Footer displays (if applicable)
   - [ ] No layout breaks or overlaps

3. **Data Loading Test**
   - [ ] Loading states display
   - [ ] Data loads successfully
   - [ ] Empty states show when appropriate
   - [ ] Error states display properly
   - [ ] Pagination works
   - [ ] Infinite scroll works (if applicable)

4. **Search & Filter Test**
   - [ ] Search bar functions
   - [ ] Search results accurate
   - [ ] Filters apply correctly
   - [ ] Filter combinations work
   - [ ] Clear filters works
   - [ ] URL params update with filters

5. **Form Testing** (for each form)
   - [ ] Form fields render
   - [ ] Required field validation
   - [ ] Field format validation (email, phone, etc.)
   - [ ] Dropdown options load
   - [ ] Date pickers work
   - [ ] File uploads work
   - [ ] Auto-save works (if applicable)
   - [ ] Submit button triggers submission
   - [ ] Success message displays
   - [ ] Error messages display
   - [ ] Form resets after success

6. **Button/Action Testing** (for each button)
   - [ ] Button is visible
   - [ ] Button is clickable
   - [ ] Loading state shows during action
   - [ ] Success feedback displays
   - [ ] Error handling works
   - [ ] Permission checking works
   - [ ] Disabled state shows when appropriate

7. **Modal/Popup Testing** (for each modal)
   - [ ] Modal opens correctly
   - [ ] Modal content loads
   - [ ] Modal form works (if applicable)
   - [ ] Close button works
   - [ ] Backdrop click closes (if applicable)
   - [ ] Escape key closes
   - [ ] Modal doesn't break page scroll

8. **API Integration Testing**
   - [ ] GET requests load data
   - [ ] POST requests create records
   - [ ] PUT/PATCH requests update records
   - [ ] DELETE requests remove records
   - [ ] Error responses handled
   - [ ] Loading states during requests
   - [ ] Optimistic updates work (if applicable)
   - [ ] Cache invalidation works

9. **Role-Based Access Testing**
   - [ ] Page visible to correct roles
   - [ ] Page hidden from incorrect roles
   - [ ] Actions disabled for insufficient permissions
   - [ ] Error messages for unauthorized access

10. **Mobile Responsiveness Testing**
    - [ ] Layout adapts to mobile
    - [ ] Touch interactions work
    - [ ] Mobile navigation accessible
    - [ ] Forms usable on mobile
    - [ ] Tables scrollable/responsive

---

## Priority Testing Order

### Phase 1: Critical User Flows (Highest Priority)
1. Authentication (login, signup, password reset)
2. Dashboard loading
3. Customer management (CRUD)
4. Lead management (CRUD)
5. Service dispatch (CRUD)
6. Invoice creation
7. Settings/profile

### Phase 2: Core Features
1. Opportunities/deals management
2. Quote builder
3. Product catalog
4. Purchase orders
5. Inventory management
6. Reports hub

### Phase 3: Advanced Features
1. AI features
2. Workflow automation
3. Advanced billing
4. Predictive analytics
5. Integrations
6. Platform admin features

### Phase 4: Supporting Features
1. Knowledge base
2. Task management
3. Calendar integration
4. Document management
5. Mobile apps
6. Marketing pages

---

## Known Issues Log

| Route | Issue | Severity | Status | Notes |
|-------|-------|----------|--------|-------|
| | | | | |

---

## Testing Progress

- **Total Routes**: ~150+ authenticated routes
- **Routes Tested**: 0
- **Routes Passing**: 0
- **Routes with Issues**: 0
- **Completion**: 0%

---

## Next Steps

1. Set up local development environment
2. Start with Phase 1 critical user flows
3. Document issues as they're found
4. Create fix PRs for each issue
5. Re-test after fixes
6. Move to next phase

---

## Notes

- All routes use role-based access control (RBAC)
- Routes check permissions via `enhanced-rbac-middleware.ts`
- Navigation visibility controlled by user role and permissions
- Some routes redirect (e.g., `/task-management` → `/tasks`)
- Legacy routes kept for backward compatibility

