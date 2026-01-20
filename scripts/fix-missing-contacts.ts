#!/usr/bin/env tsx
/**
 * Fix Missing Company Contacts
 *
 * Finds all companies without contacts and creates a default primary contact.
 * This is needed because the Customers page uses INNER JOIN with company_contacts.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://api.printyx.net';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function fixMissingContacts() {
  console.log('🔍 Finding companies without contacts...\n');

  try {
    // Find all companies that have a customer relationship
    const { data: companiesWithCustomers, error: companiesError } = await supabase.from('companies')
      .select(`
        id,
        business_name,
        tenant_id,
        phone,
        created_by,
        customers!inner(id)
      `);

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    if (!companiesWithCustomers || companiesWithCustomers.length === 0) {
      console.log('✅ No companies with customer relationships found.\n');
      return;
    }

    console.log(
      `📊 Found ${companiesWithCustomers.length} companies with customer relationships\n`,
    );

    // Check which ones don't have contacts
    const companiesWithoutContacts = [];

    for (const company of companiesWithCustomers) {
      const { data: contacts, error: contactsError } = await supabase
        .from('company_contacts')
        .select('id')
        .eq('company_id', company.id)
        .limit(1);

      if (contactsError) {
        console.error(
          `  ⚠️  Error checking contacts for ${company.business_name}: ${contactsError.message}`,
        );
        continue;
      }

      if (!contacts || contacts.length === 0) {
        companiesWithoutContacts.push(company);
      }
    }

    if (companiesWithoutContacts.length === 0) {
      console.log('✅ All companies have contacts! Nothing to fix.\n');
      return;
    }

    console.log(`📊 Found ${companiesWithoutContacts.length} companies without contacts:\n`);

    companiesWithoutContacts.forEach((company) => {
      console.log(`  - ${company.business_name} (${company.id.slice(0, 8)}...)`);
    });

    console.log('\n🔧 Creating primary contacts...\n');

    let created = 0;
    let failed = 0;

    for (const company of companiesWithoutContacts) {
      try {
        const { error: insertError } = await supabase.from('company_contacts').insert({
          company_id: company.id,
          tenant_id: company.tenant_id,
          first_name: 'Primary',
          last_name: 'Contact',
          phone: company.phone || null,
          is_primary_contact: true,
          created_by: company.created_by || null,
        });

        if (insertError) {
          throw insertError;
        }

        console.log(`  ✅ ${company.business_name}`);
        created++;
      } catch (error: any) {
        console.error(`  ❌ ${company.business_name}: ${error.message || 'Unknown error'}`);
        failed++;
      }
    }

    console.log('\n📈 Results:');
    console.log(`  ✅ Created: ${created}`);
    if (failed > 0) {
      console.log(`  ❌ Failed: ${failed}`);
    }
    console.log('\n✨ Done! Your companies should now appear in the Customers page.\n');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

// Run the script
fixMissingContacts().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
