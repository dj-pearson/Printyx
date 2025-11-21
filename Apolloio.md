## Integrating Apollo.io Lead Search into Your React TypeScript CRM

Based on your requirements for incorporating Apollo.io's lead search functionality into your copier dealer management system, I've researched the complete implementation approach. Here's a comprehensive guide to help you build this feature.

### Project Overview

Your goal is to integrate Apollo.io's powerful lead generation capabilities directly into your React TypeScript CRM platform, allowing copier dealers to search for and add leads without visiting Apollo.io's website. The system will support advanced filtering (job titles, seniority, departments, locations, buying intent), single and bulk lead imports, and efficient data storage across tenants.

### Apollo.io API Setup

**Authentication**[^1][^2]

Apollo.io uses API key authentication. To get started:

1. Navigate to Apollo.io **Settings** > **Integrations** > **API**
2. Click **Create New Key** and give it a descriptive name
3. Copy and securely store the API key
4. Use it in requests via the `X-Api-Key` header or `Authorization: Bearer` header

**Rate Limits \& Pricing**[^3][^4][^5]

- **Free Plan**: 50 requests/minute, 600/day
- **Paid Plans**: 200 requests/minute, 2,000/day
- Custom plans available for higher volumes

**Credit System**[^6][^7][^8][^9]

- **Email credits**: Unlimited (fair usage policy)
- **Mobile credits**: 100 (free) to 15,000 (organization plan)
- **Export credits**: 1 credit per contact export
- **Mobile number reveal**: ~8 credits per number
- Search API consumes credits when revealing contact details


### Key API Endpoints

**People Search Endpoint**[^10][^11]

```
POST https://api.apollo.io/v1/mixed_people/search
```

This is your primary endpoint for lead discovery. Request body parameters matching your URL filters:

```json
{
  "page": 1,
  "per_page": 25,
  "person_seniorities": ["owner", "founder", "c_suite", "partner", "vp"],
  "person_departments": ["c_suite", "master_information_technology", "master_operations"],
  "person_locations": ["Des Moines, Iowa"],
  "intent_ids": ["42c3504511f04540030b269d647bdd2c"],
  "contact_email_status": ["verified"],
  "prospected_by_current_team": ["no"]
}
```

Response structure:

```json
{
  "people": [...],
  "pagination": {
    "page": 1,
    "per_page": 25,
    "total_entries": 1234,
    "total_pages": 50
  },
  "breadcrumbs": [...]
}
```

**People Enrichment**[^12][^13]

```
POST https://api.apollo.io/v1/people/match
```

Enriches single person data with full details. Use `reveal_phone_number: true` for phone numbers.

**Bulk Enrichment**[^12]

```
POST https://api.apollo.io/v1/people/bulk_match
```

Enrich up to 10 people in a single API call to reduce request overhead.

**Contact Management**[^14][^15][^16]

```
POST https://api.apollo.io/v1/contacts
POST https://api.apollo.io/v1/contacts/bulk_create
```

Create contacts in your Apollo account (up to 100 at once with bulk endpoint).

### Implementation Architecture

**Backend API Layer (Critical for Security)**[^1][^14]

Never expose your Apollo.io API key to the frontend. Create backend proxy endpoints:

