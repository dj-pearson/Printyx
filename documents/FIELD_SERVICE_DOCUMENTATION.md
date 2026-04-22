# Field Service Photo & Signature Capture System

## Overview

The Field Service Photo & Signature Capture System is a comprehensive mobile-first solution that enables field technicians to document their work through photos and collect customer signatures during installations and service calls. The system provides GPS-tagged photo capture, digital signature collection, and installation checklist management to ensure quality service delivery and maintain comprehensive service records.

## System Purpose

- **Photo Documentation**: Enable technicians to capture and GPS-tag photos during service calls for complete work documentation
- **Digital Signatures**: Collect legally binding customer signatures for work completion, authorizations, and agreements
- **Installation Tracking**: Manage equipment installations from scheduling through completion with detailed checklists
- **Quality Assurance**: Ensure service quality through structured checklists and photo requirements
- **Audit Trail**: Maintain comprehensive records of all field service activities with timestamps, GPS coordinates, and signatures

## Core Features

### 1. Installation Management

- Schedule and track equipment installations
- Assign technicians to installations
- Monitor installation progress and status
- Track equipment details (serial numbers, models)
- Manage installation addresses with GPS coordinates
- Record completion times and notes

### 2. Service Photo Capture

- Capture photos with automatic GPS tagging
- Categorize photos (before, during, after, completed, damage, parts)
- Store photos in cloud object storage
- Associate photos with service tickets and installations
- Track file metadata (size, type, timestamps)
- Record photo capture location and address

### 3. Digital Signature Collection

- Capture customer signatures on mobile devices
- Support multiple signature methods (touchscreen, stylus, finger)
- Collect signer information (name, title, email, phone)
- Record GPS location and timestamp for signatures
- Track device and IP information for audit purposes
- Store signature images as base64 data URLs
- Verification workflow for signature validation

### 4. Installation Checklists

- Create structured checklists for installations
- Organize items by category (pre-installation, installation, testing, training, completion)
- Mark items as required or optional
- Track completion status with timestamps
- Require photos or signatures for specific items
- Record test results with expected vs. actual values
- Add notes to individual checklist items

## Technical Architecture

### Database Schema

#### 1. Installations Table

Tracks equipment installation jobs from scheduling through completion.

**Key Fields:**

- `id`: Unique installation identifier
- `tenantId`: Tenant isolation
- `installationNumber`: Human-readable installation number (e.g., INST-2024-001)
- `installationType`: Type of installation (new_equipment, replacement, upgrade, relocation)
- `customerId`: Reference to business record/customer
- `equipmentId`: Reference to equipment being installed
- `serviceTicketId`: Associated service ticket (optional)
- `scheduledDate`: Planned installation date/time
- `completedDate`: Actual completion date/time
- `assignedTechnicianId`: Primary technician
- `assistingTechnicianIds`: Array of assisting technician IDs
- `installationAddress`: Full installation address
- `gpsLatitude/gpsLongitude`: GPS coordinates
- `status`: Installation status (scheduled, in_progress, completed, cancelled)
- `serialNumber`: Equipment serial number
- `modelNumber`: Equipment model
- `networkConfigured`: Boolean flag
- `driversInstalled`: Boolean flag
- `userTrainingCompleted`: Boolean flag

**Indexes:**

- tenant_id
- installation_number (unique per tenant)
- customer_id
- status
- scheduled_date

#### 2. Service Signatures Table

Stores digital customer signatures with full audit trail.

**Key Fields:**

- `id`: Unique signature identifier
- `tenantId`: Tenant isolation
- `serviceTicketId`: Associated service ticket (optional)
- `installationId`: Associated installation (optional)
- `signatureType`: Type (completion, service_agreement, work_authorization, work_order_approval, safety_acknowledgment)
- `signerName`: Full name of person signing
- `signerTitle`: Job title/role
- `signerEmail`: Email address
- `signerPhone`: Phone number
- `signatureDataUrl`: Base64-encoded signature image
- `signatureMethod`: Capture method (touchscreen, stylus, finger, mouse)
- `gpsLatitude/gpsLongitude`: GPS coordinates
- `locationAddress`: Human-readable address
- `ipAddress`: IP address of device
- `userAgent`: Browser/device user agent
- `deviceInfo`: JSON object with device details
- `signedAt`: Timestamp of signature
- `capturedBy`: Technician who captured signature
- `agreementText`: Text of agreement signed
- `consentGiven`: Boolean consent flag
- `verified`: Verification status
- `verifiedBy`: User who verified signature
- `verifiedAt`: Verification timestamp

