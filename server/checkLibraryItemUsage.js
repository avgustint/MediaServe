const { getDatabase } = require('./database');
const dbOps = require('./dbOperations');

/**
 * Checks if a library item is used anywhere in the database
 */
function checkLibraryItemUsage(guid) {
  const db = getDatabase();
  
  console.log(`Checking usage of library item with ID=${guid}...\n`);
  
  // Get the library item first
  const item = dbOps.getLibraryItem(guid);
  if (!item) {
    console.log(`Library item with ID=${guid} does not exist.`);
    return;
  }
  
  console.log(`Library item found: "${item.name}" (Type: ${item.type})\n`);
  
  const results = {
    guid: guid,
    name: item.name,
    type: item.type,
    playlists: [],
    collections: [],
    isUsed: false
  };
  
  // Check playlists
  console.log('Checking playlists...');
  const playlists = db.prepare(`
    SELECT DISTINCT p.guid, p.name, pi.page, pi.pages, pi.description, pi.sort_order
    FROM playlists p
    JOIN playlist_items pi ON p.guid = pi.playlist_guid
    WHERE pi.library_item_guid = ?
    ORDER BY p.guid, pi.sort_order
  `).all(guid);
  
  if (playlists.length > 0) {
    console.log(`  Found in ${playlists.length} playlist(s):`);
    playlists.forEach(pl => {
      console.log(`    - Playlist ID ${pl.guid}: "${pl.name}" (sort_order: ${pl.sort_order}, page: ${pl.page || 'N/A'}, pages: ${pl.pages || 'N/A'})`);
      results.playlists.push({
        guid: pl.guid,
        name: pl.name,
        page: pl.page,
        pages: pl.pages,
        description: pl.description,
        sort_order: pl.sort_order
      });
    });
  } else {
    console.log('  Not used in any playlists');
  }
  
  // Check collections
  console.log('\nChecking collections...');
  const collections = db.prepare(`
    SELECT DISTINCT c.guid, c.title, c.label, c.year, ci.collection_number, ci.collection_page, ci.author
    FROM collections c
    JOIN collection_items ci ON c.guid = ci.collection_guid
    WHERE ci.library_item_guid = ?
    ORDER BY c.guid
  `).all(guid);
  
  if (collections.length > 0) {
    console.log(`  Found in ${collections.length} collection(s):`);
    collections.forEach(col => {
      console.log(`    - Collection ID ${col.guid}: "${col.title}" (Label: ${col.label || 'N/A'}, Year: ${col.year || 'N/A'}, Number: ${col.collection_number || 'N/A'}, Page: ${col.collection_page || 'N/A'}, Author: ${col.author || 'N/A'})`);
      results.collections.push({
        guid: col.guid,
        title: col.title,
        label: col.label,
        year: col.year,
        collection_number: col.collection_number,
        collection_page: col.collection_page,
        author: col.author
      });
    });
  } else {
    console.log('  Not used in any collections');
  }
  
  // Summary
  results.isUsed = playlists.length > 0 || collections.length > 0;
  
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY:');
  console.log('='.repeat(60));
  console.log(`Library Item ID: ${guid}`);
  console.log(`Name: "${item.name}"`);
  console.log(`Type: ${item.type}`);
  console.log(`Used in playlists: ${playlists.length}`);
  console.log(`Used in collections: ${collections.length}`);
  console.log(`Is used anywhere: ${results.isUsed ? 'YES' : 'NO'}`);
  console.log('='.repeat(60));
  
  return results;
}

// Check library item with ID=1
const guid = 1;
const usage = checkLibraryItemUsage(guid);

// Exit
process.exit(0);

