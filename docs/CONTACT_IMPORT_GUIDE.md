# Contact Import Guide

## Overview

The enhanced import system intelligently handles contact data, including:

- **Automatic placeholder detection and replacement**
- **Multiple contacts per company** support
- **Smart duplicate detection**
- **Automatic mapping** of Salesforce and common CSV formats

## How It Works

### 1. Placeholder Contact Detection

When importing contacts, the system:

1. Checks if a company already has a primary contact
2. Detects if the contact is a **placeholder** (`first_name = "Primary"`, `last_name = "Contact"`)
3. **Automatically updates** the placeholder with real data from your import file

**Example:**

```
Existing Database:
- Company: "Acme Corp"
- Contact: first_name="Primary", last_name="Contact"

Import File:
- Business Name: "Acme Corp"
- Primary Contact First Name: "John"
- Primary Contact Last Name: "Smith"

Result:
✅ Contact updated: first_name="John", last_name="Smith"
```

### 2. CSV Column Mapping

The system automatically recognizes these column headers (case-insensitive):

#### Company Fields
- `Business Name`, `Company Name` → Company
- `Phone` → Company phone
- `Address`, `Mailing Street`, `Billing Street` → Address
- `City`, `Mailing City`, `Billing City` → City
- `State`, `Mailing State/Province` → State
- `Zip Code`, `Postal Code`, `Mailing Zip/Postal Code` → Zip

#### Contact Fields
- `First Name`, `Primary Contact First Name`, `Contact First Name` → Primary contact first name
- `Last Name`, `Primary Contact Last Name`, `Contact Last Name` → Primary contact last name
- `Email`, `Primary Contact Email` → Primary contact email
- `Primary Contact Phone` → Primary contact phone

### 3. Import Process

```
1. Upload CSV file
   ↓
2. System auto-maps columns (95%+ accuracy with Salesforce exports)
   ↓
3. Review and confirm mappings (optional)
   ↓
4. Validate data (email format, phone format, required fields)
   ↓
5. Detect duplicates (by company name + city + state)
   ↓
6. Choose duplicate strategy:
   - Skip duplicates
   - Merge (update existing with new data)
   - Create new (ignore matches)
   ↓
7. Execute import
   ↓
8. Review results (imported, merged, skipped)
```

## CSV Template

Download the template from the import page, or use this structure:

```csv
Business Name,Record Type,Industry,Phone,Email,Address,City,State,Zip Code,Primary Contact First Name,Primary Contact Last Name,Primary Contact Email,Primary Contact Phone,Website,Lead Source,Notes
Acme Corporation,Customer,Technology,555-1234,info@acme.com,123 Main St,New York,NY,10001,John,Smith,john@acme.com,555-5678,https://acme.com,Website,VIP client
```

## Salesforce Export Compatibility

The system is **optimized for Salesforce exports** with automatic recognition of:

- Salesforce Account fields → Company fields
- Salesforce Contact fields → Contact fields
- Salesforce Lead fields → Lead fields

Simply export from Salesforce and import directly!

## Advanced: Multiple Contacts Per Company

For CSV files with multiple contacts per row:

```csv
Business Name,Contact 1 First Name,Contact 1 Last Name,Contact 1 Email,Contact 2 First Name,Contact 2 Last Name,Contact 2 Email
Acme Corp,John,Smith,john@acme.com,Jane,Doe,jane@acme.com
```

The system will:
1. Create/update the primary contact (Contact 1)
2. Create additional contacts (Contact 2, Contact 3, etc.) as secondary contacts

## Troubleshooting

### "Contact shows as ??"

**Cause**: Frontend caching issue.

**Solution**:
1. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Re-import contacts with proper column mapping

### "Import skipped my row"

**Causes**:
- Missing required fields (Company Name)
- Validation error (invalid email, phone)
- Duplicate detected with "Skip" strategy

**Solution**: Check validation errors in import results.

### "Placeholder not updated"

**Cause**: Column mapping incorrect.

**Solution**: Ensure CSV has `Primary Contact First Name` and `Primary Contact Last Name` columns (or `First Name` / `Last Name`).

## API Endpoints

### Upload CSV
```http
POST /api/import/upload
Content-Type: multipart/form-data

file: [CSV file]
entityType: "business_records"
```

### Get Import Status
```http
GET /api/import/jobs/:jobId
```

### Execute Import
```http
POST /api/import/jobs/:jobId/execute
```

## Edge Function (Production)

The same logic is available via Edge Functions:

```http
POST https://functions.printyx.net/import/upload
Authorization: Bearer {JWT}
```

## Best Practices

1. **Always download the template** before importing
2. **Test with 5-10 rows** first before importing thousands
3. **Review column mappings** even if auto-detected (takes 30 seconds)
4. **Choose "Merge" strategy** to update placeholders with real data
5. **Export from Salesforce** with all contact fields for best results

## Data Requirements

### Minimum Required Fields
- Company Name (required)
- Record Type (optional, defaults to "Customer")

### Recommended Fields
- Primary Contact First Name
- Primary Contact Last Name
- Email
- Phone
- Address, City, State, Zip

## Contact Update Logic

```
IF company exists:
  IF primary contact exists:
    IF contact is placeholder (Primary/Contact):
      IF import has real names:
        ✅ UPDATE contact with real data
      ELSE:
        ⏭️  SKIP (no new data)
    ELSE:
      ⏭️  SKIP (real contact already exists)
  ELSE:
    ✅ CREATE new contact
ELSE:
  ✅ CREATE company + contact
```

## Example Import Results

```
Total Rows: 100
✅ Imported: 45 new companies
🔄 Merged: 50 companies (updated fields + contacts)
⏭️  Skipped: 5 companies (exact duplicates, no changes)

Contacts:
✅ Created: 45 new contacts
🔄 Updated: 50 placeholder contacts
```

## Questions?

See the main import UI at `/import` for interactive guides and help.
