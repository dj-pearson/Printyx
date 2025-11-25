# RBAC Reporting Requirements - By Role and Department

**Document Version:** 1.0
**Date:** 2025-11-25
**Status:** Reporting Specifications

## Overview

This document defines **comprehensive reporting requirements** for each role level across all departments. Each report specification includes:
- **Report Name**
- **Description**
- **Access Level** (who can view)
- **Scope** (data range)
- **Key Metrics**
- **Filters Available**
- **Export Options**
- **Scheduling Capability**

---

## Table of Contents

1. [Sales Department Reports](#sales-department-reports)
2. [Service Department Reports](#service-department-reports)
3. [Operations Department Reports](#operations-department-reports)
4. [Finance Department Reports](#finance-department-reports)
5. [Executive Reports](#executive-reports)
6. [Platform Admin Reports](#platform-admin-reports)
7. [Cross-Department Reports](#cross-department-reports)

---

## Sales Department Reports

### Level 1: Sales Representative Reports

#### 1. Personal Pipeline Report
**Access:** Level 1+
**Scope:** Own leads/opportunities only
**Refresh:** Real-time

**Key Metrics:**
- Total pipeline value
- Number of opportunities by stage
- Weighted pipeline value
- Stage conversion rates
- Average deal size
- Days in each stage

**Dimensions/Filters:**
- Date range (created, expected close)
- Product category
- Deal size range
- Customer segment

**Visualizations:**
- Pipeline funnel chart
- Opportunities by stage (bar chart)
- Pipeline trend (line chart, last 90 days)
- Win probability distribution

**Actions:**
- Drill into opportunity details
- Cannot export (Level 1)
- Cannot schedule

---

#### 2. Personal Activity Report
**Access:** Level 1+
**Scope:** Own activities only
**Refresh:** Real-time

**Key Metrics:**
- Calls made (today, week, month)
- Meetings held
- Emails sent
- Quotes generated
- Activity by type breakdown
- Activity completion rate

**Dimensions/Filters:**
- Date range
- Activity type
- Outcome/result

**Visualizations:**
- Activity count by type (pie chart)
- Daily activity trend (line chart)
- Activity completion gauge

---

#### 3. Personal Quota Attainment
**Access:** Level 1+
**Scope:** Own performance
**Refresh:** Daily

**Key Metrics:**
- Quota target (monthly, quarterly, annual)
- Actual sales (closed-won)
- Percentage to quota
- Remaining quota
- Trend vs last period

**Visualizations:**
- Quota progress gauge
- Month-to-date trend
- Quota attainment history (last 12 months)

---

#### 4. Personal Commission Report
**Access:** Level 1+ (own only)
**Scope:** Own commissions
**Refresh:** Daily

**Key Metrics:**
- Commission earned (period)
- Commission pending
- Deals contributing to commission
- Commission by product/category
- YTD commission

**Filters:**
- Date range
- Status (pending, paid)
- Product category

**Export:** ✅ PDF only
**Schedule:** ❌

---

#### 5. Personal Leaderboard Position
**Access:** Level 1+
**Scope:** All sales reps (for comparison)
**Refresh:** Daily

**Key Metrics:**
- Rank by revenue
- Rank by deals closed
- Rank by activities
- Comparison to top performer
- Comparison to team average

**Visualizations:**
- Leaderboard table (top 10)
- Own position highlight

---

### Level 2: Senior Sales Rep / Team Lead Reports

**All Level 1 Reports, PLUS:**

#### 6. Team Pipeline Comparison
**Access:** Level 2+
**Scope:** Team (direct reports + self)
**Refresh:** Real-time

**Key Metrics:**
- Pipeline value by rep
- Pipeline coverage (pipeline value / quota)
- Average deal size by rep
- Stage distribution by rep
- Weighted pipeline

**Visualizations:**
- Stacked bar chart (pipeline by rep, by stage)
- Pipeline coverage gauge (per rep)
- Rep comparison table

**Export:** ✅ Excel, PDF
**Schedule:** ❌

---

#### 7. Team Activity Leaderboard
**Access:** Level 2+
**Scope:** Team
**Refresh:** Real-time

**Key Metrics:**
- Activities by rep
- Calls, meetings, emails (per rep)
- Activity completion rate
- Coaching opportunities (low activity flags)

**Visualizations:**
- Leaderboard table
- Activity by type (stacked bar, by rep)

---

### Level 3: Sales Supervisor Reports

**All Level 2 Reports, PLUS:**

#### 8. Team Performance Dashboard
**Access:** Level 3+
**Scope:** Team + location summary
**Refresh:** Real-time

**Key Metrics:**
- Team revenue (MTD, QTD, YTD)
- Team quota attainment
- Individual quota attainment (all team members)
- Win rate (team)
- Average sales cycle (team)
- Lead response time (team)

**Filters:**
- Date range
- Rep
- Product category

**Visualizations:**
- Team quota progress gauge
- Individual quota progress (horizontal bars)
- Win rate trend
- Sales cycle trend

**Export:** ✅ Excel, PDF, CSV
**Schedule:** ✅ Daily, Weekly

---

#### 9. Lead Management Report
**Access:** Level 3+
**Scope:** Location leads
**Refresh:** Real-time

**Key Metrics:**
- Leads created (period)
- Leads by source
- Leads by status
- Lead conversion rate
- Average lead age
- Leads unassigned
- Leads overdue for follow-up

**Filters:**
- Date range
- Lead source
- Lead status
- Assigned rep

**Visualizations:**
- Leads by source (pie chart)
- Lead funnel (conversion by stage)
- Lead aging (histogram)

**Export:** ✅ Excel, PDF, CSV
**Schedule:** ✅ Daily, Weekly

---

#### 10. Coaching Report
**Access:** Level 3+
**Scope:** Team
**Refresh:** Weekly

**Key Metrics (per rep):**
- Call volume
- Call talk time
- Meetings held vs planned
- Quote volume
- Quote win rate
- Opportunity stage velocity
- Deals stuck (> 30 days in stage)

**Flags:**
- Low activity alerts
- Low conversion alerts
- Deals at risk

**Export:** ✅ Excel, PDF
**Schedule:** ✅ Weekly, Monthly

---

### Level 4: Sales Manager Reports

**All Level 3 Reports, PLUS:**

#### 11. Location Sales Performance Report
**Access:** Level 4+
**Scope:** Location (all teams)
**Refresh:** Real-time

**Key Metrics:**
- Location revenue (MTD, QTD, YTD)
- Location quota attainment
- Team-by-team breakdown
- Win rate (location)
- Average deal size
- Sales cycle (location average)
- Pipeline coverage (location)

**Comparisons:**
- vs last period
- vs regional average (if applicable)
- vs plan

**Filters:**
- Date range
- Team
- Product category
- Customer segment

**Visualizations:**
- Revenue trend (line chart)
- Team contribution (stacked bar)
- Quota attainment by team (horizontal bars)
- Win rate funnel

**Export:** ✅ All formats
**Schedule:** ✅ Daily, Weekly, Monthly

---

#### 12. Sales Forecasting Report
**Access:** Level 4+
**Scope:** Location
**Refresh:** Real-time (recalculated nightly)

**Key Metrics:**
- Forecasted revenue (current month, next 3 months)
- Forecast by rep
- Forecast by product category
- Commit forecast (high probability deals)
- Best case forecast
- Worst case forecast
- Forecast accuracy (historical)

**Methodology:**
- Weighted pipeline (by stage)
- Historical win rates
- Sales rep input (commit/best case)

**Visualizations:**
- Forecast waterfall chart
- Forecast vs quota
- Forecast trend (historical + future)

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 13. Win/Loss Analysis Report
**Access:** Level 4+
**Scope:** Location
**Refresh:** Daily

**Key Metrics:**
- Win rate (overall, by rep, by product)
- Loss reasons (categorized)
- Competitor losses (by competitor)
- Deal size won vs lost
- Sales cycle won vs lost
- Discount levels won vs lost

**Filters:**
- Date range (close date)
- Rep
- Product category
- Competitor
- Loss reason

**Visualizations:**
- Win rate trend
- Loss reasons (pie chart)
- Competitor analysis (bar chart)
- Won vs lost comparison table

**Export:** ✅ All formats
**Schedule:** ✅ Monthly

---

#### 14. Territory Performance Report
**Access:** Level 4+
**Scope:** Location territories
**Refresh:** Daily

**Key Metrics (by territory):**
- Revenue
- Number of customers
- Pipeline value
- Coverage (pipeline / quota)
- Market penetration
- Rep assigned

**Visualizations:**
- Territory map (if geo data available)
- Territory comparison table
- Territory pipeline coverage

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 15. Product Mix Report
**Access:** Level 4+
**Scope:** Location
**Refresh:** Daily

**Key Metrics:**
- Revenue by product category
- Units sold by product
- Average selling price by product
- Gross margin by product (if available)
- Product attach rates (bundles)

**Filters:**
- Date range
- Rep
- Customer segment

**Visualizations:**
- Revenue by product (pie chart)
- Product trends (line chart, multi-series)
- Product mix table

**Export:** ✅ All formats
**Schedule:** ✅ Monthly

---

### Level 5: Regional Sales Director Reports

**All Level 4 Reports (but regional scope), PLUS:**

#### 16. Regional Sales Performance Report
**Access:** Level 5+
**Scope:** Region (all locations)
**Refresh:** Real-time

**Key Metrics:**
- Regional revenue (MTD, QTD, YTD)
- Regional quota attainment
- Location-by-location breakdown
- Regional win rate
- Regional pipeline coverage
- Regional sales cycle

**Comparisons:**
- vs last period
- vs other regions (read-only)
- vs plan

**Filters:**
- Date range
- Location
- Product category
- Customer segment

**Visualizations:**
- Regional revenue trend
- Location contribution (stacked bar)
- Location quota attainment (horizontal bars)
- Heat map (location performance)

**Export:** ✅ All formats
**Schedule:** ✅ Daily, Weekly, Monthly

---

#### 17. Location Comparison Report
**Access:** Level 5+
**Scope:** Region
**Refresh:** Daily

**Key Metrics (per location):**
- Revenue
- Quota attainment
- Win rate
- Pipeline coverage
- Sales cycle
- Average deal size
- Rep count
- Revenue per rep

**Visualizations:**
- Location scorecard (table)
- Location rankings (bar charts)
- Scatter plot (quota attainment vs pipeline coverage)

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 18. Regional Forecasting Report
**Access:** Level 5+
**Scope:** Region
**Refresh:** Real-time (recalculated nightly)

**Key Metrics:**
- Regional forecast (3-month rolling)
- Location-by-location forecast
- Forecast vs quota (regional)
- Forecast accuracy by location

**Visualizations:**
- Regional forecast waterfall
- Location forecast contribution
- Forecast trend with confidence intervals

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 19. Market Share Analysis Report
**Access:** Level 5+
**Scope:** Region
**Refresh:** Monthly

**Key Metrics:**
- Estimated market size (region)
- Company market share (region)
- Market share by location
- Market share trend
- Competitor analysis

**Data Sources:**
- Internal sales data
- Market research data (manual input)
- Industry reports

**Visualizations:**
- Market share pie chart
- Market share trend (line chart)
- Location market share comparison

**Export:** ✅ All formats
**Schedule:** ✅ Monthly, Quarterly

---

### Level 6: VP Sales / Sales Director Reports

**All Level 5 Reports (but company-wide scope), PLUS:**

#### 20. Executive Sales Dashboard
**Access:** Level 6+
**Scope:** Company-wide
**Refresh:** Real-time

**Key Metrics:**
- Company revenue (MTD, QTD, YTD)
- Revenue vs plan
- Company quota attainment
- Company win rate
- Company pipeline coverage
- Sales team headcount
- Revenue per sales rep

**Comparisons:**
- vs last year
- vs plan
- trend analysis

**Visualizations:**
- Revenue KPI cards (with trends)
- Revenue by region (stacked bar)
- Revenue trend (line chart, multi-year)
- Pipeline health gauge

**Export:** ✅ All formats
**Schedule:** ✅ Daily, Weekly, Monthly

---

#### 21. Company-Wide Sales Analytics Report
**Access:** Level 6+
**Scope:** Company-wide
**Refresh:** Daily

**Key Metrics:**
- Sales by region, location, team, rep
- Product mix (company-wide)
- Customer segment analysis
- Sales cycle analysis
- Deal size distribution
- Conversion rates (all funnel stages)
- Sales velocity

**Advanced Analytics:**
- Cohort analysis
- Retention/expansion revenue
- Customer lifetime value trends
- Sales efficiency metrics

**Filters:**
- Date range
- Region, location
- Product category
- Customer segment
- Rep level

**Visualizations:**
- Multi-dimensional dashboard
- Drill-down capability
- Custom charts

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 22. Sales Team Effectiveness Report
**Access:** Level 6+
**Scope:** Company-wide
**Refresh:** Weekly

**Key Metrics:**
- Revenue per rep (company average)
- Revenue per rep by level (rep, senior, supervisor, manager)
- Quota attainment distribution
- Ramp time (new hires)
- Attrition rate (sales team)
- Training effectiveness

**Visualizations:**
- Revenue per rep trend
- Quota attainment histogram
- Rep performance distribution curve

**Export:** ✅ All formats
**Schedule:** ✅ Monthly, Quarterly

---

#### 23. Strategic Account Report
**Access:** Level 6+
**Scope:** Company-wide strategic accounts
**Refresh:** Weekly

**Key Metrics (per strategic account):**
- Revenue (historical + current period)
- Revenue trend
- Product penetration
- Account health score
- Expansion opportunities
- Contract renewal dates
- Risk assessment

**Visualizations:**
- Strategic account portfolio view
- Account revenue trend
- Account health dashboard

**Export:** ✅ All formats
**Schedule:** ✅ Monthly

---

#### 24. Board-Level Sales Report
**Access:** Level 6+ (plus CEO, CFO, Board)
**Scope:** Company-wide
**Refresh:** Monthly

**Key Metrics:**
- Revenue (vs plan, vs LY)
- New customer acquisition
- Customer retention rate
- Average contract value
- Sales efficiency (CAC, sales & marketing expense ratio)
- Key wins/losses
- Sales team growth

**Format:**
- Executive summary (1 page)
- Key metrics dashboard
- Strategic narrative

**Export:** ✅ PDF, PowerPoint
**Schedule:** ✅ Monthly (for board meetings)

---

## Service Department Reports

### Level 1: Field Technician Reports

#### 25. Personal Productivity Report
**Access:** Level 1+
**Scope:** Own tickets/work orders
**Refresh:** Real-time

**Key Metrics:**
- Tickets completed (today, week, month)
- Work orders completed
- Average time per ticket
- First-time fix rate (own)
- Customer satisfaction score (own)
- Utilization rate (billable hours / total hours)

**Visualizations:**
- Daily ticket count (bar chart)
- FTF rate gauge
- Customer satisfaction trend

**Export:** ❌
**Schedule:** ❌

---

#### 26. Personal Schedule Report
**Access:** Level 1+
**Scope:** Own schedule
**Refresh:** Real-time

**Key Metrics:**
- Today's appointments
- Week's appointments
- Appointment status (scheduled, in-progress, completed)
- Drive time
- Total scheduled hours

**Visualizations:**
- Daily calendar view
- Weekly calendar view
- Map view (if GPS enabled)

---

#### 27. Personal Parts Usage Report
**Access:** Level 1+
**Scope:** Own parts usage
**Refresh:** Daily

**Key Metrics:**
- Parts used (period)
- Parts cost (period)
- Average parts cost per ticket
- Parts return rate

**Export:** ❌
**Schedule:** ❌

---

### Level 2: Senior Technician Reports

**All Level 1 Reports, PLUS:**

#### 28. Team Workload Report
**Access:** Level 2+
**Scope:** Team (read-only)
**Refresh:** Real-time

**Key Metrics (per tech):**
- Open tickets
- Scheduled appointments
- Utilization rate
- Ticket backlog

**Purpose:** Help senior techs balance workload and assist overwhelmed teammates

**Export:** ✅ Excel, PDF
**Schedule:** ❌

---

### Level 3: Service Supervisor Reports

**All Level 2 Reports, PLUS:**

#### 29. Team Productivity Report
**Access:** Level 3+
**Scope:** Team
**Refresh:** Daily

**Key Metrics:**
- Team tickets completed (period)
- Average tickets per tech
- Team utilization rate
- Team first-time fix rate
- Team customer satisfaction
- Response time (average)
- Resolution time (average)

**Filters:**
- Date range
- Technician
- Ticket type

**Visualizations:**
- Productivity by tech (bar chart)
- Team FTF rate trend
- CSAT trend

**Export:** ✅ All formats
**Schedule:** ✅ Daily, Weekly

---

#### 30. SLA Compliance Report
**Access:** Level 3+
**Scope:** Team
**Refresh:** Real-time

**Key Metrics:**
- Tickets within SLA (%)
- Tickets breached SLA
- Average response time
- Average resolution time
- SLA performance by priority
- SLA performance by tech

**Filters:**
- Date range
- Priority
- Technician
- Customer segment

**Visualizations:**
- SLA compliance gauge
- SLA breach trend
- SLA compliance by priority (stacked bar)

**Export:** ✅ All formats
**Schedule:** ✅ Daily, Weekly

---

#### 31. Dispatch Efficiency Report
**Access:** Level 3+
**Scope:** Team
**Refresh:** Real-time

**Key Metrics:**
- Tickets assigned (period)
- Average time to assign
- Assignment balance (tickets per tech)
- Route optimization score
- Drive time vs service time ratio
- Emergency ticket response time

**Visualizations:**
- Assignment volume by tech
- Response time histogram
- Route efficiency map

**Export:** ✅ Excel, PDF
**Schedule:** ✅ Weekly

---

### Level 4: Service Manager Reports

**All Level 3 Reports (but location scope), PLUS:**

#### 32. Location Service Performance Report
**Access:** Level 4+
**Scope:** Location (all teams)
**Refresh:** Daily

**Key Metrics:**
- Total tickets (MTD, QTD, YTD)
- Tickets by type (warranty, billable, PM)
- Service revenue (billable tickets)
- Service costs (labor + parts)
- Service profitability
- SLA compliance (location)
- First-time fix rate (location)
- Customer satisfaction (location)

**Comparisons:**
- vs last period
- vs regional average (read-only)
- vs plan

**Filters:**
- Date range
- Team
- Ticket type
- Customer segment

**Visualizations:**
- Ticket volume trend
- Revenue vs cost (stacked area chart)
- SLA compliance trend
- FTF rate trend

**Export:** ✅ All formats
**Schedule:** ✅ Daily, Weekly, Monthly

---

#### 33. Technician Performance Report
**Access:** Level 4+
**Scope:** Location
**Refresh:** Daily

**Key Metrics (per technician):**
- Tickets completed
- First-time fix rate
- Customer satisfaction score
- Utilization rate
- Average ticket time
- Parts efficiency (cost per ticket)
- Billable revenue generated
- Certifications held

**Visualizations:**
- Technician scorecard (table)
- Performance radar chart (per tech: FTF, CSAT, Utilization, Efficiency)
- Tech rankings (bar charts)

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 34. Service Profitability Report
**Access:** Level 4+
**Scope:** Location
**Refresh:** Daily

**Key Metrics:**
- Service revenue (billable tickets)
- Labor costs (technician time * rate)
- Parts costs
- Overhead allocation
- Gross profit
- Gross margin %
- Profitability by customer
- Profitability by service type

**Filters:**
- Date range
- Customer
- Service type
- Technician

**Visualizations:**
- Revenue vs cost waterfall
- Margin trend (line chart)
- Profitability by customer (bar chart)

**Export:** ✅ All formats
**Schedule:** ✅ Monthly

---

#### 35. Equipment Health Report
**Access:** Level 4+
**Scope:** Location customers
**Refresh:** Daily

**Key Metrics:**
- Total equipment monitored
- Equipment uptime %
- Equipment with recent issues
- Preventive maintenance due
- Warranty status
- Equipment at risk (high service frequency)

**Filters:**
- Customer
- Equipment type/model
- Status

**Visualizations:**
- Equipment health dashboard
- Uptime trend
- Service frequency histogram

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 36. Parts Usage & Cost Report
**Access:** Level 4+
**Scope:** Location
**Refresh:** Daily

**Key Metrics:**
- Total parts cost (period)
- Parts cost by technician
- Parts cost by customer
- Top 10 parts used
- Parts return rate
- Average parts cost per ticket
- Warranty parts vs purchased

**Filters:**
- Date range
- Technician
- Customer
- Part category

**Visualizations:**
- Parts cost trend
- Parts cost by tech (bar chart)
- Top parts table

**Export:** ✅ All formats
**Schedule:** ✅ Monthly

---

### Level 5: Regional Service Manager Reports

**All Level 4 Reports (but regional scope), PLUS:**

#### 37. Regional Service Performance Report
**Access:** Level 5+
**Scope:** Region (all locations)
**Refresh:** Daily

**Key Metrics:**
- Regional ticket volume
- Regional service revenue
- Regional service profitability
- Regional SLA compliance
- Regional FTF rate
- Regional CSAT
- Location-by-location breakdown

**Comparisons:**
- vs last period
- vs other regions (read-only)
- vs plan

**Visualizations:**
- Regional performance dashboard
- Location contribution (stacked bar)
- Location comparison table

**Export:** ✅ All formats
**Schedule:** ✅ Daily, Weekly, Monthly

---

#### 38. Location Comparison Report (Service)
**Access:** Level 5+
**Scope:** Region
**Refresh:** Daily

**Key Metrics (per location):**
- Ticket volume
- SLA compliance
- FTF rate
- CSAT
- Utilization rate
- Service profitability
- Technician count
- Tickets per technician

**Visualizations:**
- Location scorecard (table)
- Location rankings
- Scatter plot (SLA vs FTF)

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 39. Regional Capacity Planning Report
**Access:** Level 5+
**Scope:** Region
**Refresh:** Weekly

**Key Metrics:**
- Current technician headcount (by location)
- Current utilization rates
- Forecasted ticket volume (based on trends)
- Hiring needs (by location)
- Overtime trends
- Backlog trends

**Visualizations:**
- Capacity vs demand chart
- Utilization heat map (by location)
- Hiring needs table

**Export:** ✅ All formats
**Schedule:** ✅ Monthly

---

### Level 6: VP Service / Service Director Reports

**All Level 5 Reports (but company-wide scope), PLUS:**

#### 40. Executive Service Dashboard
**Access:** Level 6+
**Scope:** Company-wide
**Refresh:** Real-time

**Key Metrics:**
- Company ticket volume (MTD, QTD, YTD)
- Company service revenue
- Company service profitability
- Company SLA compliance
- Company FTF rate
- Company CSAT
- Technician headcount

**Comparisons:**
- vs last year
- vs plan
- trend analysis

**Visualizations:**
- Service KPI cards (with trends)
- Service revenue by region (stacked bar)
- SLA & FTF trend (line chart)
- Profitability trend

**Export:** ✅ All formats
**Schedule:** ✅ Daily, Weekly, Monthly

---

#### 41. Company-Wide Service Analytics Report
**Access:** Level 6+
**Scope:** Company-wide
**Refresh:** Daily

**Key Metrics:**
- Service metrics by region, location, team, tech
- Service type mix (warranty, billable, PM)
- Customer segment analysis
- Equipment type analysis
- Service cycle analysis
- Parts efficiency

**Advanced Analytics:**
- Service demand forecasting
- Technician productivity trends
- Customer churn correlation with service quality

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 42. Service Quality Report
**Access:** Level 6+
**Scope:** Company-wide
**Refresh:** Weekly

**Key Metrics:**
- First-time fix rate (company, regional, location)
- Customer satisfaction scores
- Repeat ticket rate
- Escalation rate
- Complaint volume
- Quality by technician level (new, standard, senior)

**Visualizations:**
- Quality scorecard
- Quality trends
- Root cause analysis (for quality issues)

**Export:** ✅ All formats
**Schedule:** ✅ Monthly, Quarterly

---

#### 43. Board-Level Service Report
**Access:** Level 6+ (plus CEO, CFO, Board)
**Scope:** Company-wide
**Refresh:** Monthly

**Key Metrics:**
- Service revenue (vs plan, vs LY)
- Service profitability
- SLA compliance
- Customer satisfaction
- Service efficiency metrics
- Technician headcount growth
- Service capacity

**Format:**
- Executive summary
- Key metrics dashboard
- Strategic narrative

**Export:** ✅ PDF, PowerPoint
**Schedule:** ✅ Monthly

---

## Operations Department Reports

### Level 1: Warehouse Associate / Inventory Specialist Reports

#### 44. Personal Productivity Report (Warehouse)
**Access:** Level 1+
**Scope:** Own work
**Refresh:** Daily

**Key Metrics:**
- Items received (period)
- Items picked (period)
- Orders packed (period)
- Cycle counts completed
- Accuracy rate
- Productivity (units per hour)

**Visualizations:**
- Daily productivity chart
- Accuracy gauge

**Export:** ❌
**Schedule:** ❌

---

### Level 2-3: Warehouse Supervisor Reports

#### 45. Team Productivity Report (Warehouse)
**Access:** Level 3+
**Scope:** Team
**Refresh:** Daily

**Key Metrics (per associate):**
- Productivity (units/hour)
- Accuracy rate
- Tasks completed
- Cycle count accuracy

**Export:** ✅ Excel, PDF
**Schedule:** ✅ Weekly

---

#### 46. Inventory Accuracy Report
**Access:** Level 3+
**Scope:** Location
**Refresh:** Daily

**Key Metrics:**
- Overall inventory accuracy %
- Accuracy by product category
- Cycle count results
- Discrepancies found
- Adjustments made
- Shrinkage rate

**Visualizations:**
- Accuracy trend
- Discrepancy analysis (root causes)

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 47. FPY (First Pass Yield) Report
**Access:** Level 3+
**Scope:** Location
**Refresh:** Daily

**Key Metrics:**
- FPY rate (orders assembled correctly first time)
- FPY failures by type
- Rework time
- Rework cost
- FPY rate by product
- FPY rate by associate

**Visualizations:**
- FPY trend
- Failure analysis (Pareto chart)

**Export:** ✅ All formats
**Schedule:** ✅ Daily, Weekly

---

### Level 4: Warehouse Manager / Operations Manager Reports

#### 48. Warehouse Performance Report
**Access:** Level 4+
**Scope:** Location
**Refresh:** Daily

**Key Metrics:**
- Receiving volume
- Shipping volume
- Inventory turns
- Order fill rate
- On-time shipment rate
- Warehouse labor cost
- Warehouse labor productivity

**Visualizations:**
- Volume trends (receiving, shipping)
- Fill rate trend
- On-time rate trend

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 49. Inventory Valuation Report
**Access:** Level 4+
**Scope:** Location
**Refresh:** Daily

**Key Metrics:**
- Total inventory value
- Inventory value by category
- Slow-moving inventory
- Obsolete inventory
- Inventory aging
- Carrying cost

**Visualizations:**
- Inventory value breakdown (pie chart)
- Aging histogram
- Slow-moving items table

**Export:** ✅ All formats
**Schedule:** ✅ Monthly

---

#### 50. Purchase Order Report
**Access:** Level 4+
**Scope:** Location
**Refresh:** Daily

**Key Metrics:**
- Open POs
- PO value (open)
- POs by vendor
- PO aging (time to receive)
- PO accuracy (ordered vs received)

**Visualizations:**
- Open PO table
- PO aging chart
- Vendor performance table

**Export:** ✅ All formats
**Schedule:** ✅ Weekly

---

#### 51. Logistics & Delivery Report
**Access:** Level 4+
**Scope:** Location
**Refresh:** Daily

**Key Metrics:**
- Deliveries completed
- On-time delivery rate
- Delivery cost
- Route efficiency
- Customer delivery satisfaction

**Visualizations:**
- On-time rate trend
- Delivery volume chart
- Route map (if GPS data)

**Export:** ✅ All formats
**Schedule:** ✅ Weekly

---

### Level 5-6: Regional Operations Manager / COO Reports

#### 52. Regional Operations Performance Report
**Access:** Level 5+
**Scope:** Region or Company-wide
**Refresh:** Daily

**Key Metrics:**
- Inventory accuracy (consolidated)
- Inventory turns (consolidated)
- FPY (consolidated)
- Warehouse productivity (consolidated)
- Location comparison

**Visualizations:**
- Location scorecard
- Location comparison charts

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 53. Supply Chain Report
**Access:** Level 5+
**Scope:** Regional or Company-wide
**Refresh:** Weekly

**Key Metrics:**
- Vendor performance (on-time, quality)
- Lead times by vendor
- Freight costs
- Inventory in transit
- Stockouts
- Backorders

**Visualizations:**
- Vendor scorecard
- Lead time trends
- Stockout analysis

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 54. Executive Operations Dashboard
**Access:** Level 6+
**Scope:** Company-wide
**Refresh:** Daily

**Key Metrics:**
- Inventory value (company)
- Inventory turns (company)
- Fill rate (company)
- On-time delivery (company)
- Operations costs
- Warehouse productivity (company)

**Visualizations:**
- Operations KPI cards
- Trends (inventory turns, fill rate, on-time rate)

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

## Finance Department Reports

### Level 1: Accounting Clerk Reports

#### 55. Personal Transaction Log
**Access:** Level 1+
**Scope:** Own transactions entered
**Refresh:** Real-time

**Key Metrics:**
- Transactions entered (period)
- Transaction types
- Error rate (if tracked)

**Export:** ❌
**Schedule:** ❌

---

### Level 3-4: Accounting Supervisor / Finance Manager Reports

#### 56. AR Aging Report
**Access:** Level 3+
**Scope:** Location or Company (based on level)
**Refresh:** Daily

**Key Metrics:**
- Total AR balance
- AR by aging bucket (0-30, 31-60, 61-90, 90+)
- AR by customer
- Average days outstanding
- Collections needed

**Visualizations:**
- Aging breakdown (stacked bar)
- Top customers by balance
- Aging trend

**Export:** ✅ All formats
**Schedule:** ✅ Weekly

---

#### 57. AP Aging Report
**Access:** Level 3+
**Scope:** Location or Company
**Refresh:** Daily

**Key Metrics:**
- Total AP balance
- AP by aging bucket
- AP by vendor
- Upcoming payments due
- Overdue payments

**Visualizations:**
- Aging breakdown
- Top vendors by balance

**Export:** ✅ All formats
**Schedule:** ✅ Weekly

---

#### 58. Cash Flow Report
**Access:** Level 4+
**Scope:** Location or Company
**Refresh:** Daily

**Key Metrics:**
- Cash beginning balance
- Cash receipts (period)
- Cash disbursements (period)
- Cash ending balance
- Cash forecast (30/60/90 days)

**Visualizations:**
- Cash flow waterfall
- Cash trend (line chart)

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 59. Financial Statements (P&L, Balance Sheet, Cash Flow)
**Access:** Level 4+
**Scope:** Location or Company
**Refresh:** Monthly (after close)

**Key Reports:**
- Profit & Loss Statement
- Balance Sheet
- Statement of Cash Flows

**Comparisons:**
- Actual vs budget
- Actual vs last year
- Month-over-month, YTD

**Export:** ✅ All formats
**Schedule:** ✅ Monthly

---

#### 60. Budget vs Actual Report
**Access:** Level 4+
**Scope:** Location or Company
**Refresh:** Monthly

**Key Metrics:**
- Revenue (actual vs budget)
- Expenses by category (actual vs budget)
- Variance ($, %)
- Variance explanations

**Visualizations:**
- Variance chart (bar chart with +/- variances)
- Variance trend (line chart)

**Export:** ✅ All formats
**Schedule:** ✅ Monthly

---

### Level 6: CFO Reports

#### 61. Executive Financial Dashboard
**Access:** Level 6+ (CFO, CEO)
**Scope:** Company-wide
**Refresh:** Daily

**Key Metrics:**
- Revenue (MTD, QTD, YTD)
- Gross profit, gross margin %
- Operating expenses
- EBITDA
- Net income
- Cash balance
- AR/AP summary

**Visualizations:**
- Financial KPI cards (with trends)
- Revenue & margin trends
- Cash trend

**Export:** ✅ All formats
**Schedule:** ✅ Daily, Weekly, Monthly

---

#### 62. Profitability Analysis Report
**Access:** Level 6+
**Scope:** Company-wide
**Refresh:** Monthly

**Key Metrics:**
- Profitability by location
- Profitability by department
- Profitability by customer
- Profitability by product category
- Gross margin by dimension

**Visualizations:**
- Profitability matrix
- Margin trends by dimension

**Export:** ✅ All formats
**Schedule:** ✅ Monthly, Quarterly

---

#### 63. KPI Scorecard (Financial)
**Access:** Level 6+
**Scope:** Company-wide
**Refresh:** Monthly

**Key Metrics:**
- Revenue growth rate
- Gross margin %
- Operating margin %
- EBITDA margin %
- Return on assets
- Current ratio
- Quick ratio
- Days sales outstanding (DSO)
- Days payable outstanding (DPO)

**Visualizations:**
- Scorecard table (actual vs target vs last year)
- Trend charts (multi-period)

**Export:** ✅ All formats
**Schedule:** ✅ Monthly, Quarterly

---

#### 64. Board-Level Financial Report
**Access:** Level 6+ (CFO, CEO, Board)
**Scope:** Company-wide
**Refresh:** Monthly

**Key Components:**
- Executive summary
- Financial statements (P&L, Balance Sheet)
- Key financial metrics
- Variance analysis
- Cash flow
- Strategic financial commentary

**Export:** ✅ PDF, PowerPoint
**Schedule:** ✅ Monthly (for board meetings)

---

## Executive Reports (Level 7)

### CEO / President

#### 65. Executive Summary Dashboard
**Access:** Level 7+
**Scope:** Company-wide, all departments
**Refresh:** Real-time

**Key Metrics (Comprehensive):**
- **Sales**: Revenue, pipeline, quota attainment
- **Service**: Ticket volume, SLA, CSAT, profitability
- **Operations**: Inventory turns, fill rate, FPY
- **Finance**: Revenue, margin, EBITDA, cash
- **HR**: Headcount, attrition, hiring
- **Customer**: Customer count, retention, NPS

**Visualizations:**
- Multi-departmental KPI cards
- Cross-functional trends
- Strategic alerts/flags

**Export:** ✅ All formats
**Schedule:** ✅ Daily, Weekly

---

#### 66. Company Performance Report
**Access:** Level 7+
**Scope:** Company-wide
**Refresh:** Monthly

**Key Sections:**
- Financial performance (revenue, margins, cash)
- Sales performance (vs goals)
- Service performance (quality, profitability)
- Operations performance (efficiency)
- HR metrics (headcount, productivity)
- Strategic initiatives progress

**Export:** ✅ PDF, PowerPoint
**Schedule:** ✅ Monthly

---

#### 67. Strategic KPI Report
**Access:** Level 7+
**Scope:** Company-wide
**Refresh:** Monthly

**Key Metrics:**
- Company growth rate (revenue, YoY)
- Market share
- Customer acquisition cost (CAC)
- Customer lifetime value (CLV)
- Net promoter score (NPS)
- Employee engagement score
- EBITDA margin
- Return on invested capital (ROIC)

**Export:** ✅ All formats
**Schedule:** ✅ Monthly, Quarterly

---

#### 68. Board Report
**Access:** Level 7+ (CEO, CFO, Board)
**Scope:** Company-wide
**Refresh:** Monthly (or quarterly)

**Key Components:**
- Executive summary
- Financial performance
- Strategic goals progress
- Key initiatives
- Risk & opportunities
- Forward-looking statements

**Export:** ✅ PDF, PowerPoint
**Schedule:** ✅ Monthly or Quarterly (for board meetings)

---

## Platform Admin Reports (Level 8)

### Platform Administrator (Printyx Staff)

#### 69. Platform System Metrics
**Access:** Level 8 only
**Scope:** Entire platform (all tenants)
**Refresh:** Real-time

**Key Metrics:**
- Total active tenants
- Total users (across all tenants)
- System uptime %
- API response times
- Error rates
- Database performance
- Storage utilization

**Visualizations:**
- System health dashboard
- Performance trends
- Error logs

**Export:** ✅ All formats
**Schedule:** ✅ Daily

---

#### 70. Tenant Usage Report
**Access:** Level 8 only
**Scope:** All tenants
**Refresh:** Daily

**Key Metrics (per tenant):**
- User count
- Data storage used
- API calls (period)
- Features enabled
- Subscription level
- Billing status

**Visualizations:**
- Tenant usage table
- Usage trends

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

#### 71. Platform Billing Report
**Access:** Level 8 only
**Scope:** All tenants
**Refresh:** Daily

**Key Metrics:**
- Monthly recurring revenue (MRR)
- Annual recurring revenue (ARR)
- Churn rate
- Expansion revenue
- Revenue by subscription tier
- Outstanding invoices

**Visualizations:**
- Revenue trends
- Subscription distribution

**Export:** ✅ All formats
**Schedule:** ✅ Monthly

---

#### 72. Security & Audit Report
**Access:** Level 8 only
**Scope:** Platform-wide
**Refresh:** Real-time

**Key Metrics:**
- Login attempts (successful, failed)
- MFA adoption rate
- Permission changes
- Suspicious activity flags
- Audit log review

**Visualizations:**
- Security event timeline
- Failed login heatmap (by IP)

**Export:** ✅ All formats
**Schedule:** ✅ Weekly

---

## Cross-Department Reports

#### 73. Customer 360 Report
**Access:** Level 4+ (varies by department)
**Scope:** Customer-specific, aggregated from all departments
**Refresh:** Real-time

**Key Sections:**
- **Customer Profile**: Name, address, contacts, hierarchy
- **Sales**: Opportunities, quotes, revenue history
- **Service**: Equipment, tickets, SLA compliance, CSAT
- **Finance**: AR balance, payment history, credit limit
- **Operations**: Deliveries, installations

**Visualizations:**
- Customer timeline (all interactions)
- Revenue trend
- Service health

**Export:** ✅ All formats
**Schedule:** ❌ (on-demand)

---

#### 74. Employee Performance Report
**Access:** Level 3+ (for direct reports), Level 6+ (department-wide), Level 7+ (company-wide)
**Scope:** Employee-specific or aggregated
**Refresh:** Weekly

**Key Metrics (varies by role):**
- Department-specific KPIs (see earlier sections)
- Goals vs actual
- Peer comparison
- Training completed
- Certifications

**Visualizations:**
- Performance scorecard
- Goal progress

**Export:** ✅ PDF (for reviews)
**Schedule:** ✅ Monthly, Quarterly

---

#### 75. Location Performance Report (Multi-Department)
**Access:** Level 4+ (Branch Managers), Level 5+ (Regional), Level 7+ (All locations)
**Scope:** Location-specific, all departments
**Refresh:** Daily

**Key Sections:**
- **Sales**: Revenue, pipeline, quota attainment
- **Service**: Tickets, SLA, profitability
- **Operations**: Inventory, FPY, deliveries
- **Finance**: P&L, AR/AP

**Visualizations:**
- Location dashboard (multi-department)
- Cross-department trends

**Export:** ✅ All formats
**Schedule:** ✅ Weekly, Monthly

---

## Report Delivery & Scheduling

### Scheduling Capabilities by Level

| Level | Can Schedule Reports | Frequency Options | Recipients |
|-------|---------------------|-------------------|------------|
| 1 | ❌ | N/A | N/A |
| 2 | ❌ | N/A | N/A |
| 3 | ✅ | Daily, Weekly | Self, team |
| 4 | ✅ | Daily, Weekly, Monthly | Self, team, manager |
| 5 | ✅ | Daily, Weekly, Monthly | Self, team, managers, director |
| 6 | ✅ | Daily, Weekly, Monthly, Quarterly | Any (department) |
| 7 | ✅ | Daily, Weekly, Monthly, Quarterly | Any (company) |
| 8 | ✅ | Any frequency | Any |

### Export Format Permissions

| Level | PDF | Excel | CSV | PowerPoint |
|-------|-----|-------|-----|------------|
| 1 | ❌ | ❌ | ❌ | ❌ |
| 2 | ✅ | ✅ | ❌ | ❌ |
| 3 | ✅ | ✅ | ✅ | ❌ |
| 4+ | ✅ | ✅ | ✅ | ✅ |

---

## Summary of Reporting Requirements

### Total Reports Defined: 75+

**By Department:**
- Sales: 24 reports
- Service: 19 reports
- Operations: 11 reports
- Finance: 10 reports
- Executive: 4 reports
- Platform Admin: 4 reports
- Cross-Department: 3 reports

**By Access Level:**
- Level 1: 13 reports (own data only)
- Level 2: 16 reports (+ team visibility)
- Level 3: 31 reports (+ team management)
- Level 4: 51 reports (+ location/department)
- Level 5: 62 reports (+ regional)
- Level 6: 69 reports (+ company-wide)
- Level 7: 73 reports (+ executive/strategic)
- Level 8: 75 reports (+ platform-wide)

### Implementation Priority

**Phase 1 (Critical - Weeks 1-4):**
- Personal dashboards (Levels 1-2): Reports 1-5, 25-27, 44, 55
- Team reports (Level 3): Reports 8-10, 29-31, 45-47
- Location reports (Level 4): Reports 11-15, 32-36, 48-51, 56-60

**Phase 2 (High Priority - Weeks 5-8):**
- Regional reports (Level 5): Reports 16-19, 37-39, 52-53
- Executive reports (Levels 6-7): Reports 20-24, 40-43, 61-68

**Phase 3 (Medium Priority - Weeks 9-12):**
- Cross-department reports: Reports 73-75
- Platform admin reports: Reports 69-72

---

**Next Document**: See `RBAC_IMPLEMENTATION_PLAN.md` for step-by-step implementation roadmap.
