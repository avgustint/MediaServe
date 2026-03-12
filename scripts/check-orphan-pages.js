#!/usr/bin/env node
/**
 * Check and optionally clean up orphan pages in the database.
 * Orphan pages are pages not linked to any library item (can occur when save is cancelled
 * after createPage but before createLibraryItem/updateLibraryItem).
 *
 * Usage:
 *   node scripts/check-orphan-pages.js           # Show orphan count
 *   node scripts/check-orphan-pages.js --cleanup # Delete orphan pages
 */

const path = require('path');

// Ensure we load from server directory
const serverDir = path.join(__dirname, '..', 'server');
process.chdir(serverDir);

const dbOps = require(path.join(serverDir, 'dbOperations'));

// Initialize database (required for dbOperations to work)
require(path.join(serverDir, 'database')).initDatabase();

const doCleanup = process.argv.includes('--cleanup');

const count = dbOps.getOrphanPageCount();
console.log(`Orphan pages (not linked to any library item): ${count}`);

if (count > 0 && doCleanup) {
  const deleted = dbOps.cleanupOrphanPages();
  console.log(`Deleted ${deleted} orphan page(s).`);
} else if (count > 0) {
  console.log('Run with --cleanup to delete orphan pages.');
}