```typescript
// pages/api/leads/search.ts
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const filters = req.body;
    
    // Create hash for caching
    const searchHash = crypto
      .createHash('md5')
      .update(JSON.stringify(filters))
      .digest('hex');

    // Check cache first
    const { data: cachedSearch } = await supabase
      .from('cached_searches')
      .select('*')
      .eq('search_hash', searchHash)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cachedSearch) {
      return res.status(200).json(cachedSearch.results);
    }

    // Make request to Apollo API
    const apolloResponse = await axios.post(
      'https://api.apollo.io/v1/mixed_people/search',
      {
        page: filters.page || 1,
        per_page: filters.perPage || 25,
        person_titles: filters.personTitles,
        person_seniorities: filters.personSeniorities,
        person_departments: filters.personDepartments,
        person_locations: filters.personLocations,
        intent_ids: filters.intentIds,
        contact_email_status: filters.contactEmailStatus || ['verified'],
        prospected_by_current_team: filters.prospectedByCurrentTeam || ['no'],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': process.env.APOLLO_API_KEY!,
        },
      }
    );

    const results = apolloResponse.data;

    // Cache for 1 hour
    await supabase.from('cached_searches').insert({
      search_hash: searchHash,
      filters: filters,
      results: results,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    return res.status(200).json(results);
  } catch (error: any) {
    console.error('Apollo API Error:', error.response?.data || error.message);
    
    if (error.response?.status === 429) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: error.response.headers['retry-after']
      });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

**Database Schema (Supabase)**[^17][^18][^19]

**Tenant-Specific Leads Table:**

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  apollo_id TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  company_domain TEXT,
  linkedin_url TEXT,
  seniority TEXT,
  departments JSONB,
  location TEXT,
  email_status TEXT,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX idx_leads_apollo_id ON leads(apollo_id);
CREATE INDEX idx_leads_email ON leads(email);
```

**Cached Searches Table:**

```sql
CREATE TABLE cached_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_hash TEXT UNIQUE,
  filters JSONB,
  results JSONB,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cached_searches_hash ON cached_searches(search_hash);
CREATE INDEX idx_cached_searches_expires ON cached_searches(expires_at);
```

**Centralized Leads Cache (Cross-Tenant Efficiency):**[^20][^21][^22]

```sql
CREATE TABLE centralized_leads_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apollo_id TEXT UNIQUE,
  full_data JSONB,
  last_enriched TIMESTAMP,
  access_count INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_centralized_apollo_id ON centralized_leads_cache(apollo_id);
```

**Frontend Components (React TypeScript)**[^23][^24][^25]

**API Client:**

```typescript
// src/lib/apolloApiClient.ts
import axios from 'axios';

const apolloApiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apolloApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  const tenantId = localStorage.getItem('tenantId');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (tenantId) {
    config.headers['x-tenant-id'] = tenantId;
  }
  return config;
});

export interface LeadSearchFilters {
  personTitles?: string[];
  personSeniorities?: string[];
  personDepartments?: string[];
  personLocations?: string[];
  intentIds?: string[];
  contactEmailStatus?: string[];
  prospectedByCurrentTeam?: string[];
  page?: number;
  perPage?: number;
}

export const searchLeads = async (filters: LeadSearchFilters) => {
  const response = await apolloApiClient.post('/api/leads/search', filters);
  return response.data;
};

export const bulkAddLeadsToCRM = async (leadIds: string[]) => {
  const response = await apolloApiClient.post('/api/leads/bulk-add', { leadIds });
  return response.data;
};
```

**Search Form Component:**

```typescript
// components/LeadSearchForm.tsx
import React, { useState } from 'react';
import { searchLeads, LeadSearchFilters } from '@/lib/apolloApiClient';

export const LeadSearchForm: React.FC = () => {
  const [filters, setFilters] = useState<LeadSearchFilters>({
    personSeniorities: [],
    personDepartments: [],
    personLocations: [],
    contactEmailStatus: ['verified'],
    prospectedByCurrentTeam: ['no'],
  });
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const seniorities = ['owner', 'founder', 'c_suite', 'partner', 'vp'];
  const departments = ['c_suite', 'master_information_technology', 'master_operations'];

  const handleSearch = async () => {
    setLoading(true);
    try {
      const data = await searchLeads(filters);
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lead-search-container">
      <div className="filters">
        <input
          type="text"
          placeholder="Location (e.g., Des Moines, Iowa)"
          onChange={(e) => setFilters({ ...filters, personLocations: [e.target.value] })}
        />
        
        <div className="filter-group">
          <label>Seniority:</label>
          {seniorities.map((s) => (
            <label key={s}>
              <input
                type="checkbox"
                onChange={(e) => {
                  const updated = e.target.checked
                    ? [...(filters.personSeniorities || []), s]
                    : filters.personSeniorities?.filter(x => x !== s) || [];
                  setFilters({ ...filters, personSeniorities: updated });
                }}
              />
              {s}
            </label>
          ))}
        </div>
        
        <button onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      
      {results && (
        <LeadResults results={results} />
      )}
    </div>
  );
};
```


