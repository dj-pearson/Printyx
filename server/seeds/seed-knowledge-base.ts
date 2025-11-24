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
  knowledgeBaseCategories,
  knowledgeBaseArticles,
  articleVersions,
} from '../../shared/knowledge-base-schema';
import { knowledgeBaseCategories as categorySeedData } from './knowledge-base-categories';
import { gettingStartedArticles } from './articles/getting-started';
import { crmSalesArticles } from './articles/crm-sales';

async function seedCategories() {
  console.log('🌱 Seeding knowledge base categories...');

  const insertedCategories = [];

  for (const category of categorySeedData) {
    try {
      const [inserted] = await db
        .insert(knowledgeBaseCategories)
        .values({
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          displayOrder: category.displayOrder,
          isVisible: category.isVisible,
          articleCategory: category.articleCategory,
          metadata: category.metadata,
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

  const allArticles = [...gettingStartedArticles, ...crmSalesArticles];

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
      const [inserted] = await db
        .insert(knowledgeBaseArticles)
        .values({
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt,
          content: article.content,
          htmlContent: article.htmlContent,
          categoryId: categoryId,
          contentType: article.contentType,
          difficultyLevel: article.difficultyLevel,
          estimatedReadingTime: article.estimatedReadingTime,
          keywords: article.keywords,
          tags: article.tags,
          relatedArticleSlugs: article.relatedArticleSlugs || [],
          featured: article.featured || false,
          isPublic: article.isPublic !== false, // Default to true
          allowFeedback: article.allowFeedback !== false, // Default to true
          metaTitle: article.metaTitle || article.title,
          metaDescription: article.metaDescription || article.excerpt,
          status: article.status || 'published',
          publishedAt: article.status === 'published' ? new Date() : null,
        })
        .returning();

      // Create initial version
      await db.insert(articleVersions).values({
        articleId: inserted.id,
        title: article.title,
        content: article.content,
        htmlContent: article.htmlContent,
        excerpt: article.excerpt,
        changeDescription: 'Initial version',
        versionNumber: 1,
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
    const existingCategories = await db.select().from(knowledgeBaseCategories);
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
