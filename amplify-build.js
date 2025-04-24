#!/usr/bin/env node

/**
 * This script helps prepare the application for AWS Amplify deployment.
 * It creates a proper package.json for the deployment and copies necessary files.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Read the original package.json
const packageJson = require('./package.json');

// Create a simplified package.json for deployment
const deployPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  type: packageJson.type,
  license: packageJson.license,
  scripts: {
    start: packageJson.scripts.start
  },
  dependencies: packageJson.dependencies
};

// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Write the simplified package.json to the dist directory
fs.writeFileSync(
  path.join('dist', 'package.json'),
  JSON.stringify(deployPackageJson, null, 2)
);

console.log('✅ Created simplified package.json for deployment');

// Create a Procfile for AWS
fs.writeFileSync(
  path.join('dist', 'Procfile'),
  'web: npm start'
);

console.log('✅ Created Procfile');

// Create an .npmrc file to ensure proper npm behavior
fs.writeFileSync(
  path.join('dist', '.npmrc'),
  'unsafe-perm=true\n'
);

console.log('✅ Created .npmrc');

// Copy any environment files that might be needed
try {
  if (fs.existsSync('.env')) {
    fs.copyFileSync('.env', path.join('dist', '.env'));
    console.log('✅ Copied .env file');
  }
} catch (error) {
  console.warn('⚠️ No .env file found to copy');
}

console.log('✅ Build preparation complete'); 