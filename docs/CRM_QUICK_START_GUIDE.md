# CRM Quick Start Guide

## 🚀 Getting Started with the New CRM

Welcome to the redesigned Printyx CRM! This guide will get you up and running in 5 minutes.

---

## 📍 Accessing the CRM

Navigate to: **`/enhanced-crm`**

Or click **"CRM"** in the main navigation menu.

---

## 🎯 Understanding the Layout

### Dashboard Overview

When you first open the CRM, you'll see:

1. **KPI Cards** (Top)
   - Total Leads
   - Prospects  
   - Customers
   - Pipeline Value

2. **Search & Filters** (Below KPIs)
   - Search bar: Find by company, contact, or email
   - Pipeline dropdown: Switch between Leads, Prospects, Customers
   - View toggle: Kanban board or List view
   - Import button: Bulk import from CSV
   - Add Lead button: Create new lead

3. **Kanban Board** (Main Area)
   - Columns represent status (New, Contacted, Qualified, etc.)
   - Cards show lead/customer summary
   - Drag cards between columns to change status

---

## 📝 Creating Your First Lead

### Method 1: Quick Add

1. Click **"Add Lead"** button (top right)
2. Fill in required fields:
   - Company Name *
   - Contact Name *
   - Email *
   - Phone
3. Add optional details:
   - Industry
   - Estimated Deal Value
   - Priority (Low, Medium, High, Urgent)
   - Notes
4. Click **"Create Lead"**

### Method 2: Import from CSV

1. Click **"Import"** button
2. Select **"Leads & Customers"**
3. Download template (first time)
4. Fill in your CSV file
5. Upload and follow wizard:
   - Review column mapping
   - Fix validation errors
   - Handle duplicates
   - Execute import

---

## 🔄 Managing Your Pipeline

### Moving Leads Through Stages

**Drag & Drop Method** (Kanban View):
1. Click and hold a lead card
2. Drag to the target status column
3. Release to drop
4. Status updates automatically!

**Status Dropdown Method** (List View):
1. Find the lead in the list
2. Click the status badge
3. Select new status
4. Status updates instantly!

### Understanding Status Flow

```
Lead Stages:
  New → Contacted → Qualified

Prospect Stages:
  Qualified → Proposal Sent → Negotiation

Customer Stages:
  Active → At Risk

Former Customer:
  Churned, Inactive
```

**Pro Tip**: When a lead reaches "Qualified" status, it automatically becomes a Prospect!

---

## 🔍 Finding Records Quickly

### Search Bar
Type any of these:
- Company name: "Acme"
- Contact name: "John Smith"  
- Email: "john@acme.com"

Press Enter or wait - results filter instantly!

### Filters

**Pipeline Filter**:
- Leads: Shows new/contacted/qualified
- Prospects: Shows qualified/proposal/negotiation
- Customers: Shows active/at-risk

**View Toggle**:
- Kanban: Visual board with drag-and-drop
- List: Table view with sortable columns

---

## 📊 Understanding the Cards

Each card shows:
- **Company Name** (top, bold)
- **Contact Name** (below company)
- **Deal Value** (if set, in green with $)
- **Priority Badge** (color-coded: Red=Urgent, Orange=High, Yellow=Medium, Gray=Low)
- **Industry** (bottom left)
- **Location** (City, State - bottom right)

**Click any card** to open the full detail view.

---

## 💡 Best Practices

### For Sales Reps

1. **Update Status Daily**
   - Drag cards to reflect current status
   - Don't let leads sit in "New" too long

2. **Add Notes**
   - Document every interaction
   - Notes are preserved forever

3. **Set Priority**
   - Mark hot leads as Urgent or High
   - Focus on high-priority first

4. **Estimate Deal Value**
   - Add estimated value to track pipeline
   - Update as you learn more

### For Sales Managers

1. **Monitor Pipeline Daily**
   - Check KPI cards for trends
   - Look for bottlenecks (columns with too many cards)

2. **Review At-Risk Customers**
   - Use Customer pipeline view
   - Check "At Risk" status column

3. **Import Regularly**
   - Use CSV import for trade show leads
   - Import daily from other sources

4. **Track Conversion Rates**
   - Monitor Leads → Prospects → Customers
   - Identify where leads drop off

---

## 📥 Importing Leads (Step-by-Step)

### Preparing Your CSV

1. Click **"Import"** → **"Download Template"**
2. Open template in Excel or Google Sheets
3. Fill in your data:
   - **Required**: Company Name, Contact Name, Email
   - **Optional**: Phone, Industry, Address, Deal Value, Priority, Notes

4. Save as CSV file

### Importing Your Data

1. Click **"Import"** → **"Select Data Type"** → **"Leads & Customers"**

