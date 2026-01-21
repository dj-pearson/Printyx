# Salesforce to Printyx Import Tool

Automatically transforms Salesforce "Businesses & Contacts" exports into Printyx-ready CSV format.

## Features

✅ **Automatic Deduplication** - Keeps one row per business (best contact)  
✅ **Smart Contact Selection** - Prioritizes contacts with emails and important titles (CEO, CFO, etc.)  
✅ **Field Mapping** - Automatically maps Salesforce fields to Printyx fields  
✅ **Data Validation** - Shows summary stats and sample data  
✅ **E-Automate Support** - Preserves EA Customer Numbers

## Installation

1. **Install Python dependencies:**

```bash
cd c:\Users\dpearson\Documents\Printyx\scripts
pip install -r requirements-import.txt
```

2. **Configure the script:**

Open `transform-salesforce-import.py` and update these lines:

```python
TENANT_ID = "your-actual-tenant-id"  # Get from Printyx admin settings
USER_ID = "your-actual-user-id"      # Get from Printyx admin settings
```

## Usage

### Basic Usage:

```bash
python transform-salesforce-import.py path/to/salesforce-export.xls
```

This creates `salesforce-export_printyx_import.csv` in the same folder.

### Specify Output File:

```bash
python transform-salesforce-import.py report1768836481860.xls customers_import.csv
```

### Example:

```bash
# Transform your Salesforce export
python transform-salesforce-import.py C:\Users\dpearson\Downloads\report1768836481860.xls

# Output:
# ✓ Found 150 total rows (including duplicates)
# ✓ Found 45 unique businesses
# ✓ Deduplicated to 45 unique businesses
# ✅ Saved Printyx import file: C:\Users\dpearson\Downloads\report1768836481860_printyx_import.csv
```

## What It Does

### 1. Deduplication Logic

Your Salesforce export has **one row per contact**. The script:

1. Groups rows by Business ID
2. Ranks contacts by priority:
   - ✅ Has email address (highest priority)
   - ✅ Important title (CEO, CFO, COO, President, etc.)
   - ✅ Manager/supervisor titles
3. Keeps the **best contact** for each business

### 2. Field Mapping

| Salesforce Field       | →   | Printyx Field            |
| ---------------------- | --- | ------------------------ |
| Business Name          | →   | company_name             |
| Business ID            | →   | external_salesforce_id   |
| Business Record Type   | →   | record_type (lowercased) |
| First Name + Last Name | →   | primary_contact_name     |
| Email                  | →   | primary_contact_email    |
| Phone                  | →   | primary_contact_phone    |
| Title                  | →   | primary_contact_title    |
| Mailing Street         | →   | address_line1            |
| Mailing City           | →   | city                     |
| Mailing State          | →   | state                    |
| Mailing Zip            | →   | postal_code              |
| EA Customer Number     | →   | customer_number          |
| + more...              |     |                          |

### 3. Adds Required Fields

The script automatically adds:

- `tenant_id` (from config)
- `status` = "active"
- `lead_source` = "salesforce_import"
- `created_by` (from config)
- `external_system_id` = "salesforce"

## Output Format

The script creates a CSV file ready for Printyx import with these columns:

```csv
company_name,external_salesforce_id,record_type,website,industry,notes,
primary_contact_name,primary_contact_email,primary_contact_phone,primary_contact_title,
address_line1,city,state,postal_code,country,phone,fax,
owner_id,created_at,updated_at,customer_number,
tenant_id,status,lead_source,created_by,external_system_id,external_customer_id
```

## Example Output

```
📊 Summary:
   • Total businesses: 45
   • With emails: 38
   • With phone: 45
   • With address: 43

📋 Sample (first 3 companies):
company_name              primary_contact_name    primary_contact_email    city      state
BILD INTERNATIONAL        Josh Sents              josh@bild.org            Ames      IA
ACME CORPORATION          Jane Smith              jane@acme.com            Boston    MA
TECH SOLUTIONS INC        Robert Chen             rchen@techsol.com        Seattle   WA
```

## Troubleshooting

### Missing Dependencies

```bash
pip install pandas openpyxl lxml html5lib
```

### Tenant ID / User ID Not Set

Get these from Printyx:

1. Login to Printyx
2. Go to Settings → Admin → System Settings
3. Copy your Tenant ID and User ID
4. Update the script constants

### File Not Found

Use absolute path:

```bash
python transform-salesforce-import.py "C:\Users\dpearson\Downloads\report1768836481860.xls"
```

## Next Steps

After running the script:

1. **Review the output CSV** in Excel to verify data looks correct
2. **Login to Printyx**
3. **Go to Import/Export** section
4. **Upload the CSV file**
5. **Map any custom fields** if needed
6. **Run import**

---

## Support

For issues or questions, check:

- Printyx documentation
- This README
- The script's inline comments
