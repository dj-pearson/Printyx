import { db } from './db';
import { supplies, inventoryItems, serviceContracts, customerPortalAccess } from '@shared/schema';
import { sql } from 'drizzle-orm';

const DEFAULT_TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

interface TonerProduct {
  productCode: string;
  productName: string;
  manufacturer: string;
  model: string;
  color: string;
  price: string;
  manufacturerPartNumber: string;
  stock: {
    onHand: number;
    committed: number;
    available: number;
    onOrder: number;
  };
}

const tonerProducts: TonerProduct[] = [
  // HP Toners
  {
    productCode: 'TONER-BLACK-HP-P4015',
    productName: 'HP LaserJet P4015 Black Toner',
    manufacturer: 'HP',
    model: 'P4015',
    color: 'BLACK',
    price: '89.99',
    manufacturerPartNumber: 'CC364X',
    stock: { onHand: 50, committed: 10, available: 40, onOrder: 100 },
  },
  {
    productCode: 'TONER-BLACK-HP-M604',
    productName: 'HP LaserJet M604 Black Toner',
    manufacturer: 'HP',
    model: 'M604',
    color: 'BLACK',
    price: '125.99',
    manufacturerPartNumber: 'CF281X',
    stock: { onHand: 35, committed: 5, available: 30, onOrder: 50 },
  },
  {
    productCode: 'TONER-BLACK-HP-M806',
    productName: 'HP LaserJet M806 Black Toner',
    manufacturer: 'HP',
    model: 'M806',
    color: 'BLACK',
    price: '189.99',
    manufacturerPartNumber: 'CF325X',
    stock: { onHand: 20, committed: 3, available: 17, onOrder: 40 },
  },
  // Canon Toners
  {
    productCode: 'TONER-BLACK-CANON-IR5075',
    productName: 'Canon imageRUNNER 5075 Black Toner',
    manufacturer: 'Canon',
    model: 'IR5075',
    color: 'BLACK',
    price: '149.99',
    manufacturerPartNumber: 'C-EXV28',
    stock: { onHand: 25, committed: 8, available: 17, onOrder: 60 },
  },
  {
    productCode: 'TONER-CYAN-CANON-IR5075',
    productName: 'Canon imageRUNNER 5075 Cyan Toner',
    manufacturer: 'Canon',
    model: 'IR5075',
    color: 'CYAN',
    price: '129.99',
    manufacturerPartNumber: 'C-EXV28-C',
    stock: { onHand: 18, committed: 4, available: 14, onOrder: 40 },
  },
  {
    productCode: 'TONER-MAGENTA-CANON-IR5075',
    productName: 'Canon imageRUNNER 5075 Magenta Toner',
    manufacturer: 'Canon',
    model: 'IR5075',
    color: 'MAGENTA',
    price: '129.99',
    manufacturerPartNumber: 'C-EXV28-M',
    stock: { onHand: 15, committed: 3, available: 12, onOrder: 40 },
  },
  {
    productCode: 'TONER-YELLOW-CANON-IR5075',
    productName: 'Canon imageRUNNER 5075 Yellow Toner',
    manufacturer: 'Canon',
    model: 'IR5075',
    color: 'YELLOW',
    price: '129.99',
    manufacturerPartNumber: 'C-EXV28-Y',
    stock: { onHand: 20, committed: 5, available: 15, onOrder: 40 },
  },
  // Xerox Toners
  {
    productCode: 'TONER-BLACK-XEROX-C70',
    productName: 'Xerox Color C70 Black Toner',
    manufacturer: 'Xerox',
    model: 'C70',
    color: 'BLACK',
    price: '169.99',
    manufacturerPartNumber: '006R01658',
    stock: { onHand: 28, committed: 6, available: 22, onOrder: 50 },
  },
  {
    productCode: 'TONER-CYAN-XEROX-C70',
    productName: 'Xerox Color C70 Cyan Toner',
    manufacturer: 'Xerox',
    model: 'C70',
    color: 'CYAN',
    price: '159.99',
    manufacturerPartNumber: '006R01660',
    stock: { onHand: 22, committed: 4, available: 18, onOrder: 45 },
  },
  {
    productCode: 'TONER-MAGENTA-XEROX-C70',
    productName: 'Xerox Color C70 Magenta Toner',
    manufacturer: 'Xerox',
    model: 'C70',
    color: 'MAGENTA',
    price: '159.99',
    manufacturerPartNumber: '006R01659',
    stock: { onHand: 19, committed: 3, available: 16, onOrder: 45 },
  },
  {
    productCode: 'TONER-YELLOW-XEROX-C70',
    productName: 'Xerox Color C70 Yellow Toner',
    manufacturer: 'Xerox',
    model: 'C70',
    color: 'YELLOW',
    price: '159.99',
    manufacturerPartNumber: '006R01661',
    stock: { onHand: 24, committed: 5, available: 19, onOrder: 45 },
  },
  // Ricoh Toners
  {
    productCode: 'TONER-BLACK-RICOH-MP6503',
    productName: 'Ricoh MP 6503 Black Toner',
    manufacturer: 'Ricoh',
    model: 'MP6503',
    color: 'BLACK',
    price: '139.99',
    manufacturerPartNumber: '841853',
    stock: { onHand: 30, committed: 7, available: 23, onOrder: 55 },
  },
  {
    productCode: 'TONER-CYAN-RICOH-MP6503',
    productName: 'Ricoh MP 6503 Cyan Toner',
    manufacturer: 'Ricoh',
    model: 'MP6503',
    color: 'CYAN',
    price: '119.99',
    manufacturerPartNumber: '841854',
    stock: { onHand: 16, committed: 2, available: 14, onOrder: 35 },
  },
  {
    productCode: 'TONER-MAGENTA-RICOH-MP6503',
    productName: 'Ricoh MP 6503 Magenta Toner',
    manufacturer: 'Ricoh',
    model: 'MP6503',
    color: 'MAGENTA',
    price: '119.99',
    manufacturerPartNumber: '841855',
    stock: { onHand: 14, committed: 3, available: 11, onOrder: 35 },
  },
  {
    productCode: 'TONER-YELLOW-RICOH-MP6503',
    productName: 'Ricoh MP 6503 Yellow Toner',
    manufacturer: 'Ricoh',
    model: 'MP6503',
    color: 'YELLOW',
    price: '119.99',
    manufacturerPartNumber: '841856',
    stock: { onHand: 17, committed: 4, available: 13, onOrder: 35 },
  },
];

