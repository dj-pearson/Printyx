# Printyx RBAC Reporting System - User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Quick Start by Role](#quick-start-by-role)
3. [Level 1-2: Individual Contributors](#level-1-2-individual-contributors)
4. [Level 3-4: Supervisors & Managers](#level-3-4-supervisors--managers)
5. [Level 5-6: Directors](#level-5-6-directors)
6. [Level 7-8: Executives & Platform Admins](#level-7-8-executives--platform-admins)
7. [Report Features](#report-features)
8. [Frequently Asked Questions](#frequently-asked-questions)

---

## Introduction

Welcome to the Printyx RBAC (Role-Based Access Control) Reporting System! This guide will help you understand and use the reporting features available to your role.

### What is RBAC?

RBAC automatically shows you only the reports and data you're authorized to see based on your:
- **Role Level** (1-8): Your position in the organization
- **Permissions**: Specific actions you can perform
- **Scope**: The breadth of data you can access (own, team, location, regional, company, platform)

### 8-Level Role Hierarchy

1. **Level 1**: Individual Contributors (Sales Rep, Field Technician)
2. **Level 2**: Senior Staff (Senior Sales Rep, Senior Technician)
3. **Level 3**: Supervisors (Sales Supervisor, Service Supervisor)
4. **Level 4**: Managers (Sales Manager, Service Manager, Branch Manager)
5. **Level 5**: Regional Directors (Regional Sales Director, Regional Service Manager)
6. **Level 6**: Company Directors (VP Sales, VP Service, Director Operations, Controller)
7. **Level 7**: Executives (CEO, CFO, COO)
8. **Level 8**: Platform Administrators (Printyx Staff Only)

---

## Quick Start by Role

### I'm a Sales Rep - What can I see?

✅ **Your Reports (4 reports)**:
- My Sales Pipeline
- My Activity Report
- My Win/Loss Analysis
- My Monthly Performance

📊 **Data Scope**: Only YOUR data (deals, leads, opportunities you own)

🔒 **Restrictions**: Cannot see team, location, or company-wide data

---

### I'm a Manager - What can I see?

✅ **Your Reports (16+ reports)**:
- All Individual Reports (your own data)
- Team Performance Dashboard
- Location-Wide Metrics
- Budget vs Actual Analysis
- Team Leaderboards

📊 **Data Scope**: Your location + your team's data

🔒 **Restrictions**: Cannot see other locations or company-wide data

---

### I'm a Director - What can I see?

✅ **Your Reports (35+ reports)**:
- All Manager Reports
- Regional Performance Dashboard
- Multi-Location Comparisons
- Strategic Planning Reports
- Forecasting & Projections

📊 **Data Scope**: Your region (multiple locations)

🔒 **Restrictions**: Cannot see other regions or full company data

---

### I'm an Executive - What can I see?

✅ **Your Reports (60+ reports)**:
- All Lower-Level Reports
- Executive Dashboard
- Board Reports
- Company-Wide Analytics
- Financial Performance
- Strategic KPIs

📊 **Data Scope**: Entire company across all locations and regions

---

## Level 1-2: Individual Contributors

### Your Available Reports

#### Sales Representatives (4 Reports)

1. **My Sales Pipeline** (`SALES_PIPELINE_INDIVIDUAL`)
   - **What it shows**: Your open opportunities by stage
   - **Use case**: Track your deals from Discovery → Closed Won
   - **Refresh**: Every 5 minutes
   - **How to use**:
     1. Navigate to **Reports** → **Sales** → **My Pipeline**
     2. View deals organized by stage
     3. Click any deal to see details
     4. Filter by date range if needed

2. **My Activity Report** (`SALES_ACTIVITY_INDIVIDUAL`)
   - **What it shows**: Your daily/weekly activities (calls, meetings, emails)
   - **Use case**: Track your productivity and outreach
   - **Refresh**: Real-time
   - **How to use**:
     1. Go to **Reports** → **Sales** → **My Activity**
     2. Review activity metrics
     3. Compare this week vs last week

3. **My Win/Loss Analysis** (`SALES_WINLOSS_INDIVIDUAL`)
   - **What it shows**: Your closed deals (won vs lost)
   - **Use case**: Understand what's working and improve
   - **Refresh**: Daily
   - **How to use**:
     1. Navigate to **Reports** → **Sales** → **Win/Loss**
     2. Review win rate percentage
     3. Read AI-generated insights on common objections

4. **My Monthly Performance** (`SALES_PERFORMANCE_INDIVIDUAL`)
   - **What it shows**: Your quota attainment and monthly stats
   - **Use case**: Track progress toward monthly goals
   - **Refresh**: Daily
   - **How to use**:
     1. Go to **Reports** → **Sales** → **Performance**
     2. See quota progress bar
     3. Review trend over past 6 months

#### Field Technicians (4 Reports)

1. **My Service Calls** (`SERVICE_CALLS_INDIVIDUAL`)
   - **What it shows**: Your assigned service calls
   - **Use case**: See today's schedule and pending work
   - **Mobile-optimized**: Yes ✓

2. **My Productivity** (`SERVICE_PRODUCTIVITY_INDIVIDUAL`)
   - **What it shows**: First-time fix rate, average time per call
   - **Use case**: Track efficiency metrics

3. **My Parts Usage** (`SERVICE_PARTS_INDIVIDUAL`)
   - **What it shows**: Parts you've used this month
   - **Use case**: Inventory tracking and accountability

4. **My Customer Satisfaction** (`SERVICE_CSAT_INDIVIDUAL`)
   - **What it shows**: Customer ratings for your service calls
   - **Use case**: Maintain high quality standards

### How to Access Reports

**Desktop**:
1. Click **Reports** in the main navigation
2. Select your department (Sales, Service, etc.)
3. Click the report name
4. Report loads automatically

**Mobile**:
1. Tap menu (☰)
2. Tap **Reports**
3. Reports are optimized for mobile viewing
4. Swipe to navigate data

### Tips for Individual Contributors

✅ **Do**:
- Check your reports daily to stay on track
- Use filters to narrow down data
- Share report screenshots with your manager
- Set goals based on your metrics

❌ **Don't**:
- Try to access team or location reports (you won't have permission)
- Share report data externally
- Modify report formulas or calculations

---

## Level 3-4: Supervisors & Managers

### Your Available Reports

You have access to **all individual reports** PLUS team/location reports (16 total).

#### Sales Managers (8 Reports)

**Team Reports**:
1. **Team Sales Dashboard** (`SALES_TEAM_DASHBOARD`)
   - Team pipeline, win rates, quota attainment
   - Compare team members side-by-side

2. **Team Activity Summary** (`SALES_TEAM_ACTIVITY`)
   - Team productivity metrics
   - Identify top performers and coaching opportunities

**Location Reports**:
3. **Location Sales Performance** (`SALES_LOCATION_DASHBOARD`)
   - All sales across your location
   - Month-over-month growth

4. **Sales Forecast - Location** (`SALES_FORECAST_LOCATION`)
   - Predicted revenue for next 30/60/90 days
   - AI-powered projections

**Management Tools**:
5. **Rep Performance Comparison** (`SALES_REP_COMPARISON`)
   - Leaderboard of your team
   - Identify training needs

6. **Deal Stage Velocity** (`SALES_STAGE_VELOCITY_LOCATION`)
   - How fast deals move through pipeline
   - Identify bottlenecks

7. **Lost Deal Analysis** (`SALES_LOST_ANALYSIS_LOCATION`)
   - Why deals are lost at your location
   - Common objections and competitive losses

8. **Territory Coverage** (`SALES_TERRITORY_COVERAGE`)
   - Geographic coverage and gaps
   - Opportunity mapping

#### Service Managers (8 Reports)

**Team Reports**:
1. **Team Service Dashboard** (`SERVICE_TEAM_DASHBOARD`)
   - Team metrics: FTF rate, response time, CSAT

2. **Technician Utilization** (`SERVICE_UTILIZATION_LOCATION`)
   - Billable hours, capacity planning

**Location Reports**:
3. **Service Call Volume** (`SERVICE_VOLUME_LOCATION`)
   - Call trends and patterns

4. **SLA Compliance** (`SERVICE_SLA_LOCATION`)
   - Response time compliance by priority

**Management Tools**:
5. **Parts Inventory** (`SERVICE_PARTS_LOCATION`)
   - Stock levels at your location

6. **Customer Satisfaction** (`SERVICE_CSAT_LOCATION`)
   - Aggregate CSAT scores and trends

7. **Revenue by Service Type** (`SERVICE_REVENUE_LOCATION`)
   - Profitability analysis

8. **Preventive Maintenance** (`SERVICE_PM_LOCATION`)
   - PM compliance and scheduling

### Advanced Features for Managers

#### 1. Report Filters

Apply filters to drill down:
- **Date Range**: Last 7/30/90 days, custom ranges
- **Team Member**: Individual team member
- **Product Line**: Specific product categories
- **Customer Segment**: By industry, size, etc.

**How to use**:
1. Open any report
2. Click **Filters** button (🔍)
3. Select criteria
4. Click **Apply**

#### 2. Export Reports

Export data for presentations or offline analysis:

**Supported Formats**:
- CSV (Excel-friendly)
- Excel (.xlsx) with formatting
- PDF for printing

**How to export**:
1. Open report
2. Click **Export** button (📥)
3. Choose format
4. File downloads automatically

**Limits**: Max 10,000 rows per export

#### 3. Scheduled Reports

Receive reports automatically via email:

**How to schedule**:
1. Open report
2. Click **Schedule** button (🕐)
3. Set frequency (Daily, Weekly, Monthly)
4. Choose recipients
5. Select delivery time
6. Save schedule

**Example**: "Email me the Team Sales Dashboard every Monday at 8 AM"

---

## Level 5-6: Directors

### Your Available Reports

You have access to **all manager reports** PLUS regional/company reports (35+ total).

### Multi-Location Analysis

As a director, you can:
- Compare performance across locations
- Identify best practices to share
- Spot underperforming locations for intervention
- Optimize resource allocation

#### Key Director Reports

1. **Regional Sales Dashboard** (`SALES_REGIONAL_DASHBOARD`)
   - Aggregate metrics across all your locations
   - Regional quota attainment
   - Win rate trends by location

2. **Location Comparison** (`SALES_LOCATION_COMPARISON`)
   - Side-by-side location performance
   - Benchmark locations against each other
   - Identify top and bottom performers

3. **Territory Planning** (`SALES_TERRITORY_PLANNING_REGIONAL`)
   - Coverage maps and gap analysis
   - Territory rebalancing recommendations

4. **Forecast Accuracy** (`SALES_FORECAST_ACCURACY_REGIONAL`)
   - How accurate are your location managers' forecasts?
   - Historical vs actual analysis

5. **Customer Concentration** (`SALES_CUSTOMER_CONCENTRATION_REGIONAL`)
   - Revenue concentration risk
   - Customer retention by location

### Strategic Planning Reports

6. **Market Share Analysis** (`SALES_MARKET_SHARE_REGIONAL`)
   - Your region's market position
   - Competitive intelligence

7. **Product Mix Analysis** (`SALES_PRODUCT_MIX_REGIONAL`)
   - What products are selling where
   - Cross-sell/upsell opportunities

8. **Compensation Analysis** (`SALES_COMPENSATION_REGIONAL`)
   - Commission payouts and trends
   - Cost of sale by location

### Service Directors

9. **Regional Service Dashboard** (`SERVICE_REGIONAL_DASHBOARD`)
   - Aggregate service metrics
   - Multi-location SLA compliance

10. **Technician Capacity Planning** (`SERVICE_CAPACITY_REGIONAL`)
    - Staffing needs by location
    - Seasonal demand patterns

11. **Parts Optimization** (`SERVICE_PARTS_REGIONAL`)
    - Inventory levels across locations
    - Transfer recommendations

12. **Customer Health** (`SERVICE_CUSTOMER_HEALTH_REGIONAL`)
    - Contract renewal risk
    - Satisfaction trends

### Director Tips & Best Practices

✅ **Weekly Routine**:
- Monday: Review regional dashboard
- Wednesday: Check forecast accuracy
- Friday: Review location comparisons

✅ **Monthly Tasks**:
- Deep-dive into underperforming locations
- Share best practices from top locations
- Adjust territory assignments if needed

✅ **Quarterly Activities**:
- Strategic planning reviews
- Market share analysis
- Compensation plan adjustments

---

## Level 7-8: Executives & Platform Admins

### Executive Dashboard Suite

As an executive, you have **unrestricted access** to all 75 reports across all departments and levels.

#### CEO Dashboard (`EXECUTIVE_CEO_DASHBOARD`)

**Financial Metrics**:
- Revenue (MRR, ARR, Growth %)
- Gross Margin & Operating Margin
- Cash Flow & Runway

**Operational Metrics**:
- Customer Acquisition Cost (CAC)
- Customer Lifetime Value (CLV)
- Net Promoter Score (NPS)

**People Metrics**:
- Employee Headcount & Attrition
- Engagement Scores
- Open Positions

**Strategic Metrics**:
- Market Share
- Product Adoption
- Innovation Pipeline

#### CFO Dashboard (`EXECUTIVE_CFO_DASHBOARD`)

**Financial Performance**:
- P&L Summary
- Balance Sheet Highlights
- Cash Flow Statement

**AR/AP Metrics**:
- DSO (Days Sales Outstanding)
- Aging Reports
- Collection Efficiency

**Profitability Analysis**:
- Gross Margin by Product/Service
- Department P&L
- Cost Center Analysis

**Forecasting**:
- Revenue Forecast (with confidence intervals)
- Expense Projections
- Scenario Planning

#### COO Dashboard (`EXECUTIVE_COO_DASHBOARD`)

**Operations Metrics**:
- Service Delivery Metrics (SLA Compliance)
- Warehouse Efficiency (FPY, Inventory Turns)
- Fleet Utilization

**Customer Success**:
- Churn Rate
- Retention Rate
- Expansion Revenue

**Supply Chain**:
- Supplier Performance
- Lead Times
- Stock-outs

#### Board Report (`EXECUTIVE_BOARD_REPORT`)

**Quarterly Highlights**:
- Revenue & Profitability
- Key Wins & Losses
- Strategic Initiatives Progress

**Risk Dashboard**:
- Customer Concentration
- Competitive Threats
- Compliance Status

**Forward-Looking**:
- Growth Projections
- Investment Needs
- Market Opportunities

### Platform Admin Reports (Level 8)

**System Health**:
1. **Platform Metrics** (`PLATFORM_SYSTEM_METRICS`)
   - Uptime, API Response Times
   - Error Rates
   - Active Users

2. **Tenant Usage** (`PLATFORM_TENANT_USAGE`)
   - Storage per tenant
   - API call volumes
   - Feature adoption

3. **Billing & Revenue** (`PLATFORM_BILLING`)
   - MRR/ARR across all tenants
   - Churn analytics
   - Upgrade/downgrade trends

4. **Support Metrics** (`PLATFORM_SUPPORT`)
   - Ticket volume by tenant
   - Resolution times
   - Customer satisfaction

---

## Report Features

### Universal Features (All Users)

#### 1. Real-Time Data

Most reports refresh automatically:
- **Every 5 minutes**: Sales pipelines, service calls
- **Every 15 minutes**: Dashboards, activity reports
- **Daily**: Historical analysis, win/loss reports
- **Real-time**: Critical alerts and notifications

#### 2. Interactive Visualizations

Click on any chart to:
- **Drill down**: See underlying data
- **Filter**: Focus on specific segments
- **Compare**: Side-by-side comparisons

#### 3. AI-Powered Insights

Reports include:
- **Automated insights**: "Your win rate is up 12% this month"
- **Anomaly detection**: "Unusual spike in service calls detected"
- **Recommendations**: "Consider focusing on mid-market segment"

#### 4. Mobile Optimization

All reports work on:
- **Desktop**: Full-featured experience
- **Tablet**: Touch-optimized interface
- **Mobile**: Streamlined views for on-the-go

### Manager+ Features

#### Bulk Export
Export multiple reports at once:
1. Go to **Reports** → **Bulk Export**
2. Select reports to export
3. Choose format and delivery method
4. Reports emailed as ZIP file

#### Custom Date Ranges
Beyond standard ranges:
- Fiscal year vs calendar year
- Custom rolling periods (e.g., "last 45 days")
- Comparison periods (YoY, MoM)

#### Annotations
Add notes to reports:
1. Click **Annotate** on any data point
2. Add context (e.g., "New product launch")
3. Annotations visible to your team

### Director+ Features

#### Multi-Report Dashboards
Create custom dashboards:
1. **Dashboard Builder**: Drag-and-drop interface
2. **Layout**: Choose 2, 3, or 4-column layouts
3. **Widgets**: Add charts, tables, KPIs
4. **Sharing**: Share with team or keep private

#### Alert Configuration
Set up proactive alerts:
- **Threshold Alerts**: "Notify me if SLA drops below 95%"
- **Trend Alerts**: "Alert if calls increase 20% week-over-week"
- **Anomaly Alerts**: AI detects unusual patterns

#### Forecast Scenarios
Run what-if analyses:
- "What if we add 2 sales reps?"
- "Impact of 10% price increase?"
- "Effect of entering new market?"

---

## Frequently Asked Questions

### General Questions

**Q: How often are reports updated?**
A: Most reports refresh every 5-15 minutes. You can see the "Last Updated" timestamp in the top right of each report. Some historical reports update daily.

**Q: Can I share reports with people outside my company?**
A: No. For security and confidentiality, reports can only be shared within your organization. You can export to PDF/Excel and share those files, but use caution with sensitive data.

**Q: What does "permission denied" mean?**
A: You're trying to access a report that requires a higher role level or specific permissions. Contact your administrator if you believe you should have access.

**Q: Can I customize reports?**
A: Managers and above can create custom dashboards. Individual reports are standardized for consistency, but you can apply filters to customize the view.

**Q: How long is historical data retained?**
A: 13 months of data is available in reports. For longer historical analysis, contact your administrator about data warehouse access.

### Troubleshooting

**Q: Report is loading slowly**
A: Large reports may take 10-30 seconds to load. Try:
- Narrowing date range
- Applying filters to reduce data
- Clearing browser cache
- Checking internet connection

**Q: Data looks incorrect**
A: First, check the "Last Updated" timestamp. If recently updated but still looks wrong:
1. Verify filters aren't hiding data
2. Check date range settings
3. Contact support with report code and screenshot

**Q: Can't find a report I used before**
A: Use the search function (🔍) in the Reports menu. If you still can't find it, your role or permissions may have changed.

**Q: Export is failing**
A: Exports have size limits (10,000 rows). Try:
- Narrowing date range
- Applying filters
- Splitting into multiple exports
- Contact support for large data extracts

### Performance & Limits

**Q: How many reports can I run at once?**
A: You can have up to 5 reports open simultaneously. More than that may slow performance.

**Q: Are there limits on scheduled reports?**
A: Yes, maximum 10 scheduled reports per user. Executives can have up to 25.

**Q: Can I download raw data?**
A: Yes, via CSV export. Excel and PDF exports include formatting. Maximum 10,000 rows per export.

---

## Getting Help

### Support Resources

📧 **Email Support**: support@printyx.com
📞 **Phone**: 1-800-PRINTYX (9 AM - 5 PM ET)
💬 **Live Chat**: Available in app (bottom right corner)
📚 **Knowledge Base**: help.printyx.com/reports

### Training Resources

🎓 **Video Tutorials**: learn.printyx.com/reporting
📖 **User Guide PDF**: Download from Help menu
🎯 **Quick Start Guides**: Role-specific 1-pagers
🗓️ **Live Webinars**: Monthly training sessions

### Feedback

We're always improving! Share your feedback:
- **Feature Requests**: Click "Suggest Feature" in Reports menu
- **Bug Reports**: Use "Report Issue" button
- **General Feedback**: feedback@printyx.com

---

**Last Updated**: November 25, 2025
**Version**: 1.0
**Applies To**: Printyx RBAC Reporting System v3.0+