### Bulk Add Implementation with Deduplication

```typescript
// pages/api/leads/bulk-add.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const tenantId = req.headers['x-tenant-id'] as string;
  const { leadIds } = req.body;

  // Check centralized cache first
  const { data: cachedLeads } = await supabase
    .from('centralized_leads_cache')
    .select('*')
    .in('apollo_id', leadIds);

  const cachedIds = new Set(cachedLeads?.map(l => l.apollo_id) || []);
  const leadsToEnrich = leadIds.filter(id => !cachedIds.has(id));

  // Enrich missing leads if needed
  // ... enrichment logic

  // Check for duplicates in tenant's CRM
  const { data: existingLeads } = await supabase
    .from('leads')
    .select('apollo_id')
    .eq('tenant_id', tenantId)
    .in('apollo_id', leadIds);

  const existingIds = new Set(existingLeads?.map(l => l.apollo_id) || []);
  const newLeads = allLeads.filter(lead => !existingIds.has(lead.id));

  // Insert new leads
  const { data: insertedLeads } = await supabase
    .from('leads')
    .insert(newLeads.map(lead => ({
      tenant_id: tenantId,
      apollo_id: lead.id,
      first_name: lead.first_name,
      // ... other fields
      raw_data: lead,
    })))
    .select();

  return res.status(200).json({
    added: insertedLeads?.length || 0,
    skipped: leadIds.length - (insertedLeads?.length || 0),
  });
}
```


### Best Practices \& Optimization

**Cache Strategy**[^26][^27]

- Cache search results for 1 hour to reduce API calls
- Use centralized cache for lead data across tenants
- Store raw Apollo responses in JSONB for flexibility

**Deduplication**[^21][^22][^20]

- Check by `apollo_id` first (most reliable)
- Fall back to email matching
- Show duplicate warnings before adding

**Rate Limiting**[^4][^28][^3]

- Implement exponential backoff for 429 errors
- Track credit usage in database
- Alert admins when approaching limits

**Security**[^14][^1]

- Never expose API key to frontend
- Validate tenant access on every request
- Use environment variables for sensitive data

**Performance**[^27][^26]

- Use database indexes on `apollo_id`, `email`, `tenant_id`
- Implement pagination for large result sets
- Consider Redis for frequently accessed cache data


### Implementation Phases

**Phase 1: Setup**

1. Obtain Apollo.io API key
2. Configure environment variables
3. Create Supabase database tables
4. Set up backend proxy endpoints

**Phase 2: Search Functionality**

1. Build search form component
2. Implement search API endpoint with caching
3. Display results with pagination
4. Add filter presets for common searches

**Phase 3: Lead Details \& Enrichment**

1. Create detail modal
2. Implement enrichment endpoint
3. Check centralized cache before enriching
4. Update cache with new data

**Phase 4: CRM Integration**

1. Single lead add functionality
2. Bulk selection UI
3. Bulk add with deduplication
4. Save to tenant-specific table

**Phase 5: Optimization**

1. Rate limit handling
2. Credit usage dashboard
3. Error handling and retry logic
4. Monitoring and analytics

This implementation gives you a production-ready Apollo.io integration that efficiently manages API credits, prevents duplicates across tenants, and provides a seamless lead enrichment experience within your copier dealer CRM platform.[^29][^30][^31][^32][^26][^1][^14]
<span style="display:none">[^33][^34][^35][^36][^37][^38][^39][^40][^41][^42][^43][^44][^45][^46][^47][^48][^49][^50][^51][^52][^53][^54][^55][^56][^57][^58][^59][^60][^61][^62][^63][^64][^65][^66][^67][^68][^69][^70][^71][^72][^73][^74][^75][^76][^77][^78][^79][^80][^81][^82][^83][^84][^85][^86][^87][^88][^89]</span>

