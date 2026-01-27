#!/usr/bin/env node
/**
 * Knowledge Base CLI Tool
 * Command-line interface for knowledge base administration
 *
 * Usage:
 *   npm run kb -- <command> [options]
 *
 * Commands:
 *   list              List all articles
 *   create            Create a new article
 *   update            Update an existing article
 *   delete            Delete an article
 *   publish           Publish draft articles
 *   generate          Generate article with AI
 *   import            Import articles from file
 *   export            Export articles to file
 *   stats             Show statistics
 *   feedback          Manage feedback
 *   search            Search articles
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import KnowledgeBaseService from '../services/knowledge-base-service';
import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { knowledgeArticles, knowledgeCategories, articleFeedback } from '@shared/schema';

const program = new Command();

program.name('kb').description('Knowledge Base CLI Tool').version('1.0.0');

/**
 * List articles
 */
program
  .command('list')
  .description('List all articles')
  .option('-t, --tenant <id>', 'Tenant ID', 'demo-tenant')
  .option('-c, --category <id>', 'Filter by category ID')
  .option('-s, --status <status>', 'Filter by status (draft, review, published, etc.)')
  .option('-l, --limit <number>', 'Limit results', '20')
  .action(async (options) => {
    try {
      const result = await KnowledgeBaseService.searchArticles(options.tenant, '', {
        categoryId: options.category,
        status: options.status,
        limit: parseInt(options.limit),
      });

      console.log('\n📚 Knowledge Base Articles\n');
      console.log(`Found ${result.total} articles:\n`);

      result.articles.forEach((article, index) => {
        console.log(`${index + 1}. ${article.title}`);
        console.log(`   ID: ${article.id}`);
        console.log(`   Status: ${article.status}`);
        console.log(`   Views: ${article.viewCount}`);
        console.log(`   Created: ${article.created_at}`);
        console.log('');
      });
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * Create article
 */
program
  .command('create')
  .description('Create a new article')
  .requiredOption('-t, --tenant <id>', 'Tenant ID')
  .requiredOption('-u, --user <id>', 'User ID')
  .requiredOption('--title <title>', 'Article title')
  .requiredOption('--category <id>', 'Category ID')
  .option('--content-file <path>', 'Path to content file (JSON)')
  .option('--content-text <text>', 'Plain text content')
  .option('--excerpt <text>', 'Article excerpt')
  .option('--tags <tags>', 'Comma-separated tags')
  .option('--type <type>', 'Content type (tutorial, how_to, reference, etc.)', 'tutorial')
  .option('--difficulty <level>', 'Difficulty level (beginner, intermediate, advanced)', 'beginner')
  .action(async (options) => {
    try {
      let content;

      if (options.contentFile) {
        const filePath = path.resolve(options.contentFile);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        content = JSON.parse(fileContent);
      } else if (options.contentText) {
        content = {
          sections: [
            {
              type: 'paragraph',
              content: options.contentText,
              order: 1,
            },
          ],
        };
      } else {
        console.error('❌ Error: Either --content-file or --content-text is required');
        process.exit(1);
      }

      const article = await KnowledgeBaseService.createArticle(options.tenant, options.user, {
        title: options.title,
        content,
        categoryId: options.category,
        excerpt: options.excerpt,
        tags: options.tags ? options.tags.split(',') : [],
        contentType: options.type,
        difficultyLevel: options.difficulty,
      });

      console.log('\n✅ Article created successfully!');
      console.log(`   ID: ${article.id}`);
      console.log(`   Title: ${article.title}`);
      console.log(`   Slug: ${article.slug}`);
      console.log(`   Status: ${article.status}`);
      console.log('');
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * Update article
 */
program
  .command('update')
  .description('Update an existing article')
  .requiredOption('-t, --tenant <id>', 'Tenant ID')
  .requiredOption('-u, --user <id>', 'User ID')
  .requiredOption('-i, --id <id>', 'Article ID')
  .option('--title <title>', 'New title')
  .option('--status <status>', 'New status')
  .option('--content-file <path>', 'Path to content file (JSON)')
  .option('--category <id>', 'New category ID')
  .option('--tags <tags>', 'Comma-separated tags')
  .action(async (options) => {
    try {
      const updates: any = {};

      if (options.title) updates.title = options.title;
      if (options.status) updates.status = options.status;
      if (options.category) updates.categoryId = options.category;
      if (options.tags) updates.tags = options.tags.split(',');

      if (options.contentFile) {
        const filePath = path.resolve(options.contentFile);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        updates.content = JSON.parse(fileContent);
      }

      const article = await KnowledgeBaseService.updateArticle(
        options.id,
        options.tenant,
        options.user,
        updates,
      );

      console.log('\n✅ Article updated successfully!');
      console.log(`   ID: ${article.id}`);
      console.log(`   Title: ${article.title}`);
      console.log(`   Status: ${article.status}`);
      console.log(`   Version: ${article.version}`);
      console.log('');
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * Delete article
 */
program
  .command('delete')
  .description('Delete an article')
  .requiredOption('-t, --tenant <id>', 'Tenant ID')
  .requiredOption('-i, --id <id>', 'Article ID')
  .option('-f, --force', 'Skip confirmation')
  .action(async (options) => {
    try {
      if (!options.force) {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
          readline.question(
            '⚠️  Are you sure you want to delete this article? (yes/no): ',
            resolve,
          );
        });

        readline.close();

        if (answer.toLowerCase() !== 'yes') {
          console.log('Cancelled.');
          process.exit(0);
        }
      }

      await db
        .delete(knowledgeArticles)
        .where(
          and(
            eq(knowledgeArticles.id, options.id),
            eq(knowledgeArticles.tenant_id, options.tenant),
          ),
        );

      console.log('\n✅ Article deleted successfully!');
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * Publish articles
 */
program
  .command('publish')
  .description('Publish draft articles')
  .requiredOption('-t, --tenant <id>', 'Tenant ID')
  .requiredOption('-u, --user <id>', 'User ID')
  .option('-i, --id <id>', 'Specific article ID')
  .option('-c, --category <id>', 'Publish all drafts in category')
  .option('--all', 'Publish all draft articles')
  .action(async (options) => {
    try {
      let articleIds: string[] = [];

      if (options.id) {
        articleIds = [options.id];
      } else if (options.category) {
        const drafts = await db.query.knowledgeArticles.findMany({
          where: and(
            eq(knowledgeArticles.tenant_id, options.tenant),
            eq(knowledgeArticles.categoryId, options.category),
            eq(knowledgeArticles.status, 'draft'),
          ),
        });
        articleIds = drafts.map((a) => a.id);
      } else if (options.all) {
        const drafts = await db.query.knowledgeArticles.findMany({
          where: and(
            eq(knowledgeArticles.tenant_id, options.tenant),
            eq(knowledgeArticles.status, 'draft'),
          ),
        });
        articleIds = drafts.map((a) => a.id);
      } else {
        console.error('❌ Error: Specify --id, --category, or --all');
        process.exit(1);
      }

      console.log(`\nPublishing ${articleIds.length} article(s)...`);

      for (const id of articleIds) {
        await KnowledgeBaseService.updateArticle(id, options.tenant, options.user, {
          status: 'published',
        });
      }

      console.log(`✅ Published ${articleIds.length} article(s) successfully!`);
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * Generate article with AI
 */
program
  .command('generate')
  .description('Generate an article using AI')
  .requiredOption('-t, --tenant <id>', 'Tenant ID')
  .requiredOption('-u, --user <id>', 'User ID')
  .requiredOption('--topic <topic>', 'Article topic')
  .requiredOption('--category <id>', 'Category ID')
  .requiredOption('--feature <feature>', 'Feature area to document')
  .option('--audience <audience>', 'Target audience (beginner, intermediate, advanced)', 'beginner')
  .option('--difficulty <level>', 'Difficulty level', 'beginner')
  .option('--examples', 'Include examples', false)
  .option('--tone <tone>', 'Tone (professional, casual, technical)', 'professional')
  .action(async (options) => {
    try {
      console.log('\n🤖 Generating article with AI...\n');

      const result = await KnowledgeBaseService.generateArticleWithAI(
        options.tenant,
        options.user,
        {
          topic: options.topic,
          category: options.category,
          featureArea: options.feature,
          targetAudience: options.audience,
          difficultyLevel: options.difficulty,
          includeExamples: options.examples,
          tone: options.tone,
        },
      );

      console.log('✅ Article generation queued!');
      console.log(`   Queue ID: ${result.queueId}`);
      console.log(`   ${result.message}`);
      console.log('');
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * Import articles
 */
program
  .command('import')
  .description('Import articles from file')
  .requiredOption('-t, --tenant <id>', 'Tenant ID')
  .requiredOption('-u, --user <id>', 'User ID')
  .requiredOption('-f, --file <path>', 'Path to import file')
  .requiredOption('-c, --category <id>', 'Default category ID')
  .option('--format <format>', 'File format (json, csv, markdown)', 'json')
  .action(async (options) => {
    try {
      const filePath = path.resolve(options.file);

      if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: File not found: ${filePath}`);
        process.exit(1);
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      let data;

      if (options.format === 'json') {
        data = JSON.parse(fileContent);
      } else {
        console.error('❌ Error: CSV and Markdown import not yet implemented');
        process.exit(1);
      }

      console.log('\n📥 Importing articles...\n');

      const articles = Array.isArray(data) ? data : [data];
      let imported = 0;
      let failed = 0;

      for (const articleData of articles) {
        try {
          await KnowledgeBaseService.createArticle(options.tenant, options.user, {
            ...articleData,
            categoryId: articleData.categoryId || options.category,
          });
          imported++;
          console.log(`✅ Imported: ${articleData.title}`);
        } catch (error: any) {
          failed++;
          console.error(`❌ Failed: ${articleData.title} - ${error.message}`);
        }
      }

      console.log(`\n📊 Import complete:`);
      console.log(`   Imported: ${imported}`);
      console.log(`   Failed: ${failed}`);
      console.log('');
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * Export articles
 */
program
  .command('export')
  .description('Export articles to file')
  .requiredOption('-t, --tenant <id>', 'Tenant ID')
  .requiredOption('-o, --output <path>', 'Output file path')
  .option('-c, --category <id>', 'Filter by category')
  .option('-s, --status <status>', 'Filter by status')
  .option('--format <format>', 'Output format (json, csv)', 'json')
  .action(async (options) => {
    try {
      console.log('\n📤 Exporting articles...\n');

      const result = await KnowledgeBaseService.searchArticles(options.tenant, '', {
        categoryId: options.category,
        status: options.status,
        limit: 10000,
      });

      const outputPath = path.resolve(options.output);

      if (options.format === 'json') {
        fs.writeFileSync(outputPath, JSON.stringify(result.articles, null, 2), 'utf-8');
      } else if (options.format === 'csv') {
        // Simple CSV export
        const headers = ['ID', 'Title', 'Status', 'Category', 'Created', 'Views'];
        const rows = result.articles.map((a) => [
          a.id,
          `"${a.title.replace(/"/g, '""')}"`,
          a.status,
          a.categoryId,
          a.created_at,
          a.viewCount,
        ]);

        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

        fs.writeFileSync(outputPath, csv, 'utf-8');
      }

      console.log(`✅ Exported ${result.articles.length} articles to ${outputPath}`);
      console.log('');
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * Show statistics
 */
program
  .command('stats')
  .description('Show knowledge base statistics')
  .requiredOption('-t, --tenant <id>', 'Tenant ID')
  .option('-d, --days <number>', 'Time period in days', '30')
  .action(async (options) => {
    try {
      const start = new Date();
      start.setDate(start.getDate() - parseInt(options.days));

      const analytics = await KnowledgeBaseService.getAnalytics(options.tenant, {
        start,
        end: new Date(),
      });

      console.log('\n📊 Knowledge Base Statistics\n');
      console.log(`Total Articles: ${analytics.totalArticles}`);
      console.log(`Published: ${analytics.publishedArticles}`);
      console.log(`Total Views: ${analytics.totalViews}`);
      console.log(`AI Generated: ${analytics.aiGeneratedCount}`);
      console.log(`AI Success Rate: ${(analytics.aiGenerationSuccessRate * 100).toFixed(1)}%`);
      console.log(`Average Rating: ${analytics.averageRating.toFixed(1)}/5.0`);
      console.log('');

      console.log('Top Articles:');
      analytics.topArticles.forEach((article, index) => {
        console.log(`  ${index + 1}. ${article.title} (${article.views} views)`);
      });
      console.log('');

      console.log('Popular Categories:');
      analytics.popularCategories.forEach((category, index) => {
        console.log(`  ${index + 1}. ${category.name} (${category.articleCount} articles)`);
      });
      console.log('');

      console.log('Content Gaps:');
      analytics.contentGaps.forEach((gap, index) => {
        console.log(`  ${index + 1}. ${gap}`);
      });
      console.log('');
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * Manage feedback
 */
program
  .command('feedback')
  .description('Manage article feedback')
  .requiredOption('-t, --tenant <id>', 'Tenant ID')
  .option('--pending', 'Show pending feedback')
  .option('--resolve <id>', 'Resolve feedback by ID')
  .option('--user <id>', 'User ID (for resolving)')
  .action(async (options) => {
    try {
      if (options.pending) {
        const feedback = await db.query.articleFeedback.findMany({
          where: and(
            eq(articleFeedback.tenant_id, options.tenant),
            eq(articleFeedback.resolved, false),
          ),
          limit: 50,
        });

        console.log(`\n💬 Pending Feedback (${feedback.length})\n`);

        for (const fb of feedback) {
          const article = await db.query.knowledgeArticles.findFirst({
            where: eq(knowledgeArticles.id, fb.articleId),
          });

          console.log(`ID: ${fb.id}`);
          console.log(`Article: ${article?.title || 'Unknown'}`);
          console.log(`Type: ${fb.feedbackType}`);
          console.log(`Rating: ${fb.rating || 'N/A'}`);
          console.log(`Comment: ${fb.comment || 'N/A'}`);
          console.log(`Created: ${fb.created_at}`);
          console.log('---');
        }
      } else if (options.resolve) {
        if (!options.user) {
          console.error('❌ Error: --user is required when resolving feedback');
          process.exit(1);
        }

        await db
          .update(articleFeedback)
          .set({
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: options.user,
          })
          .where(
            and(
              eq(articleFeedback.id, options.resolve),
              eq(articleFeedback.tenant_id, options.tenant),
            ),
          );

        console.log('\n✅ Feedback resolved successfully!');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * Search articles
 */
program
  .command('search')
  .description('Search articles')
  .requiredOption('-t, --tenant <id>', 'Tenant ID')
  .requiredOption('-q, --query <query>', 'Search query')
  .option('-c, --category <id>', 'Filter by category')
  .option('-s, --status <status>', 'Filter by status')
  .option('-l, --limit <number>', 'Limit results', '10')
  .action(async (options) => {
    try {
      const result = await KnowledgeBaseService.searchArticles(options.tenant, options.query, {
        categoryId: options.category,
        status: options.status,
        limit: parseInt(options.limit),
      });

      console.log(`\n🔍 Search Results for "${options.query}"\n`);
      console.log(`Found ${result.total} articles in ${result.searchTime}ms:\n`);

      result.articles.forEach((article, index) => {
        console.log(`${index + 1}. ${article.title}`);
        console.log(`   ID: ${article.id}`);
        console.log(`   Status: ${article.status}`);
        console.log(`   Views: ${article.viewCount}`);
        console.log(`   Excerpt: ${article.excerpt?.substring(0, 100)}...`);
        console.log('');
      });
    } catch (error) {
      console.error('❌ Error:', error);
      process.exit(1);
    }
  });

program.parse();
