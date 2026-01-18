const { getDatabase } = require('./server/database');

/**
 * Script to delete all tags, collections, and library items from the database
 * WARNING: This is a destructive operation and cannot be undone!
 * 
 * This will delete:
 * - All tags
 * - All collections
 * - All library items
 * - All pages (linked to library items)
 * - All junction table records (collection_items, library_item_tags, library_item_pages)
 */

const db = getDatabase();

console.log('WARNING: This will delete ALL tags, collections, and library items!');
console.log('Starting deletion...\n');

try {
  // Start a transaction for atomicity
  db.transaction(() => {
    // 1. Delete junction tables first (to avoid foreign key constraint issues)
    console.log('Deleting collection_items...');
    const collectionItemsDeleted = db.prepare('DELETE FROM collection_items').run();
    console.log(`  Deleted ${collectionItemsDeleted.changes} collection_items rows`);

    console.log('Deleting library_item_tags...');
    const libraryItemTagsDeleted = db.prepare('DELETE FROM library_item_tags').run();
    console.log(`  Deleted ${libraryItemTagsDeleted.changes} library_item_tags rows`);

    console.log('Deleting library_item_pages...');
    const libraryItemPagesDeleted = db.prepare('DELETE FROM library_item_pages').run();
    console.log(`  Deleted ${libraryItemPagesDeleted.changes} library_item_pages rows`);

    // 2. Delete main tables
    console.log('Deleting collections...');
    const collectionsDeleted = db.prepare('DELETE FROM collections').run();
    console.log(`  Deleted ${collectionsDeleted.changes} collections`);

    console.log('Deleting library_items...');
    const libraryItemsDeleted = db.prepare('DELETE FROM library_items').run();
    console.log(`  Deleted ${libraryItemsDeleted.changes} library_items`);

    console.log('Deleting tags...');
    const tagsDeleted = db.prepare('DELETE FROM tags').run();
    console.log(`  Deleted ${tagsDeleted.changes} tags`);

    console.log('Deleting pages...');
    const pagesDeleted = db.prepare('DELETE FROM pages').run();
    console.log(`  Deleted ${pagesDeleted.changes} pages`);

    console.log('\n✅ All library data deleted successfully!');
  })();
} catch (error) {
  console.error('❌ Error deleting data:', error);
  process.exit(1);
}

// Verify deletion
console.log('\nVerifying deletion...');
const collectionsCount = db.prepare('SELECT COUNT(*) as count FROM collections').get().count;
const libraryItemsCount = db.prepare('SELECT COUNT(*) as count FROM library_items').get().count;
const tagsCount = db.prepare('SELECT COUNT(*) as count FROM tags').get().count;
const pagesCount = db.prepare('SELECT COUNT(*) as count FROM pages').get().count;
const collectionItemsCount = db.prepare('SELECT COUNT(*) as count FROM collection_items').get().count;
const libraryItemTagsCount = db.prepare('SELECT COUNT(*) as count FROM library_item_tags').get().count;
const libraryItemPagesCount = db.prepare('SELECT COUNT(*) as count FROM library_item_pages').get().count;

console.log(`Collections: ${collectionsCount}`);
console.log(`Library Items: ${libraryItemsCount}`);
console.log(`Tags: ${tagsCount}`);
console.log(`Pages: ${pagesCount}`);
console.log(`Collection Items: ${collectionItemsCount}`);
console.log(`Library Item Tags: ${libraryItemTagsCount}`);
console.log(`Library Item Pages: ${libraryItemPagesCount}`);

if (collectionsCount === 0 && libraryItemsCount === 0 && tagsCount === 0 && pagesCount === 0) {
  console.log('\n✅ Verification successful - all data deleted!');
} else {
  console.log('\n⚠️  Warning: Some data still exists!');
}

console.log('\nDone!');
process.exit(0);