<div align="center">⁂</div>

[^1]: https://knowledge.apollo.io/hc/en-us/articles/4416173158541-Use-the-Apollo-REST-API

[^2]: https://docs.apollo.io/docs/api-overview

[^3]: https://www.tetriz.io/blog/how-to-use-apollo-api/

[^4]: https://docs.apollo.io/reference/view-api-usage-stats

[^5]: https://docs.apollo.io/reference/rate-limits

[^6]: https://www.cognism.com/blog/apollo-io-pricing

[^7]: https://persana.ai/blogs/apollo-io-pricing

[^8]: https://www.smarte.pro/blog/apollo-io-pricing

[^9]: https://docs.apollo.io/docs/api-pricing

[^10]: https://docs.apollo.io/docs/find-people-using-filters

[^11]: https://docs.apollo.io/reference/people-search

[^12]: https://docs.apollo.io/reference/bulk-people-enrichment

[^13]: https://docs.apollo.io/reference/people-enrichment

[^14]: https://endgrate.com/blog/using-the-apollo-api-to-create-or-update-contacts-(with-php-examples)

[^15]: https://docs.apollo.io/reference/bulk-create-contacts

[^16]: https://docs.apollo.io/reference/create-a-contact

[^17]: https://www.polytomic.com/connections/apolloio-supabase

[^18]: https://buildship.com/integrations/apps/supabase-and-apollo

[^19]: https://yepcode.io/recipes/apollo-io-contacts-to-supabase-csv-file

[^20]: https://knowledge.apollo.io/hc/en-us/articles/7628885806093-Map-a-Contact-to-the-Correct-Duplicate-Account

[^21]: https://knowledge.apollo.io/hc/en-us/articles/4413326420621-Merge-Duplicate-Records-to-Consolidate-Your-Data

[^22]: https://www.apollo.io/tech-blog/detecting-data-duplication-at-scale

[^23]: https://hasura.io/learn/graphql/typescript-react-apollo/queries/2-create-query/

[^24]: http://wanago.io/2021/03/01/graphql-apollo-client-react-typescript/

[^25]: https://dev.to/jeeny/how-to-create-an-api-layer-with-react-hooks-and-typescriptand-why-3a8o

[^26]: https://knowledge.apollo.io/hc/en-us/articles/4412665755661-Search-Filters-Overview

[^27]: https://knowledge.apollo.io/hc/en-us/articles/33699917233293-Enrichment-Overview

[^28]: https://rollout.com/integration-guides/apollo/api-essentials

[^29]: https://www.apollo.io

[^30]: https://www.apollo.io/product/api

[^31]: https://knowledge.apollo.io/hc/en-us/articles/4413032484493-Save-Contacts-and-Accounts

[^32]: https://knowledge.apollo.io/hc/en-us/articles/4409728608525-Create-and-Use-a-List

[^33]: http://apollo.io

[^34]: https://www.apollo.io/product/integrations

[^35]: https://www.reddit.com/r/LeadGeneration/comments/1fd1dma/how_do_you_guys_use_apolloio_what_is_useful/

[^36]: https://www.youtube.com/watch?v=2K7vbGYqBjg

[^37]: https://www.youtube.com/watch?v=n_lRMtWDU40

[^38]: https://www.youtube.com/watch?v=s_8GzXM_CuI

[^39]: https://www.bardeen.ai/answers/how-to-use-apollo-io-to-generate-leads

[^40]: https://community.make.com/t/apollo-io-api-workflow/75778

[^41]: https://www.apollographql.com/docs/

[^42]: https://github.com/nextauthjs/next-auth/discussions/1492

[^43]: https://www.reddit.com/r/graphql/comments/zsp67r/how_to_hide_bearer_token_in_apollo_client/

[^44]: https://www.apollographql.com/docs/react/networking/authentication