**Indexes:**

- tenant_id
- service_ticket_id
- installation_id
- signature_type
- signed_at

#### 3. Installation Checklists Table

Manages structured checklists for installation quality assurance.

**Key Fields:**

- `id`: Unique checklist item identifier
- `tenantId`: Tenant isolation
- `installationId`: Associated installation
- `itemOrder`: Sort order
- `category`: Category (pre_installation, installation, testing, training, completion)
- `itemName`: Name of checklist item
- `itemDescription`: Detailed description
- `isCompleted`: Completion status
- `isRequired`: Whether item is mandatory
- `completedAt`: Completion timestamp
- `completedBy`: User who completed item
- `notes`: Additional notes
- `photoIds`: Array of associated photo IDs
- `requiresPhoto`: Photo requirement flag
- `requiresSignature`: Signature requirement flag
- `expectedValue`: Expected test result
- `actualValue`: Actual test result
- `passed`: Pass/fail status

**Indexes:**

- tenant_id
- installation_id
- item_order (for sorting)
- category

#### 4. Service Photos Table

Stores GPS-tagged photos from field service work.

**Key Fields:**

- `id`: Unique photo identifier
- `tenantId`: Tenant isolation
- `serviceTicketId`: Associated service ticket
- `sessionId`: Mobile service session (optional)
- `fileName`: Storage file name
- `originalName`: Original uploaded file name
- `mimeType`: File MIME type
- `fileSize`: File size in bytes
- `objectPath`: Path in cloud object storage
- `latitude/longitude`: GPS coordinates
- `address`: Human-readable location
- `category`: Photo category (before, during, after, completed, damage, parts)
- `description`: Photo description

**Indexes:**

- tenant_id
- service_ticket_id
- category

### Storage Layer

The system provides 18 storage methods organized into three groups:

#### Installation Storage Methods (7 methods)

```typescript
getInstallations(tenantId, filters?)
getInstallationById(id, tenantId)
getInstallationByNumber(installationNumber, tenantId)
createInstallation(installation)
updateInstallation(id, tenantId, data)
deleteInstallation(id, tenantId)
generateInstallationNumber(tenantId)
```

#### Service Signature Storage Methods (5 methods)

```typescript
getServiceSignatures(tenantId, filters?)
getServiceSignatureById(id, tenantId)
createServiceSignature(signature)
updateServiceSignature(id, tenantId, data)
deleteServiceSignature(id, tenantId)
```

#### Installation Checklist Storage Methods (6 methods)

```typescript
getInstallationChecklists(installationId, tenantId);
getInstallationChecklistById(id, tenantId);
createInstallationChecklist(checklist);
updateInstallationChecklist(id, tenantId, data);
deleteInstallationChecklist(id, tenantId);
bulkCreateInstallationChecklists(checklists);
```

**Note:** Service photos use existing storage methods from the mobile service system.

### API Endpoints

All endpoints require authentication and use tenant isolation.

#### Installation Endpoints

```
GET    /api/installations
       Query params: status, customerId, technicianId
       Returns: Array of installations

GET    /api/installations/:id
       Returns: Single installation

POST   /api/installations
       Body: Installation data (validated with insertInstallationSchema)
       Returns: Created installation

PATCH  /api/installations/:id
       Body: Partial installation data
       Returns: Updated installation

DELETE /api/installations/:id
       Returns: 204 No Content
```

#### Service Signature Endpoints

```
GET    /api/service-signatures
       Query params: serviceTicketId, installationId
       Returns: Array of signatures

GET    /api/service-signatures/:id
       Returns: Single signature

POST   /api/service-signatures
       Body: Signature data (validated with insertServiceSignatureSchema)
       Returns: Created signature

PATCH  /api/service-signatures/:id
       Body: Partial signature data
       Returns: Updated signature

DELETE /api/service-signatures/:id
       Returns: 204 No Content
```

#### Installation Checklist Endpoints

```
GET    /api/installations/:installationId/checklists
       Returns: Array of checklist items for installation

GET    /api/installation-checklists/:id
       Returns: Single checklist item

POST   /api/installation-checklists
       Body: Checklist item data (validated with insertInstallationChecklistSchema)
       Returns: Created checklist item

POST   /api/installation-checklists/bulk
       Body: Array of checklist items
       Returns: Array of created checklist items

PATCH  /api/installation-checklists/:id
       Body: Partial checklist item data
       Returns: Updated checklist item

DELETE /api/installation-checklists/:id
       Returns: 204 No Content
```

