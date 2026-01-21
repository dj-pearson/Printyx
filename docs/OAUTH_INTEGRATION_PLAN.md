# OAuth Integration Planning for CRM Import

## Overview

This document outlines the OAuth 2.0 integration requirements for importing data from popular CRM platforms into Printyx. OAuth integrations will enable users to connect their existing CRM systems and automatically sync data without manual CSV uploads.

---

## Supported Platforms

### 1. HubSpot

**API Documentation**: https://developers.hubspot.com/docs/api/overview

#### Authentication

- **OAuth 2.0 Flow**: Authorization Code Grant
- **Scopes Required**:
  - `crm.objects.contacts.read` - Read contacts
  - `crm.objects.companies.read` - Read companies
  - `crm.objects.deals.read` - Read deals
  - `crm.schemas.contacts.read` - Read custom properties

#### Key Endpoints

```
Authorization URL: https://app.hubspot.com/oauth/authorize
Token URL: https://api.hubapi.com/oauth/v1/token
Base API URL: https://api.hubapi.com
```

#### Data Mapping

| HubSpot Field                            | Printyx Field         |
| ---------------------------------------- | --------------------- |
| `company.name`                           | `companyName`         |
| `company.domain`                         | `website`             |
| `company.industry`                       | `industry`            |
| `contact.firstname` + `contact.lastname` | `primaryContactName`  |
| `contact.email`                          | `primaryContactEmail` |
| `contact.phone`                          | `primaryContactPhone` |
| `deal.amount`                            | `estimatedAmount`     |
| `deal.pipeline`                          | `salesStage`          |
| `deal.dealstage`                         | `status`              |

#### Implementation Notes

- HubSpot uses portal ID and app ID for authentication
- Rate limit: 100 requests per 10 seconds (standard accounts)
- Webhook support available for real-time sync
- Requires app registration at https://developers.hubspot.com/

#### Example OAuth Flow

```typescript
// 1. Redirect user to HubSpot authorization
const authUrl =
  `https://app.hubspot.com/oauth/authorize?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `scope=crm.objects.contacts.read%20crm.objects.companies.read%20crm.objects.deals.read`;

// 2. Exchange code for access token
const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    code: authCode,
  }),
});

// 3. Use access token to fetch data
const contacts = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
  headers: { Authorization: `Bearer ${accessToken}` },
});
```

---

### 2. Salesforce

**API Documentation**: https://developer.salesforce.com/docs/apis

#### Authentication

- **OAuth 2.0 Flow**: Authorization Code Grant or JWT Bearer
- **Scopes Required**:
  - `api` - Access to REST API
  - `refresh_token` - Refresh access token
  - `offline_access` - Access data while offline

#### Key Endpoints

```
Authorization URL: https://login.salesforce.com/services/oauth2/authorize
Token URL: https://login.salesforce.com/services/oauth2/token
Base API URL: https://{instance}.salesforce.com/services/data/v59.0
```

#### Data Mapping

| Salesforce Field                   | Printyx Field         |
| ---------------------------------- | --------------------- |
| `Account.Name`                     | `companyName`         |
| `Account.Website`                  | `website`             |
| `Account.Industry`                 | `industry`            |
| `Account.AnnualRevenue`            | `annualRevenue`       |
| `Account.NumberOfEmployees`        | `employeeCount`       |
| `Lead.FirstName` + `Lead.LastName` | `primaryContactName`  |
| `Lead.Email`                       | `primaryContactEmail` |
| `Lead.Phone`                       | `primaryContactPhone` |
| `Lead.Status`                      | `status`              |
| `Opportunity.Amount`               | `estimatedAmount`     |
| `Opportunity.Probability`          | `probability`         |
| `Opportunity.StageName`            | `salesStage`          |

#### Implementation Notes

- Requires Connected App configuration in Salesforce
- Supports both sandbox and production environments
- SOQL queries for complex data retrieval
- Bulk API available for large datasets (>2000 records)
- Rate limits vary by org edition (15,000 - 1,000,000 API calls per 24 hours)

#### Example SOQL Query

```sql
SELECT Id, Name, Website, Industry, AnnualRevenue,
       BillingCity, BillingState, BillingPostalCode,
       (SELECT FirstName, LastName, Email, Phone, Title FROM Contacts)
FROM Account
WHERE IsDeleted = false
ORDER BY LastModifiedDate DESC
LIMIT 200
```

---

### 3. Microsoft Dynamics 365

**API Documentation**: https://docs.microsoft.com/en-us/dynamics365/customer-engagement/web-api/

#### Authentication

- **OAuth 2.0 Flow**: Authorization Code Grant
- **Azure AD Required**: Must register app in Azure Portal
- **Scopes Required**:
  - `https://{{org}}.crm.dynamics.com/.default` - Full access to org

#### Key Endpoints

```
Authorization URL: https://login.microsoftonline.com/{{tenant}}/oauth2/v2.0/authorize
Token URL: https://login.microsoftonline.com/{{tenant}}/oauth2/v2.0/token
Base API URL: https://{{org}}.crm.dynamics.com/api/data/v9.2/
```

