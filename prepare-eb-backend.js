#!/usr/bin/env node

/**
 * This script prepares the backend for Elastic Beanstalk deployment
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Get current file directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create EB deployment directory
const EB_DIR = 'eb-backend';
if (fs.existsSync(EB_DIR)) {
  console.log(`Cleaning existing ${EB_DIR} directory...`);
  execSync(`rm -rf ${EB_DIR}`);
}

console.log(`Creating ${EB_DIR} directory...`);
fs.mkdirSync(EB_DIR, { recursive: true });

// Copy server files
console.log('Copying server files...');
execSync(`cp -r server ${EB_DIR}/`);

// Copy shared files if needed by the backend
if (fs.existsSync('shared')) {
  console.log('Copying shared files...');
  execSync(`cp -r shared ${EB_DIR}/`);
}

// Copy EB extensions
console.log('Copying EB extensions...');
if (fs.existsSync('.ebextensions')) {
  execSync(`cp -r .ebextensions ${EB_DIR}/`);
}

// Copy database migration scripts if needed
if (fs.existsSync('migrations')) {
  console.log('Copying migration files...');
  execSync(`cp -r migrations ${EB_DIR}/`);
}

// Copy drizzle config
if (fs.existsSync('drizzle.config.ts')) {
  console.log('Copying drizzle config...');
  execSync(`cp drizzle.config.ts ${EB_DIR}/`);
}

// Read the original package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

// Create a backend-focused package.json
const backendPackageJson = {
  name: `${packageJson.name}-backend`,
  version: packageJson.version,
  type: packageJson.type,
  license: packageJson.license,
  scripts: {
    build: "esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    start: "NODE_ENV=production node dist/index.js",
    "db:push": "drizzle-kit push",
    "db:migrate": packageJson.scripts["db:migrate"]
  },
  dependencies: {
    // Backend specific dependencies
    "@neondatabase/serverless": packageJson.dependencies["@neondatabase/serverless"],
    "connect-pg-simple": packageJson.dependencies["connect-pg-simple"],
    "dotenv": packageJson.dependencies["dotenv"],
    "drizzle-orm": packageJson.dependencies["drizzle-orm"],
    "drizzle-zod": packageJson.dependencies["drizzle-zod"],
    "express": packageJson.dependencies["express"],
    "express-fileupload": packageJson.dependencies["express-fileupload"],
    "express-session": packageJson.dependencies["express-session"],
    "memorystore": packageJson.dependencies["memorystore"],
    "passport": packageJson.dependencies["passport"],
    "passport-local": packageJson.dependencies["passport-local"],
    "pg": packageJson.dependencies["pg"],
    "ws": packageJson.dependencies["ws"],
    "zod": packageJson.dependencies["zod"],
    "zod-validation-error": packageJson.dependencies["zod-validation-error"]
  },
  devDependencies: {
    "@types/connect-pg-simple": packageJson.devDependencies["@types/connect-pg-simple"],
    "@types/express": packageJson.devDependencies["@types/express"],
    "@types/express-fileupload": packageJson.devDependencies["@types/express-fileupload"],
    "@types/express-session": packageJson.devDependencies["@types/express-session"],
    "@types/node": packageJson.devDependencies["@types/node"],
    "@types/passport": packageJson.devDependencies["@types/passport"],
    "@types/passport-local": packageJson.devDependencies["@types/passport-local"],
    "@types/pg": packageJson.devDependencies["@types/pg"],
    "@types/ws": packageJson.devDependencies["@types/ws"],
    "drizzle-kit": packageJson.devDependencies["drizzle-kit"],
    "esbuild": packageJson.devDependencies["esbuild"],
    "tsx": packageJson.devDependencies["tsx"],
    "typescript": packageJson.devDependencies["typescript"]
  }
};

// Write the backend package.json
fs.writeFileSync(
  path.join(EB_DIR, 'package.json'),
  JSON.stringify(backendPackageJson, null, 2)
);
console.log('✅ Created backend-focused package.json');

// Create a Procfile for Elastic Beanstalk
fs.writeFileSync(
  path.join(EB_DIR, 'Procfile'),
  'web: npm start'
);
console.log('✅ Created Procfile');

// Create a tsconfig.json file
const tsConfig = {
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "outDir": "./dist",
    "strict": true
  },
  "include": ["server/**/*", "shared/**/*"],
  "exclude": ["node_modules"]
};

fs.writeFileSync(
  path.join(EB_DIR, 'tsconfig.json'),
  JSON.stringify(tsConfig, null, 2)
);
console.log('✅ Created tsconfig.json');

// Create .npmrc
fs.writeFileSync(
  path.join(EB_DIR, '.npmrc'),
  'engine-strict=true\nsave-exact=true\nunsafe-perm=true\n'
);
console.log('✅ Created .npmrc');

// Create .gitignore
fs.writeFileSync(
  path.join(EB_DIR, '.gitignore'),
  'node_modules/\ndist/\n.env\n*.log\n'
);
console.log('✅ Created .gitignore');

// Create .ebignore
fs.writeFileSync(
  path.join(EB_DIR, '.ebignore'),
  'node_modules/\n.git/\n*.log\n'
);
console.log('✅ Created .ebignore');

// Create a sample .env.example file for EB
fs.writeFileSync(
  path.join(EB_DIR, '.env.example'),
  '# Database\nDATABASE_URL=postgres://username:password@host:port/database\n\n# Session\nSESSION_SECRET=your-session-secret-key\n\n# CORS\nCORS_ORIGIN=https://your-amplify-app.amplifyapp.com\n'
);
console.log('✅ Created .env.example');

console.log('\n🎉 Backend preparation complete!');
console.log(`\nYour Elastic Beanstalk package is ready in the "${EB_DIR}" directory.`);
console.log('\nNext steps:');
console.log('1. cd ' + EB_DIR);
console.log('2. npm install');
console.log('3. eb init (follow the prompts)');
console.log('4. eb create production-env');
console.log('5. Set environment variables using:');
console.log('   eb setenv DATABASE_URL=xxx SESSION_SECRET=xxx CORS_ORIGIN=xxx'); 