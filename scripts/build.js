#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const CONFIG_FILE = path.join(ROOT_DIR, 'build.config.js');

// Parse command line arguments
const cleanFlag = process.argv.includes('--clean') || process.argv.includes('-c');
const profileIndex = process.argv.findIndex(arg => arg === '--profile');
const profileName = profileIndex !== -1 && process.argv[profileIndex + 1] 
  ? process.argv[profileIndex + 1] 
  : 'default';

// Load build configuration
let buildConfig = {};
if (fs.existsSync(CONFIG_FILE)) {
  buildConfig = require(CONFIG_FILE);
}

// Default configuration
const defaultConfig = {
  server: {
    port: 8080,
    nodeEnv: 'production',
    corsOrigin: [],
    corsCredentials: false
  },
  admin: {
    apiUrl: 'http://localhost:8080',
    wsUrl: 'ws://localhost:8080'
  },
  client: {
    apiUrl: 'http://localhost:8080',
    wsUrl: 'ws://localhost:8080'
  }
};

// Load profile configuration if available
let profileConfig = defaultConfig;
if (buildConfig.profiles && buildConfig.profiles[profileName]) {
  profileConfig = buildConfig.profiles[profileName];
  console.log(`📦 Using build profile: ${profileName}\n`);
} else if (profileName !== 'default') {
  console.log(`⚠️  Profile '${profileName}' not found, using default configuration\n`);
}

// Use profile config if available, otherwise fall back to buildConfig (for backward compatibility)
const configToUse = profileConfig !== defaultConfig ? profileConfig : (buildConfig || {});

// Merge with defaults
const config = {
  server: { ...defaultConfig.server, ...(configToUse.server || {}) },
  admin: { ...defaultConfig.admin, ...(configToUse.admin || {}) },
  client: { ...defaultConfig.client, ...(configToUse.client || {}) }
};

console.log('🚀 Starting build process...\n');

// Clean dist directory if requested
if (cleanFlag && fs.existsSync(DIST_DIR)) {
  console.log('🧹 Cleaning dist directory...');
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
}

// Create dist directory structure
if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

const serverDistDir = path.join(DIST_DIR, 'server');
const adminDistDir = path.join(DIST_DIR, 'admin');
const clientDistDir = path.join(DIST_DIR, 'client');

[serverDistDir, adminDistDir, clientDistDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Build Server
console.log('\n📦 Building server...');
const serverDir = path.join(ROOT_DIR, 'server');
const serverConfigPath = path.join(serverDistDir, 'config.js');

// Copy server files
const serverFilesToCopy = [
  'server.js',
  'database.js',
  'dataLoader.js',
  'dbOperations.js',
  'websocketHandler.js',
  'package.json'
];

serverFilesToCopy.forEach(file => {
  const src = path.join(serverDir, file);
  const dest = path.join(serverDistDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`  ✓ Copied ${file}`);
  }
});

// Copy server directories
const serverDirsToCopy = ['routes', 'middleware', 'services', 'utils', 'data'];

serverDirsToCopy.forEach(dir => {
  const src = path.join(serverDir, dir);
  const dest = path.join(serverDistDir, dir);
  if (fs.existsSync(src)) {
    copyDirectory(src, dest);
    console.log(`  ✓ Copied directory ${dir}/`);
  }
});

// Generate server config.js with build-time overrides
const serverConfigTemplate = `require('dotenv').config();

module.exports = {
  port: process.env.PORT || ${config.server.port},
  nodeEnv: process.env.NODE_ENV || '${config.server.nodeEnv}',
  
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ${JSON.stringify(config.server.corsOrigin)},
    credentials: process.env.CORS_CREDENTIALS === 'true' || ${config.server.corsCredentials}
  },
  
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10
  },
  
  performance: {
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
    cacheTTL: parseInt(process.env.CACHE_TTL) || 300000,
    pagination: {
      defaultLimit: parseInt(process.env.PAGINATION_DEFAULT_LIMIT) || 50,
      maxLimit: parseInt(process.env.PAGINATION_MAX_LIMIT) || 1000
    }
  },
  
  bodySizeLimit: process.env.BODY_SIZE_LIMIT || '10mb'
};
`;

fs.writeFileSync(serverConfigPath, serverConfigTemplate);
console.log('  ✓ Generated config.js');

