# Intelligent CSV Import Mapping System

Automatic detection and mapping of Salesforce (and other) CSV columns to Printyx database fields.

## Features

✅ **Auto-Detection** - Automatically matches CSV columns to Printyx fields  
✅ **Visual Mapping UI** - Drag-free interface with dropdowns for manual mapping  
✅ **Confidence Scoring** - Shows match quality (0-100%)  
✅ **Smart Validation** - Type checking for emails, phones, dates, etc.  
✅ **Required Fields** - Warns if required fields are missing  
✅ **Sample Data Preview** - Shows sample values for each column  
✅ **Reusable** - Works for Salesforce, E-Automate, QuickBooks, etc.

---

## How It Works

### 1. Auto-Detection Algorithm

```typescript
// Automatically matches CSV headers to Printyx fields
const mappings = autoMapSalesforceColumns(['Business Name', 'Email', 'Phone']);
// Returns: Map { 'Business Name' => 'company_name', 'Email' => 'primary_contact_email', ... }
```

The system:

- Normalizes header names (case-insensitive)
- Matches against known Salesforce field names
- Returns confidence score based on required field coverage

### 2. Visual Mapping Interface

```tsx
import { ColumnMappingInterface } from '@/components/import/ColumnMappingInterface';

<ColumnMappingInterface
  csvHeaders={headers}
  csvSampleData={sampleRows}
  onMappingComplete={(mappings) => {
    // mappings is a Map<csvColumn, printyxField>
    console.log('Mapped fields:', mappings);
  }}
/>;
```

### 3. Confidence Score

- **80-100%**: Excellent - All required fields + most optional fields mapped
- **60-79%**: Good - Required fields mapped + some optional
- **0-59%**: Poor - Missing required fields or low match rate

---

## Usage in CSV Import Wizard

### Integration Steps

1. **Parse CSV headers**
2. **Show mapping interface** with auto-detection
3. **Let user review/adjust** mappings
4. **Transform data** using the mappings
5. **Import** to database

### Example Integration

```tsx
// In your CSV Import Wizard
import { ColumnMappingInterface } from '@/components/import/ColumnMappingInterface';
import { autoMapSalesforceColumns } from '@/lib/import-mappings/salesforce-mapping';

function CsvImportWizard() {
  const [step, setStep] = useState<'upload' | 'mapping' | 'validate' | 'import'>('upload');
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] }>({
    headers: [],
    rows: [],
  });
  const [columnMappings, setColumnMappings] = useState<Map<string, string>>(new Map());

  const handleFileUpload = (file: File) => {
    // Parse CSV
    const { headers, rows } = parseCSV(file);
    setCsvData({ headers, rows });
    setStep('mapping');
  };

  const handleMappingComplete = (mappings: Map<string, string>) => {
    setColumnMappings(mappings);
    setStep('validate');
  };

  const transformData = () => {
    return csvData.rows.map((row) => {
      const transformed: Record<string, any> = {};

      // Add system fields
      transformed.tenant_id = currentUser.tenantId;
      transformed.created_by = currentUser.id;
      transformed.external_system_id = 'salesforce';
      transformed.record_type = 'customer';
      transformed.status = 'active';

      // Map CSV columns to Printyx fields
      csvData.headers.forEach((csvColumn, index) => {
        const printyxField = columnMappings.get(csvColumn);
        if (printyxField) {
          transformed[printyxField] = row[index];
        }
      });

      // Combine first + last name if needed
      if (transformed.primary_contact_first_name && transformed.primary_contact_last_name) {
        transformed.primary_contact_name = `${transformed.primary_contact_first_name} ${transformed.primary_contact_last_name}`;
      }

      return transformed;
    });
  };

  return (
    <div>
      {step === 'upload' && <FileUploader onUpload={handleFileUpload} />}
      {step === 'mapping' && (
        <ColumnMappingInterface
          csvHeaders={csvData.headers}
          csvSampleData={csvData.rows.slice(0, 5)} // Show first 5 rows as samples
          onMappingComplete={handleMappingComplete}
        />
      )}
      {step === 'validate' && <ValidationStep data={transformData()} />}
      {step === 'import' && <ImportStep data={transformData()} />}
    </div>
  );
}
```

---

## Adding New Field Mappings

To support new CSV sources (E-Automate, QuickBooks, etc.), add to `salesforce-mapping.ts`:

```typescript
export const EAUTOMATE_MAPPINGS: FieldMapping[] = [
  {
    printyxField: 'company_name',
    salesforceFields: ['CustomerName', 'CompanyName'], // E-Automate field names
    type: 'string',
    required: true,
    description: 'Company or business name',
  },
  // ... more mappings
];

// Create matching function
export function autoMapEAutomateColumns(csvHeaders: string[]): Map<string, string> {
  // Same logic as autoMapSalesforceColumns but with EAUTOMATE_MAPPINGS
}
```

---

## Field Types & Validation

Supported field types:

- `string` - Any text
- `number` - Numeric values
- `date` - Date/datetime values
- `boolean` - true/false, yes/no, 1/0
- `email` - Email address (validated)
- `phone` - Phone number (validated)

Validation happens automatically during import.

---

## API Reference

### `autoMapSalesforceColumns(csvHeaders: string[])`

Returns auto-detected mappings as `Map<csvColumn, printyxField>`

### `calculateMappingConfidence(csvHeaders: string[])`

Returns confidence score 0-100

### `getPrintyxFields()`

Returns all available Printyx fields for manual mapping

### `validateFieldValue(value: any, fieldType: string)`

Validates a value against its field type

---

## Tenant Experience

1. **Upload CSV** - Drag & drop or select file
2. **Auto-Detect** - System automatically maps columns (takes <1 second)
3. **Review** - See confidence score and adjust mappings if needed
4. **Import** - Click "Continue" to proceed with import

**No manual CSV editing required!**

---

## Future Enhancements

- [ ] Save mapping templates for reuse
- [ ] AI-powered suggestions using GPT-4
- [ ] Support for custom field mapping
- [ ] Bulk mapping presets (Salesforce, E-Automate, QuickBooks)
- [ ] Column transformation rules (uppercase, lowercase, date formats)
- [ ] Multi-column merging (combine address fields)

---

## Testing

Test with the sample Salesforce export:

```
c:\Users\dpearson\Downloads\report1768837291734.xls
```

Should auto-detect with 85%+ confidence.
