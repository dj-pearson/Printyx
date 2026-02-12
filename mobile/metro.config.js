const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const sharedRoot = path.resolve(projectRoot, '../shared');

const config = getDefaultConfig(projectRoot);

// Allow Metro to resolve files from the shared directory
config.watchFolders = [sharedRoot];

// Ensure Metro can resolve modules from the shared directory
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(projectRoot, '..', 'node_modules'),
];

// Tell Metro to use the shared directory for @shared imports
config.resolver.extraNodeModules = {
  '@shared': sharedRoot,
};

module.exports = config;
