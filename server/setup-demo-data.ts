import { setupDemoAuth } from './auth-setup';

async function main() {
  try {
    console.log('🚀 Setting up demo data...');
    await setupDemoAuth();
    console.log('✅ Demo data setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up demo data:', error);
    process.exit(1);
  }
}

main();
