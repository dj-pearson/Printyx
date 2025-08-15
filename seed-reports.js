const { seedReportDefinitions } = require('./server/routes-reporting-definitions.ts');

async function main() {
  try {
    // Use the default tenant ID from the environment
    const tenantId = '550e8400-e29b-41d4-a716-446655440000';
    console.log('🌱 Starting report definitions seeding...');
    await seedReportDefinitions(tenantId);
    console.log('✅ Report definitions seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding reports:', error);
    process.exit(1);
  }
}

main();