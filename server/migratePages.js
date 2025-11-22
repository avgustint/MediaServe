const { getDatabase, initDatabase, closeDatabase } = require('./database');
const path = require('path');
const Database = require('better-sqlite3');

/**
 * Migrates playlist_items table to support pages array instead of single page
 */
function migratePages() {
  console.log('Starting migration to support pages array...\n');

  const db = getDatabase();

  try {
    // Start transaction
    const transaction = db.transaction(() => {
      // Check if pages column already exists
      const tableInfo = db.prepare("PRAGMA table_info(playlist_items)").all();
      const hasPagesColumn = tableInfo.some(col => col.name === 'pages');
      
      if (hasPagesColumn) {
        console.log('Pages column already exists. Migration may have already been run.');
        return;
      }

      // Add new pages column (TEXT to store JSON array)
      console.log('Adding pages column...');
      db.exec(`
        ALTER TABLE playlist_items 
        ADD COLUMN pages TEXT
      `);

      // Migrate existing data: convert single page to pages array
      console.log('Migrating existing data...');
      const items = db.prepare('SELECT * FROM playlist_items').all();
      
      items.forEach(item => {
        let pages = null;
        
        // If page exists, convert to pages array
        if (item.page !== null && item.page !== undefined) {
          pages = JSON.stringify([item.page]);
        }
        // If page is null, pages will remain null (meaning all pages)
        
        db.prepare(`
          UPDATE playlist_items 
          SET pages = ? 
          WHERE playlist_guid = ? AND library_item_guid = ? AND sort_order = ?
        `).run(
          pages,
          item.playlist_guid,
          item.library_item_guid,
          item.sort_order
        );
      });

      console.log(`Migrated ${items.length} playlist items`);
      console.log('\nMigration completed successfully!');
      console.log('Note: The old "page" column still exists but is deprecated.');
      console.log('You can remove it manually if desired.');
    });

    transaction();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Don't close database here as it might be in use by the server
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migratePages();
}

module.exports = { migratePages };
