# Document Automation System

## Overview

The Document Automation System provides comprehensive document generation, OCR processing, and AI-powered field extraction capabilities for Printyx. This system enables:

1. **Template-Based Document Generation**: Create reusable templates with dynamic field placeholders
2. **OCR Processing**: Extract text from uploaded images and PDFs
3. **AI Field Extraction**: Use Claude AI to intelligently extract and map document fields
4. **Workflow Integration**: Automatically generate and send documents as part of workflow tasks
5. **Multi-Format Support**: Generate PDFs, DOCX, and HTML documents

## Architecture

### Database Schema

Located in: `shared/document-automation-schema.ts`

#### Core Tables

**`document_templates`**

- Stores reusable document templates
- Supports versioning and field mapping
- Multiple output formats (PDF, DOCX, HTML, Markdown)
- Template types: contract, purchase_order, invoice, quote, proposal, service_agreement, etc.
- Features:
  - Handlebars template syntax with placeholders
  - Custom styling and page settings
  - Field mapping to data sources
  - Usage tracking

**`generated_documents`**

- Stores documents generated from templates
- Links to source template and version
- References related entities (quotes, deals, customers, etc.)
- Tracks email delivery and downloads
- Stores both rendered content and generated files

**`document_uploads`**

- Manages uploaded documents for OCR processing
- Tracks OCR and AI processing status
- Stores extracted text and fields
- Supports review and approval workflow
- Links to target entities for data population

**`document_field_mappings`**

- Defines how document fields map to database entities
- Supports custom transformation and validation rules
- Enables AI-powered field extraction with custom prompts
- Reusable across multiple documents

**`document_workflow_actions`**

- Defines document-related actions in workflows
- Action types: generate, send, upload, extract
- Configures recipients and delivery methods
- Conditional execution based on workflow state

**`document_notifications`**

- Tracks document-related notifications
- Supports email and in-app delivery
- Engagement tracking (viewed, downloaded)
- Links to workflows and tasks

### Services

#### 1. Document Generation Service

**Location**: `server/services/document-generation-service.ts`

**Key Classes**:

- **`TemplateRenderingService`**:
  - Compiles Handlebars templates
  - Renders templates with data context
  - Provides custom helpers for formatting dates, currency, numbers
  - Fetches data from multiple sources (business records, quotes, deals, etc.)

- **`PDFGenerationService`**:
  - Converts HTML to PDF using Puppeteer
  - Supports custom page settings and styling
  - Automatic style wrapping with professional defaults

- **`DOCXGenerationService`**:
  - Generates Word documents
  - Placeholder for full DOCX implementation

- **`DocumentGenerationService`**:
  - Main orchestrator for document generation
  - Batch document generation support
  - Template preview functionality

**Template Syntax**:

Templates use Handlebars with custom helpers:

```handlebars
<h1>Purchase Order #{{quote.quoteNumber}}</h1>

<p>Date: {{formatDate currentDate 'long'}}</p>
<p>Customer: {{customer.name}}</p>
<p>Total: {{formatCurrency quote.total}}</p>

{{#if quote.lineItems}}
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Quantity</th>
        <th>Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each quote.lineItems}}
        <tr>
          <td>{{this.description}}</td>
          <td>{{this.quantity}}</td>
          <td>{{formatCurrency this.unitPrice}}</td>
          <td>{{formatCurrency this.total}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>
{{/if}}
```

**Available Helpers**:

- `{{formatDate date "short|long|iso"}}` - Format dates
- `{{formatCurrency amount}}` - Format as currency
- `{{formatNumber num decimals}}` - Format numbers
- `{{eq a b}}` - Equality comparison
- `{{gt a b}}` - Greater than
- `{{lt a b}}` - Less than
- `{{join array separator}}` - Join arrays
- `{{uppercase str}}` - Convert to uppercase
- `{{lowercase str}}` - Convert to lowercase
- `{{default value defaultValue}}` - Default value

#### 2. OCR and AI Field Extraction Service

**Location**: `server/services/document-ocr-ai-service.ts`

**Key Classes**:

- **`OCRService`**:
  - Extracts text from images using Tesseract.js
  - Extracts text from PDFs using pdf-parse
  - Returns confidence scores for OCR quality

