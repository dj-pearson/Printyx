# N8N SEO Blog Writer - Coolify/Supabase Setup Guide

This guide covers deploying the SEO Blog Writer Agent workflow in a Coolify-hosted N8N instance with self-hosted Supabase.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Coolify Platform                         │
├─────────────────┬─────────────────┬─────────────────────────────┤
│    N8N Service  │  Supabase Stack │      Printyx App            │
│    (Workflow)   │  (PostgreSQL +  │      (Express +             │
│                 │   Storage)      │       React)                │
└────────┬────────┴────────┬────────┴────────────┬────────────────┘
         │                 │                      │
         │  REST API       │  Direct DB Access    │
         └────────────────►├◄─────────────────────┘
                          │
              ┌───────────┴───────────┐
              │   blog_content_queue  │
              │   blog_posts          │
              │   blog-images bucket  │
              └───────────────────────┘
```

## Prerequisites

1. **Coolify Instance** with N8N deployed
2. **Self-Hosted Supabase** (PostgreSQL + Storage)
3. **API Keys**:
   - OpenRouter API key
   - Perplexity API key

## Step 1: Database Setup

### 1.1 Push Schema Changes

Run the following to create the `blog_content_queue` table:

```bash
npm run db:push
```

This will create:
- `blog_content_queue` table (for pending content requests)
- Required indexes for efficient querying

### 1.2 Create Storage Bucket

In your Supabase dashboard or via SQL:

```sql
-- Create the blog-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true);

-- Allow public read access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-images');

-- Allow authenticated uploads via service role
CREATE POLICY "Service Role Upload"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'blog-images');
```

### 1.3 Verify Tables Exist

```sql
-- Check blog_posts table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'blog_posts';

-- Check blog_content_queue table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'blog_content_queue';
```

## Step 2: N8N Configuration in Coolify

### 2.1 Environment Variables

Add these environment variables to your N8N service in Coolify:

```env
# Supabase Connection
SUPABASE_URL=https://api.printyx.net
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter (for AI models)
OPENROUTER_API_KEY=your-openrouter-key

# Perplexity (for research)
PERPLEXITY_API_KEY=your-perplexity-key
```

### 2.2 Import the Workflow

1. Open N8N in your browser
2. Go to **Workflows** > **Import from File**
3. Select `SEO-Blog-Writer-Supabase.json`
4. Review and save the workflow

### 2.3 Configure Credentials

Create these credentials in N8N:

#### HTTP Header Auth (Supabase)
- **Name**: `Supabase API`
- **Header Name**: `apikey`
- **Header Value**: Use expression `{{ $env.SUPABASE_SERVICE_ROLE_KEY }}`

#### HTTP Bearer Auth (Perplexity)
- **Name**: `Perplexity Auth`
- **Token**: Your Perplexity API key

#### OpenRouter API
- **Name**: `OpenRouter API`
- **API Key**: Your OpenRouter API key

## Step 3: Workflow Configuration

### 3.1 Adjust Schedule Trigger

The default schedule runs every 6 hours. Modify in the **Schedule Trigger** node:

```json
{
  "rule": {
    "interval": [
      {
        "field": "hours",
        "hoursInterval": 6
      }
    ]
  }
}
```

Options:
- `hoursInterval: 1` - Every hour
- `hoursInterval: 12` - Twice daily
- `hoursInterval: 24` - Once daily

### 3.2 Batch Size

The workflow processes 5 posts per run. Adjust in **Get Pending Posts** node:

```
limit=5
```

### 3.3 AI Model Selection

The workflow uses these models via OpenRouter:

| Agent | Model | Purpose |
|-------|-------|---------|
| SERP Analysis | GPT-4.1 Mini | Research parsing |
| Title Refiner | Claude 3.5 Haiku | CTR optimization |
| Key Takeaways | Claude 3.5 Haiku | Summary generation |
| Outline | Claude 3.5 Haiku | Structure planning |
| Content Writer | Claude Sonnet 4 | Main article |
| Humanizer | Claude 3.5 Haiku | Polish content |
| SEO Meta | Claude 3.5 Haiku | Metadata generation |

To change models, update the **model** parameter in the respective LLM nodes.

## Step 4: Using the System

### 4.1 Adding Content Requests

Insert rows into `blog_content_queue`:

```sql
INSERT INTO blog_content_queue (
  title,
  primary_keyword,
  secondary_keywords,
  category,
  target_audience,
  priority
) VALUES (
  'How to Optimize Service Dispatch for Copier Dealers',
  'service dispatch optimization',
  '["copier service management", "field service automation", "technician scheduling"]',
  'service_operations',
  'copier dealers, print service providers, office equipment dealers',
  1
);
```

### 4.2 Via Printyx Admin UI

Create an admin page to manage the queue:

```typescript
// Example API endpoint for adding to queue
app.post('/api/blog-content-queue', requireAuth, async (req, res) => {
  const { title, primaryKeyword, secondaryKeywords, category, targetAudience, priority } = req.body;

  const result = await db.insert(blogContentQueue).values({
    title,
    primaryKeyword,
    secondaryKeywords,
    category,
    targetAudience,
    priority: priority || 0,
    requestedBy: req.user.id,
    tenantId: req.tenantId,
  }).returning();

  res.json(result[0]);
});
```

### 4.3 Checking Status

```sql
-- View queue status
SELECT
  id,
  title,
  status,
  created_at,
  started_at,
  completed_at,
  generated_title,
  error_message
