import { setupDemoAuth } from './auth-setup';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('setup-demo-data');

async function main() {
  try {
    log.info('🚀 Setting up demo data...');
    await setupDemoAuth();
    log.info('✅ Demo data setup complete!');
    process.exit(0);
  } catch (error) {
    log.error('❌ Error setting up demo data:', error);
    process.exit(1);
  }
}

main();
