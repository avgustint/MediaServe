const db = require('./server/database').getDatabase();

// Find songs with similar names (likely duplicates with (2), (3), etc.)
const songs = db.prepare('SELECT guid, name FROM library_items ORDER BY name').all();
const baseNames = {};

songs.forEach(s => {
  // Check if name ends with (number)
  const match = s.name.match(/^(.+?)\s*\((\d+)\)$/);
  if (match) {
    const baseName = match[1].trim();
    if (!baseNames[baseName]) {
      baseNames[baseName] = [];
    }
    baseNames[baseName].push({ guid: s.guid, name: s.name });
  }
});

// Find base names with multiple versions
const duplicates = Object.entries(baseNames).filter(([base, versions]) => versions.length > 1);

console.log(`Found ${duplicates.length} base names with multiple versions\n`);

// Statistics
let totalDuplicateGroups = 0;
let identicalPagesCount = 0;
let differentPagesCount = 0;
let identicalCollectionOrderCount = 0;
let differentCollectionOrderCount = 0;
let identicalPlaylistDataCount = 0;
let differentPlaylistDataCount = 0;

// Analyze all duplicate groups
duplicates.forEach(([baseName, versions]) => {
  totalDuplicateGroups++;
  
  // Get pages for each version
  const allPages = versions.map(v => {
    const pages = db.prepare(`
      SELECT p.guid, p.content
      FROM library_item_pages lip
      JOIN pages p ON lip.page_guid = p.guid
      WHERE lip.library_item_guid = ?
      ORDER BY lip.order_number
    `).all(v.guid);
    return {
      guid: v.guid,
      name: v.name,
      pages: pages.map(p => p.content),
      pageGuids: pages.map(p => p.guid)
    };
  });
  
  // Compare pages
  const allSamePages = allPages.every((data, i) => 
    i === 0 || (
      data.pages.length === allPages[0].pages.length && 
      data.pages.every((p, j) => p === allPages[0].pages[j])
    )
  );
  
  if (allSamePages) {
    identicalPagesCount++;
  } else {
    differentPagesCount++;
  }
  
  // Get collection items for each version
  const allCollectionData = versions.map(v => {
    const items = db.prepare(`
      SELECT ci.collection_guid, ci.collection_number, ci.collection_page, ci.author
      FROM collection_items ci
      WHERE ci.library_item_guid = ?
      ORDER BY ci.collection_guid, ci.collection_number
    `).all(v.guid);
    return items.map(i => `${i.collection_guid}:${i.collection_number || 'null'}:${i.collection_page || 'null'}:${i.author || 'null'}`);
  });
  
  const allSameCollectionOrder = allCollectionData.every((data, i) => 
    i === 0 || JSON.stringify(data) === JSON.stringify(allCollectionData[0])
  );
  
  if (allSameCollectionOrder) {
    identicalCollectionOrderCount++;
  } else {
    differentCollectionOrderCount++;
  }
  
  // Get playlist items for each version
  const allPlaylistData = versions.map(v => {
    const items = db.prepare(`
      SELECT pi.playlist_guid, pi.sort_order, pi.pages, pi.page
      FROM playlist_items pi
      WHERE pi.library_item_guid = ?
      ORDER BY pi.playlist_guid, pi.sort_order
    `).all(v.guid);
    return items.map(i => ({
      playlist: i.playlist_guid,
      order: i.sort_order,
      pages: i.pages ? JSON.parse(i.pages).sort().join(',') : (i.page ? String(i.page) : ''),
      page: i.page || null
    }));
  });
  
  const allSamePlaylistData = allPlaylistData.every((data, i) => 
    i === 0 || JSON.stringify(data) === JSON.stringify(allPlaylistData[0])
  );
  
  if (allSamePlaylistData) {
    identicalPlaylistDataCount++;
  } else {
    differentPlaylistDataCount++;
  }
});

// Print summary
console.log('=== SUMMARY ===');
console.log(`Total duplicate groups: ${totalDuplicateGroups}`);
console.log(`\nPages:`);
console.log(`  Identical: ${identicalPagesCount} (${(identicalPagesCount/totalDuplicateGroups*100).toFixed(1)}%)`);
console.log(`  Different: ${differentPagesCount} (${(differentPagesCount/totalDuplicateGroups*100).toFixed(1)}%)`);
console.log(`\nCollection Ordering:`);
console.log(`  Identical: ${identicalCollectionOrderCount} (${(identicalCollectionOrderCount/totalDuplicateGroups*100).toFixed(1)}%)`);
console.log(`  Different: ${differentCollectionOrderCount} (${(differentCollectionOrderCount/totalDuplicateGroups*100).toFixed(1)}%)`);
console.log(`\nPlaylist Ordering/Pages:`);
console.log(`  Identical: ${identicalPlaylistDataCount} (${(identicalPlaylistDataCount/totalDuplicateGroups*100).toFixed(1)}%)`);
console.log(`  Different: ${differentPlaylistDataCount} (${(differentPlaylistDataCount/totalDuplicateGroups*100).toFixed(1)}%)`);