2. **Upload CSV**
   - Drag and drop your file
   - Or click to browse

3. **Review Column Mapping**
   - System auto-maps columns (usually 90%+ accurate)
   - Manually adjust any incorrect mappings
   - Required fields shown with *

4. **Validate Data**
   - System checks for errors (invalid emails, missing fields)
   - Review error list
   - Fix errors in CSV and re-upload, OR
   - Continue (invalid rows will be skipped)

5. **Handle Duplicates**
   - System detects matching records
   - For each duplicate, choose:
     - **Skip**: Don't import (keep existing)
     - **Merge**: Update existing with new data
     - **Create New**: Import as new record
   - Or use bulk actions: Skip All, Merge All, Create All New

6. **Execute Import**
   - Click "Start Import"
   - Watch progress bar
   - Review results:
     - Imported: Successfully added
     - Merged: Updated existing records
     - Skipped: Duplicates or errors

7. **Done!**
   - Your leads appear in the Kanban board
   - Check "Total Leads" KPI for updated count

---

## 🎨 Customizing Your View

### Kanban Board

**Pros**:
- Visual pipeline overview
- Drag-and-drop status changes
- See bottlenecks at a glance

**When to Use**:
- Managing active leads
- Daily pipeline review
- Team meetings/standups

### List View

**Pros**:
- More details visible
- Sortable columns
- Better for large datasets

**When to Use**:
- Finding specific records
- Exporting data
- Detailed analysis

### Switching Views
Click the **Grid icon** (Kanban) or **List icon** (List) in the toolbar.

---

## 🚨 Common Mistakes to Avoid

1. ❌ **Forgetting to Update Status**
   - ✅ Update status after every interaction
   - ✅ Use drag-and-drop for speed

2. ❌ **Importing Without Cleaning Data**
   - ✅ Review CSV before importing
   - ✅ Remove duplicates in Excel first

3. ❌ **Not Setting Priority**
   - ✅ Mark hot leads as High/Urgent
   - ✅ Focus on priority leads first

4. ❌ **Letting Leads Get Stale**
   - ✅ Follow up within 24 hours
   - ✅ Move or mark as Closed Lost

5. ❌ **Duplicate Records**
   - ✅ Use search before creating
   - ✅ Review duplicates during import

---

## 💬 Tips & Tricks

### Keyboard Shortcuts
- **Cmd/Ctrl + K**: Quick search (future)
- **Escape**: Close dialogs
- **Tab**: Navigate form fields

### Speed Tips
1. **Bulk Status Update**: Select multiple cards → Change status at once (future)
2. **Quick Search**: Type partial names (e.g., "acm" finds "Acme Corp")
3. **Filter Presets**: Save your favorite filter combinations (future)

### Mobile Tips
1. **Cards are touch-optimized** (48px tap targets)
2. **Swipe to reveal actions** (future)
3. **Pull to refresh** (future)

---

## 📞 Need Help?

### Quick Resources
- **Documentation**: `/docs/CRM_IMPROVEMENTS_README.md`
- **API Reference**: `/docs/OAUTH_INTEGRATION_PLAN.md`
- **Competitive Info**: `/docs/CRM_COMPETITIVE_ADVANTAGES.md`

### Common Questions

**Q: Can I undo a status change?**
A: Yes, just drag the card back or change status again. All changes are logged in the activity history.

**Q: What happens to lead data when converting to customer?**
A: Nothing! All data stays in the same record. We just change the status and record type.

**Q: Can I import from HubSpot or Salesforce?**
A: CSV import works now. OAuth integration coming Q1 2026.

**Q: How do I delete a lead?**
A: Click the card → More actions → Delete. (Note: This is a soft delete, data is preserved.)

**Q: Can I export my leads?**
A: Yes! Use bulk export feature (coming soon) or export via reports.

---

## ✅ Quick Start Checklist

- [ ] Access the CRM at `/enhanced-crm`
- [ ] Explore the Kanban board
- [ ] Create your first test lead
- [ ] Try dragging a card to change status
- [ ] Search for a record
- [ ] Switch between Kanban and List view
- [ ] Download CSV template
- [ ] Import a small test CSV (5-10 records)
- [ ] Review KPI dashboard cards
- [ ] Share feedback with team!

---

## 🎉 You're Ready!

You now know everything to get started with the new CRM. 

**Next Steps**:
1. Import your existing leads
2. Train your team
3. Start managing your pipeline
4. Watch your conversion rates improve!

**Pro Tip**: The more you use it, the easier it gets. Drag-and-drop becomes second nature after a day!

---

**Questions?** Ask your admin or check the full documentation.

**Feedback?** We'd love to hear how we can make it better!
