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
3. **API Keys** (Direct access - no OpenRouter needed):
   - OpenAI API key
   - Anthropic (Claude) API key
   - Perplexity API key

## Step 1: Environment Variables in Coolify

### N8N Service Environment Variables

Add these to your N8N service in Coolify:

```env
# ═══════════════════════════════════════════════════════════════
# SUPABASE CONNECTION (Printyx-specific naming)
# ═══════════════════════════════════════════════════════════════
# Your self-hosted Supabase API URL
PRINTYX_SUPABASE_URL=https://api.printyx.net

# Service role key for admin operations (NOT the anon key)
PRINTYX_SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ═══════════════════════════════════════════════════════════════
# AI SERVICES - DIRECT API ACCESS
# ═══════════════════════════════════════════════════════════════
# OpenAI API key - Used for GPT-4o-mini (SERP analysis, SEO metadata) and DALL-E 3 (images)
OPENAI_API_KEY=sk-...

# Anthropic Claude API key - Used for Claude 3.5 Haiku/Sonnet (content generation)
CLAUDE_API_KEY=sk-ant-...

# Perplexity API key - Used for web research and SERP data
PERPLEXITY_API_KEY=pplx-...
```

### Environment Variable Descriptions

| Variable                            | Description                                                                                                            | Where to Get                                |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `PRINTYX_SUPABASE_URL`              | Your Supabase REST API URL. For self-hosted, this is typically your Kong gateway URL (e.g., `https://api.printyx.net`) | Coolify Supabase service config             |
| `PRINTYX_SUPABASE_SERVICE_ROLE_KEY` | Service role JWT for admin operations. Has full database access, bypasses RLS                                          | Supabase Dashboard > Settings > API         |
| `OPENAI_API_KEY`                    | OpenAI API key for GPT and DALL-E                                                                                      | https://platform.openai.com/api-keys        |
| `CLAUDE_API_KEY`                    | Anthropic API key for Claude models                                                                                    | https://console.anthropic.com/settings/keys |
| `PERPLEXITY_API_KEY`                | Perplexity API key for research                                                                                        | https://www.perplexity.ai/settings/api      |

## Step 2: Database Setup

### 2.1 Push Schema Changes

The `blog_content_queue` table has been added to `shared/content-marketing-schema.ts`. Push it to your database:

```bash
npm run db:push
```

This creates:

- `blog_content_queue` table with status tracking
- Required indexes for efficient querying

### 2.2 Create Storage Bucket

In your Supabase SQL Editor, run:

```sql
-- Create the blog-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to images
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'blog-images');

-- Allow service role to upload images
CREATE POLICY "Service Role Upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'blog-images');

-- Allow service role to delete images
CREATE POLICY "Service Role Delete" ON storage.objects
FOR DELETE USING (bucket_id = 'blog-images');
```

### 2.3 Verify Tables

```sql
-- Check blog_content_queue table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'blog_content_queue'
ORDER BY ordinal_position;

-- Check blog_posts table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'blog_posts'
ORDER BY ordinal_position;
```

## Step 3: Import Workflow into N8N

### 3.1 Import the Workflow

1. Open N8N in your browser (via Coolify)
2. Go to **Workflows** > **Import from File**
3. Select `SEO-Blog-Writer-Supabase.json`
4. Save the workflow

### 3.2 No Credentials Needed!

Unlike the original workflow, this version uses **direct HTTP requests** with environment variables. No N8N credentials need to be configured - all API keys are read from `$env.*` variables.

This approach:

- Simplifies setup (no credential management in N8N)
- Makes it easier to update keys (just change env vars)
- Works better with Coolify's environment management

## Step 4: Model Usage and Costs

### Models Used