- **`AIFieldExtractionService`**:
  - Uses Claude Sonnet 4.5 for intelligent field extraction
  - Automatic field mapping to target entities
  - Confidence levels for each extracted field
  - Source tracking for audit trails
  - Validation and transformation support

- **`DocumentProcessingService`**:
  - Orchestrates OCR and AI extraction
  - Handles errors and retries
  - Updates document upload records with results

**AI Extraction Process**:

1. OCR extracts text from document
2. Text is sent to Claude AI with:
   - Target entity type (e.g., "purchase_order")
   - Expected fields
   - Validation rules (if configured)
   - Custom prompts (optional)
3. Claude returns:
   - Extracted fields with values
   - Confidence levels (high/medium/low)
   - Source references
   - Suggested field mappings
   - Issues or ambiguities
4. System validates extracted fields
5. Results are stored for review

**Example AI Response**:

```json
{
  "fields": {
    "po_number": {
      "value": "PO-2025-001",
      "confidence": "high",
      "source": "line 3, header section",
      "reasoning": "Explicitly labeled as 'PO Number'"
    },
    "vendor_name": {
      "value": "Acme Corporation",
      "confidence": "high",
      "source": "line 5, vendor section",
      "reasoning": "Listed under 'Vendor Information'"
    },
    "total_amount": {
      "value": 15250.0,
      "confidence": "medium",
      "source": "line 45, totals section",
      "reasoning": "Labeled as 'Total' but formatting unclear"
    }
  },
  "mapping": {
    "po_number": "purchaseOrder.poNumber",
    "vendor_name": "businessRecord.name",
    "total_amount": "purchaseOrder.totalAmount"
  },
  "issues": ["Date format is ambiguous (MM/DD/YYYY vs DD/MM/YYYY)"],
  "requiresReview": true
}
```

### API Routes

**Location**: `server/routes-document-automation.ts`

#### Document Templates

- `GET /api/document-templates` - List all templates
- `GET /api/document-templates/:id` - Get single template
- `POST /api/document-templates` - Create new template
- `PUT /api/document-templates/:id` - Update template
- `DELETE /api/document-templates/:id` - Soft delete template
- `POST /api/document-templates/:id/preview` - Preview template with sample data

#### Document Generation

- `POST /api/documents/generate` - Generate document from template

  ```json
  {
    "templateId": 123,
    "businessRecordId": 456,
    "quoteId": 789,
    "name": "Quote for Acme Corp",
    "format": "pdf",
    "customData": {
      "specialNotes": "Custom field"
    }
  }
  ```

- `POST /api/documents/batch-generate` - Batch generate documents

  ```json
  {
    "templateId": 123,
    "format": "pdf",
    "contextList": [
      { "quoteId": 789, "businessRecordId": 456 },
      { "quoteId": 790, "businessRecordId": 457 }
    ]
  }
  ```

- `GET /api/documents/generated` - List generated documents
  - Query params: `workflowId`, `taskId`, `businessRecordId`, `type`

- `GET /api/documents/generated/:id/download` - Download generated document

#### Document Uploads & OCR

- `POST /api/documents/upload` - Upload document for OCR processing
  - Multipart form data with file
  - Optional: `targetEntityType`, `targetEntityId`, `workflowId`, `taskId`
  - Triggers automatic OCR and AI extraction

- `GET /api/documents/uploads/:id` - Get upload status and results
- `GET /api/documents/uploads` - List all uploads
- `POST /api/documents/uploads/:id/review` - Approve/review extracted data
  ```json
  {
    "approved": true,
    "notes": "Verified all fields"
  }
  ```

#### Field Mappings

- `GET /api/document-field-mappings` - List all field mappings
- `POST /api/document-field-mappings` - Create field mapping
  ```json
  {
    "name": "Purchase Order Mapping",
    "sourceType": "ocr",
    "targetEntityType": "purchase_order",
    "sourceFields": {
      "po_number": { "type": "string", "required": true },
      "total": { "type": "number", "required": true }
    },
    "targetFields": {
      "po_number": "poNumber",
      "total": "totalAmount"
    },
    "transformationRules": {
      "po_number": { "uppercase": true, "trim": true },
      "total": { "numberFormat": true }
    },
    "validationRules": {
      "po_number": {
        "required": true,
        "pattern": "^PO-\\d{4}-\\d{3}$"
      },
      "total": {
        "required": true,
        "type": "number"
      }
    }
  }
  ```

