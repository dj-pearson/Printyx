import { initializeRoleHierarchy } from './role-seeder';
import { createModuleLogger } from './lib/logger';
const log = createModuleLogger('initialize-roles');

// Run the role initialization
initializeRoleHierarchy()
  .then(() => {
    log.info('Role hierarchy setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    log.error('Error setting up role hierarchy:', error);
    process.exit(1);
  });
