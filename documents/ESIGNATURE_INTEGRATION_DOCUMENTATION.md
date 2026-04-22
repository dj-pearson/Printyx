# E-Signature Integration System Documentation

**Status:** ✅ Complete - Backend Infrastructure Ready  
**Priority:** #2 in COMPREHENSIVE_RECOMMENDATIONS.md  
**Implementation Date:** November 2025  
**Estimated ROI:** High - Critical for paperless workflows and compliance

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Database Schema](#database-schema)
4. [Storage Layer](#storage-layer)
5. [API Endpoints](#api-endpoints)
6. [Integration Guide](#integration-guide)
7. [Mock Data](#mock-data)
8. [Testing & Validation](#testing--validation)
9. [Security & Compliance](#security--compliance)
10. [Future Enhancements](#future-enhancements)

---

## Overview

The E-Signature Integration System is a provider-agnostic platform integration that enables copier dealers to manage electronic signatures for leases, contracts, service agreements, and other business documents. The system is built to the **API integration point**, allowing dealers to configure their own e-signature service credentials (DocuSign, Adobe Sign, HelloSign) through the platform.

### Key Features

✅ **Multi-Provider Support**

- DocuSign (primary)
- Adobe Sign
- HelloSign (Dropbox Sign)
- Extensible architecture for additional providers

✅ **Complete Document Lifecycle**

- Create and send signature requests
- Track signing progress in real-time
- Manage multiple signers per document
- Sequential or parallel signing workflows
- Automated reminders
- Audit trail and compliance logging

✅ **Dealer Self-Service**

- Configure integration credentials via UI
- Health monitoring for integrations
- Sandbox/production mode support
- OAuth token management

✅ **Comprehensive Data Model**

- 5 database tables with full relationships
- Tenant isolation for multi-tenancy
- Complete audit logging
- Document versioning

---

## System Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                    Printyx Platform                          │
│                                                              │
│  ┌──────────────┐      ┌──────────────┐    ┌─────────────┐ │
│  │  UI Layer    │ ───> │  API Routes  │───>│   Storage   │ │
│  │  (Future)    │      │ (Complete)   │    │  (Complete) │ │
│  └──────────────┘      └──────────────┘    └─────────────┘ │
│                              │                      │        │
│                              │                      │        │
│                              v                      v        │
│                        ┌──────────────────────────────────┐ │
│                        │   PostgreSQL Database (Neon)    │ │
│                        │   - integration_credentials      │ │
│                        │   - signature_requests           │ │
│                        │   - signature_signers            │ │
│                        │   - signature_documents          │ │
│                        │   - signature_audit_logs         │ │
│                        └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ API Calls
                              v
        ┌───────────────────────────────────────────┐
        │    E-Signature Providers (Dealer-Owned)   │
        ├───────────────────────────────────────────┤
        │  • DocuSign       (dealer credentials)    │
        │  • Adobe Sign     (dealer credentials)    │
        │  • HelloSign      (dealer credentials)    │
        └───────────────────────────────────────────┘
```

### Provider Abstraction Layer

The system uses a **provider-agnostic design**:

- Dealers configure their own API credentials
- Platform provides unified interface for all providers
- Provider-specific logic handled in API routes
- Easy to add new providers

### Integration Pattern

**Platform-Level Integration:**

- Printyx provides the infrastructure (database, API, UI)
- Dealers bring their own credentials
- No platform-wide API keys required
- Each tenant manages their own integrations

---

## Database Schema

### 1. Integration Credentials (`integration_credentials`)

Stores dealer-configured e-signature service credentials.

```typescript
{
  id: varchar (UUID, Primary Key)
  tenantId: varchar (Foreign Key → tenants.id)
  provider: varchar ('docusign' | 'adobe_sign' | 'hellosign')
  integrationName: varchar
  status: varchar ('active' | 'inactive' | 'error')

  // API Credentials
  apiKey: varchar (encrypted)
  apiSecret?: varchar (encrypted)
  accessToken?: varchar (encrypted)
  refreshToken?: varchar (encrypted)
  tokenExpiry?: timestamp
  accountId?: varchar

  // Configuration
  sandboxMode: boolean (default: false)
  config?: jsonb (provider-specific settings)

  // Health Monitoring
  healthStatus?: varchar ('healthy' | 'degraded' | 'unhealthy' | 'unknown')
  lastHealthCheck?: timestamp
  healthCheckError?: text

  // Metadata
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Indexes:**

- `idx_integration_credentials_tenant` (tenantId)
- `idx_integration_credentials_provider` (tenantId, provider)
- `idx_integration_credentials_status` (status)

**Constraints:**

- Unique: (tenantId, integrationName)

---

### 2. Signature Requests (`signature_requests`)

Main table for signature requests/envelopes.

```typescript
{
  id: varchar (UUID, Primary Key)
  tenantId: varchar (Foreign Key → tenants.id)
  requestNumber: varchar (unique per tenant, e.g., "SIG-2025-001")

  // Request Details
  title: varchar
  description?: text

  // Related Records
  customerId?: varchar (Foreign Key → business_records.id)
  leaseId?: varchar (Foreign Key → leases.id)
  contractId?: varchar (Foreign Key → contracts.id)
  serviceTicketId?: varchar (Foreign Key → service_tickets.id)

  // Provider Integration
  provider: varchar ('docusign' | 'adobe_sign' | 'hellosign')
  integrationId: varchar (Foreign Key → integration_credentials.id)
  externalId?: varchar (provider's envelope/request ID)

  // Status & Tracking
  status: varchar ('draft' | 'sent' | 'delivered' | 'signed' |
                   'completed' | 'declined' | 'voided' | 'expired')
  sentAt?: timestamp
  completedAt?: timestamp
  declinedAt?: timestamp
  voidedAt?: timestamp
  expiresAt?: timestamp

  // Email Configuration
  emailSubject?: varchar
  emailMessage?: text
  reminderEnabled: boolean (default: true)
  reminderDays?: integer

  // Signing Configuration
  sequentialSigning: boolean (default: false)

  // Progress Tracking
  totalSigners: integer
  signersCompleted: integer
  totalDocuments: integer

  // Metadata
  declinedReason?: text
  voidedReason?: text
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Indexes:**

- `idx_signature_requests_tenant` (tenantId)
- `idx_signature_requests_number` (tenantId, requestNumber) UNIQUE
- `idx_signature_requests_customer` (customerId)
- `idx_signature_requests_status` (status)
- `idx_signature_requests_provider` (provider)
- `idx_signature_requests_external` (externalId)

---

### 3. Signature Signers (`signature_signers`)

Tracks individual signers for each request.

```typescript
{
  id: varchar (UUID, Primary Key)
  tenantId: varchar (Foreign Key → tenants.id)
  requestId: varchar (Foreign Key → signature_requests.id)

  // Signer Information
  signerOrder: integer
  signerType: varchar ('signer' | 'approver' | 'cc' | 'witness')
  name: varchar
  email: varchar

  // Status & Tracking
  status: varchar ('pending' | 'sent' | 'delivered' | 'viewed' |
                   'signed' | 'declined')
  sentAt?: timestamp
  deliveredAt?: timestamp
  viewedAt?: timestamp
  signedAt?: timestamp
  declinedAt?: timestamp

  // Signature Details
  signatureMethod?: varchar ('drawn' | 'typed' | 'uploaded' | 'digital_certificate')
  ipAddress?: varchar
  declineReason?: text

  // Metadata
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Indexes:**

- `idx_signature_signers_tenant` (tenantId)
- `idx_signature_signers_request` (requestId)
- `idx_signature_signers_email` (email)
- `idx_signature_signers_status` (status)

---

### 4. Signature Documents (`signature_documents`)

Individual documents within a signature request.

```typescript
{
  id: varchar (UUID, Primary Key)
  tenantId: varchar (Foreign Key → tenants.id)
  requestId: varchar (Foreign Key → signature_requests.id)

  // Document Information
  documentOrder: integer
  documentName: varchar
  documentType: varchar ('pdf' | 'docx' | 'html')

  // File Storage
  originalFileUrl?: varchar
  signedFileUrl?: varchar (completed document)
  certificateUrl?: varchar (certificate of completion)
  fileSize?: integer (bytes)

  // Status & Tracking
  status: varchar ('pending' | 'processing' | 'completed' | 'error')
  totalFields?: integer (signature/initial fields)
  completedFields?: integer

  // Metadata
  createdAt: timestamp
  updatedAt: timestamp
}
```

**Indexes:**

- `idx_signature_documents_tenant` (tenantId)
- `idx_signature_documents_request` (requestId)
- `idx_signature_documents_status` (status)

---

### 5. Signature Audit Logs (`signature_audit_logs`)

Complete audit trail for compliance and tracking.

```typescript
{
  id: varchar (UUID, Primary Key)
  tenantId: varchar (Foreign Key → tenants.id)
  requestId: varchar (Foreign Key → signature_requests.id)
  signerId?: varchar (Foreign Key → signature_signers.id)
  documentId?: varchar (Foreign Key → signature_documents.id)

  // Event Information
  eventType: varchar ('request_created' | 'sent' | 'delivered' | 'viewed' |
                      'signed' | 'declined' | 'voided' | 'completed' |
                      'reminder_sent' | 'expired' | 'document_uploaded' |
                      'field_updated' | 'webhook_received')
  eventDescription: text

  // Actor Information
  actorType: varchar ('user' | 'signer' | 'system' | 'webhook')
  actorName?: varchar
  actorEmail?: varchar

  // Additional Context
  ipAddress?: varchar
  userAgent?: varchar
  metadata?: jsonb

  // Timestamp
  createdAt: timestamp (indexed)
}
```

**Indexes:**

- `idx_signature_audit_logs_tenant` (tenantId)
- `idx_signature_audit_logs_request` (requestId)
- `idx_signature_audit_logs_signer` (signerId)
- `idx_signature_audit_logs_created` (createdAt DESC)
- `idx_signature_audit_logs_event_type` (eventType)

---

## Storage Layer

The storage layer provides 27 methods for complete CRUD operations:

### Integration Credentials (5 methods)

```typescript
// Retrieve credentials
getIntegrationCredentials(tenantId, provider?): Promise<IntegrationCredential[]>
getIntegrationCredentialById(id, tenantId): Promise<IntegrationCredential | null>

// Manage credentials
createIntegrationCredential(data): Promise<IntegrationCredential>
updateIntegrationCredential(id, tenantId, data): Promise<IntegrationCredential>
deleteIntegrationCredential(id, tenantId): Promise<void>
```

### Signature Requests (9 methods)

```typescript
// Retrieve requests
getSignatureRequests(tenantId, filters): Promise<SignatureRequest[]>
getSignatureRequestById(id, tenantId): Promise<SignatureRequest | null>
getSignatureRequestByNumber(requestNumber, tenantId): Promise<SignatureRequest | null>
getSignatureRequestsByCustomer(customerId, tenantId): Promise<SignatureRequest[]>

// Manage requests
createSignatureRequest(data): Promise<SignatureRequest>
updateSignatureRequest(id, tenantId, data): Promise<SignatureRequest>
deleteSignatureRequest(id, tenantId): Promise<void>
voidSignatureRequest(id, tenantId, reason): Promise<SignatureRequest>
generateRequestNumber(tenantId): Promise<string>
```

### Signature Signers (5 methods)

```typescript
// Retrieve signers
getSignatureSigners(requestId, tenantId): Promise<SignatureSigner[]>
getSignatureSignerById(id, tenantId): Promise<SignatureSigner | null>

// Manage signers
createSignatureSigner(data): Promise<SignatureSigner>
updateSignatureSigner(id, tenantId, data): Promise<SignatureSigner>
deleteSignatureSigner(id, tenantId): Promise<void>
```

### Signature Documents (5 methods)

```typescript
// Retrieve documents
getSignatureDocuments(requestId, tenantId): Promise<SignatureDocument[]>
getSignatureDocumentById(id, tenantId): Promise<SignatureDocument | null>

// Manage documents
createSignatureDocument(data): Promise<SignatureDocument>
updateSignatureDocument(id, tenantId, data): Promise<SignatureDocument>
deleteSignatureDocument(id, tenantId): Promise<void>
```

### Signature Audit Logs (3 methods)

```typescript
// Retrieve audit logs
getSignatureAuditLogs(requestId, tenantId): Promise<SignatureAuditLog[]>

// Create audit logs
createSignatureAuditLog(data): Promise<SignatureAuditLog>
createBatchSignatureAuditLogs(data[]): Promise<SignatureAuditLog[]>
```

**All methods include:**

- Tenant isolation for security
- Type safety with TypeScript
- Error handling
- Transaction support where needed

---

## API Endpoints

Complete REST API with 30+ endpoints organized by resource:

### Integration Credentials Endpoints

```
GET    /api/signatures/integration-credentials
       Query: ?provider=docusign
       Returns: List of integration credentials for tenant

GET    /api/signatures/integration-credentials/:id
       Returns: Single integration credential

POST   /api/signatures/integration-credentials
       Body: { provider, integrationName, apiKey, ... }
       Returns: Created integration credential

PATCH  /api/signatures/integration-credentials/:id
       Body: { status?, apiKey?, config?, ... }
       Returns: Updated integration credential

DELETE /api/signatures/integration-credentials/:id
       Returns: 204 No Content

POST   /api/signatures/integration-credentials/:id/test-connection
       Returns: { success, message, healthStatus }
       Tests the integration connection

POST   /api/signatures/integration-credentials/:id/refresh-token
       Body: { refreshToken }
       Returns: { accessToken, refreshToken, tokenExpiry }
       Refreshes OAuth token (Adobe Sign, etc.)
```

### Signature Requests Endpoints

```
GET    /api/signatures/requests
       Query: ?status=sent&customerId=123
       Returns: List of signature requests

GET    /api/signatures/requests/:id
       Returns: Single signature request with signers and documents

POST   /api/signatures/requests
       Body: { title, customerId, provider, documents, signers, ... }
       Returns: Created signature request

PATCH  /api/signatures/requests/:id
       Body: { status?, title?, expiresAt?, ... }
       Returns: Updated signature request

DELETE /api/signatures/requests/:id
       Returns: 204 No Content

POST   /api/signatures/requests/:id/send
       Sends the signature request to signers
       Returns: { success, externalId, sentAt }

POST   /api/signatures/requests/:id/void
       Body: { reason }
       Voids the signature request
       Returns: Updated request

POST   /api/signatures/requests/:id/download
       Returns: Signed PDF document (when completed)

POST   /api/signatures/requests/:id/reminder
       Body: { signerIds? }
       Sends reminder to specific signers or all pending
       Returns: { success, remindersSent }

POST   /api/signatures/requests/:id/sync
       Syncs status from provider API
       Returns: Updated request with latest status
```

### Signature Signers Endpoints

```
GET    /api/signatures/requests/:requestId/signers
       Returns: List of signers for the request

GET    /api/signatures/signers/:id
       Returns: Single signer

POST   /api/signatures/requests/:requestId/signers
       Body: { name, email, signerType, signerOrder }
       Returns: Created signer

PATCH  /api/signatures/signers/:id
       Body: { status?, signedAt?, signatureMethod?, ... }
       Returns: Updated signer

DELETE /api/signatures/signers/:id
       Returns: 204 No Content
```

### Signature Documents Endpoints

```
GET    /api/signatures/requests/:requestId/documents
       Returns: List of documents for the request

GET    /api/signatures/documents/:id
       Returns: Single document

POST   /api/signatures/requests/:requestId/documents
       Body: FormData with file upload
       Returns: Created document

PATCH  /api/signatures/documents/:id
       Body: { status?, signedFileUrl?, ... }
       Returns: Updated document

DELETE /api/signatures/documents/:id
       Returns: 204 No Content

GET    /api/signatures/documents/:id/download
       Returns: Document file (original or signed)
```

### Signature Audit Logs Endpoints

```
GET    /api/signatures/requests/:requestId/audit-logs
       Returns: Complete audit trail for request

POST   /api/signatures/audit-logs
       Body: { requestId, eventType, eventDescription, ... }
       Returns: Created audit log entry
```

### Webhook Endpoints

```
POST   /api/signatures/webhooks/docusign
       Handles DocuSign Connect webhooks
       Returns: 200 OK

POST   /api/signatures/webhooks/adobe-sign
       Handles Adobe Sign webhooks
       Returns: 200 OK

POST   /api/signatures/webhooks/hellosign
       Handles HelloSign webhooks
       Returns: 200 OK
```

**All endpoints:**

- Require authentication (`req.session.user`)
- Enforce tenant isolation
- Return proper HTTP status codes
- Include error handling
- Support pagination where applicable

---

## Integration Guide

### For Dealers: Setting Up E-Signature Integration

#### Step 1: Choose Your Provider

Select one of the supported e-signature providers:

**DocuSign** (Recommended)

- Industry leader
- Most features
- Best API documentation
- Pricing: ~$25-45/user/month

**Adobe Sign**

- Strong document workflows
- Good Adobe ecosystem integration
- Pricing: ~$20-40/user/month

**HelloSign (Dropbox Sign)**

- Simple, user-friendly
- Good for small teams
- Pricing: ~$15-30/user/month

#### Step 2: Get API Credentials

**DocuSign:**

1. Sign up at https://developers.docusign.com
2. Create an integration key
3. Note your Account ID and API Key
4. Configure OAuth (if using production)

**Adobe Sign:**

1. Log in to Adobe Sign admin
2. Go to Account → Adobe Sign API
3. Create integration key
4. Configure OAuth application

**HelloSign:**

1. Sign up at https://app.hellosign.com/api
2. Navigate to API → Settings
3. Generate API key

#### Step 3: Configure in Printyx

1. Navigate to **Integrations** → **E-Signature**
2. Click **Add Integration**
3. Fill in the form:
   - **Integration Name**: e.g., "DocuSign Production"
   - **Provider**: Select your provider
   - **API Key**: Paste your API key
   - **Account ID**: Your account identifier
   - **Sandbox Mode**: Enable for testing
4. Click **Test Connection** to verify
5. Click **Save**

#### Step 4: Start Using

You can now:

- Send leases for signature
- Send service contracts for signature
- Track signature progress
- Download completed documents
- View audit trails

---

## Mock Data

The system includes comprehensive seed data for testing:

### Integration Credentials (3)

1. **DocuSign Production** - Active, healthy
2. **Adobe Sign Development** - Active, sandbox mode
3. **HelloSign Testing** - Inactive

### Signature Requests (5)

1. **SIG-2025-001** - Lease Agreement (sent, 1/2 signers completed)
2. **SIG-2025-002** - Service Contract (completed)
3. **SIG-2025-003** - Purchase Agreement (draft, not sent)
4. **SIG-2025-004** - Service Level Agreement (sent, expiring soon)
5. **SIG-2025-005** - Equipment Upgrade (declined)

### Signature Signers (9)

- Various states: signed, viewed, pending, sent, declined
- Different signer types: signer, approver
- Realistic timestamps and IP addresses

### Signature Documents (6)

- Multiple documents per request
- Different states: pending, completed
- File URLs and sizes

### Audit Logs (15)

- Complete event history
- request_created, sent, viewed, signed, declined, completed, reminder_sent
- Actor tracking (user, signer, system)
- IP addresses and metadata

### Running the Seed

```bash
npx tsx server/seed-signature-data.ts
```

---

## Testing & Validation

### Database Testing

```sql
-- Check integration credentials
SELECT
  provider,
  integration_name,
  status,
  health_status
FROM integration_credentials;

-- Check signature requests by status
SELECT
  status,
  COUNT(*) as count
FROM signature_requests
GROUP BY status;

-- Check signer completion rate
SELECT
  r.request_number,
  r.total_signers,
  r.signers_completed,
  ROUND(r.signers_completed::decimal / r.total_signers * 100, 2) as completion_pct
FROM signature_requests r
WHERE r.total_signers > 0;

-- Audit trail for a specific request
SELECT
  event_type,
  event_description,
  actor_name,
  created_at
FROM signature_audit_logs
WHERE request_id = 'xxx'
ORDER BY created_at DESC;
```

### API Testing

Test the endpoints using curl or Postman:

```bash
# Get all integration credentials
curl http://localhost:5000/api/signatures/integration-credentials

# Get signature requests
curl http://localhost:5000/api/signatures/requests

# Get request details with signers and documents
curl http://localhost:5000/api/signatures/requests/:id

# Get audit logs
curl http://localhost:5000/api/signatures/requests/:id/audit-logs
```

### Health Checks

The system includes integration health monitoring:

```bash
# Test integration connection
POST /api/signatures/integration-credentials/:id/test-connection

# Sync request status from provider
POST /api/signatures/requests/:id/sync
```

---

## Security & Compliance

### Data Security

✅ **Encryption**

- API keys and secrets encrypted at rest
- All credentials stored securely
- HTTPS required for all API calls

✅ **Tenant Isolation**

- Row-level security on all tables
- Tenant ID required for all queries
- No cross-tenant data access

✅ **Audit Logging**

- Complete event history
- IP address tracking
- Actor identification
- Immutable audit trail

### Compliance

✅ **ESIGN Act Compliance**

- Complete audit trails
- Signer identification
- Document integrity
- Timestamp accuracy

✅ **UETA Compliance**

- Electronic record retention
- Signature authentication
- Non-repudiation

✅ **SOC 2 Ready**

- Audit logging
- Access controls
- Data encryption
- Health monitoring

### Best Practices

1. **Use Production Mode Carefully**
   - Test thoroughly in sandbox first
   - Verify all workflows
   - Check email templates

2. **Monitor Health Status**
   - Check integration health regularly
   - Set up alerts for failures
   - Review audit logs

3. **Manage Credentials Securely**
   - Rotate API keys periodically
   - Use OAuth when available
   - Limit access to credentials

4. **Document Retention**
   - Store signed documents securely
   - Keep completion certificates
   - Maintain audit trails

---

## Future Enhancements

### Phase 1 (Completed ✅)

- ✅ Database schema design
- ✅ Storage layer implementation
- ✅ API routes and endpoints
- ✅ Mock data for testing
- ✅ Multi-provider support
- ✅ Webhook handling

### Phase 2 (Future)

- ⏳ UI for credential management
- ⏳ UI for signature request creation
- ⏳ UI for tracking and monitoring
- ⏳ Email templates
- ⏳ Document preview

### Phase 3 (Future)

- ⏳ Automated workflows (auto-send after lease creation)
- ⏳ Template management
- ⏳ Bulk sending
- ⏳ Advanced reporting
- ⏳ Mobile signing experience

### Phase 4 (Future)

- ⏳ AI-powered field placement
- ⏳ Smart document routing
- ⏳ Predictive completion times
- ⏳ Risk scoring for non-completion

---

## Technical Implementation Notes

### Provider-Specific Features

**DocuSign:**

- Supports sequential signing
- Rich field types (text, checkbox, radio, dropdown)
- Templates and composite templates
- PowerForms for embedded signing

**Adobe Sign:**

- MegaSign for bulk sending
- Widget support for reusable forms
- Library documents
- Adobe PDF integration

**HelloSign:**

- Simple API design
- Good for small teams
- Embedded signing
- Test mode included

### Webhook Security

All webhook endpoints should implement:

- Signature verification (HMAC)
- IP whitelist (optional)
- Idempotency handling
- Error handling and retry logic

### Rate Limiting

Consider implementing rate limits:

- 10 requests/minute per tenant for sending
- 100 requests/minute for status checks
- 1000 requests/minute for webhooks

---

## Support & Resources

### Printyx Documentation

- This document
- API endpoint reference
- Database schema guide

### Provider Documentation

- [DocuSign API Reference](https://developers.docusign.com/docs/esign-rest-api/)
- [Adobe Sign API Guide](https://secure.na1.adobesign.com/public/docs/restapi/v6)
- [HelloSign API Docs](https://developers.hellosign.com/api/reference/)

### Contact

For questions or support with the E-Signature Integration System:

- Review this documentation
- Check provider-specific docs
- Contact Printyx support

---

## Changelog

### November 2025 - Initial Release

- Database schema (5 tables)
- Storage layer (27 methods)
- API routes (30+ endpoints)
- Mock data seeding
- Multi-provider support
- Webhook handlers
- Comprehensive documentation

---

**Document Version:** 1.0  
**Last Updated:** November 2025  
**Status:** Backend Complete ✅