#### AI Field Extraction (Manual)

- `POST /api/documents/ai-extract` - Manually extract fields from text
  ```json
  {
    "text": "Invoice #12345\nDate: 1/15/2025\n...",
    "targetEntityType": "invoice",
    "fieldMappingId": 123,
    "customPrompt": "Extract all invoice fields..."
  }
  ```

## Workflow Integration

### Document Workflow Actions

Document tasks can be added to workflows using the `document_workflow_actions` table:

**Generate Document Action**:

```json
{
  "workflowId": 456,
  "stepId": "contract_signed",
  "actionType": "generate",
  "templateId": 123,
  "generateFormat": "pdf"
}
```

**Send Document Action**:

```json
{
  "workflowId": 456,
  "stepId": "contract_signed",
  "actionType": "send",
  "templateId": 123,
  "sendTo": [
    { "type": "email", "value": "purchasing@company.com" },
    { "type": "role", "value": "purchasing_manager" }
  ],
  "sendMethod": "email",
  "emailSubject": "New Purchase Order - {{quote.quoteNumber}}",
  "emailBody": "Please review the attached purchase order."
}
```

**Upload & Extract Action**:

```json
{
  "workflowId": 456,
  "stepId": "document_received",
  "actionType": "extract",
  "fieldMappingId": 789,
  "requireReview": true
}
```

### Example: Contract Signed → Purchase Order Workflow

1. **Trigger**: Contract status changes to "signed"
2. **Workflow Step 1**: Generate purchase order
   - Template: "Standard Purchase Order"
   - Data source: Quote + Business Record
   - Format: PDF
3. **Workflow Step 2**: Send to purchasing department
   - Recipients: purchasing@company.com + role:purchasing_manager
   - Method: Email + In-app notification
   - Attach: Generated PO document
4. **Workflow Step 3**: Create task for purchasing manager
   - Title: "Process Purchase Order for {{customer.name}}"
   - Attached document: Generated PO
   - Due: 2 business days

## Use Cases

### 1. Automatic Quote to Purchase Order

When a quote is accepted:

1. Generate PO from "Purchase Order" template
2. Populate with quote line items and customer info
3. Email to purchasing department
4. Create approval task for purchasing manager
5. Track document views and downloads

### 2. Contract Document Processing

When a signed contract is uploaded:

1. OCR extracts text from scanned contract
2. AI identifies key terms: start date, end date, value, parties
3. System validates extracted data
4. Purchasing manager reviews and approves
5. Data populates contract record in system
6. Trigger fulfillment workflow

### 3. Invoice Generation and Delivery

At end of billing period:

1. Batch generate invoices for all customers
2. Apply template with company branding
3. Calculate totals from meter readings
4. Generate PDF invoices
5. Email to customer contacts
6. Track delivery and views
7. Send reminders for unpaid invoices

### 4. Service Report Automation

After service call completion:

1. Generate service report from template
2. Include technician notes, photos, parts used
3. Generate PDF with customer signature
4. Email to customer
5. Attach to service call record
6. Trigger billing workflow

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Required for AI field extraction
ANTHROPIC_API_KEY=your_claude_api_key