#### Data Mapping

| Dynamics Field                           | Printyx Field         |
| ---------------------------------------- | --------------------- |
| `account.name`                           | `companyName`         |
| `account.websiteurl`                     | `website`             |
| `account.industrycode`                   | `industry`            |
| `contact.firstname` + `contact.lastname` | `primaryContactName`  |
| `contact.emailaddress1`                  | `primaryContactEmail` |
| `contact.telephone1`                     | `primaryContactPhone` |
| `opportunity.estimatedvalue`             | `estimatedAmount`     |
| `opportunity.stepname`                   | `salesStage`          |

---

### 4. Zoho CRM

**API Documentation**: https://www.zoho.com/crm/developer/docs/api/v5/

#### Authentication

- **OAuth 2.0 Flow**: Authorization Code Grant
- **Data Center Specific**: Different auth domains for US, EU, India, China
- **Scopes Required**:
  - `ZohoCRM.modules.ALL` - Access all modules
  - `ZohoCRM.settings.ALL` - Read org settings

#### Key Endpoints

```
Authorization URL: https://accounts.zoho.com/oauth/v2/auth
Token URL: https://accounts.zoho.com/oauth/v2/token
Base API URL: https://www.zohoapis.com/crm/v5/
```

#### Implementation Notes

- Requires client registration at https://api-console.zoho.com/
- Different API domains for different data centers
- Rate limit: 100 requests per minute (standard)
- Supports real-time webhooks

---

### 5. Pipedrive

**API Documentation**: https://developers.pipedrive.com/docs/api/v1

#### Authentication

- **OAuth 2.0 Flow**: Authorization Code Grant
- **Alternative**: API Token (simpler but less secure)
- **Scopes Required**:
  - `base` - Basic access
  - `deals:read` - Read deals
  - `organizations:read` - Read organizations

#### Key Endpoints

```
Authorization URL: https://oauth.pipedrive.com/oauth/authorize
Token URL: https://oauth.pipedrive.com/oauth/token
Base API URL: https://api.pipedrive.com/v1/
```

#### Data Mapping

| Pipedrive Field        | Printyx Field         |
| ---------------------- | --------------------- |
| `organization.name`    | `companyName`         |
| `organization.address` | `addressLine1`        |
| `person.name`          | `primaryContactName`  |
| `person.email`         | `primaryContactEmail` |
| `person.phone`         | `primaryContactPhone` |
| `deal.value`           | `estimatedAmount`     |
| `deal.stage_id`        | `salesStage`          |
| `deal.status`          | `status`              |

---

## Implementation Architecture

### Database Schema

```sql
CREATE TABLE oauth_connections (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  provider VARCHAR NOT NULL, -- 'hubspot', 'salesforce', etc.
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  provider_account_id VARCHAR,
  provider_account_name VARCHAR,
  scopes TEXT[],
  metadata JSONB, -- Store provider-specific data
  status VARCHAR DEFAULT 'active', -- active, expired, revoked
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, provider, provider_account_id)
);

CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR NOT NULL,
  connection_id UUID REFERENCES oauth_connections(id),
  status VARCHAR, -- pending, running, completed, failed
  sync_type VARCHAR, -- full, incremental, manual
  records_synced INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  metadata JSONB
);
```

### Backend Implementation

#### 1. OAuth Routes

```typescript
// server/routes-oauth.ts
router.get('/api/oauth/:provider/authorize', requireAuth, async (req, res) => {
  const { provider } = req.params;
  const config = oauthConfigs[provider];

  const authUrl =
    `${config.authUrl}?` +
    `client_id=${config.clientId}&` +
    `redirect_uri=${config.redirectUri}&` +
    `scope=${config.scopes.join('%20')}&` +
    `state=${generateState(req.user.id)}`;

  res.redirect(authUrl);
});

router.get('/api/oauth/:provider/callback', requireAuth, async (req, res) => {
  const { provider } = req.params;
  const { code, state } = req.query;

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(provider, code);

  // Store tokens in database
  await db.insert(oauthConnections).values({
    tenantId: req.tenantId,
    userId: req.user.id,
    provider,
    accessToken: encrypt(tokens.access_token),
    refreshToken: encrypt(tokens.refresh_token),
    tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  });

  res.redirect('/settings/integrations?success=true');
});
```

#### 2. Sync Service

```typescript
// server/services/crm-sync-service.ts
export class CRMSyncService {
  async syncFromHubSpot(connectionId: string) {
    const connection = await getConnection(connectionId);
    const accessToken = decrypt(connection.accessToken);

    // Fetch contacts
    const contacts = await fetchHubSpotContacts(accessToken);

    // Transform and import
    for (const contact of contacts) {
      const mapped = mapHubSpotToBusinessRecord(contact);
      await upsertBusinessRecord(mapped, connection.tenantId);
    }
  }

  async syncFromSalesforce(connectionId: string) {
    const connection = await getConnection(connectionId);
    const accessToken = decrypt(connection.accessToken);

    // Fetch accounts and leads
    const accounts = await fetchSalesforceAccounts(accessToken);
    const leads = await fetchSalesforceLeads(accessToken);

    // Transform and import
    // ...
  }
}
```

