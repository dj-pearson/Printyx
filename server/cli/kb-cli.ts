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
import { createModuleLogger } from '../lib/logger';
const log = createModuleLogger('kb-cli');

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

      log.info('\n📚 Knowledge Base Articles\n');
      log.info(`Found ${result.total} articles:\n`);

      result.articles.forEach((article, index) => {
        log.info(`${index + 1}. ${article.title}`);
        log.info(`   ID: ${article.id}`);
        log.info(`   Status: ${article.status}`);
        log.info(`   Views: ${article.viewCount}`);
        log.info(`   Created: ${article.createdAt}`);
        log.info('');
      });
    } catch (error) {
      log.error('❌ Error:', error);
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
        log.error('❌ Error: Either --content-file or --content-text is required');
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

      log.info('\n✅ Article created successfully!');
      log.info(`   ID: ${article.id}`);
      log.info(`   Title: ${article.title}`);
      log.info(`   Slug: ${article.slug}`);
      log.info(`   Status: ${article.status}`);
      log.info('');
    } catch (error) {
      log.error('❌ Error:', error);
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

      log.info('\n✅ Article updated successfully!');
      log.info(`   ID: ${article.id}`);
      log.info(`   Title: ${article.title}`);
      log.info(`   Status: ${article.status}`);
      log.info(`   Version: ${article.version}`);
      log.info('');
    } catch (error) {
      log.error('❌ Error:', error);
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
          log.info('Cancelled.');
          process.exit(0);
        }
      }

      await db
        .delete(knowledgeArticles)
        .where(
          and(eq(knowledgeArticles.id, options.id), eq(knowledgeArticles.tenantId, options.tenant)),
        );

      log.info('\n✅ Article deleted successfully!');
    } catch (error) {
      log.error('❌ Error:', error);
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
            eq(knowledgeArticles.tenantId, options.tenant),
            eq(knowledgeArticles.categoryId, options.category),
            eq(knowledgeArticles.status, 'draft'),
          ),
        });
        articleIds = drafts.map((a) => a.id);
      } else if (options.all) {
        const drafts = await db.query.knowledgeArticles.findMany({
          where: and(
            eq(knowledgeArticles.tenantId, options.tenant),
            eq(knowledgeArticles.status, 'draft'),
          ),
        });
        articleIds = drafts.map((a) => a.id);
      } else {
        log.error('❌ Error: Specify --id, --category, or --all');
        process.exit(1);
      }

      log.info(`\nPublishing ${articleIds.length} article(s)...`);

      for (const id of articleIds) {
        await KnowledgeBaseService.updateArticle(id, options.tenant, options.user, {
          status: 'published',
        });
      }

      log.info(`✅ Published ${articleIds.length} article(s) successfully!`);
    } catch (error) {
      log.error('❌ Error:', error);
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
      log.info('\n🤖 Generating article with AI...\n');

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

      log.info('✅ Article generation queued!');
      log.info(`   Queue ID: ${result.queueId}`);
      log.info(`   ${result.message}`);
      log.info('');
    } catch (error) {
      log.error('❌ Error:', error);
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
        log.error(`❌ Error: File not found: ${filePath}`);
        process.exit(1);
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      let data;

      if (options.format === 'json') {
        data = JSON.parse(fileContent);
      } else {
        log.error('❌ Error: CSV and Markdown import not yet implemented');
        process.exit(1);
      }

      log.info('\n📥 Importing articles...\n');

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
          log.info(`✅ Imported: ${articleData.title}`);
        } catch (error: any) {
          failed++;
          log.error(`❌ Failed: ${articleData.title} - ${error.message}`);
        }
      }

      log.info(`\n📊 Import complete:`);
      log.info(`   Imported: ${imported}`);
      log.info(`   Failed: ${failed}`);
      log.info('');
    } catch (error) {
      log.error('❌ Error:', error);
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
      log.info('\n📤 Exporting articles...\n');

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
          a.createdAt,
          a.viewCount,
        ]);

        const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

        fs.writeFileSync(outputPath, csv, 'utf-8');
      }

      log.info(`✅ Exported ${result.articles.length} articles to ${outputPath}`);
      log.info('');
    } catch (error) {
      log.error('❌ Error:', error);
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

      log.info('\n📊 Knowledge Base Statistics\n');
      log.info(`Total Articles: ${analytics.totalArticles}`);
      log.info(`Published: ${analytics.publishedArticles}`);
      log.info(`Total Views: ${analytics.totalViews}`);
      log.info(`AI Generated: ${analytics.aiGeneratedCount}`);
      log.info(`AI Success Rate: ${(analytics.aiGenerationSuccessRate * 100).toFixed(1)}%`);
      log.info(`Average Rating: ${analytics.averageRating.toFixed(1)}/5.0`);
      log.info('');

      log.info('Top Articles:');
      analytics.topArticles.forEach((article, index) => {
        log.info(`  ${index + 1}. ${article.title} (${article.views} views)`);
      });
      log.info('');

      log.info('Popular Categories:');
      analytics.popularCategories.forEach((category, index) => {
        log.info(`  ${index + 1}. ${category.name} (${category.articleCount} articles)`);
      });
      log.info('');

      log.info('Content Gaps:');
      analytics.contentGaps.forEach((gap, index) => {
        log.info(`  ${index + 1}. ${gap}`);
      });
      log.info('');
    } catch (error) {
      log.error('❌ Error:', error);
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
            eq(articleFeedback.tenantId, options.tenant),
            eq(articleFeedback.resolved, false),
          ),
          limit: 50,
        });

        log.info(`\n💬 Pending Feedback (${feedback.length})\n`);

        for (const fb of feedback) {
          const article = await db.query.knowledgeArticles.findFirst({
            where: eq(knowledgeArticles.id, fb.articleId),
          });

          log.info(`ID: ${fb.id}`);
          log.info(`Article: ${article?.title || 'Unknown'}`);
          log.info(`Type: ${fb.feedbackType}`);
          log.info(`Rating: ${fb.rating || 'N/A'}`);
          log.info(`Comment: ${fb.comment || 'N/A'}`);
          log.info(`Created: ${fb.createdAt}`);
          log.info('---');
        }
      } else if (options.resolve) {
        if (!options.user) {
          log.error('❌ Error: --user is required when resolving feedback');
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
              eq(articleFeedback.tenantId, options.tenant),
            ),
          );

        log.info('\n✅ Feedback resolved successfully!');
      }
    } catch (error) {
      log.error('❌ Error:', error);
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

      log.info(`\n🔍 Search Results for "${options.query}"\n`);
      log.info(`Found ${result.total} articles in ${result.searchTime}ms:\n`);

      result.articles.forEach((article, index) => {
        log.info(`${index + 1}. ${article.title}`);
        log.info(`   ID: ${article.id}`);
        log.info(`   Status: ${article.status}`);
        log.info(`   Views: ${article.viewCount}`);
        log.info(`   Excerpt: ${article.excerpt?.substring(0, 100)}...`);
        log.info('');
      });
    } catch (error) {
      log.error('❌ Error:', error);
      process.exit(1);
    }
  });

program.parse();