// Show detailed analysis for first 10 groups with differences
console.log('\n=== DETAILED ANALYSIS (First 10 groups with differences) ===\n');

let shown = 0;
duplicates.forEach(([baseName, versions]) => {
  if (shown >= 10) return;
  
  const allPages = versions.map(v => {
    const pages = db.prepare(`
      SELECT p.guid, p.content
      FROM library_item_pages lip
      JOIN pages p ON lip.page_guid = p.guid
      WHERE lip.library_item_guid = ?
      ORDER BY lip.order_number
    `).all(v.guid);
    return {
      guid: v.guid,
      name: v.name,
      pages: pages.map(p => p.content),
      pageCount: pages.length
    };
  });
  
  const allCollectionData = versions.map(v => {
    const items = db.prepare(`
      SELECT ci.collection_guid, c.title as collection_title, ci.collection_number, ci.collection_page
      FROM collection_items ci
      LEFT JOIN collections c ON ci.collection_guid = c.guid
      WHERE ci.library_item_guid = ?
      ORDER BY ci.collection_guid, ci.collection_number
    `).all(v.guid);
    return {
      guid: v.guid,
      name: v.name,
      collections: items
    };
  });
  
  const allPlaylistData = versions.map(v => {
    const items = db.prepare(`
      SELECT pi.playlist_guid, pl.name as playlist_name, pi.sort_order, pi.pages, pi.page
      FROM playlist_items pi
      LEFT JOIN playlists pl ON pi.playlist_guid = pl.guid
      WHERE pi.library_item_guid = ?
      ORDER BY pi.playlist_guid, pi.sort_order
    `).all(v.guid);
    return {
      guid: v.guid,
      name: v.name,
      playlists: items
    };
  });
  
  const pagesSame = allPages.every((data, i) => 
    i === 0 || (
      data.pages.length === allPages[0].pages.length && 
      data.pages.every((p, j) => p === allPages[0].pages[j])
    )
  );
  
  const collectionsSame = allCollectionData.every((data, i) => 
    i === 0 || JSON.stringify(data.collections.map(c => `${c.collection_guid}:${c.collection_number}`)) === 
             JSON.stringify(allCollectionData[0].collections.map(c => `${c.collection_guid}:${c.collection_number}`))
  );
  
  const playlistsSame = allPlaylistData.every((data, i) => 
    i === 0 || JSON.stringify(data.playlists.map(p => `${p.playlist_guid}:${p.sort_order}:${p.pages || p.page || ''}`)) === 
             JSON.stringify(allPlaylistData[0].playlists.map(p => `${p.playlist_guid}:${p.sort_order}:${p.pages || p.page || ''}`))
  );
  
  // Only show if there are differences
  if (!pagesSame || !collectionsSame || !playlistsSame) {
    shown++;
    console.log(`\n=== "${baseName}" ===`);
    
    versions.forEach((version, idx) => {
      const pageData = allPages[idx];
      const collectionData = allCollectionData[idx];
      const playlistData = allPlaylistData[idx];
      
      console.log(`\n  ${version.name} (guid: ${version.guid}):`);
      console.log(`    Pages: ${pageData.pageCount} pages`);
      console.log(`    In collections: ${collectionData.collections.length}`);
      if (collectionData.collections.length > 0) {
        collectionData.collections.slice(0, 3).forEach(ci => {
          console.log(`      - ${ci.collection_title || 'Unknown'} (number: ${ci.collection_number || 'N/A'}, page: ${ci.collection_page || 'N/A'})`);
        });
        if (collectionData.collections.length > 3) {
          console.log(`      ... and ${collectionData.collections.length - 3} more`);
        }
      }
      console.log(`    In playlists: ${playlistData.playlists.length}`);
      if (playlistData.playlists.length > 0) {
        playlistData.playlists.slice(0, 3).forEach(pi => {
          const pages = pi.pages ? JSON.parse(pi.pages) : (pi.page ? [pi.page] : []);
          console.log(`      - ${pi.playlist_name || 'Unknown'} (order: ${pi.sort_order}, pages: [${pages.join(', ')}])`);
        });
        if (playlistData.playlists.length > 3) {
          console.log(`      ... and ${playlistData.playlists.length - 3} more`);
        }
      }
    });
    
    console.log(`\n  Comparison:`);
    console.log(`    Pages: ${pagesSame ? '✓ IDENTICAL' : '✗ DIFFERENT'}`);
    console.log(`    Collection ordering: ${collectionsSame ? '✓ IDENTICAL' : '✗ DIFFERENT'}`);
    console.log(`    Playlist ordering/pages: ${playlistsSame ? '✓ IDENTICAL' : '✗ DIFFERENT'}`);
  }
});

process.exit(0);