// Update server.js to use dist/admin path
const serverJsPath = path.join(serverDistDir, 'server.js');
if (fs.existsSync(serverJsPath)) {
  let serverJs = fs.readFileSync(serverJsPath, 'utf8');
  // Update admin app path to point to dist/admin/browser
  // Note: Angular build outputs to dist/media-player-admin-v2 which gets copied to dist/admin
  // So the final path is dist/admin/browser (not dist/admin/media-player-admin-v2/browser)
  serverJs = serverJs.replace(
    /path\.join\(__dirname, '\.\.\/admin-v2\/dist\/media-player-admin-v2\/browser'\)/g,
    "path.join(__dirname, '../admin/browser')"
  );
  // Also handle case where it was already updated to wrong path
  serverJs = serverJs.replace(
    /path\.join\(__dirname, '\.\.\/admin\/media-player-admin-v2\/browser'\)/g,
    "path.join(__dirname, '../admin/browser')"
  );
  fs.writeFileSync(serverJsPath, serverJs);
  console.log('  ✓ Updated server.js paths');
}

// Build Admin App
console.log('\n📦 Building admin app...');
const adminDir = path.join(ROOT_DIR, 'admin-v2');

// Generate admin environment files with build-time config
// Use config values if provided, otherwise use defaults
// Defaults: dev environment has auto-login enabled, prod has it disabled
const autoLoginUsername = config.admin.autoLoginUsername !== undefined ? config.admin.autoLoginUsername : '';
const autoLoginPassword = config.admin.autoLoginPassword !== undefined ? config.admin.autoLoginPassword : '';
const autoLoginLocationId = config.admin.autoLoginLocationId !== undefined ? config.admin.autoLoginLocationId : 0;
const autoLoginTimeout = config.admin.autoLoginTimeout !== undefined ? config.admin.autoLoginTimeout : 0;

// For dev environment, use different defaults if not specified
const devAutoLoginUsername = config.admin.autoLoginUsername !== undefined ? config.admin.autoLoginUsername : 'user';
const devAutoLoginPassword = config.admin.autoLoginPassword !== undefined ? config.admin.autoLoginPassword : 'user';
const devAutoLoginLocationId = config.admin.autoLoginLocationId !== undefined ? config.admin.autoLoginLocationId : 1;
const devAutoLoginTimeout = config.admin.autoLoginTimeout !== undefined ? config.admin.autoLoginTimeout : 10;

const adminEnvDev = `export const environment = {
  production: false,
  apiUrl: '${config.admin.apiUrl}',
  wsUrl: '${config.admin.wsUrl}',
  autoLoginUsername: '${devAutoLoginUsername}',
  autoLoginPassword: '${devAutoLoginPassword}',
  autoLoginLocationId: ${devAutoLoginLocationId},
  autoLoginTimeout: ${devAutoLoginTimeout}
};
`;

const adminEnvProd = `export const environment = {
  production: true,
  apiUrl: '${config.admin.apiUrl}',
  wsUrl: '${config.admin.wsUrl}',
  autoLoginUsername: '${autoLoginUsername}',
  autoLoginPassword: '${autoLoginPassword}',
  autoLoginLocationId: ${autoLoginLocationId},
  autoLoginTimeout: ${autoLoginTimeout}
};
`;

const adminEnvDevPath = path.join(adminDir, 'src/environments/environment.ts');
const adminEnvProdPath = path.join(adminDir, 'src/environments/environment.prod.ts');

// Backup original files if they don't have .backup extension
if (!fs.existsSync(adminEnvDevPath + '.backup')) {
  fs.copyFileSync(adminEnvDevPath, adminEnvDevPath + '.backup');
}
if (!fs.existsSync(adminEnvProdPath + '.backup')) {
  fs.copyFileSync(adminEnvProdPath, adminEnvProdPath + '.backup');
}

fs.writeFileSync(adminEnvDevPath, adminEnvDev);
fs.writeFileSync(adminEnvProdPath, adminEnvProd);
console.log('  ✓ Generated environment files');

// Build Angular admin app
try {
  execSync('npm run build', { cwd: adminDir, stdio: 'inherit' });
  console.log('  ✓ Angular build completed');
} catch (error) {
  console.error('  ✗ Angular build failed');
  process.exit(1);
}

// Copy admin build output
const adminBuildOutput = path.join(adminDir, 'dist/media-player-admin-v2');
if (fs.existsSync(adminBuildOutput)) {
  copyDirectory(adminBuildOutput, adminDistDir);
  console.log('  ✓ Copied admin build output');
}

