#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🚀 Starting Media Server monorepo...\n');

// Check if we should use dist (production) or individual projects (development)
const useDist = process.argv.includes('--dist') || process.argv.includes('-d');

if (useDist) {
  console.log('📦 Starting from dist (production mode)...\n');
  const distDir = path.join(ROOT_DIR, 'dist');
  
  // Install dependencies if needed
  const distPackageJson = path.join(distDir, 'package.json');
  const distNodeModules = path.join(distDir, 'node_modules');
  
  if (!require('fs').existsSync(distNodeModules) && require('fs').existsSync(distPackageJson)) {
    console.log('📥 Installing production dependencies...');
    execSync('npm install --production', { cwd: distDir, stdio: 'inherit' });
  }
  
  // Start server
  console.log('🎬 Starting server...');
  const serverProcess = spawn('node', ['server/server.js'], {
    cwd: distDir,
    stdio: 'inherit',
    env: { ...process.env }
  });
  
  serverProcess.on('exit', (code) => {
    console.log(`\n⛔ Server exited with code ${code}`);
    process.exit(code);
  });
  
  // Handle termination
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    serverProcess.kill('SIGINT');
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down...');
    serverProcess.kill('SIGTERM');
    process.exit(0);
  });
  
} else {
  console.log('🔧 Starting in development mode...\n');
  console.log('   Server: http://localhost:8080');
  console.log('   Admin:  http://localhost:4200');
  console.log('   Client: http://localhost:4201\n');
  
  // Use concurrently if available, otherwise start server only
  try {
    execSync('npx concurrently --version', { stdio: 'ignore' });
    
    console.log('📦 Starting all services with concurrently...\n');
    execSync('npm run start:dev', { cwd: ROOT_DIR, stdio: 'inherit' });
  } catch (error) {
    // concurrently not available, start server only
    console.log('⚠️  concurrently not found. Starting server only...\n');
    console.log('💡 Install concurrently for parallel development: npm install --save-dev concurrently\n');
    
    const serverProcess = spawn('npm', ['start'], {
      cwd: path.join(ROOT_DIR, 'server'),
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    serverProcess.on('exit', (code) => {
      console.log(`\n⛔ Server exited with code ${code}`);
      process.exit(code);
    });
    
    // Handle termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down...');
      serverProcess.kill('SIGINT');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down...');
      serverProcess.kill('SIGTERM');
      process.exit(0);
    });
  }
}