export async function seedTonerWorkflow() {
  console.log('🌱 Starting toner workflow seed...\n');

  try {
    // Step 1: Insert toner products into supplies table
    console.log('📦 Step 1: Inserting toner products into supplies table...');

    for (const product of tonerProducts) {
      // Check if product already exists
      const existing = await db
        .select()
        .from(supplies)
        .where(
          sql`${supplies.productCode} = ${product.productCode} AND ${supplies.tenantId} = ${DEFAULT_TENANT_ID}`,
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`   ⏭️  Skipping ${product.productCode} (already exists)`);
        continue;
      }

      await db.insert(supplies).values({
        tenantId: DEFAULT_TENANT_ID,
        productCode: product.productCode,
        productName: product.productName,
        productType: 'Supplies',
        summary: `${product.color} toner cartridge for ${product.manufacturer} ${product.model} series printers`,
        newRepPrice: product.price,
        newActive: true,
        isActive: true,
        inStock: 'true',
        availableForAll: true,
      });

      console.log(`   ✅ Added ${product.productCode}: ${product.productName}`);
    }

    // Step 2: Create matching inventory records
    console.log('\n📊 Step 2: Creating inventory records for toner products...');

    for (const product of tonerProducts) {
      // Check if inventory already exists
      const existing = await db
        .select()
        .from(inventoryItems)
        .where(
          sql`${inventoryItems.partNumber} = ${product.productCode} AND ${inventoryItems.tenantId} = ${DEFAULT_TENANT_ID}`,
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`   ⏭️  Skipping inventory for ${product.productCode} (already exists)`);
        continue;
      }

      await db.insert(inventoryItems).values({
        tenantId: DEFAULT_TENANT_ID,
        name: product.productName, // Required field
        category: 'Toner', // Required field
        partNumber: product.productCode,
        manufacturerPartNumber: product.manufacturerPartNumber,
        itemDescription: product.productName,
        itemCategory: 'Toner',
        manufacturer: product.manufacturer,
        quantityOnHand: product.stock.onHand,
        quantityCommitted: product.stock.committed,
        quantityAvailable: product.stock.available,
        quantityOnOrder: product.stock.onOrder,
        reorderPoint: 10,
        reorderQuantity: 25,
        unitCost: (parseFloat(product.price) * 0.6).toFixed(2), // 60% of retail
        unitPrice: product.price,
        retailPrice: product.price,
        warehouseLocation: 'WAREHOUSE-A',
        binLocation: `AISLE-${Math.floor(Math.random() * 20) + 1}-BIN-${Math.floor(Math.random() * 10) + 1}`,
        primaryVendor: product.manufacturer,
        vendorPartNumber: product.manufacturerPartNumber,
        unitOfMeasure: 'EA',
        isActive: true,
        isTaxable: true,
        isSerialized: false,
      });

      console.log(
        `   ✅ Created inventory for ${product.productCode} (${product.stock.available} available)`,
      );
    }

    // Step 3: Verify customer portal users have contact info
    console.log('\n👤 Step 3: Verifying customer portal access has contact info...');

    const portalUsers = await db
      .select()
      .from(customerPortalAccess)
      .where(sql`${customerPortalAccess.tenantId} = ${DEFAULT_TENANT_ID}`)
      .limit(5);

    if (portalUsers.length === 0) {
      console.log('   ⚠️  No customer portal users found. Skipping contact info verification.');
      console.log('   💡 Create customer portal users first, then run this seed again.');
    } else {
      for (const user of portalUsers) {
        const needsUpdate = !user.email || !user.phone;

        if (needsUpdate) {
          await db
            .update(customerPortalAccess)
            .set({
              email: user.email || `customer${user.id.substring(0, 8)}@example.com`,
              phone:
                user.phone ||
                `+1555${Math.floor(Math.random() * 10000000)
                  .toString()
                  .padStart(7, '0')}`,
            })
            .where(sql`${customerPortalAccess.id} = ${user.id}`);

          console.log(`   ✅ Updated contact info for user ${user.username}`);
        } else {
          console.log(`   ✓  User ${user.username} already has email and phone`);
        }
      }
    }

    // Step 4: Display service contract guidance
    console.log('\n📋 Step 4: Service Contract Setup Guidance');
    console.log('   ℹ️  To enable automatic toner coverage ($0.00 for customer):');
    console.log('   1. Link service contracts to equipment via equipment_id');
    console.log('   2. Set includes_toner = true for contracts with toner coverage');
    console.log('   3. Ensure start_date <= NOW() and end_date > NOW()');
    console.log("   4. Set contract_status = 'active'");
    console.log('');
    console.log('   Example SQL to create a toner-covered contract:');
    console.log(`
    INSERT INTO service_contracts (
      tenant_id, contract_number, customer_id, equipment_id,
      contract_type, contract_status, start_date, end_date,
      includes_toner, includes_parts, includes_labor,
      monthly_base_rate, auto_renewal
    ) VALUES (
      '${DEFAULT_TENANT_ID}',
      'SVC-2025-001',
      'your-customer-id',
      'your-equipment-id',
      'full-service',
      'active',
      NOW(),
      NOW() + INTERVAL '1 year',
      true,  -- Toner IS covered
      true,
      true,
      299.99,
      true
    );
    `);

    console.log('\n✅ Toner workflow seed completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - ${tonerProducts.length} toner products added to supplies table`);
    console.log(`   - ${tonerProducts.length} inventory records created`);
    console.log(`   - ${portalUsers.length} customer portal users verified`);
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('   1. Create service contracts for your equipment (see guidance above)');
    console.log('   2. Test fleet monitoring → order toner flow');
    console.log('   3. Configure email/SMS notification services (optional)');
  } catch (error) {
    console.error('\n❌ Error seeding toner workflow:', error);
    throw error;
  }
}

// Run if executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedTonerWorkflow()
    .then(() => {
      console.log('\n✅ Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Seed script failed:', error);
      process.exit(1);
    });
}
