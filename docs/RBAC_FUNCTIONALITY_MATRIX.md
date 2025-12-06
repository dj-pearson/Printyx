# RBAC Functionality Matrix - By Role, Level, and Department

**Document Version:** 1.0
**Date:** 2025-11-25
**Status:** Functional Requirements

## Overview

This document defines **specific functionality access** for each role level across all departments. Use this as a reference for implementing role-based feature access and UI rendering.

---

## Table of Contents

1. [Sales Department Functionality](#sales-department-functionality)
2. [Service Department Functionality](#service-department-functionality)
3. [Operations Department Functionality](#operations-department-functionality)
4. [Finance Department Functionality](#finance-department-functionality)
5. [HR Department Functionality](#hr-department-functionality)
6. [IT Department Functionality](#it-department-functionality)
7. [Executive Functionality](#executive-functionality)
8. [Platform Admin Functionality](#platform-admin-functionality)

---

## Sales Department Functionality

### Level 1: Sales Representative / BDR

**Module Access:**
- ✅ Leads (own only)
- ✅ Opportunities (own only)
- ✅ Quotes (own only)
- ✅ Customers (own accounts)
- ✅ Activities (own only)
- ❌ Sales Reports (own metrics only via dashboard)
- ❌ Forecasting
- ❌ Territory Management
- ❌ Commission Management (view own only)

**Specific Functions:**

**Lead Management:**
- ✅ Create new leads
- ✅ Edit own leads
- ✅ View own leads
- ✅ Add activities/notes to own leads
- ✅ Convert lead to customer (own leads)
- ❌ Delete leads
- ❌ Assign leads to others
- ❌ View team leads
- ❌ Import leads
- ❌ Bulk operations

**Opportunity Management:**
- ✅ Create opportunities from own leads
- ✅ Edit own opportunities
- ✅ View own pipeline
- ✅ Update opportunity stage
- ✅ Add products to opportunities
- ✅ Log activities on own opportunities
- ❌ Delete opportunities
- ❌ Transfer opportunities
- ❌ View team opportunities
- ❌ Override pricing

**Quote/Proposal Generation:**
- ✅ Create quotes from own opportunities
- ✅ Edit draft quotes (own)
- ✅ Add products/services to quotes
- ✅ Use standard pricing
- ✅ Submit quotes for approval
- ✅ Send approved quotes to customers
- ✅ Convert quotes to orders
- ❌ Approve quotes
- ❌ Apply custom pricing (requires approval)
- ❌ Modify approved quotes
- ❌ Delete submitted quotes

**Customer Management:**
- ✅ View own customer accounts
- ✅ Update customer contact info (own accounts)
- ✅ Add customer notes (own accounts)
- ✅ View customer equipment (own accounts)
- ✅ View customer service history (own accounts)
- ❌ Create new customer accounts (requires manager approval)
- ❌ Delete customers
- ❌ Merge duplicate customers
- ❌ View all customers

**Activity Tracking:**
- ✅ Log calls, meetings, emails (own)
- ✅ Schedule follow-ups (own)
- ✅ View own activity history
- ✅ Track time spent on activities
- ❌ View team activities
- ❌ Assign activities to others
- ❌ Bulk activity logging

**Reporting/Analytics:**
- ✅ View own sales dashboard
- ✅ View own pipeline health
- ✅ View own quota attainment
- ✅ View own activity metrics
- ✅ View own commission (read-only)
- ✅ View leaderboard position
- ❌ Export reports
- ❌ View team reports
- ❌ Customize reports
- ❌ Schedule reports

**Territory:**
- ✅ View own territory assignment
- ✅ View own territory accounts
- ❌ Request territory changes
- ❌ View territory performance
- ❌ View territory map

---

### Level 2: Senior Sales Rep / Team Lead

**Everything from Level 1, PLUS:**

**Lead Management:**
- ✅ View team leads (read-only)
- ✅ Assist with lead assignment (suggest to supervisor)
- ✅ Mentor junior reps on lead qualification

**Opportunity Management:**
- ✅ View team pipeline (for coaching)
- ✅ Assist with deal strategy

**Quote/Proposal:**
- ✅ Review quotes for junior reps (before submission)
- ✅ Suggest pricing adjustments

**Reporting:**
- ✅ View team performance comparison
- ✅ Export own reports (PDF, Excel)
- ✅ View team activity leaderboard
- ✅ View mentee performance metrics

**Territory:**
- ✅ View team territory coverage
- ✅ Suggest territory optimizations

**Special Functions:**
- ✅ Train new sales reps
- ✅ Provide deal coaching
- ✅ Escalate complex opportunities to supervisor

---

### Level 3: Sales Supervisor

**Everything from Level 2, PLUS:**

**Lead Management:**
- ✅ View all location leads
- ✅ Assign leads to team members
- ✅ Bulk import leads
- ✅ Merge duplicate leads
- ✅ Delete invalid leads
- ✅ Set lead scoring rules (with manager approval)

**Opportunity Management:**
- ✅ View team opportunities
- ✅ Reassign opportunities
- ✅ Override opportunity stages (with reason)
- ✅ Mark opportunities as won/lost
- ✅ Approve deal strategies

**Quote/Proposal:**
- ✅ Approve quotes up to $25K
- ✅ Apply discount up to 10% (own authority)
- ✅ Review all team quotes
- ✅ Modify quote templates

**Customer Management:**
- ✅ Approve new customer creation
- ✅ View all location customers
- ✅ Assign account ownership

**Reporting:**
- ✅ View team sales reports
- ✅ Schedule automated reports (team metrics)
- ✅ Create custom team dashboards
- ✅ View location sales summary
- ✅ Track team quota attainment
- ✅ View team activity metrics
- ✅ Coaching reports (call quality, conversion rates)

**Territory:**
- ✅ View location territory assignments
- ✅ Propose territory changes
- ✅ View territory performance metrics

**Management Functions:**
- ✅ Set team goals
- ✅ Approve time-off requests (team)
- ✅ Conduct performance reviews (with manager)
- ✅ Manage team schedules
- ✅ Approve expense reports (team, < $500)

---

### Level 4: Sales Manager

**Everything from Level 3, PLUS:**

**Lead Management:**
- ✅ View all location leads across teams
- ✅ Configure lead assignment rules
- ✅ Manage lead sources
- ✅ Set lead SLAs
- ✅ Bulk operations (location-wide)

**Opportunity Management:**
- ✅ View all location opportunities
- ✅ Forecast location sales
- ✅ Manage sales stages
- ✅ Configure pipeline settings
- ✅ Override lost opportunities (re-open with approval)

**Quote/Proposal:**
- ✅ Approve quotes up to $100K
- ✅ Apply discounts up to 20%
- ✅ Create quote templates
- ✅ Manage pricing rules
- ✅ Approve custom pricing requests

**Customer Management:**
- ✅ Create customer accounts
- ✅ Merge customer records
- ✅ View all location customers
- ✅ Manage customer hierarchies
- ✅ Assign strategic accounts

**Reporting:**
- ✅ View location sales reports (all metrics)
- ✅ View regional sales summary (read-only)
- ✅ Create location forecasts
- ✅ Customize location dashboards
- ✅ Schedule location reports
- ✅ Export all location data
- ✅ View win/loss analysis
- ✅ View sales cycle metrics
- ✅ View conversion funnel

**Territory:**
- ✅ Manage location territories
- ✅ Assign territories to reps
- ✅ View territory coverage maps
- ✅ Analyze territory performance
- ✅ Propose territory changes (regional level)

**Commission:**
- ✅ View team commission reports
- ✅ Approve commission exceptions
- ✅ Review commission disputes

**Management Functions:**
- ✅ Hire sales reps (with director approval)
- ✅ Terminate sales reps (with HR + director)
- ✅ Set location sales goals
- ✅ Manage location budget
- ✅ Approve expenses up to $5K
- ✅ Conduct performance reviews (all location staff)
- ✅ Create training programs

---

### Level 5: Regional Sales Director

**Everything from Level 4, PLUS:**

**Lead Management:**
- ✅ View regional leads (all locations)
- ✅ Redistribute leads across locations
- ✅ Analyze regional lead sources
- ✅ Set regional lead SLAs

**Opportunity Management:**
- ✅ View regional pipeline
- ✅ Forecast regional sales
- ✅ Manage regional sales campaigns
- ✅ Strategic deal involvement (enterprise)

**Quote/Proposal:**
- ✅ Approve quotes up to $500K
- ✅ Apply discounts up to 30% (with justification)
- ✅ Create regional pricing programs
- ✅ Approve special pricing arrangements

**Customer Management:**
- ✅ View regional customers
- ✅ Manage enterprise accounts (multi-location)
- ✅ Assign national accounts
- ✅ Review customer profitability (regional)

**Reporting:**
- ✅ View regional sales reports (comprehensive)
- ✅ View company sales summary (read-only)
- ✅ Create regional forecasts
- ✅ Regional performance dashboards
- ✅ Location comparison reports
- ✅ Regional sales trends
- ✅ Market share analysis (regional)
- ✅ Competitive analysis

**Territory:**
- ✅ Manage regional territories
- ✅ Optimize territory coverage (regional)
- ✅ Balance workloads across locations
- ✅ Expand into new territories

**Commission:**
- ✅ View regional commission reports
- ✅ Approve regional commission exceptions
- ✅ Review commission structure effectiveness

**Strategic Functions:**
- ✅ Set regional sales strategy
- ✅ Manage regional budget
- ✅ Hire/fire sales managers (with VP approval)
- ✅ Develop regional sales programs
- ✅ Partner relationship management (regional)
- ✅ Major account negotiations
- ✅ Approve large expenses (up to $25K)

---

### Level 6: VP Sales / Sales Director

**Everything from Level 5, PLUS:**

**Lead Management:**
- ✅ View company-wide leads
- ✅ Configure global lead processes
- ✅ Set company lead strategy
- ✅ Approve lead management software/tools

**Opportunity Management:**
- ✅ View company-wide pipeline
- ✅ Forecast company sales
- ✅ Set company sales strategy
- ✅ Approve major deals (enterprise, strategic)
- ✅ Manage sales methodology

**Quote/Proposal:**
- ✅ Approve quotes of any value
- ✅ Set company pricing strategy
- ✅ Approve discounts > 30%
- ✅ Create global pricing programs
- ✅ Negotiate enterprise agreements

**Customer Management:**
- ✅ View all company customers
- ✅ Manage strategic/national accounts
- ✅ Customer portfolio analysis
- ✅ Set customer success strategy

**Reporting:**
- ✅ View all company sales reports
- ✅ Company-wide forecasting
- ✅ Executive sales dashboards
- ✅ Board-level reporting
- ✅ Sales analytics (advanced)
- ✅ Sales team effectiveness metrics
- ✅ Market analysis (company-wide)
- ✅ Competitive positioning
- ✅ Product mix analysis
- ✅ Sales channel performance

**Territory:**
- ✅ Design company territory structure
- ✅ Approve territory changes (all levels)
- ✅ National territory strategy
- ✅ Market expansion planning

**Commission:**
- ✅ Design commission structure
- ✅ Approve commission plans
- ✅ Review company-wide commission expense
- ✅ Approve large commission payouts

**Strategic Functions:**
- ✅ Set company sales goals
- ✅ Manage sales department budget
- ✅ Hire/fire regional directors
- ✅ Sales team structure design
- ✅ Sales process optimization
- ✅ CRM system selection/configuration
- ✅ Sales training program design
- ✅ Partner/channel strategy
- ✅ Major contract negotiations
- ✅ Approve large expenses (up to $100K)
- ✅ Sales compensation design

---

## Service Department Functionality

### Level 1: Field Service Technician

**Module Access:**
- ✅ Service Tickets (assigned only)
- ✅ Work Orders (assigned only)
- ✅ Equipment (assigned customers)
- ✅ Parts (use only)
- ✅ Time Tracking (own)
- ❌ Service Reports (own metrics only via dashboard)
- ❌ Scheduling (view own schedule only)
- ❌ Customer Management

**Specific Functions:**

**Ticket Management:**
- ✅ View assigned tickets
- ✅ Update ticket status (in progress, completed)
- ✅ Add notes to tickets
- ✅ Upload photos/documents to tickets
- ✅ Log time on tickets
- ✅ Request parts for tickets
- ✅ Close tickets (requires photos/completion notes)
- ❌ Create tickets
- ❌ Assign tickets
- ❌ Delete tickets
- ❌ View unassigned tickets
- ❌ View team tickets

**Work Order Management:**
- ✅ View assigned work orders
- ✅ Update work order progress
- ✅ Complete checklists/tasks
- ✅ Capture customer signature
- ✅ Submit completed work orders
- ❌ Create work orders
- ❌ Modify work order scope

**Equipment/Installation:**
- ✅ View equipment details (assigned customers)
- ✅ Record meter readings
- ✅ Update equipment status
- ✅ Log equipment issues
- ✅ Install equipment (with proper certification)
- ✅ Configure basic equipment settings
- ❌ Register new equipment
- ❌ Decommission equipment
- ❌ Remote access to equipment (requires approval)
- ❌ Advanced configuration

**Parts Management:**
- ✅ View parts catalog
- ✅ Request parts from warehouse
- ✅ Record parts used on tickets
- ✅ Return unused parts
- ✅ Check parts availability
- ❌ Order parts directly
- ❌ Adjust inventory
- ❌ View parts costs
- ❌ Approve parts requisitions

**Schedule Management:**
- ✅ View own schedule
- ✅ Check in/check out of appointments
- ✅ View appointment details
- ✅ Update appointment status
- ✅ Request time off
- ❌ Modify schedule
- ❌ View team schedules
- ❌ Assign appointments

**Mobile Functions:**
- ✅ Mobile app access
- ✅ GPS check-in at customer sites
- ✅ Offline ticket updates
- ✅ Photo capture and upload
- ✅ Digital signature collection
- ✅ Navigation to appointments
- ✅ Emergency contact access

**Customer Interaction:**
- ✅ View customer contact info (assigned only)
- ✅ Call customers (from ticket)
- ✅ Send appointment reminders
- ✅ Collect customer feedback
- ❌ View customer financial info
- ❌ Update customer account
- ❌ View customer billing

**Reporting/Analytics:**
- ✅ View own productivity dashboard
- ✅ View own ticket completion rate
- ✅ View own customer satisfaction scores
- ✅ View own time utilization
- ✅ View certification status
- ❌ Export reports
- ❌ View team reports
- ❌ View location reports

---

### Level 2: Senior Technician / Lead Technician

**Everything from Level 1, PLUS:**

**Ticket Management:**
- ✅ View team tickets (for workload balancing)
- ✅ Assist with complex tickets
- ✅ Escalate tickets to supervisor
- ✅ Mentor junior techs on tickets

**Equipment:**
- ✅ Advanced equipment configuration
- ✅ Troubleshoot complex issues
- ✅ Equipment remote access (approved devices)
- ✅ Train customers on equipment

**Parts:**
- ✅ View parts costs (for efficiency)
- ✅ Suggest parts alternatives

**Schedule:**
- ✅ View team schedules (read-only)
- ✅ Suggest schedule optimizations

**Reporting:**
- ✅ View team performance comparison
- ✅ View mentee productivity
- ✅ Export own reports

**Special Functions:**
- ✅ Train new technicians
- ✅ Lead complex installations
- ✅ Quality assurance for junior tech work
- ✅ Technical documentation

---

### Level 3: Service Supervisor

**Everything from Level 2, PLUS:**

**Ticket Management:**
- ✅ View all location tickets
- ✅ Assign tickets to technicians
- ✅ Reassign tickets
- ✅ Create tickets (from customer calls)
- ✅ Bulk ticket operations
- ✅ Set ticket priorities
- ✅ Escalate to manager
- ✅ Close disputed tickets
- ✅ Void tickets (with reason)

**Dispatch:**
- ✅ Manage daily dispatch
- ✅ Optimize routes
- ✅ Handle emergency calls
- ✅ Balance technician workloads
- ✅ Adjust schedules in real-time

**Work Orders:**
- ✅ Create work orders
- ✅ Assign work orders
- ✅ Review completed work orders
- ✅ Approve billable work orders
- ✅ Manage preventive maintenance schedules

**Equipment:**
- ✅ View all location equipment
- ✅ Register new equipment
- ✅ Assign equipment to customers
- ✅ Schedule preventive maintenance
- ✅ Approve remote access requests

**Parts:**
- ✅ Approve parts requisitions (< $500)
- ✅ View team parts usage
- ✅ Track parts costs per ticket
- ✅ Identify parts abuse/waste

**Customer Management:**
- ✅ View location service customers
- ✅ Update service agreements
- ✅ Handle customer complaints (first level)
- ✅ Schedule service calls

**Reporting:**
- ✅ View team service reports
- ✅ Schedule automated reports (team)
- ✅ Track team SLA compliance
- ✅ View team productivity metrics
- ✅ First-time fix rate (team)
- ✅ Customer satisfaction (team)
- ✅ Parts efficiency (team)

**Management:**
- ✅ Conduct daily huddles
- ✅ Approve time-off requests (team)
- ✅ Review timesheets
- ✅ Manage team training
- ✅ Conduct ride-alongs
- ✅ Quality assurance audits

---

### Level 4: Service Manager

**Everything from Level 3, PLUS:**

**Ticket Management:**
- ✅ View all location tickets (all teams)
- ✅ Configure ticket workflows
- ✅ Set SLA rules
- ✅ Manage ticket categories
- ✅ Escalation management
- ✅ Warranty vs. billable determination

**Dispatch:**
- ✅ Manage location dispatch operations
- ✅ Configure dispatch rules
- ✅ Territory assignment for service
- ✅ Capacity planning
- ✅ Overtime approval

**Work Orders:**
- ✅ Approve high-value work orders
- ✅ Configure work order templates
- ✅ Preventive maintenance program design
- ✅ Service contract management

**Equipment:**
- ✅ View all location equipment
- ✅ Equipment profitability analysis
- ✅ Fleet health monitoring
- ✅ Equipment lifecycle management
- ✅ Decommission equipment

**Parts:**
- ✅ Approve parts orders (location)
- ✅ Manage location parts inventory
- ✅ Parts cost analysis
- ✅ Vendor relationships (parts)
- ✅ Set par levels
- ✅ Approve parts returns

**Customer Management:**
- ✅ View all location customers (service view)
- ✅ Service contract creation/renewal
- ✅ Handle escalated complaints
- ✅ Service pricing decisions
- ✅ Customer profitability (service)

**Reporting:**
- ✅ View location service reports (all metrics)
- ✅ Regional service summary (read-only)
- ✅ SLA compliance reports
- ✅ Technician productivity
- ✅ Parts usage and waste
- ✅ Service profitability
- ✅ Customer satisfaction trends
- ✅ Equipment uptime/downtime
- ✅ Response time metrics
- ✅ First-time fix rates

**Financial:**
- ✅ View location service P&L
- ✅ Manage service budget
- ✅ Technician labor cost analysis
- ✅ Service revenue forecasting

**Management:**
- ✅ Hire technicians (with approval)
- ✅ Terminate technicians (with HR)
- ✅ Set location service goals
- ✅ Manage technician certifications
- ✅ Conduct performance reviews
- ✅ Approve expenses (< $5K)
- ✅ Training program management
- ✅ Safety compliance

---

### Level 5: Regional Service Manager

**Everything from Level 4, PLUS:**

**Ticket Management:**
- ✅ View regional tickets
- ✅ Regional SLA management
- ✅ Cross-location ticket assignment
- ✅ Regional escalation handling

**Dispatch:**
- ✅ Regional dispatch coordination
- ✅ Cross-location resource sharing
- ✅ Regional capacity planning
- ✅ Disaster recovery dispatch

**Equipment:**
- ✅ View regional equipment fleet
- ✅ Regional equipment strategy
- ✅ Fleet optimization (regional)
- ✅ Manufacturer relationships (regional)

**Parts:**
- ✅ Regional parts strategy
- ✅ Consolidated parts ordering
- ✅ Regional inventory optimization
- ✅ Parts vendor negotiations (regional)

**Customer Management:**
- ✅ Regional service accounts
- ✅ Multi-location service agreements
- ✅ Regional customer satisfaction programs

**Reporting:**
- ✅ Regional service reports (comprehensive)
- ✅ Company service summary (read-only)
- ✅ Location comparison (regional)
- ✅ Regional trends analysis
- ✅ Regional capacity planning
- ✅ Regional parts efficiency
- ✅ Regional customer satisfaction
- ✅ Technician performance (regional)

**Financial:**
- ✅ Regional service P&L
- ✅ Regional service budget
- ✅ Service profitability analysis (regional)

**Strategic:**
- ✅ Hire/fire service managers (with VP)
- ✅ Set regional service strategy
- ✅ Regional training programs
- ✅ Service process standardization (regional)
- ✅ Approve large expenses (< $25K)

---

### Level 6: VP Service / Service Director

**Everything from Level 5, PLUS:**

**Ticket Management:**
- ✅ Company-wide ticket visibility
- ✅ Set company SLA standards
- ✅ Service methodology design
- ✅ Escalation policy design

**Dispatch:**
- ✅ Company-wide dispatch strategy
- ✅ Dispatch software selection
- ✅ National resource allocation

**Equipment:**
- ✅ Company-wide equipment strategy
- ✅ Equipment portfolio planning
- ✅ Manufacturer partnerships (national)
- ✅ Equipment investment decisions

**Parts:**
- ✅ Company parts strategy
- ✅ National parts contracts
- ✅ Parts inventory policy
- ✅ Make-vs-buy decisions

**Customer Management:**
- ✅ National service accounts
- ✅ Service pricing strategy
- ✅ Customer satisfaction program design

**Reporting:**
- ✅ Company-wide service reports
- ✅ Executive service dashboards
- ✅ Board-level reporting
- ✅ Service analytics (advanced)
- ✅ Service profitability (company)
- ✅ Capacity planning (company)
- ✅ Service quality metrics
- ✅ Customer retention (service impact)

**Financial:**
- ✅ Service department budget
- ✅ Service P&L (company)
- ✅ Service pricing policy
- ✅ Investment analysis (equipment, training)

**Strategic:**
- ✅ Service department structure design
- ✅ Hire/fire regional service managers
- ✅ Service strategy and vision
- ✅ Service process design
- ✅ Technology platform selection
- ✅ Training and certification programs
- ✅ Safety and compliance programs
- ✅ Service innovation
- ✅ Approve large expenses (< $100K)

---

## Operations Department Functionality

### Level 1: Warehouse Associate / Inventory Specialist

**Module Access:**
- ✅ Inventory (view + basic transactions)
- ✅ Receiving
- ✅ Picking/Shipping
- ✅ Kitting
- ❌ Purchase Orders (view only)
- ❌ Inventory Reports
- ❌ Vendors

**Specific Functions:**

**Receiving:**
- ✅ Receive shipments
- ✅ Scan/count received items
- ✅ Verify packing slips
- ✅ Report discrepancies
- ✅ Stage received goods
- ❌ Approve receipts
- ❌ Create purchase orders
- ❌ Return goods to vendor

**Inventory:**
- ✅ View inventory levels
- ✅ Perform cycle counts (assigned)
- ✅ Update bin locations
- ✅ Report damaged goods
- ✅ Check item availability
- ❌ Adjust inventory (requires supervisor)
- ❌ Create new inventory items
- ❌ View inventory costs
- ❌ Transfer inventory between locations

**Picking/Shipping:**
- ✅ Pick orders
- ✅ Pack orders
- ✅ Print shipping labels
- ✅ Scan items for shipment
- ✅ Prepare bills of lading
- ✅ Load trucks
- ❌ Approve shipments
- ❌ Arrange freight
- ❌ Process returns

**Kitting:**
- ✅ View kitting tasks
- ✅ Assemble kits
- ✅ Scan kit components
- ✅ Complete kitting checklist
- ✅ Report kitting issues
- ❌ Create kits
- ❌ Modify kit BOMs

**Delivery (if applicable):**
- ✅ Load delivery truck
- ✅ Execute delivery route
- ✅ Obtain delivery signatures
- ✅ Report delivery issues
- ❌ Modify delivery schedule

**Reporting:**
- ✅ View own productivity metrics
- ✅ View own accuracy rates
- ❌ Export reports
- ❌ View team reports

---

### Level 2: Lead Warehouse Associate / Senior Specialist

**Everything from Level 1, PLUS:**

**Inventory:**
- ✅ Minor inventory adjustments (with reason)
- ✅ Lead cycle count teams
- ✅ Investigate inventory discrepancies

**Operations:**
- ✅ Train new associates
- ✅ Quality checks
- ✅ Suggest process improvements

**Reporting:**
- ✅ View team productivity comparison
- ✅ Export own reports

---

### Level 3: Warehouse Supervisor / Inventory Supervisor

**Everything from Level 2, PLUS:**

**Receiving:**
- ✅ Approve receipts
- ✅ Handle receipt discrepancies
- ✅ Initiate vendor returns
- ✅ Manage receiving schedule

**Inventory:**
- ✅ Approve inventory adjustments
- ✅ Manage cycle count program
- ✅ Investigate major discrepancies
- ✅ Transfer inventory (intra-location)
- ✅ Manage inventory accuracy program
- ✅ Set min/max levels (with manager approval)

**Picking/Shipping:**
- ✅ Approve shipments
- ✅ Process returns
- ✅ Handle shipping issues
- ✅ Manage pick queue

**Kitting:**
- ✅ Create new kits
- ✅ Modify kit BOMs (with manager)
- ✅ Set kitting schedules

**FPY (First Pass Yield):**
- ✅ Track FPY metrics
- ✅ Investigate FPY failures
- ✅ Report FPY to manager

**Reporting:**
- ✅ Team productivity reports
- ✅ Inventory accuracy reports
- ✅ Receiving/shipping metrics
- ✅ FPY reports
- ✅ Schedule automated reports

**Management:**
- ✅ Assign daily tasks
- ✅ Manage team schedules
- ✅ Approve time-off (team)
- ✅ Conduct daily huddles
- ✅ Safety compliance
- ✅ Quality audits

---

### Level 4: Warehouse Manager / Operations Manager

**Everything from Level 3, PLUS:**

**Purchase Orders:**
- ✅ Create purchase orders (< $10K)
- ✅ Approve purchase orders (< $5K)
- ✅ Manage PO workflow
- ✅ Track open POs

**Inventory:**
- ✅ View all location inventory
- ✅ Inter-location transfers
- ✅ Create new inventory items
- ✅ Set reorder points
- ✅ View inventory costs
- ✅ Manage consignment inventory
- ✅ Inventory forecasting (location)
- ✅ Obsolete inventory management

**Vendors:**
- ✅ Manage vendor relationships (location)
- ✅ Negotiate pricing (location)
- ✅ Vendor performance tracking
- ✅ Approve new vendors (with director)

**Shipping:**
- ✅ Arrange freight
- ✅ Negotiate shipping rates (location)
- ✅ Manage carrier relationships

**Logistics:**
- ✅ Route planning
- ✅ Fleet management (location)
- ✅ Delivery schedule optimization

**FPY:**
- ✅ Manage FPY program
- ✅ Set FPY targets
- ✅ FPY improvement initiatives

**Reporting:**
- ✅ Location inventory reports (all)
- ✅ Regional inventory summary (read-only)
- ✅ Inventory turns
- ✅ Carrying cost analysis
- ✅ FPY metrics (location)
- ✅ Warehouse efficiency
- ✅ Labor productivity
- ✅ Shipping accuracy
- ✅ On-time delivery rates

**Financial:**
- ✅ Warehouse budget management
- ✅ Labor cost tracking
- ✅ Inventory valuation (location)

**Management:**
- ✅ Hire warehouse staff (with director)
- ✅ Conduct performance reviews
- ✅ Set location warehouse goals
- ✅ Training program management
- ✅ Safety program management
- ✅ Approve expenses (< $5K)

---

### Level 5: Regional Operations Manager (Enterprise only)

**Everything from Level 4, PLUS:**

**Purchase Orders:**
- ✅ Approve POs up to $50K
- ✅ Consolidated regional purchasing
- ✅ Strategic vendor relationships (regional)

**Inventory:**
- ✅ View regional inventory
- ✅ Regional inventory strategy
- ✅ Cross-location optimization
- ✅ Regional parts consolidation

**Logistics:**
- ✅ Regional logistics optimization
- ✅ Cross-location deliveries
- ✅ Regional fleet management

**Reporting:**
- ✅ Regional operations reports
- ✅ Company operations summary (read-only)
- ✅ Location comparison (regional)
- ✅ Regional efficiency metrics

**Financial:**
- ✅ Regional operations budget
- ✅ Regional P&L impact

**Strategic:**
- ✅ Hire/fire operations managers (with COO)
- ✅ Regional process standardization
- ✅ Approve expenses (< $25K)

---

### Level 6: COO / Director of Operations

**Everything from Level 5, PLUS:**

**Purchase Orders:**
- ✅ Approve POs of any value
- ✅ Set company purchasing policy
- ✅ National vendor contracts

**Inventory:**
- ✅ Company-wide inventory visibility
- ✅ Inventory strategy (company)
- ✅ Investment in inventory optimization tools

**Logistics:**
- ✅ Company-wide logistics strategy
- ✅ Fleet strategy (company)
- ✅ National logistics contracts

**Reporting:**
- ✅ Company-wide operations reports
- ✅ Executive operations dashboard
- ✅ Board-level reporting
- ✅ Supply chain analytics
- ✅ Operational efficiency (company)

**Financial:**
- ✅ Operations department budget
- ✅ Operations P&L
- ✅ Capital expenditure planning

**Strategic:**
- ✅ Operations structure design
- ✅ Hire/fire regional operations managers
- ✅ Operations strategy and vision
- ✅ Process optimization (company-wide)
- ✅ Technology platform selection
- ✅ Facility planning
- ✅ Approve large expenses (< $100K)

---

## Finance Department Functionality

### Level 1: Accounting Clerk / AR/AP Specialist

**Module Access:**
- ✅ Invoices (data entry)
- ✅ Bills (data entry)
- ✅ Payments (recording)
- ✅ Journal Entries (basic)
- ❌ Financial Reports
- ❌ Bank Reconciliation
- ❌ Chart of Accounts

**Specific Functions:**

**Accounts Receivable:**
- ✅ Create invoices (from approved orders)
- ✅ Record customer payments
- ✅ Apply payments to invoices
- ✅ Send payment reminders (automated)
- ✅ View AR aging (read-only)
- ❌ Void invoices
- ❌ Write off bad debt
- ❌ Modify posted invoices
- ❌ Adjust customer credit limits

**Accounts Payable:**
- ✅ Enter vendor bills
- ✅ Match bills to POs
- ✅ Code expenses to GL accounts
- ✅ Prepare payment batches
- ✅ View AP aging (read-only)
- ❌ Approve bills for payment
- ❌ Process payments
- ❌ Void payments
- ❌ Create vendors

**General Ledger:**
- ✅ Enter basic journal entries (with approval)
- ✅ View GL accounts (assigned)
- ❌ Post journal entries
- ❌ Close periods
- ❌ Modify COA

**Reporting:**
- ✅ View own transaction log
- ✅ View own productivity metrics
- ❌ Export reports
- ❌ View financial reports

---

### Level 2: Senior Accountant

**Everything from Level 1, PLUS:**

**AR/AP:**
- ✅ Approve minor adjustments
- ✅ Handle customer inquiries
- ✅ Review and correct junior staff work

**General Ledger:**
- ✅ Post standard journal entries
- ✅ Prepare reconciliations (assigned accounts)

**Reporting:**
- ✅ Export own reports
- ✅ Assist with month-end close

**Special:**
- ✅ Train new accounting clerks
- ✅ Review procedures

---

### Level 3: Accounting Supervisor

**Everything from Level 2, PLUS:**

**Accounts Receivable:**
- ✅ Void invoices (with reason)
- ✅ Approve customer refunds (< $1K)
- ✅ Adjust invoices
- ✅ Manage collections process (location)
- ✅ Customer credit hold decisions

**Accounts Payable:**
- ✅ Approve bills for payment (< $5K)
- ✅ Process payment batches
- ✅ Create vendors
- ✅ Handle vendor disputes
- ✅ Approve expense reports (< $1K)

**General Ledger:**
- ✅ Post complex journal entries
- ✅ Reconcile bank accounts
- ✅ Reconcile sub-ledgers
- ✅ Review team entries

**Reporting:**
- ✅ Generate basic financial reports
- ✅ Team productivity reports
- ✅ Process efficiency metrics

**Management:**
- ✅ Assign daily tasks (team)
- ✅ Review team work
- ✅ Approve time-off (team)
- ✅ Month-end close coordination

---

### Level 4: Finance Manager / Controller (small companies)

**Everything from Level 3, PLUS:**

**Accounts Receivable:**
- ✅ Write off bad debt (< $10K, with approval)
- ✅ Adjust customer credit limits
- ✅ AR process design (location)
- ✅ Collections strategy

**Accounts Payable:**
- ✅ Approve bills for payment (< $50K)
- ✅ Void payments (with investigation)
- ✅ AP process design (location)
- ✅ Vendor terms negotiation

**General Ledger:**
- ✅ Manage full chart of accounts
- ✅ Post all journal entries
- ✅ Close monthly periods
- ✅ Manage accruals
- ✅ Prepare financial statements (location)

**Cash Management:**
- ✅ Bank reconciliation
- ✅ Cash flow management (location)
- ✅ Approve check runs

**Billing:**
- ✅ Manage billing process
- ✅ Meter billing oversight
- ✅ Contract billing
- ✅ Revenue recognition decisions

**Reporting:**
- ✅ Financial statements (location)
- ✅ Budget vs actual (location)
- ✅ AR/AP aging analysis
- ✅ Cash flow reports
- ✅ Commission reports (verification)
- ✅ Department profitability

**Financial Planning:**
- ✅ Location budgeting
- ✅ Forecasting (location)

**Compliance:**
- ✅ Tax compliance (location)
- ✅ Audit support
- ✅ Internal controls monitoring

**Management:**
- ✅ Hire accounting staff (with director)
- ✅ Conduct performance reviews
- ✅ Set location finance goals
- ✅ Approve expenses (< $5K)

---

### Level 6: CFO / Controller (mid-large companies)

**Everything from Level 4, PLUS:**

**Accounts Receivable:**
- ✅ Write off bad debt (any amount)
- ✅ Set credit policies (company)
- ✅ Customer credit analysis

**Accounts Payable:**
- ✅ Approve payments (any amount)
- ✅ Set payment terms policies
- ✅ Vendor relationship strategy

**General Ledger:**
- ✅ Company-wide COA management
- ✅ Consolidations (multi-location)
- ✅ Close annual periods
- ✅ Manage accounting policies

**Financial Reporting:**
- ✅ Consolidated financial statements
- ✅ Executive financial dashboards
- ✅ Board-level financial reports
- ✅ Investor reporting
- ✅ Lender reporting
- ✅ Management reports (comprehensive)

**Cash Management:**
- ✅ Company-wide cash management
- ✅ Banking relationships
- ✅ Investment decisions
- ✅ Debt management
- ✅ Credit facility management

**Financial Planning:**
- ✅ Company budget
- ✅ Multi-year financial planning
- ✅ Capital planning
- ✅ Financial modeling
- ✅ Scenario analysis

**Tax & Compliance:**
- ✅ Tax strategy
- ✅ Audit oversight
- ✅ Regulatory compliance
- ✅ Internal controls design
- ✅ Risk management

**Strategic Finance:**
- ✅ M&A financial analysis
- ✅ Financing strategy
- ✅ Profitability analysis (all dimensions)
- ✅ Pricing strategy (financial input)
- ✅ Capital allocation

**Management:**
- ✅ Finance department budget
- ✅ Hire/fire finance managers
- ✅ Finance team structure
- ✅ Accounting system selection
- ✅ Approve large expenses (< $100K)

---

## HR Department Functionality

### Level 1: HR Coordinator

**Functions:**
- ✅ Employee onboarding administration
- ✅ Maintain employee files
- ✅ Process new hire paperwork
- ✅ Benefits enrollment assistance
- ✅ HRIS data entry
- ✅ Answer basic HR questions
- ❌ Make HR decisions
- ❌ Handle investigations
- ❌ View sensitive employee data

---

### Level 2-3: HR Generalist / Recruiter

**Additional Functions:**
- ✅ Full-cycle recruiting
- ✅ Conduct interviews
- ✅ Employee relations (first level)
- ✅ Policy interpretation
- ✅ Basic investigations
- ✅ Training coordination
- ✅ Performance review administration
- ✅ Leave of absence administration

---

### Level 4: HR Manager

**Additional Functions:**
- ✅ Complex employee relations
- ✅ Investigations
- ✅ Disciplinary actions
- ✅ Terminations
- ✅ Compensation decisions (location)
- ✅ Benefits administration
- ✅ Compliance monitoring
- ✅ Policy enforcement
- ✅ HR metrics reporting (location)

---

### Level 6-7: CHRO / Director of HR

**Additional Functions:**
- ✅ HR strategy
- ✅ Compensation and benefits design
- ✅ Talent management
- ✅ Succession planning
- ✅ Culture and engagement programs
- ✅ Labor relations
- ✅ Legal compliance (company-wide)
- ✅ HRIS selection
- ✅ HR analytics
- ✅ Workforce planning

---

## IT Department Functionality

### Level 1: Help Desk Technician

**Functions:**
- ✅ Answer support tickets
- ✅ Password resets
- ✅ Basic troubleshooting
- ✅ Hardware setup
- ✅ Software installation (standard)
- ✅ Document issues
- ✅ Escalate complex issues
- ❌ Server access
- ❌ Network changes
- ❌ Security decisions

---

### Level 2-3: Senior Help Desk / System Administrator

**Additional Functions:**
- ✅ Advanced troubleshooting
- ✅ Server administration
- ✅ Network troubleshooting
- ✅ User account management
- ✅ Backup management
- ✅ Software deployment
- ✅ Mobile device management

---

### Level 4: IT Manager

**Additional Functions:**
- ✅ IT budget (location)
- ✅ Vendor management
- ✅ Project management
- ✅ Security monitoring
- ✅ Change management
- ✅ Disaster recovery planning
- ✅ IT metrics reporting

---

### Level 6-7: CTO / Director of IT

**Additional Functions:**
- ✅ IT strategy
- ✅ Technology roadmap
- ✅ Enterprise architecture
- ✅ Software/platform selection
- ✅ Cybersecurity strategy
- ✅ Compliance (technical)
- ✅ IT governance
- ✅ Innovation initiatives
- ✅ IT budget (company)

---

## Executive Functionality (Level 7)

### CEO / President

**Unique Functions:**
- ✅ View all company data (all departments, all locations)
- ✅ Company-wide strategic planning
- ✅ Board reporting
- ✅ M&A decisions
- ✅ Major hiring decisions (VP+)
- ✅ Major expenditures (> $100K)
- ✅ Legal matters
- ✅ Investor relations
- ✅ Strategic partnerships
- ✅ Company vision and culture
- ✅ Final approval authority (all matters)

### CFO

**Unique Functions:**
- ✅ All financial data (sensitive)
- ✅ Capital structure decisions
- ✅ Financial risk management
- ✅ Treasury management
- ✅ Financial strategy
- ✅ Investor/lender relations
- ✅ Tax strategy
- ✅ Financial systems
- ✅ Audit oversight

### COO

**Unique Functions:**
- ✅ All operational data
- ✅ Cross-departmental operations
- ✅ Process optimization (company-wide)
- ✅ Operational strategy
- ✅ Capacity planning (company)
- ✅ Facility planning
- ✅ Supply chain strategy
- ✅ Quality programs

---

## Platform Admin Functionality (Level 8)

### Platform Administrator (Printyx Staff)

**Unique Functions:**
- ✅ Access all tenant data
- ✅ View system-wide metrics
- ✅ Tenant provisioning
- ✅ Tenant configuration
- ✅ Cross-tenant support
- ✅ Platform monitoring
- ✅ System configuration
- ✅ Security administration
- ✅ Database access (controlled)
- ✅ Feature flag management
- ✅ Emergency access (audited)
- ✅ Subscription management
- ✅ Billing administration

---

## Summary

This functionality matrix defines **specific access and capabilities** for each role across all departments. Use this document to:

1. **Implement feature flags** - Gate features based on role/level
2. **Design UI/UX** - Show/hide functionality based on permissions
3. **Configure RBAC** - Map functions to permissions in database
4. **Train users** - Clear expectations for each role
5. **Scale the organization** - Add roles as company grows

**Next Document**: See `RBAC_REPORTING_REQUIREMENTS.md` for detailed reporting needs by role and department.