// Restore original environment files
if (fs.existsSync(adminEnvDevPath + '.backup')) {
  fs.copyFileSync(adminEnvDevPath + '.backup', adminEnvDevPath);
  fs.unlinkSync(adminEnvDevPath + '.backup');
}
if (fs.existsSync(adminEnvProdPath + '.backup')) {
  fs.copyFileSync(adminEnvProdPath + '.backup', adminEnvProdPath);
  fs.unlinkSync(adminEnvProdPath + '.backup');
}

// Build Client App
console.log('\n📦 Building client app...');
const clientDir = path.join(ROOT_DIR, 'client');

// Generate client api.config.ts with build-time config
const clientAutoLoginLocationId = config.client.autoLoginLocationId !== undefined ? config.client.autoLoginLocationId : 0;
const clientApiConfig = `export const SERVER_BASE_URL = "${config.client.apiUrl}";
export const AUTO_LOGIN_LOCATION_ID = ${clientAutoLoginLocationId};
`;

const clientApiConfigPath = path.join(clientDir, 'src/app/api.config.ts');

// Backup original file
if (!fs.existsSync(clientApiConfigPath + '.backup')) {
  fs.copyFileSync(clientApiConfigPath, clientApiConfigPath + '.backup');
}

fs.writeFileSync(clientApiConfigPath, clientApiConfig);
console.log('  ✓ Generated api.config.ts');

// Build Angular client app
try {
  execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });
  console.log('  ✓ Angular build completed');
} catch (error) {
  console.error('  ✗ Angular build failed');
  process.exit(1);
}

// Copy client build output
const clientBuildOutput = path.join(clientDir, 'dist/media-player');
if (fs.existsSync(clientBuildOutput)) {
  copyDirectory(clientBuildOutput, clientDistDir);
  console.log('  ✓ Copied client build output');
}

// Restore original api.config.ts
if (fs.existsSync(clientApiConfigPath + '.backup')) {
  fs.copyFileSync(clientApiConfigPath + '.backup', clientApiConfigPath);
  fs.unlinkSync(clientApiConfigPath + '.backup');
}

// Create package.json for dist
const distPackageJson = {
  name: 'media-server-dist',
  version: '1.0.0',
  description: 'Media Server distribution package',
  main: 'server/server.js',
  scripts: {
    start: 'cd server && npm install --omit=dev && node server.js'
  },
  dependencies: {}
};

// Read server package.json dependencies
const serverPackageJson = JSON.parse(fs.readFileSync(path.join(serverDir, 'package.json'), 'utf8'));
distPackageJson.dependencies = serverPackageJson.dependencies || {};

fs.writeFileSync(path.join(DIST_DIR, 'package.json'), JSON.stringify(distPackageJson, null, 2));
console.log('  ✓ Generated dist/package.json');

// Create .gitignore for dist
const distGitignore = `node_modules/
*.log
.DS_Store
server/data/*.db
server/data/*.db-shm
server/data/*.db-wal
`;
fs.writeFileSync(path.join(DIST_DIR, '.gitignore'), distGitignore);

// Create README for dist
const distReadme = `# Media Server Distribution

This is the built and ready-to-deploy version of the Media Server.

## Structure

- \`server/\` - Node.js server application
- \`admin/\` - Admin Angular application (served by server)
- \`client/\` - Client Angular application (standalone)

## Installation

\`\`\`bash
npm install
\`\`\`

This will install all server dependencies.

## Running

\`\`\`bash
npm start
\`\`\`

The server will start on port 8080 (or PORT environment variable) and serve:
- API endpoints at \`http://localhost:8080/\`
- Admin app at \`http://localhost:8080/\`
- WebSocket at \`ws://localhost:8080\`

## Environment Variables

- \`PORT\` - Server port (default: 8080)
- \`NODE_ENV\` - Node environment (default: production)
- \`CORS_ORIGIN\` - Comma-separated list of allowed CORS origins
- \`CORS_CREDENTIALS\` - Enable CORS credentials (true/false)
- Other server configuration via .env file

## Client App

The client app is built separately and should be served independently or configured to point to this server.

Built on: ${new Date().toISOString()}
`;

fs.writeFileSync(path.join(DIST_DIR, 'README.md'), distReadme);

console.log('\n✅ Build completed successfully!');
console.log(`📁 Output directory: ${DIST_DIR}`);
console.log('\nTo start the server:');
console.log(`  cd ${DIST_DIR}`);
console.log('  npm install');
console.log('  npm start');

// Helper function to copy directory recursively
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

