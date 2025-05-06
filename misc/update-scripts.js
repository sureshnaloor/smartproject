#!/usr/bin/env node

/**
 * This script updates package.json with build scripts for separate 
 * frontend and backend deployments
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the original package.json
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Add new scripts for separate builds
packageJson.scripts = {
  ...packageJson.scripts,
  "build:client": "vite build --outDir dist/client",
  "build:server": "esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
  "prepare:eb": "node prepare-eb-backend.js",
  "deploy:amplify": "npm run build:client",
  "deploy:eb": "npm run prepare:eb"
};

// Write the updated package.json
fs.writeFileSync(
  packageJsonPath,
  JSON.stringify(packageJson, null, 2)
);

console.log('✅ Updated package.json with new build scripts');
console.log('\nNew scripts added:');
console.log('- build:client: Builds only the frontend');
console.log('- build:server: Builds only the backend');
console.log('- prepare:eb: Prepares backend for Elastic Beanstalk');
console.log('- deploy:amplify: Prepares frontend for Amplify');
console.log('- deploy:eb: Shortcut for prepare:eb');
console.log('\nTo deploy your app:');
console.log('1. Frontend: Run npm run deploy:amplify');
console.log('2. Backend: Run npm run deploy:eb'); 