### Frontend Implementation

#### 1. Integration Settings Page

```typescript
// client/src/pages/settings/integrations.tsx
export default function IntegrationSettings() {
  const { data: connections } = useQuery({
    queryKey: ['/api/oauth/connections'],
  });

  return (
    <div className="space-y-4">
      <h2>Connected CRM Systems</h2>

      {['hubspot', 'salesforce', 'zoho', 'pipedrive'].map(provider => (
        <Card key={provider}>
          <CardHeader>
            <CardTitle>{provider}</CardTitle>
          </CardHeader>
          <CardContent>
            {isConnected(provider) ? (
              <>
                <Badge>Connected</Badge>
                <Button onClick={() => syncNow(provider)}>Sync Now</Button>
                <Button variant="destructive" onClick={() => disconnect(provider)}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Button onClick={() => connect(provider)}>
                Connect {provider}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

## Security Considerations

1. **Token Storage**
   - Encrypt access tokens and refresh tokens in database (AES-256-GCM)
   - Never expose tokens in API responses or logs
   - Store tokens in secure environment variables during development

2. **Token Refresh**
   - Implement automatic token refresh before expiration
   - Handle token revocation gracefully
   - Retry failed requests with fresh tokens

3. **Rate Limiting**
   - Implement exponential backoff for rate-limited requests
   - Cache frequently accessed data
   - Use bulk APIs when available

4. **Webhook Security**
   - Verify webhook signatures from providers
   - Use HTTPS-only webhook URLs
   - Validate payload structure before processing

5. **User Permissions**
   - Only allow tenant admins to connect OAuth integrations
   - Audit all sync operations
   - Allow users to view sync history and errors

---

## Environment Variables Required

```env
# HubSpot
HUBSPOT_CLIENT_ID=your_client_id
HUBSPOT_CLIENT_SECRET=your_client_secret
HUBSPOT_REDIRECT_URI=https://yourdomain.com/api/oauth/hubspot/callback

# Salesforce
SALESFORCE_CLIENT_ID=your_client_id
SALESFORCE_CLIENT_SECRET=your_client_secret
SALESFORCE_REDIRECT_URI=https://yourdomain.com/api/oauth/salesforce/callback
SALESFORCE_ENVIRONMENT=production # or sandbox

# Microsoft Dynamics
DYNAMICS_CLIENT_ID=your_azure_app_id
DYNAMICS_CLIENT_SECRET=your_azure_app_secret
DYNAMICS_TENANT_ID=your_azure_tenant_id
DYNAMICS_REDIRECT_URI=https://yourdomain.com/api/oauth/dynamics/callback

# Zoho CRM
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_REDIRECT_URI=https://yourdomain.com/api/oauth/zoho/callback
ZOHO_DATA_CENTER=us # us, eu, in, cn

# Pipedrive
PIPEDRIVE_CLIENT_ID=your_client_id
PIPEDRIVE_CLIENT_SECRET=your_client_secret
PIPEDRIVE_REDIRECT_URI=https://yourdomain.com/api/oauth/pipedrive/callback

# Encryption
OAUTH_ENCRYPTION_KEY=your_32_byte_encryption_key
```

---

## Testing Strategy

1. **Sandbox Testing**
   - Use provider sandbox/developer accounts
   - Test full OAuth flow in staging environment
   - Verify data mapping with sample records

2. **Error Handling**
   - Test token expiration scenarios
   - Test rate limit handling
   - Test network failures and retries

3. **Data Integrity**
   - Verify no data loss during sync
   - Test duplicate detection
   - Validate field mapping accuracy

4. **Performance**
   - Test with large datasets (10,000+ records)
   - Monitor sync job duration
   - Optimize bulk operations

---

## Rollout Plan

### Phase 1: CSV Import Only (Current)

- Manual CSV import with wizard
- Column mapping and validation
- Duplicate detection

### Phase 2: HubSpot OAuth (Q1 2026)

- Basic OAuth connection
- One-time import from HubSpot
- Manual sync trigger

### Phase 3: Salesforce OAuth (Q2 2026)

- Salesforce OAuth connection
- Support for both sandbox and production
- Scheduled sync (daily/weekly)

### Phase 4: Additional Providers (Q3 2026)

- Zoho CRM
- Pipedrive
- Microsoft Dynamics 365

### Phase 5: Real-time Sync (Q4 2026)

- Webhook support for all providers
- Bi-directional sync
- Conflict resolution

---

## Support Resources

- [HubSpot Developer Portal](https://developers.hubspot.com/)
- [Salesforce Developer Center](https://developer.salesforce.com/)
- [Microsoft Dynamics 365 Docs](https://docs.microsoft.com/en-us/dynamics365/)
- [Zoho CRM API Console](https://api-console.zoho.com/)
- [Pipedrive Developer Hub](https://developers.pipedrive.com/)
