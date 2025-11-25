# Knowledge Base Admin Guide

Complete guide for administering the Printyx Knowledge Base system including CLI tools, Chrome extension, API routes, and admin UI.

## Table of Contents

1. [Overview](#overview)
2. [Admin API Routes](#admin-api-routes)
3. [CLI Tool](#cli-tool)
4. [Chrome Extension](#chrome-extension)
5. [Admin UI Dashboard](#admin-ui-dashboard)
6. [Environment Variables](#environment-variables)
7. [Database Schema](#database-schema)
8. [Best Practices](#best-practices)

---

## Overview

The Knowledge Base admin system provides comprehensive tools for managing content, including:

- **Admin API Routes**: RESTful endpoints for bulk operations, analytics, and content management
- **CLI Tool**: Command-line interface for programmatic article management
- **Chrome Extension**: Browser extension for capturing web content
- **Admin UI**: Web-based dashboard for visual management
- **AI Integration**: Automated content generation and analysis

---

## Admin API Routes

All admin routes are prefixed with `/api/admin/knowledge-base` and require authentication with admin privileges.

### Dashboard Statistics

**GET** `/api/admin/knowledge-base/dashboard`

Get comprehensive dashboard statistics including article counts, views, feedback, and AI queue status.

**Query Parameters:**
- `days` (optional): Number of days for time-based stats (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "articles": {
      "total": 150,
      "published": 120,
      "draft": 25,
      "review": 5,
      "aiGenerated": 45
    },
    "views": {
      "total": 15000,
      "recent": 2500,
      "avgTimeSpent": 180,
      "completionRate": 0.75
    },
    "feedback": {
      "total": 350,
      "pending": 12,
      "avgSentiment": 0.82
    },
    "aiQueue": {
      "pending": 3,
      "generating": 1,
      "completed": 42,
      "failed": 2
    },
    "topArticles": [...],
    "needsReview": [...]
  }
}
```

### Bulk Operations

**POST** `/api/admin/knowledge-base/articles/bulk-update`

Update multiple articles at once.

**Request Body:**
```json
{
  "articleIds": ["uuid-1", "uuid-2", "uuid-3"],
  "updates": {
    "status": "published",
    "featured": true,
    "tags": ["updated", "reviewed"]
  }
}
```

**DELETE** `/api/admin/knowledge-base/articles/bulk-delete`

Delete multiple articles.

**Request Body:**
```json
{
  "articleIds": ["uuid-1", "uuid-2"]
}
```

### Feedback Management

**GET** `/api/admin/knowledge-base/feedback/pending`

Get all pending feedback that needs review.

**Query Parameters:**
- `limit` (default: 50): Number of results
- `offset` (default: 0): Pagination offset

**PUT** `/api/admin/knowledge-base/feedback/:id/resolve`

Resolve a feedback item.

**Request Body:**
```json
{
  "resolutionNotes": "Fixed the issue in article v2.1"
}
```

### AI Generation Queue

**GET** `/api/admin/knowledge-base/ai-queue`

Get AI content generation queue items.

**Query Parameters:**
- `status` (optional): Filter by status (pending, generating, completed, failed)
- `limit` (default: 50): Number of results

**POST** `/api/admin/knowledge-base/ai-queue/:id/retry`

Retry a failed AI generation task.

### Version Management

**GET** `/api/admin/knowledge-base/articles/:id/versions`

Get version history for an article.

**POST** `/api/admin/knowledge-base/articles/:id/restore-version`

Restore a previous version of an article.

**Request Body:**
```json
{
  "version": 3
}
```

### Import/Export

**POST** `/api/admin/knowledge-base/import`

Import articles from JSON, CSV, or Markdown.

**Request Body:**
```json
{
  "format": "json",
  "data": [...],
  "categoryId": "category-uuid",
  "overwriteExisting": false
}
```

**GET** `/api/admin/knowledge-base/export`

Export articles.

**Query Parameters:**
- `format`: json or csv
- `categoryId` (optional): Filter by category
- `status` (optional): Filter by status

### Analytics

**GET** `/api/admin/knowledge-base/analytics/detailed`

Get detailed analytics with trends and performance metrics.

**Query Parameters:**
- `startDate`: Start date for analysis
- `endDate`: End date for analysis
- `groupBy`: Grouping interval (day, week, month)

---

## CLI Tool

The Knowledge Base CLI provides command-line access to all KB operations.

### Installation

The CLI is installed with the project. Access it via npm scripts:

```bash
npm run kb -- <command> [options]
```

Or use the full path:

```bash
tsx server/cli/kb-cli.ts <command> [options]
```

### Commands

#### List Articles

```bash
npm run kb:list -- --tenant <tenant-id> [options]

Options:
  -c, --category <id>     Filter by category ID
  -s, --status <status>   Filter by status
  -l, --limit <number>    Limit results (default: 20)
```

Example:
```bash
npm run kb:list -- --tenant demo-tenant --status published --limit 10
```

#### Create Article

```bash
npm run kb:create -- --tenant <tenant-id> --user <user-id> [options]

Required:
  --title <title>         Article title
  --category <id>         Category ID

Options:
  --content-file <path>   Path to JSON content file
  --content-text <text>   Plain text content
  --excerpt <text>        Article excerpt
  --tags <tags>           Comma-separated tags
  --type <type>           Content type (default: tutorial)
  --difficulty <level>    Difficulty level (default: beginner)
```

Example:
```bash
npm run kb:create -- \
  --tenant demo-tenant \
  --user admin-user \
  --title "How to Setup Meter Billing" \
  --category billing-category-id \
  --content-file ./article-content.json \
  --tags "billing,setup,tutorial"
```

#### Update Article

```bash
npm run kb -- update --tenant <tenant-id> --user <user-id> --id <article-id> [options]

Options:
  --title <title>         New title
  --status <status>       New status
  --content-file <path>   Path to content file
  --category <id>         New category ID
  --tags <tags>           Comma-separated tags
```

#### Delete Article

```bash
npm run kb -- delete --tenant <tenant-id> --id <article-id> [--force]
```

#### Publish Articles

Publish draft articles:

```bash
npm run kb -- publish --tenant <tenant-id> --user <user-id> [options]

Options:
  -i, --id <id>          Publish specific article
  -c, --category <id>    Publish all drafts in category
  --all                  Publish all draft articles
```

Example:
```bash
# Publish specific article
npm run kb -- publish --tenant demo-tenant --user admin --id article-123

# Publish all drafts in category
npm run kb -- publish --tenant demo-tenant --user admin --category billing

# Publish all drafts
npm run kb -- publish --tenant demo-tenant --user admin --all
```

#### Generate with AI

```bash
npm run kb -- generate --tenant <tenant-id> --user <user-id> [options]

Required:
  --topic <topic>         Article topic
  --category <id>         Category ID
  --feature <feature>     Feature area to document

Options:
  --audience <audience>   Target audience (default: beginner)
  --difficulty <level>    Difficulty level
  --examples              Include examples
  --tone <tone>           Tone (professional, casual, technical)
```

Example:
```bash
npm run kb -- generate \
  --tenant demo-tenant \
  --user admin \
  --topic "Setting up Service Dispatch" \
  --category service-category \
  --feature "Service Management" \
  --examples \
  --tone professional
```

#### Import Articles

```bash
npm run kb:import -- --tenant <tenant-id> --user <user-id> --file <path> --category <id> [options]

Options:
  --format <format>  File format (json, csv, markdown) (default: json)
```

Example:
```bash
npm run kb:import -- \
  --tenant demo-tenant \
  --user admin \
  --file ./articles-export.json \
  --category default-category
```

#### Export Articles

```bash
npm run kb:export -- --tenant <tenant-id> --output <path> [options]

Options:
  -c, --category <id>    Filter by category
  -s, --status <status>  Filter by status
  --format <format>      Output format (json, csv) (default: json)
```

Example:
```bash
npm run kb:export -- \
  --tenant demo-tenant \
  --output ./kb-backup.json \
  --status published \
  --format json
```

#### Show Statistics

```bash
npm run kb:stats -- --tenant <tenant-id> [--days <number>]
```

Example:
```bash
npm run kb:stats -- --tenant demo-tenant --days 90
```

Output:
```
📊 Knowledge Base Statistics

Total Articles: 150
Published: 120
Total Views: 15,234
AI Generated: 45
AI Success Rate: 92.5%
Average Rating: 4.2/5.0

Top Articles:
  1. Getting Started with Printyx (2,345 views)
  2. Service Dispatch Guide (1,892 views)
  ...
```

#### Manage Feedback

```bash
# Show pending feedback
npm run kb -- feedback --tenant <tenant-id> --pending

# Resolve feedback
npm run kb -- feedback --tenant <tenant-id> --resolve <feedback-id> --user <user-id>
```

#### Search Articles

```bash
npm run kb -- search --tenant <tenant-id> --query <query> [options]

Options:
  -c, --category <id>    Filter by category
  -s, --status <status>  Filter by status
  -l, --limit <number>   Limit results (default: 10)
```

---

## Chrome Extension

The Printyx Knowledge Capture Chrome extension allows you to capture web content and save it directly to your knowledge base.

### Installation

1. Navigate to `browser-extensions/chrome/`
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `browser-extensions/chrome/` directory

### Configuration

1. Click the extension icon in Chrome
2. Go to the "Settings" tab
3. Configure the following:

```
API URL: https://printyx.net/api
Auth Token: <your-auth-token>
Tenant ID: <your-tenant-id>
User ID: <your-user-id>
Default Category ID: <category-uuid>
```

### Usage

#### Quick Capture

1. Navigate to any webpage
2. Click the extension icon
3. Click "Capture Current Page"
4. The page content will be automatically extracted and saved

#### Context Menu Capture

1. Right-click on any page
2. Select "Capture to Printyx KB" from the context menu
3. Or select text first, then right-click and choose "Capture selection to Printyx KB"

#### Custom Capture

1. Click the extension icon
2. Click "Custom Capture"
3. Fill in:
   - Title
   - Content (or paste from clipboard)
   - Category (optional)
   - Tags (optional)
4. Click "Save to KB"

### Features

- **Intelligent Content Extraction**: Uses reader mode algorithms to extract clean content
- **Metadata Extraction**: Automatically captures author, publish date, and description
- **Image Support**: Captures images with alt text
- **Code Detection**: Recognizes and formats code blocks
- **List Formatting**: Preserves bullet and numbered lists
- **Header Hierarchy**: Maintains document structure

### Captured Metadata

The extension captures:
- Page title
- Author (if available)
- Publication date (if available)
- Meta description
- Source URL
- Capture timestamp
- Content structure (headers, paragraphs, lists, code blocks, images)

---

## Admin UI Dashboard

The web-based admin dashboard provides a visual interface for knowledge base management.

### Accessing the Dashboard

Navigate to: `/admin/knowledge-base-admin-dashboard`

**URL:** `https://printyx.net/admin/knowledge-base-admin-dashboard`

### Features

#### Overview Tab

- **Statistics Cards**: Total articles, views, feedback, AI generation
- **Top Performing Articles**: Most viewed content
- **Articles Needing Review**: Draft articles awaiting approval
- **Quick Actions**: Approve, edit, or reject articles

#### Articles Tab

- List all articles with filters
- Bulk operations (publish, archive, delete)
- Quick edit and preview
- Status management

#### Feedback Tab

- View all pending user feedback
- Resolve feedback with notes
- Track sentiment analysis
- View feedback trends

#### AI Queue Tab

- Monitor AI generation tasks
- Retry failed generations
- View generation prompts and results
- Track token usage and costs

#### Analytics Tab

- View trends (daily, weekly, monthly)
- Category performance metrics
- Search query analysis
- User engagement statistics
- Content gap identification

### Bulk Operations

Select multiple articles using checkboxes, then:
- Publish selected
- Archive selected
- Change category
- Add/remove tags
- Delete selected

### Import/Export

**Export Options:**
- JSON: Full article data with metadata
- CSV: Simplified tabular format

**Import Options:**
- JSON: Full article import with validation
- CSV: Bulk article creation
- Markdown: Convert Markdown files to articles

---

## Environment Variables

Add these to your `.env` file:

```bash
# Knowledge Base Configuration
KB_AI_MODEL=claude-3-5-sonnet-20241022
KB_AI_TEMPERATURE=0.7
KB_AI_MAX_TOKENS=4000
KB_EMBEDDING_MODEL=text-embedding-ada-002
KB_SEMANTIC_SEARCH_ENABLED=true
KB_AUTO_GENERATE_EMBEDDINGS=true
KB_DEFAULT_CATEGORY_ID=
KB_ARTICLE_MIN_WORD_COUNT=100
KB_ARTICLE_MAX_WORD_COUNT=10000

# Knowledge Base Content Generation
KB_AI_GENERATION_ENABLED=true
KB_AI_BATCH_SIZE=5
KB_AI_QUEUE_PROCESSING_INTERVAL=60000

# Knowledge Base Chrome Extension
KB_EXTENSION_ALLOWED_ORIGINS=https://printyx.net,http://localhost:5000
KB_EXTENSION_API_VERSION=v1
```

### Variable Descriptions

- **KB_AI_MODEL**: Claude model for content generation
- **KB_AI_TEMPERATURE**: Creativity level (0.0-1.0)
- **KB_AI_MAX_TOKENS**: Maximum tokens per generation
- **KB_EMBEDDING_MODEL**: OpenAI model for semantic search
- **KB_SEMANTIC_SEARCH_ENABLED**: Enable vector-based search
- **KB_AUTO_GENERATE_EMBEDDINGS**: Auto-create embeddings for new articles
- **KB_DEFAULT_CATEGORY_ID**: Default category for uncategorized content
- **KB_ARTICLE_MIN_WORD_COUNT**: Minimum words for articles
- **KB_ARTICLE_MAX_WORD_COUNT**: Maximum words for articles
- **KB_AI_GENERATION_ENABLED**: Enable AI content generation
- **KB_AI_BATCH_SIZE**: Number of articles to generate in batch
- **KB_AI_QUEUE_PROCESSING_INTERVAL**: Interval for processing AI queue (ms)
- **KB_EXTENSION_ALLOWED_ORIGINS**: Allowed origins for extension API calls
- **KB_EXTENSION_API_VERSION**: API version for extension compatibility

---

## Database Schema

### Core Tables

1. **knowledge_categories**: Hierarchical category structure
2. **knowledge_articles**: Main article content and metadata
3. **article_versions**: Version history tracking
4. **article_views**: View analytics and tracking
5. **article_feedback**: User feedback and suggestions
6. **ai_content_generation_queue**: AI generation task queue
7. **article_embeddings**: Vector embeddings for semantic search
8. **knowledge_search_queries**: Search analytics
9. **article_bookmarks**: User bookmarks
10. **reading_history**: Reading progress tracking
11. **article_ratings**: User ratings and reviews
12. **article_votes**: Helpful/unhelpful votes

### Key Relationships

```
knowledge_categories (1:N) knowledge_articles
knowledge_articles (1:N) article_versions
knowledge_articles (1:N) article_views
knowledge_articles (1:N) article_feedback
knowledge_articles (1:1) article_embeddings
```

---

## Best Practices

### Content Creation

1. **Use Templates**: Start with article templates for consistency
2. **SEO Optimization**: Include relevant keywords and meta descriptions
3. **Clear Structure**: Use headers (H1-H6) for content hierarchy
4. **Examples**: Include practical examples and code snippets
5. **Screenshots**: Add annotated screenshots for clarity
6. **Links**: Link to related articles for better navigation

### AI Generation

1. **Specific Prompts**: Provide detailed, specific prompts for better results
2. **Review AI Content**: Always review and edit AI-generated content
3. **Human Touch**: Add personal insights and company-specific details
4. **Fact Checking**: Verify all technical details and accuracy
5. **Brand Voice**: Ensure content matches your brand tone and style

### Content Maintenance

1. **Regular Reviews**: Schedule quarterly content audits
2. **Update Metrics**: Monitor view counts and engagement
3. **Address Feedback**: Respond to user feedback promptly
4. **Version Control**: Use versions for major updates
5. **Archive Old Content**: Archive outdated articles instead of deleting

### Organization

1. **Category Structure**: Maintain a logical, flat category hierarchy
2. **Consistent Tags**: Use standardized tags across articles
3. **Naming Conventions**: Follow consistent article naming patterns
4. **Cross-References**: Link related articles together
5. **Search Optimization**: Use relevant keywords in titles and excerpts

### Analytics

1. **Track Metrics**: Monitor views, ratings, and completion rates
2. **Identify Gaps**: Use analytics to find missing topics
3. **Popular Content**: Promote high-performing articles
4. **Low Performers**: Improve or retire low-traffic articles
5. **User Behavior**: Analyze search queries for content ideas

### Security

1. **Access Control**: Restrict admin access to authorized users
2. **Audit Logs**: Monitor all admin operations
3. **Draft Protection**: Keep drafts private until ready
4. **Backup Regularly**: Export knowledge base weekly
5. **Version History**: Maintain version history for rollbacks

---

## Troubleshooting

### CLI Issues

**Problem**: CLI command not found
```bash
# Solution: Use full path
tsx server/cli/kb-cli.ts <command>

# Or add to package.json scripts
```

**Problem**: Database connection error
```bash
# Solution: Check DATABASE_URL in .env
# Ensure PostgreSQL is running
```

### Chrome Extension Issues

**Problem**: Authentication failed
```
Solution:
1. Check API URL is correct
2. Verify auth token is valid
3. Ensure tenant ID and user ID are correct
4. Check CORS settings allow extension origin
```

**Problem**: Content not captured
```
Solution:
1. Check browser console for errors
2. Verify category ID exists
3. Ensure content meets minimum requirements
4. Check API endpoint is accessible
```

### API Issues

**Problem**: 401 Unauthorized
```
Solution:
1. Include valid auth token in request
2. Ensure user has admin privileges
3. Check session is active
```

**Problem**: 500 Internal Server Error
```
Solution:
1. Check server logs for details
2. Verify database schema is up to date
3. Ensure required environment variables are set
```

---

## Support

For additional support:

1. **Documentation**: Review `/docs` directory
2. **API Reference**: `/docs/API.md`
3. **Schema Documentation**: `/docs/DATABASE_SCHEMA_HIERARCHY.md`
4. **GitHub Issues**: Report bugs and feature requests
5. **Support Portal**: Contact support team

---

## Changelog

### v1.0.0 (Current)

- Initial release of admin tools
- CLI tool with full CRUD operations
- Chrome extension for content capture
- Admin API routes for bulk operations
- Admin UI dashboard
- AI content generation integration
- Analytics and reporting

---

**Last Updated**: 2025-11-25
**Version**: 1.0.0
**Maintainer**: Printyx Development Team