FROM blog_content_queue
ORDER BY created_at DESC;

-- View generated posts
SELECT
  id,
  title,
  slug,
  status,
  created_at
FROM blog_posts
WHERE status = 'draft'
ORDER BY created_at DESC;
```

## Step 5: Content Categories

Available categories (from `content_category` enum):

| Category | Description |
|----------|-------------|
| `operational_efficiency` | Workflow and process optimization |
| `meter_billing` | Meter reading and billing automation |
| `service_operations` | Service dispatch and technician management |
| `business_growth` | Sales, marketing, revenue growth |
| `integration` | Third-party integrations (ERP, accounting) |
| `mobile` | Mobile apps and field service |
| `analytics` | Reporting and business intelligence |
| `automation` | Process automation and AI |
| `security` | Data security and compliance |
| `industry_news` | Industry trends and updates |

## Step 6: Monitoring & Troubleshooting

### 6.1 N8N Execution History

Check workflow executions in N8N:
- **Workflows** > Select workflow > **Executions**
- Filter by status: Success, Error, Running

### 6.2 Common Issues

#### Issue: Supabase Connection Failed
```
Error: Invalid API key
```
**Solution**: Verify `SUPABASE_SERVICE_ROLE_KEY` is correct and not the anon key.

#### Issue: OpenRouter Rate Limit
```
Error: 429 Too Many Requests
```
**Solution**: Reduce batch size or add delays between API calls.

#### Issue: Image Upload Failed
```
Error: Storage bucket not found
```
**Solution**: Create the `blog-images` bucket in Supabase Storage.

#### Issue: Content Too Short
```
Generated content under 2000 words
```
**Solution**: Adjust the Content Writer Agent prompt to emphasize word count.

### 6.3 Error Recovery

Failed items remain in the queue with `status = 'failed'`. To retry:

```sql
-- Reset failed items to pending
UPDATE blog_content_queue
SET
  status = 'pending',
  error_message = NULL,
  failed_at = NULL
WHERE status = 'failed';
```

## Step 7: Customization

### 7.1 Industry-Specific Prompts

The workflow is configured for copier/print dealers. To adapt for other industries:

1. Update system prompts in each Agent node
2. Modify the `target_audience` default value
3. Adjust category enum if needed

### 7.2 Adding FAQs

Extend the workflow to generate FAQs:

```json
{
  "promptType": "define",
  "text": "Generate 5-7 FAQs for this article...",
  "options": {
    "systemMessage": "Generate SEO-optimized FAQ questions..."
  }
}
```

### 7.3 Multi-Language Support

Add a language field to the queue and modify prompts:

```sql
ALTER TABLE blog_content_queue
ADD COLUMN target_language varchar(10) DEFAULT 'en';
```

## Step 8: Integration with Printyx Frontend

### 8.1 Display Generated Posts

```typescript
// client/src/pages/BlogAdmin.tsx
const { data: posts } = useQuery({
  queryKey: ['blog-posts', 'draft'],
  queryFn: () => fetch('/api/blog-posts?status=draft').then(r => r.json())
});
```

### 8.2 Publish Flow

```typescript
// Publish a draft post
const publishPost = async (postId: string) => {
  await fetch(`/api/blog-posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'published',
      publishedAt: new Date().toISOString()
    })
  });
};
```

### 8.3 Public Blog Display

The generated content is stored with proper SEO metadata and structured data for:
- Meta tags (title, description)
- Open Graph tags
- Schema.org Article markup
- Automatic slug generation

## Cost Estimation

| Component | Estimated Cost/Post |
|-----------|---------------------|
| Perplexity Research | ~$0.02 |
| OpenRouter (Claude Haiku) | ~$0.05 |
| OpenRouter (Claude Sonnet) | ~$0.15 |
| Image Generation | ~$0.01 |
| **Total per post** | **~$0.23** |

At 5 posts/day = ~$35/month

## Security Considerations

1. **Service Role Key**: Only use in server-side contexts (N8N)
2. **Storage Policies**: Ensure proper RLS on storage buckets
3. **Rate Limiting**: Consider adding rate limits to the queue API
4. **Content Review**: All posts generate as `draft` status for human review

## Next Steps

1. Set up the workflow following this guide
2. Add 5-10 content requests to test
3. Review generated drafts for quality
4. Adjust prompts based on output quality
5. Create admin UI for queue management
6. Set up content calendar integration
