# Import Customers from Salesforce to Printyx

Simple 3-step process to import your Salesforce customers into Printyx.

## Quick Start

### Step 1: Export from Salesforce

1. In Salesforce, go to **Reports** → **New Report**
2. Select report type: **"Businesses & Contacts"** (or "Accounts & Contacts")
3. Add these columns:
   - Business Name
   - Business ID
   - Business Record Type
   - Website
   - Industry
   - Business Description
   - Lead Source
   - EA Customer Number (if you use E-Automate)
   - Prospect Status
   - First Name
   - Last Name
   - Title
   - Mailing Street
   - Mailing City
   - Mailing State/Province
   - Mailing Zip/Postal Code
   - Mailing Country
   - Phone
   - Fax
   - Mobile
   - Email
   - Business Owner
   - Business Owner Alias
   - Created Date
   - Last Modified Date
   - Created By

4. **Run Report** and click **Export** → **Excel Format (.xls)**

---

### Step 2: Prepare the CSV

**Option A: Use Excel (Easiest)**

1. Open your Salesforce export in Excel
2. **Download this template**: `SALESFORCE_IMPORT_TEMPLATE.csv`
3. Copy your Salesforce data and paste it below the template headers
4. Delete the old Salesforce header row
5. **Save As** → CSV format

**Option B: Rename Headers Manually**

Open the CSV and change the first row (headers) from Salesforce names to Printyx names:

```
Business Name          → company_name
Business ID            → external_salesforce_id
Business Record Type   → account_type
Website                → website
Industry               → industry
Business Description   → notes
Lead Source            → lead_source
EA Customer Number     → customer_number
Prospect Status        → status
First Name             → contact_first_name
Last Name              → contact_last_name
Title                  → primary_contact_title
Mailing Street         → address_line1
Mailing City           → city
Mailing State/Province → state
Mailing Zip/Postal Code → postal_code
Mailing Country        → country
Phone                  → phone
Fax                    → fax
Mobile                 → mobile_phone
Email                  → primary_contact_email
Business Owner         → account_manager_name
Business Owner Alias   → owner_id
Created Date           → created_at
Last Modified Date     → updated_at
Created By             → created_by_name
```

---

### Step 3: Import to Printyx

1. **Login to Printyx**
2. Go to **Settings** → **Import/Export** → **Import Customers**
3. Click **"Upload CSV"**
4. Select your prepared CSV file
5. The import wizard will automatically:
   - Detect the column mappings
   - Add your tenant ID
   - Handle duplicate detection
   - Set record type to "customer"
6. **Review** the preview
7. Click **"Import"**

Done! Your Salesforce customers are now in Printyx.

---

## Handling Multiple Contacts

If your Salesforce export has multiple rows per company (one per contact), you have 2 options:

### Option 1: Import One Contact Per Company

- Sort by company name
- Use Excel: **Data → Remove Duplicates** → Select "Business ID" column
- This keeps the first contact for each company

### Option 2: Import All Contacts Separately

1. **First import**: Remove duplicates and import companies
2. **Second import**: Go to **Import Contacts** and upload all contacts
   - Map `Business ID` → `company_id`
   - All contacts will link to their companies

---

## Common Issues

### Issue: "tenant_id required"

**Solution**: This is automatically added during import - you don't need to add it to your CSV.

### Issue: "Duplicate companies detected"

**Solution**: The import wizard will show you duplicates and let you choose:

- Skip duplicates
- Update existing
- Create new records

### Issue: "Multiple contacts per company"

**Solution**: See "Handling Multiple Contacts" section above.

---

## Template Download

**CSV Template**: `SALESFORCE_IMPORT_TEMPLATE.csv`

This template has the correct Printyx header names. Just paste your Salesforce data below the headers.

---

## Support

Need help? Contact Printyx support or check the full documentation at:

- Printyx Knowledge Base → Imports → Salesforce

---

## Advanced: Custom Fields

If you have custom Salesforce fields you want to import:

1. Add them to your Salesforce report
2. In Printyx import wizard, click **"Map Custom Fields"**
3. Match your Salesforce column to a Printyx field
4. The mapping will be saved for future imports
