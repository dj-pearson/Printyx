// Quick script to normalize categories in existing products
const { drizzle } = require('drizzle-orm/node-postgres');
const { Client } = require('pg');
const { masterProductModels } = require('./shared/schema.ts');
const { eq, sql } = require('drizzle-orm');

const normalizeCategoryName = (category) => {
  if (!category) return category;
  
  const categoryLower = category.toLowerCase().trim();
  
  // Consolidate similar categories
  if (categoryLower.includes('mfp') || categoryLower.includes('multifunction')) {
    return 'Multifunction';
  }
  
  if (categoryLower.includes('accessory') || categoryLower.includes('hardware accessory') || 
      categoryLower.includes('paper feeding') || categoryLower.includes('document feeding')) {
    return 'Accessory';
  }
  
  // Capitalize first letter for consistency
  return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
};

async function normalizeCategories() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  const db = drizzle(client);
  
  try {
    // Get all products with categories
    const products = await db.select().from(masterProductModels).where(sql`category IS NOT NULL`);
    
    let updated = 0;
    for (const product of products) {
      const normalizedCategory = normalizeCategoryName(product.category);
      if (normalizedCategory !== product.category) {
        await db.update(masterProductModels)
          .set({ 
            category: normalizedCategory,
            productType: normalizedCategory === 'Accessory' ? 'accessory' : 'model',
            updatedAt: new Date()
          })
          .where(eq(masterProductModels.id, product.id));
        console.log(`Updated "${product.category}" → "${normalizedCategory}" for ${product.modelCode}`);
        updated++;
      }
    }
    
    console.log(`\nNormalized ${updated} product categories`);
    
  } catch (error) {
    console.error('Error normalizing categories:', error);
  } finally {
    await client.end();
  }
}

normalizeCategories().catch(console.error);