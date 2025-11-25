/**
 * Knowledge Base Seeder
 *
 * Seeds the knowledge base with initial categories and articles.
 * Run with: node -r tsx/register server/seeds/seed-knowledge-base.ts
 *
 * Environment: Requires DATABASE_URL to be set
 */

import { db } from '../db';
import {
  knowledgeCategories,
  knowledgeArticles,
  articleVersions,
} from '../../shared/knowledge-base-schema';
import { knowledgeBaseCategories as categorySeedData } from './knowledge-base-categories';
import { gettingStartedArticles } from './articles/getting-started';
import { crmSalesArticles } from './articles/crm-sales';
import { serviceManagementArticles } from './articles/service-management';
import { meterBillingArticles } from './articles/meter-billing';
import { troubleshootingArticles } from './articles/troubleshooting';

async function seedCategories() {
  console.log('🌱 Seeding knowledge base categories...');

  const insertedCategories = [];

  for (const category of categorySeedData) {
    try {
      const [inserted] = await db
        .insert(knowledgeCategories)
        .values({
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          categoryOrder: category.displayOrder || 0,
          isActive: category.isVisible !== false,
          tenantId: '00000000-0000-0000-0000-000000000000', // Default tenant for seed data
          createdBy: '00000000-0000-0000-0000-000000000000', // System user
        })
        .returning();

      insertedCategories.push(inserted);
      console.log(`  ✓ Created category: ${category.name}`);
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique constraint violation
        console.log(`  ⊙ Category already exists: ${category.name}`);
      } else {
        console.error(`  ✗ Error creating category ${category.name}:`, error.message);
      }
    }
  }

  console.log(
    `✅ Categories seeded: ${insertedCategories.length} new, ${categorySeedData.length} total\n`,
  );
  return insertedCategories;
}

async function seedArticles(categoryMap: Map<string, string>) {
  console.log('📝 Seeding knowledge base articles...');

  const allArticles = [
    ...gettingStartedArticles,
    ...crmSalesArticles,
    ...serviceManagementArticles,
    ...meterBillingArticles,
    ...troubleshootingArticles
  ];

  let insertedCount = 0;
  let skippedCount = 0;

  for (const article of allArticles) {
    try {
      const categoryId = categoryMap.get(article.categorySlug);
      if (!categoryId) {
        console.log(
          `  ⚠ Warning: Category not found for slug "${article.categorySlug}", skipping article: ${article.title}`,
        );
        skippedCount++;
        continue;
      }

      // Create the article
      const plainText = typeof article.content === 'object'
        ? JSON.stringify(article.content)
        : String(article.content);
      const wordCount = plainText.split(/\s+/).length;

      const [inserted] = await db
        .insert(knowledgeArticles)
        .values({
          tenantId: '00000000-0000-0000-0000-000000000000', // Default tenant
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
          content: article.content as any,
          plainTextContent: plainText,
          htmlContent: article.htmlContent,
          categoryId: categoryId,
          contentType: article.contentType as any,
          difficultyLevel: article.difficultyLevel as any,
          estimatedReadingTime: article.estimatedReadingTime,
          wordCount: wordCount,
          keywords: (article.keywords || []) as any,
          tags: (article.tags || []) as any,
          relatedArticles: (article.relatedArticleSlugs || []) as any,
          featured: article.featured || false,
          isPublic: article.isPublic !== false,
          allowFeedback: article.allowFeedback !== false,
          metaTitle: article.metaTitle || article.title,
          metaDescription: article.metaDescription || article.excerpt,
          status: (article.status || 'published') as any,
          publishedAt: article.status === 'published' ? new Date() : null,
          createdBy: '00000000-0000-0000-0000-000000000000', // System user
        })
        .returning();

      // Create initial version
      await db.insert(articleVersions).values({
        tenantId: '00000000-0000-0000-0000-000000000000',
        articleId: inserted.id,
        version: 1,
        title: article.title,
        content: article.content as any,
        plainTextContent: plainText,
        changeDescription: 'Initial version',
        changeType: 'major',
        createdBy: '00000000-0000-0000-0000-000000000000',
      });

      insertedCount++;
      console.log(`  ✓ Created article: ${article.title} (${article.categorySlug})`);
    } catch (error: any) {
      if (error.code === '23505') {
        // Unique constraint violation
        console.log(`  ⊙ Article already exists: ${article.title}`);
        skippedCount++;
      } else {
        console.error(`  ✗ Error creating article "${article.title}":`, error.message);
        skippedCount++;
      }
    }
  }

  console.log(
    `✅ Articles seeded: ${insertedCount} new, ${skippedCount} skipped, ${allArticles.length} total\n`,
  );
}

async function main() {
  console.log('\n🚀 Starting Knowledge Base Seeder\n');
  console.log('═'.repeat(60));

  try {
    // Step 1: Seed categories
    const categories = await seedCategories();

    // Create a map of category slug to ID for article seeding
    const categoryMap = new Map<string, string>();
    const existingCategories = await db.select().from(knowledgeCategories);
    existingCategories.forEach((cat) => {
      categoryMap.set(cat.slug, cat.id);
    });

    console.log(`📋 Category map created with ${categoryMap.size} categories\n`);

    // Step 2: Seed articles
    await seedArticles(categoryMap);

    console.log('═'.repeat(60));
    console.log('✨ Knowledge Base seeding complete!\n');
    console.log('Next steps:');
    console.log('1. Visit /admin/knowledge-base to manage articles');
    console.log('2. Visit /knowledge-base to view the public knowledge base');
    console.log('3. Continue adding more articles as needed\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the seeder
if (require.main === module) {
  main();
}

export { seedCategories, seedArticles };