# Required for PDF generation (if not using system Chromium)
PUPPETEER_SKIP_DOWNLOAD=false
PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
```

### Dependencies

New dependencies added in `package.json`:

- `handlebars` (^4.7.8): Template rendering
- `pdf-parse` (^1.1.1): PDF text extraction
- `tesseract.js` (^5.1.1): OCR processing
- `puppeteer` (^24.16.0): PDF generation (already installed)
- `multer` (^2.0.2): File uploads (already installed)

### File Storage

Generated documents are stored in:

```
attached_assets/generated-documents/
```

Uploaded documents are stored in:

```
attached_assets/document-uploads/
```

Ensure these directories have appropriate permissions.

## Best Practices

### Template Design

1. **Use Semantic HTML**: Structure templates with proper HTML tags
2. **Test with Sample Data**: Always preview templates before production use
3. **Version Control**: Create new versions instead of modifying active templates
4. **Field Validation**: Define clear field mappings and validation rules
5. **Professional Styling**: Include proper CSS for professional-looking PDFs

### AI Field Extraction

1. **Provide Clear Prompts**: Custom prompts improve extraction accuracy
2. **Define Field Mappings**: Create reusable field mappings for common document types
3. **Enable Review**: Always require review for critical documents
4. **Track Confidence**: Pay attention to confidence levels
5. **Validate Results**: Implement validation rules for critical fields

### Workflow Integration

1. **Conditional Actions**: Use workflow conditions to control document generation
2. **Error Handling**: Plan for failed document generation
3. **Notification Strategy**: Balance email and in-app notifications
4. **Audit Trail**: Track all document generation and delivery
5. **Access Control**: Ensure proper RBAC for document operations

## Security Considerations

1. **Tenant Isolation**: All documents are tenant-scoped
2. **File Validation**: Only allow safe file types (PDF, images)
3. **File Size Limits**: 10MB upload limit configured
4. **Path Sanitization**: Uploaded files use secure random names
5. **Access Control**: Document download requires authentication and tenant check
6. **Data Privacy**: OCR text and extracted fields are stored securely
7. **Audit Logging**: All document operations are logged

## Performance Optimization

1. **Async Processing**: OCR and AI extraction run in background
2. **Batch Operations**: Support batch document generation
3. **Caching**: Template compilation is cached
4. **File Cleanup**: Implement periodic cleanup of old documents
5. **Database Indexes**: Index document_uploads and generated_documents tables

## Troubleshooting

### OCR Not Working

- Check Tesseract.js installation
- Verify file format is supported
- Check file quality and resolution
- Review OCR error logs

### PDF Generation Fails

- Verify Puppeteer is properly installed
- Check Chromium/Chrome availability
- Review template HTML for errors
- Check page settings configuration

### AI Extraction Issues

- Verify ANTHROPIC_API_KEY is set
- Check API quota and rate limits
- Review document text quality
- Adjust custom prompts for better results
- Check field mapping configuration

### File Upload Errors

- Verify file size under limit
- Check file type is allowed
- Ensure upload directory has write permissions
- Review multer configuration

## Future Enhancements

1. **E-Signature Integration**: Add DocuSign/Adobe Sign integration
2. **Template Marketplace**: Share templates across tenants
3. **Advanced PDF Features**: Headers, footers, page numbers, watermarks
4. **DOCX Generation**: Full Microsoft Word document support
5. **OCR Languages**: Support for multiple languages
6. **Batch Upload**: Upload multiple documents at once
7. **Template Variables UI**: Visual template editor
8. **Webhook Support**: Trigger external systems on document events
9. **Analytics**: Document generation and delivery metrics
10. **AI Training**: Improve extraction accuracy with feedback loop

## API Examples

### Complete Workflow: Quote to Purchase Order

```javascript
// 1. Create PO template (one-time setup)
const template = await fetch('/api/document-templates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Standard Purchase Order',
    type: 'purchase_order',
    format: 'pdf',
    content: `
      <h1>Purchase Order</h1>
      <p>PO Number: {{quote.quoteNumber}}</p>
      <p>Date: {{formatDate currentDate "long"}}</p>
      <h2>Vendor</h2>
      <p>{{customer.name}}</p>
      <p>{{customer.address}}</p>
      <h2>Items</h2>
      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
        </thead>
        <tbody>
          {{#each quote.lineItems}}
          <tr>
            <td>{{this.description}}</td>
            <td>{{this.quantity}}</td>
            <td>{{formatCurrency this.unitPrice}}</td>
            <td>{{formatCurrency this.total}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
      <p><strong>Total: {{formatCurrency quote.total}}</strong></p>
    `,
    fieldMapping: {
      quote: 'quote',
      customer: 'businessRecord',
    },
  }),
});

// 2. When quote is accepted, generate PO
const document = await fetch('/api/documents/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateId: template.id,
    quoteId: 789,
    businessRecordId: 456,
    format: 'pdf',
    name: `PO for Quote #${quoteNumber}`,
  }),
});

// 3. Download or send the generated PO
const fileUrl = `/api/documents/generated/${document.id}/download`;
```

## Support

For questions or issues:

- Check this documentation first
- Review error logs in console
- Test with sample data
- Contact development team with:
  - Error messages
  - Template content (if applicable)
  - Sample data
  - Expected vs actual results