| Stage            | API        | Model               | Purpose                                    |
| ---------------- | ---------- | ------------------- | ------------------------------------------ |
| Research         | Perplexity | `sonar-pro`         | Web search, SERP data, competitor analysis |
| SERP Analysis    | OpenAI     | `gpt-4o-mini`       | Parse research into structured JSON        |
| Title Refinement | Anthropic  | `claude-3-5-haiku`  | Optimize title for CTR                     |
| Key Takeaways    | Anthropic  | `claude-3-5-haiku`  | Summary bullet points                      |
| Outline          | Anthropic  | `claude-3-5-haiku`  | Article structure                          |
| Content Writing  | Anthropic  | `claude-3-5-sonnet` | Main 2500-3500 word article                |
| Humanizing       | Anthropic  | `claude-3-5-haiku`  | Remove AI-sounding phrases                 |
| SEO Metadata     | OpenAI     | `gpt-4o-mini`       | Meta title, description, slug              |
| Image Generation | OpenAI     | `dall-e-3`          | Featured image (1792x1024)                 |

### Estimated Cost per Article

| Component                    | Estimated Cost |
| ---------------------------- | -------------- |
| Perplexity Research          | ~$0.02         |
| OpenAI GPT-4o-mini (2 calls) | ~$0.01         |
| Claude Haiku (4 calls)       | ~$0.04         |
| Claude Sonnet (1 call)       | ~$0.15         |
| DALL-E 3 Image               | ~$0.04         |
| **Total per article**        | **~$0.26**     |

At 5 articles/day = ~$39/month

## Step 5: Using the System

### 5.1 Adding Content to the Queue

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
  1  -- Higher priority = processed first
);
```

### 5.2 Available Categories

From `content_category` enum:

| Category                 | Description                                |
| ------------------------ | ------------------------------------------ |
| `operational_efficiency` | Workflow and process optimization          |
| `meter_billing`          | Meter reading and billing automation       |
| `service_operations`     | Service dispatch and technician management |
| `business_growth`        | Sales, marketing, revenue growth           |
| `integration`            | Third-party integrations                   |
| `mobile`                 | Mobile apps and field service              |
| `analytics`              | Reporting and business intelligence        |
| `automation`             | Process automation and AI                  |
| `security`               | Data security and compliance               |
| `industry_news`          | Industry trends and updates                |

### 5.3 Monitor Queue Status

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
ORDER BY created_at DESC
LIMIT 20;

-- Count by status
SELECT status, COUNT(*)
FROM blog_content_queue
GROUP BY status;
```

### 5.4 View Generated Posts

```sql
-- View recent drafts
SELECT
  id,
  title,
  slug,
  word_count,
  read_time,
  status,
  created_at
FROM blog_posts
WHERE status = 'draft'
ORDER BY created_at DESC
LIMIT 10;
```

## Step 6: Schedule Configuration

### Default Schedule

The workflow runs every **6 hours** and processes up to **5 pending posts** per run.

### Modify Schedule

Edit the **Schedule Trigger** node:

```json
{
  "rule": {
    "interval": [
      {
        "field": "hours",
        "hoursInterval": 6 // Change this value
      }
    ]
  }
}
```

Options:

- `1` - Every hour
- `6` - Every 6 hours (default)
- `12` - Twice daily
- `24` - Once daily

### Modify Batch Size

Edit the **Get Pending Posts** node query parameter:

```
limit=5  // Change to desired batch size
```

## Step 7: Troubleshooting

### Common Issues

#### Issue: `401 Unauthorized` from Supabase

```
Error: Invalid API key
```

**Cause**: Wrong key or missing `Authorization` header
**Solution**:

1. Verify `PRINTYX_SUPABASE_SERVICE_ROLE_KEY` is the **service role** key (not anon key)
2. Check the key hasn't expired
3. Ensure the environment variable is properly set in Coolify

#### Issue: `403 Forbidden` on Storage Upload

```
Error: new row violates row-level security policy
```

**Solution**: Create the storage policies from Step 2.2

#### Issue: OpenAI Rate Limit

```
Error: 429 Too Many Requests
```

**Solution**:

1. Reduce batch size
2. Increase schedule interval
3. Check your OpenAI usage tier

#### Issue: Claude API Error

```
Error: invalid_api_key
```

**Solution**:

1. Verify `CLAUDE_API_KEY` starts with `sk-ant-`
2. Check key hasn't been revoked
3. Ensure account has API access enabled