## Integration with Object Storage

The system is integrated with Replit's object storage for photo and signature storage:

### Configuration

- **Public Directory**: `public/` - For photos that may be shared in reports
- **Private Directory**: `.private/` - For sensitive signature images
- **Environment Variables**:
  - `PUBLIC_OBJECT_SEARCH_PATHS`: Search paths for public assets
  - `PRIVATE_OBJECT_DIR`: Directory for private objects

### Storage Patterns

```javascript
// Photo storage path pattern
const photoPath = `public/service-photos/${fileName}`;

// Signature storage path pattern
const signaturePath = `.private/signatures/${signatureId}.png`;
```

## Usage Examples

### Creating an Installation

```typescript
// 1. Create installation record
const installation = await storage.createInstallation({
  tenantId: userTenantId,
  installationNumber: 'INST-2024-001', // Or auto-generate
  installationType: 'new_equipment',
  customerId: customerId,
  equipmentId: equipmentId,
  scheduledDate: new Date('2024-02-15T09:00:00'),
  estimatedDuration: 120, // minutes
  assignedTechnicianId: technicianId,
  installationAddress: '123 Main St, New York, NY 10001',
  gpsLatitude: 40.7128,
  gpsLongitude: -74.006,
  status: 'scheduled',
  modelNumber: 'MX-B455W',
  networkConfigured: false,
  driversInstalled: false,
  userTrainingCompleted: false,
  createdBy: userId,
});

// 2. Create installation checklist
const checklistItems = [
  {
    tenantId: userTenantId,
    installationId: installation.id,
    itemOrder: 1,
    category: 'pre_installation',
    itemName: 'Verify equipment model',
    isRequired: true,
    requiresPhoto: true,
  },
  {
    tenantId: userTenantId,
    installationId: installation.id,
    itemOrder: 2,
    category: 'installation',
    itemName: 'Network configuration',
    isRequired: true,
  },
  // ... more items
];

await storage.bulkCreateInstallationChecklists(checklistItems);
```

### Capturing a Service Photo

```typescript
// Upload photo to object storage first
const photoPath = await uploadToObjectStorage(photoFile);

// Create photo record
const photo = await db.insert(servicePhotos).values({
  tenantId: userTenantId,
  serviceTicketId: ticketId,
  fileName: 'photo-12345.jpg',
  originalName: photoFile.name,
  mimeType: 'image/jpeg',
  fileSize: photoFile.size,
  objectPath: photoPath,
  latitude: gpsCoordinates.latitude,
  longitude: gpsCoordinates.longitude,
  address: await reverseGeocode(gpsCoordinates),
  category: 'completed',
  description: 'Installation completed - equipment positioned',
});
```

### Collecting a Customer Signature

```typescript
// Capture signature on canvas and convert to data URL
const signatureDataUrl = canvas.toDataURL('image/png');

const signature = await storage.createServiceSignature({
  tenantId: userTenantId,
  installationId: installationId,
  signatureType: 'completion',
  signerName: 'John Smith',
  signerTitle: 'Office Manager',
  signerEmail: 'john.smith@example.com',
  signatureDataUrl: signatureDataUrl,
  signatureMethod: 'touchscreen',
  gpsLatitude: currentLocation.latitude,
  gpsLongitude: currentLocation.longitude,
  locationAddress: currentAddress,
  ipAddress: deviceIp,
  userAgent: navigator.userAgent,
  deviceInfo: {
    platform: navigator.platform,
    deviceType: 'tablet',
    screenSize: `${screen.width}x${screen.height}`,
  },
  signedAt: new Date(),
  capturedBy: technicianId,
  agreementText: 'I confirm that the installation has been completed satisfactorily.',
  consentGiven: true,
});
```

### Completing an Installation Checklist Item

```typescript
// Mark checklist item as complete
await storage.updateInstallationChecklist(checklistItemId, userTenantId, {
  isCompleted: true,
  completedAt: new Date(),
  completedBy: userId,
  notes: 'Network test successful, print quality excellent',
  expectedValue: 'Print quality: Good',
  actualValue: 'Print quality: Excellent',
  passed: true,
});

// Update installation status when all required items complete
const allItems = await storage.getInstallationChecklists(installationId, userTenantId);
const allRequiredComplete = allItems
  .filter((item) => item.isRequired)
  .every((item) => item.isCompleted);

if (allRequiredComplete) {
  await storage.updateInstallation(installationId, userTenantId, {
    status: 'completed',
    completedDate: new Date(),
  });
}
```

