import { initializeRoleHierarchy } from "./role-seeder";

// Run the role initialization
initializeRoleHierarchy()
  .then(() => {
    console.log("Role hierarchy setup completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error setting up role hierarchy:", error);
    process.exit(1);
  });