#### Issue: Content Too Short

```
Generated article under 2000 words
```

**Solution**: The Content Writer prompt specifies 2,500-3,500 words. If consistently short:

1. Check research data is being passed correctly
2. Verify outline has enough sections
3. Consider increasing `max_tokens` in the Content Writer node

### Error Recovery

Failed items remain in queue with `status = 'failed'`. To retry:

```sql
-- View failed items with errors
SELECT id, title, error_message, failed_at
FROM blog_content_queue
WHERE status = 'failed'
ORDER BY failed_at DESC;

-- Reset specific item to pending
UPDATE blog_content_queue
SET
  status = 'pending',
  error_message = NULL,
  failed_at = NULL,
  started_at = NULL
WHERE id = 'your-uuid-here';

-- Reset all failed items
UPDATE blog_content_queue
SET
  status = 'pending',
  error_message = NULL,
  failed_at = NULL,
  started_at = NULL
WHERE status = 'failed';
```

## Step 8: Integration with Printyx App

### 8.1 API Endpoint for Queue Management

Add to your Express routes:

```typescript
// server/routes/blog-content-queue.ts
import { Router } from 'express';
import { db } from '../db';
import { blogContentQueue, insertBlogContentQueueSchema } from '@shared/content-marketing-schema';
import { eq } from 'drizzle-orm';

const router = Router();

// List queue items
router.get('/api/blog-content-queue', requireAuth, async (req, res) => {
  const items = await db.query.blogContentQueue.findMany({
    orderBy: (q, { desc }) => [desc(q.createdAt)],
    limit: 50,
  });
  res.json(items);
});

// Add to queue
router.post('/api/blog-content-queue', requireAuth, async (req, res) => {
  const parsed = insertBlogContentQueueSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error });
  }

  const result = await db
    .insert(blogContentQueue)
    .values({
      ...parsed.data,
      requestedBy: req.user.id,
      tenantId: req.tenantId,
    })
    .returning();

  res.json(result[0]);
});

// Cancel queue item
router.patch('/api/blog-content-queue/:id/cancel', requireAuth, async (req, res) => {
  const result = await db
    .update(blogContentQueue)
    .set({ status: 'cancelled' })
    .where(eq(blogContentQueue.id, req.params.id))
    .returning();

  res.json(result[0]);
});

export default router;
```

### 8.2 Publish Draft Posts

```typescript
// Publish a generated draft
router.patch('/api/blog-posts/:id/publish', requireAuth, async (req, res) => {
  const result = await db
    .update(blogPosts)
    .set({
      status: 'published',
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(blogPosts.id, req.params.id))
    .returning();

  res.json(result[0]);
});
```

## Step 9: Security Considerations

1. **Service Role Key**: Only used server-side (N8N). Never expose to clients.

2. **Storage Bucket**: Public read, but uploads require service role.

3. **Content Review**: All posts generate as `draft` - require manual publish.

4. **Rate Limiting**: Consider adding rate limits to queue API.

5. **API Key Rotation**: Regularly rotate API keys and update in Coolify.

## Quick Reference

### Environment Variables Summary

```env
# Supabase (Printyx naming convention)
PRINTYX_SUPABASE_URL=https://api.printyx.net
PRINTYX_SUPABASE_SERVICE_ROLE_KEY=eyJ...

# AI APIs (Direct access)
OPENAI_API_KEY=sk-...
CLAUDE_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...
```

### Useful SQL Queries

```sql
-- Add high-priority content request
INSERT INTO blog_content_queue (title, primary_keyword, category, priority)
VALUES ('Your Topic', 'your keyword', 'operational_efficiency', 10);

-- Check workflow progress
SELECT title, status, started_at FROM blog_content_queue
WHERE status = 'processing';

-- Get latest generated posts
SELECT title, slug, word_count FROM blog_posts
ORDER BY created_at DESC LIMIT 5;
```

### Workflow Files

- `SEO-Blog-Writer-Supabase.json` - Main N8N workflow
- `shared/content-marketing-schema.ts` - Database schema (includes `blogContentQueue`)