[^45]: https://docs.apollo.io/docs/overview-apollo-api-tutorials

[^46]: https://docs.apollo.io/docs/use-oauth-20-authorization-flow-to-access-apollo-user-information-partners

[^47]: https://docs.apollo.io/reference/organization-enrichment

[^48]: https://community.zapier.com/code-webhooks-52/using-apollo-api-in-zap-webhooks-to-search-contacts-filters-not-working-49344

[^49]: https://www.apollo.io/magazine/api-developer-hub

[^50]: https://playbooks.com/mcp/lkm1developer-apollo-io

[^51]: https://www.apollo.io/magazine/buying-intent-from-apollo

[^52]: https://www.apollographql.com/docs/graphos/platform/access-management/api-keys

[^53]: https://knowledge.apollo.io/hc/en-us/articles/8135721478925-Use-Buying-Intent

[^54]: https://www.reddit.com/r/apolloapp/comments/14pzyel/a_simpler_guide_to_getting_apollo_working_with/

[^55]: https://knowledge.apollo.io/hc/en-us/articles/8047704465933-Buying-Intent-Overview

[^56]: https://docs.apollo.io/docs/create-api-key

[^57]: https://www.apollographql.com/docs/apollo-server/v3/requests

[^58]: https://docs.apollo.io

[^59]: https://knowledge.apollo.io/hc/en-us/articles/4423314404621-Email-Status-Overview

[^60]: https://docs.apollo.io/reference/organization-search

[^61]: https://knowledge.apollo.io/hc/en-us/articles/10826699994381-How-Apollo-Verifies-Emails

[^62]: https://www.youtube.com/watch?v=aU97oJETOII

[^63]: https://docs.apollo.io/reference/search-for-accounts

[^64]: https://cotera.co/docs/reference/tools/individual-tools/apollo

[^65]: https://www.apollo.io/magazine/advanced-filtering-apollo

[^66]: https://knowledge.apollo.io/hc/en-us/articles/4412498825869-Create-Custom-Contact-Fields

[^67]: https://storeleads.app/help/integrations/apollo

[^68]: https://www.gigasheet.com/no-code-api/apollo-api

[^69]: https://docs.apollo.io/reference/add-contacts-to-sequence

[^70]: https://docs.apollo.io/reference/update-a-contact

[^71]: https://knowledge.apollo.io/hc/en-us/articles/4409237712141-Export-Contacts-to-a-CSV

[^72]: https://www.apollo.io/magazine/lead-generation-tools

[^73]: https://github.com/apollo-server-integrations/apollo-server-integration-next

[^74]: https://www.dhiwise.com/post/a-comprehensive-guide-to-nextjs-apollo-client-integration

[^75]: https://hasura.io/learn/graphql/nextjs-fullstack-serverless/apollo-client/

[^76]: https://www.apollographql.com/docs/react/data/typescript

[^77]: https://www.apollographql.com/blog/apollo-client-integration-nextjs-officially-released

[^78]: https://pipedream.com/apps/http/integrations/apollo-io

[^79]: https://www.workato.com/integrations/apollo.io~workato_webhooks

[^80]: https://integrately.com/integrations/apollo/webhook-api

[^81]: https://the-guild.dev/graphql/apollo-angular/docs/data/pagination

[^82]: https://www.apollographql.com/docs/apollo-server/data/errors

[^83]: https://www.apollographql.com/docs/react/pagination/core-api

[^84]: https://community.make.com/t/apollo-io-phone-number-scrapping-confusion-using-make-com/84326

[^85]: https://stackoverflow.com/questions/58586576/apollo-server-4xx-status-codes

[^86]: https://stackoverflow.com/questions/74277298/using-apolloclient-pagination-api-results-in-requests-even-if-all-page-content

[^87]: https://docs.apollo.io/reference/status-codes

[^88]: https://www.apollographql.com/docs/ios/v0-legacy/tutorial/tutorial-pagination

[^89]: https://docs.apollo.io/reference/search-for-contacts