## Data Flow

### Typical Installation Workflow

1. **Scheduling**
   - Create installation record with status "scheduled"
   - Assign technician(s)
   - Set scheduled date and address
   - Generate installation checklist from template

2. **Pre-Installation**
   - Technician views installation details and checklist
   - Capture photos of site (optional)
   - Mark pre-installation checklist items complete

3. **Installation**
   - Update status to "in_progress"
   - Capture "before" photos
   - Perform installation work
   - Capture "during" photos showing progress
   - Complete installation checklist items
   - Record test results

4. **Completion**
   - Capture "completed" photos showing finished work
   - Collect customer signature for completion
   - Mark all required checklist items complete
   - Update installation status to "completed"
   - Set completedDate timestamp

## Security & Compliance

### Data Protection

- All endpoints require authentication
- Tenant isolation enforced at database and API levels
- Signature images contain base64 data (not executable code)
- GPS coordinates stored with precision limits

### Audit Trail

- All signatures include:
  - Timestamp of signing
  - GPS location
  - IP address
  - Device information
  - User agent
  - Capturing technician ID

### Signature Verification

- Optional verification workflow
- Verification by supervisor or manager
- Timestamp and user tracking for verification
- Verification status flag

## Mock Data

The system includes comprehensive mock data for testing:

- **3 Installations**: Covering scheduled, in_progress, and completed states
- **4 Service Signatures**: Various signature types with complete audit trail
- **15 Installation Checklist Items**: Across all categories with varied completion states
- **5 Service Photos**: GPS-tagged photos with metadata

### Seeding Mock Data

```bash
npx tsx server/seed-field-service-data.ts
```

The seed script automatically:

- Cleans up existing field service data
- Creates realistic installation scenarios
- Generates signatures with proper timestamps
- Creates structured checklists
- Associates photos with service tickets

## Future Enhancements

### Potential Features

- Signature template management
- Custom checklist templates
- Photo annotation and markup
- OCR for equipment serial numbers
- Offline photo capture with sync
- Signature reminder workflows
- Installation analytics dashboard
- Photo comparison (before/after)
- Equipment QR code scanning
- Time tracking integration

### Integration Opportunities

- Service dispatch optimization
- Inventory management (parts used)
- Customer communication (email photos)
- Billing integration (proof of work)
- Warranty tracking
- Maintenance scheduling

## Related Systems

- **Mobile Service App**: Provides mobile interface for photo capture
- **Service Dispatch**: Coordinates technician assignments
- **Equipment Management**: Tracks installed equipment
- **Customer Management**: Links to business records
- **Object Storage**: Stores photos and signature images
- **E-Signature Integration**: Complementary system for document signing

## API Error Responses

```json
// 400 Bad Request - Validation Error
{
  "message": "Validation failed",
  "errors": [
    {
      "path": ["installationType"],
      "message": "Invalid installation type"
    }
  ]
}

// 401 Unauthorized
{
  "message": "Unauthorized"
}

// 404 Not Found
{
  "message": "Installation not found"
}
```

## Performance Considerations

- Indexes on frequently queried fields (status, dates, tenant_id)
- Photo storage in cloud object storage (not database)
- Signature data URLs stored inline (typically <50KB)
- Bulk checklist creation for efficiency
- GPS coordinates stored as decimals for query optimization

## Best Practices

### Photo Capture

- Capture photos at key stages (before, during, after)
- Include close-ups of serial numbers
- Document any damage or pre-existing conditions
- Capture test results (print samples, network configs)
- Store originals in cloud storage with metadata

### Signature Collection

- Collect signatures at completion
- Include clear agreement text
- Capture GPS location for audit trail
- Verify signer identity and authority
- Store device and IP information

### Checklist Management

- Create from templates for consistency
- Mark required vs. optional items
- Require photos for critical items
- Record test results with pass/fail
- Add detailed notes for failures

## Conclusion

The Field Service Photo & Signature Capture System provides a comprehensive, mobile-first solution for documenting field service work. With GPS-tagged photos, digital signatures, and structured checklists, the system ensures quality service delivery while maintaining complete audit trails for compliance and customer satisfaction.
