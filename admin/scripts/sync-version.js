#!/usr/bin/env node
/**
 * Syncs version from package.json to environment files.
 * Run as prebuild to keep version in sync.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version || '0.0.0';

const envFiles = [
  'src/environments/environment.ts',
  'src/environments/environment.prod.ts'
];

for (const file of envFiles) {
  const filePath = path.join(root, file);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/version:\s*['"][^'"]*['"]/, `version: '${version}'`);
  fs.writeFileSync(filePath, content);
}

console.log(`Synced version ${version} to environment files`);
