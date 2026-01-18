const { getDatabase } = require('./database');
const dbOps = require('./dbOperations');

/**
 * Duplicates a library item and updates collection references to the new item
 */
function duplicateLibraryItem(sourceGuid) {
  const db = getDatabase();
  
  console.log(`Duplicating library item with ID=${sourceGuid}...\n`);
  
  // Get the source library item
  const sourceItem = dbOps.getLibraryItem(sourceGuid);
  if (!sourceItem) {
    console.error(`Library item with ID=${sourceGuid} does not exist.`);
    return null;
  }
  
  console.log(`Source item: "${sourceItem.name}" (Type: ${sourceItem.type})`);
  
  // Start transaction
  const transaction = db.transaction(() => {
    // Get collection items inside transaction to ensure we have latest data
    const collectionItems = db.prepare(`
      SELECT collection_guid, collection_number, collection_page, author, tonality_guid
      FROM collection_items
      WHERE library_item_guid = ?
    `).all(sourceGuid);
    // Get the next available GUID
    const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM library_items').get()?.maxGuid || 0;
    const newGuid = maxGuid + 1;
    
    console.log(`New GUID will be: ${newGuid}`);
    
    // Create new library item (copy of source)
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO library_items (guid, name, type, content, description, modified, background_color, font_color, author)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newGuid,
      sourceItem.name || '',
      sourceItem.type || 'text',
      sourceItem.content || '',
      sourceItem.description || null,
      now,
      sourceItem.background_color || null,
      sourceItem.font_color || null,
      sourceItem.author || null
    );
    
    console.log(`✓ Created new library item with ID=${newGuid}`);
    
    // Copy library_item_pages (for text items with pages)
    if (sourceItem.type === 'text') {
      const sourcePages = dbOps.getLibraryItemPages(sourceGuid);
      if (sourcePages && sourcePages.length > 0) {
        const insertPage = db.prepare(`
          INSERT INTO library_item_pages (library_item_guid, page_guid, order_number)
          VALUES (?, ?, ?)
        `);
        sourcePages.forEach(page => {
          insertPage.run(newGuid, page.guid, page.order_number);
        });
        console.log(`✓ Copied ${sourcePages.length} pages to new item`);
      }
    }
    
    // Copy library_item_tags
    const sourceTags = db.prepare(`
      SELECT tag_guid FROM library_item_tags
      WHERE library_item_guid = ?
    `).all(sourceGuid);
    
    if (sourceTags.length > 0) {
      const insertTag = db.prepare(`
        INSERT INTO library_item_tags (library_item_guid, tag_guid)
        VALUES (?, ?)
      `);
      sourceTags.forEach(tag => {
        insertTag.run(newGuid, tag.tag_guid);
      });
      console.log(`✓ Copied ${sourceTags.length} tags to new item`);
    }
    
    // Update collection_items references from old GUID to new GUID
    if (collectionItems.length > 0) {
      console.log(`\nUpdating ${collectionItems.length} collection reference(s)...`);
      
      // First delete old references
      db.prepare(`
        DELETE FROM collection_items
        WHERE library_item_guid = ?
      `).run(sourceGuid);
      
      // Then insert new references with new GUID
      const insertCollectionItem = db.prepare(`
        INSERT INTO collection_items (collection_guid, library_item_guid, collection_number, collection_page, author, tonality_guid)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      collectionItems.forEach(ci => {
        insertCollectionItem.run(
          ci.collection_guid,
          newGuid, // Use new GUID
          ci.collection_number,
          ci.collection_page,
          ci.author,
          ci.tonality_guid
        );
        const collection = db.prepare('SELECT title FROM collections WHERE guid = ?').get(ci.collection_guid);
        console.log(`  ✓ Updated collection "${collection?.title || ci.collection_guid}" to use new item ID=${newGuid}`);
      });
      return { newGuid, collectionCount: collectionItems.length };
    } else {
      console.log(`No collection references to update`);
      return { newGuid, collectionCount: 0 };
    }
  });
  
  // Execute transaction
  try {
    const result = transaction();
    const newGuid = result.newGuid;
    const collectionCount = result.collectionCount;
    
    console.log('\n' + '='.repeat(60));
    console.log('SUCCESS:');
    console.log('='.repeat(60));
    console.log(`Source item ID: ${sourceGuid}`);
    console.log(`New item ID: ${newGuid}`);
    console.log(`Name: "${sourceItem.name}"`);
    console.log(`Type: ${sourceItem.type}`);
    console.log(`Collection references updated: ${collectionCount}`);
    console.log('='.repeat(60));
    
    return {
      sourceGuid: sourceGuid,
      newGuid: newGuid,
      name: sourceItem.name,
      type: sourceItem.type,
      collectionsUpdated: collectionCount
    };
  } catch (error) {
    console.error('Error during duplication:', error);
    throw error;
  }
}

// Duplicate library item with ID=1
// Note: This will work even if ID=1 has already been duplicated before
// It will create a new copy and update any remaining collection references
const sourceGuid = 1;
const result = duplicateLibraryItem(sourceGuid);

if (result) {
  console.log(`\nDuplication completed successfully!`);
  console.log(`New library item ID: ${result.newGuid}`);
  console.log(`Old item (ID=${result.sourceGuid}) still exists but is no longer referenced in collections.`);
}

process.exit(0);

