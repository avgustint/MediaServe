const fs = require('fs');
const path = require('path');
const { getDatabase } = require('./server/database');

// Setup logging
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}
const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
const logFile = path.join(logDir, `import-pesmi-simple-${timestamp}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function logToFile(...args) {
  const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
  logStream.write(`[${new Date().toISOString()}] ${message}\n`);
}

console.log = function(...args) {
  originalLog.apply(console, args);
  logToFile(...args);
};

console.error = function(...args) {
  originalError.apply(console, args);
  logToFile('ERROR:', ...args);
};

console.warn = function(...args) {
  originalWarn.apply(console, args);
  logToFile('WARN:', ...args);
};

// Initialize database
const db = getDatabase();

// Statistics
const stats = {
  tags: {
    imported: 0,
    skipped: 0,
    errors: 0
  },
  libraryItems: {
    imported: 0,
    skipped: 0,
    errors: 0
  },
  pages: {
    imported: 0,
    skipped: 0,
    errors: 0
  },
  libraryItemPages: {
    imported: 0,
    skipped: 0,
    errors: 0
  },
  tonalities: {
    imported: 0,
    skipped: 0,
    errors: 0
  },
  collections: {
    imported: 0,
    skipped: 0,
    errors: 0
  },
  collectionItems: {
    imported: 0,
    skipped: 0,
    errors: 0
  },
  albumCollections: {
    imported: 0,
    skipped: 0,
    errors: 0
  },
  albumCollectionItems: {
    imported: 0,
    skipped: 0,
    errors: 0
  },
  libraryItemTags: {
    imported: 0,
    skipped: 0,
    errors: 0
  },
  pageSplits: {
    pagesSplit: 0,
    newPagesCreated: 0,
    errors: 0
  },
  pageContentProcessing: {
    pagesProcessed: 0,
    italicReplacements: 0,
    chordReplacements: 0,
    chiTagReplacements: 0,
    errors: 0
  },
  brTagCleaning: {
    pagesProcessed: 0,
    replacements: 0,
    errors: 0
  }
};

/**
 * Import tags from zvrsti table
 */
function importTags() {
  console.log('\n=== Importing Tags from zvrsti ===');
  
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'Pesmi', 'pesmi.json'), 'utf8'));
  const zvrsti = data.tables.zvrsti || data.tables.zvrst || [];
  
  console.log(`Found ${zvrsti.length} tags to import`);
  
  for (const zvrst of zvrsti) {
    try {
      const zid = zvrst.zid;
      const name = zvrst.Oznaka || zvrst.oznaka || '';
      const description = zvrst.zvrst || zvrst.Zvrst || null;
      
      if (!zid) {
        console.warn(`  Skipping tag with missing zid:`, zvrst);
        stats.tags.skipped++;
        continue;
      }
      
      if (!name) {
        console.warn(`  Skipping tag with missing name (zid: ${zid})`);
        stats.tags.skipped++;
        continue;
      }
      
      // Check if tag already exists
      const existing = db.prepare('SELECT guid FROM tags WHERE guid = ?').get(zid);
      if (existing) {
        // Update existing tag
        db.prepare(`
          UPDATE tags
          SET name = ?, description = ?
          WHERE guid = ?
        `).run(name, description, zid);
        console.log(`  Updated tag: ${name} (guid: ${zid})`);
      } else {
        // Insert new tag
        db.prepare(`
          INSERT INTO tags (guid, name, description)
          VALUES (?, ?, ?)
        `).run(zid, name, description);
        console.log(`  Imported tag: ${name} (guid: ${zid})`);
      }
      
      stats.tags.imported++;
    } catch (error) {
      console.error(`  Error importing tag:`, zvrst, error.message);
      stats.tags.errors++;
    }
  }
  
  console.log(`\nTags import complete: ${stats.tags.imported} imported, ${stats.tags.skipped} skipped, ${stats.tags.errors} errors`);
}

/**
 * Import library items from pesmi table
 */
function importLibraryItems() {
  console.log('\n=== Importing Library Items from pesmi ===');
  
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'Pesmi', 'pesmi.json'), 'utf8'));
  const pesmi = data.tables.pesmi || data.tables.Pesmi || [];
  
  console.log(`Found ${pesmi.length} library items to import`);
  
  for (const pesem of pesmi) {
    try {
      const phId = pesem.phId;
      const naslov = pesem.naslov || '';
      const naslov1 = pesem.naslov1 || null;
      const avtor = pesem.avtor || null;
      
      if (!phId) {
        console.warn(`  Skipping library item with missing phId:`, pesem);
        stats.libraryItems.skipped++;
        continue;
      }
      
      if (!naslov) {
        console.warn(`  Skipping library item with missing naslov (phId: ${phId})`);
        stats.libraryItems.skipped++;
        continue;
      }
      
      // Check if library item already exists
      const existing = db.prepare('SELECT guid FROM library_items WHERE guid = ?').get(phId);
      if (existing) {
        // Update existing item
        const modified = new Date().toISOString();
        db.prepare(`
          UPDATE library_items
          SET name = ?, description = ?, author = ?, modified = ?, type = ?, content = ?
          WHERE guid = ?
        `).run(naslov, naslov1, avtor, modified, 'text', '', phId);
        console.log(`  Updated library item: ${naslov} (guid: ${phId})`);
      } else {
        // Insert new item
        const modified = new Date().toISOString();
        db.prepare(`
          INSERT INTO library_items (guid, name, type, content, description, modified, author)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(phId, naslov, 'text', '', naslov1, modified, avtor);
        console.log(`  Imported library item: ${naslov} (guid: ${phId})`);
      }
      
      stats.libraryItems.imported++;
    } catch (error) {
      console.error(`  Error importing library item:`, pesem, error.message);
      stats.libraryItems.errors++;
    }
  }
  
  console.log(`\nLibrary items import complete: ${stats.libraryItems.imported} imported, ${stats.libraryItems.skipped} skipped, ${stats.libraryItems.errors} errors`);
}

/**
 * Import pages from kitice table
 */
function importPages() {
  console.log('\n=== Importing Pages from kitice ===');
  
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'Pesmi', 'pesmi.json'), 'utf8'));
  const kitice = data.tables.kitice || [];
  
  console.log(`Found ${kitice.length} pages to import`);
  
  for (const kitica of kitice) {
    try {
      const cid = kitica.cid;
      const besedilo = kitica.besedilo || '';
      
      if (!cid) {
        console.warn(`  Skipping page with missing cid:`, kitica);
        stats.pages.skipped++;
        continue;
      }
      
      // Process besedilo: replace \\n with <br> tags
      let processedContent = besedilo;
      if (processedContent) {
        // Replace escaped newlines with <br> tags
        processedContent = processedContent.replace(/\\n/g, '<br>');
        // Also replace actual newlines if any
        processedContent = processedContent.replace(/\n/g, '<br>');
      }
      
      // Check if page already exists
      const existing = db.prepare('SELECT guid FROM pages WHERE guid = ?').get(cid);
      if (existing) {
        // Update existing page
        db.prepare(`
          UPDATE pages
          SET content = ?
          WHERE guid = ?
        `).run(processedContent, cid);
        console.log(`  Updated page (guid: ${cid})`);
      } else {
        // Insert new page
        db.prepare(`
          INSERT INTO pages (guid, content)
          VALUES (?, ?)
        `).run(cid, processedContent);
        console.log(`  Imported page (guid: ${cid})`);
      }
      
      stats.pages.imported++;
    } catch (error) {
      console.error(`  Error importing page:`, kitica, error.message);
      stats.pages.errors++;
    }
  }
  
  console.log(`\nPages import complete: ${stats.pages.imported} imported, ${stats.pages.skipped} skipped, ${stats.pages.errors} errors`);
}

/**
 * Import library item pages from pesem_kitica table
 */
function importLibraryItemPages() {
  console.log('\n=== Importing Library Item Pages from pesem_kitica ===');
  
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'Pesmi', 'pesmi.json'), 'utf8'));
  const pesem_kitica = data.tables.pesem_kitica || [];
  
  console.log(`Found ${pesem_kitica.length} page links to import`);
  
  // Build a map of phid -> array of {cid, ordun} for efficient processing
  const phidToPages = new Map();
  for (const link of pesem_kitica) {
    const phid = link.phid || link.phId;
    const cid = link.cid;
    const ordun = link.ordun || 0;
    
    if (!phid || !cid) {
      continue;
    }
    
    if (!phidToPages.has(phid)) {
      phidToPages.set(phid, []);
    }
    phidToPages.get(phid).push({ cid, ordun });
  }
  
  console.log(`Found ${phidToPages.size} unique library items with pages`);
  
  // Process each library item
  for (const [phid, pages] of phidToPages.entries()) {
    try {
      // Check if library item exists
      const libraryItem = db.prepare('SELECT guid FROM library_items WHERE guid = ?').get(phid);
      if (!libraryItem) {
        console.warn(`  Skipping page links for non-existent library item (phId: ${phid})`);
        stats.libraryItemPages.skipped++;
        continue;
      }
      
      // Remove existing pages for this library item
      db.prepare('DELETE FROM library_item_pages WHERE library_item_guid = ?').run(phid);
      
      // Sort pages by ordun
      pages.sort((a, b) => (a.ordun || 0) - (b.ordun || 0));
      
      // Insert new page links
      let insertedCount = 0;
      for (const page of pages) {
        // Check if page exists
        const pageExists = db.prepare('SELECT guid FROM pages WHERE guid = ?').get(page.cid);
        if (!pageExists) {
          console.warn(`  Skipping non-existent page (cid: ${page.cid}) for library item (phId: ${phid})`);
          continue;
        }
        
        // Insert page link
        try {
          db.prepare(`
            INSERT INTO library_item_pages (library_item_guid, page_guid, order_number)
            VALUES (?, ?, ?)
          `).run(phid, page.cid, page.ordun || 0);
          insertedCount++;
        } catch (error) {
          // Ignore duplicate key errors
          if (!error.message.includes('UNIQUE constraint')) {
            throw error;
          }
        }
      }
      
      if (insertedCount > 0) {
        console.log(`  Linked ${insertedCount} page(s) to library item (phId: ${phid})`);
        stats.libraryItemPages.imported++;
      } else {
        stats.libraryItemPages.skipped++;
      }
    } catch (error) {
      console.error(`  Error importing page links for library item (phId: ${phid}):`, error.message);
      stats.libraryItemPages.errors++;
    }
  }
  
  console.log(`\nLibrary item pages import complete: ${stats.libraryItemPages.imported} items linked, ${stats.libraryItemPages.skipped} skipped, ${stats.libraryItemPages.errors} errors`);
}

/**
 * Import tonalities from tonalitete table
 */
function importTonalities() {
  console.log('\n=== Importing Tonalities from tonalitete ===');
  
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'Pesmi', 'pesmi.json'), 'utf8'));
  const tonalitete = data.tables.tonalitete || [];
  
  console.log(`Found ${tonalitete.length} tonalities to import`);
  
  for (const tonality of tonalitete) {
    try {
      const idx = tonality.idx;
      const name = tonality.ime || '';
      const alternations = tonality.alternacije || null;
      const dur = tonality.dur || null;
      const mol = tonality.mol || null;
      const dur_scale = tonality.dur_lestvica || null;
      const mol_scale = tonality.mol_lestvica || null;
      
      if (idx === undefined || idx === null) {
        console.warn(`  Skipping tonality with missing idx:`, tonality);
        stats.tonalities.skipped++;
        continue;
      }
      
      if (!name) {
        console.warn(`  Skipping tonality with missing name (idx: ${idx})`);
        stats.tonalities.skipped++;
        continue;
      }
      
      // Check if tonality already exists
      const existing = db.prepare('SELECT guid FROM tonalities WHERE guid = ?').get(idx);
      if (existing) {
        // Update existing tonality
        db.prepare(`
          UPDATE tonalities
          SET name = ?, alternations = ?, dur = ?, mol = ?, dur_scale = ?, mol_scale = ?
          WHERE guid = ?
        `).run(name, alternations, dur, mol, dur_scale, mol_scale, idx);
        console.log(`  Updated tonality: ${name} (guid: ${idx})`);
      } else {
        // Insert new tonality
        db.prepare(`
          INSERT INTO tonalities (guid, name, alternations, dur, mol, dur_scale, mol_scale)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(idx, name, alternations, dur, mol, dur_scale, mol_scale);
        console.log(`  Imported tonality: ${name} (guid: ${idx})`);
      }
      
      stats.tonalities.imported++;
    } catch (error) {
      console.error(`  Error importing tonality:`, tonality, error.message);
      stats.tonalities.errors++;
    }
  }
  
  console.log(`\nTonalities import complete: ${stats.tonalities.imported} imported, ${stats.tonalities.skipped} skipped, ${stats.tonalities.errors} errors`);
}

/**
 * Import collections from pesmarice table
 */
function importCollections() {
  console.log('\n=== Importing Collections from pesmarice ===');
  
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'Pesmi', 'pesmi.json'), 'utf8'));
  const pesmarice = data.tables.pesmarice || data.tables.Pesmarice || [];
  
  console.log(`Found ${pesmarice.length} collections to import`);
  
  // Build a map of oznaka -> guid for later lookup
  const oznakaToGuid = new Map();
  let nextGuid = 1;
  
  // First, get the max existing guid
  const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM collections').get()?.maxGuid || 0;
  nextGuid = maxGuid + 1;
  
  for (const pesmarica of pesmarice) {
    try {
      const oznaka = pesmarica.oznaka || '';
      const naslov = pesmarica.naslov || '';
      const letoIzida = pesmarica['leto izida'] || pesmarica.leto_izida || null;
      const zalozba = pesmarica.Založba || pesmarica.Zalozba || null;
      const vir = pesmarica.vir || null;
      
      if (!oznaka) {
        console.warn(`  Skipping collection with missing oznaka:`, pesmarica);
        stats.collections.skipped++;
        continue;
      }
      
      if (!naslov) {
        console.warn(`  Skipping collection with missing naslov (oznaka: ${oznaka})`);
        stats.collections.skipped++;
        continue;
      }
      
      // Check if collection already exists by oznaka (we'll use label field)
      const existing = db.prepare('SELECT guid FROM collections WHERE label = ?').get(oznaka);
      let guid;
      
      if (existing) {
        guid = existing.guid;
        // Update existing collection
        db.prepare(`
          UPDATE collections
          SET title = ?, label = ?, year = ?, publisher = ?, source = ?
          WHERE guid = ?
        `).run(naslov, oznaka, letoIzida, zalozba, vir, guid);
        console.log(`  Updated collection: ${naslov} (oznaka: ${oznaka}, guid: ${guid})`);
      } else {
        guid = nextGuid++;
        // Insert new collection
        db.prepare(`
          INSERT INTO collections (guid, title, label, year, publisher, source)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(guid, naslov, oznaka, letoIzida, zalozba, vir);
        console.log(`  Imported collection: ${naslov} (oznaka: ${oznaka}, guid: ${guid})`);
      }
      
      oznakaToGuid.set(oznaka, guid);
      stats.collections.imported++;
    } catch (error) {
      console.error(`  Error importing collection:`, pesmarica, error.message);
      stats.collections.errors++;
    }
  }
  
  console.log(`\nCollections import complete: ${stats.collections.imported} imported, ${stats.collections.skipped} skipped, ${stats.collections.errors} errors`);
  
  return oznakaToGuid;
}

/**
 * Import collection items from pesem_pesmarica table
 */
function importCollectionItems(oznakaToGuid) {
  console.log('\n=== Importing Collection Items from pesem_pesmarica ===');
  
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'Pesmi', 'pesmi.json'), 'utf8'));
  const pesem_pesmarica = data.tables.pesem_pesmarica || data.tables.Pesem_pesmarica || [];
  
  console.log(`Found ${pesem_pesmarica.length} collection item links to import`);
  
  for (const link of pesem_pesmarica) {
    try {
      const phId = link.phId || link.phid;
      const pesmarica = link.pesmarica || '';
      const stevilka = link.stevilka || null;
      const stran = link.stran || null;
      const tonaliteta = link.tonaliteta || null;
      const avtor = link.avtor || null;
      
      if (!phId) {
        console.warn(`  Skipping collection item with missing phId:`, link);
        stats.collectionItems.skipped++;
        continue;
      }
      
      if (!pesmarica) {
        console.warn(`  Skipping collection item with missing pesmarica (phId: ${phId})`);
        stats.collectionItems.skipped++;
        continue;
      }
      
      // Find collection guid by oznaka (pesmarica)
      const collectionGuid = oznakaToGuid.get(pesmarica);
      if (!collectionGuid) {
        console.warn(`  Skipping collection item - collection not found (pesmarica: ${pesmarica}, phId: ${phId})`);
        stats.collectionItems.skipped++;
        continue;
      }
      
      // Check if library item exists
      const libraryItem = db.prepare('SELECT guid FROM library_items WHERE guid = ?').get(phId);
      if (!libraryItem) {
        console.warn(`  Skipping collection item - library item not found (phId: ${phId})`);
        stats.collectionItems.skipped++;
        continue;
      }
      
      // Check if tonality exists (if provided)
      let tonalityGuid = null;
      if (tonaliteta !== null && tonaliteta !== undefined) {
        const tonality = db.prepare('SELECT guid FROM tonalities WHERE guid = ?').get(tonaliteta);
        if (tonality) {
          tonalityGuid = tonaliteta;
        } else {
          console.warn(`  Warning: Tonality not found (guid: ${tonaliteta}) for collection item (phId: ${phId}, collection: ${pesmarica})`);
        }
      }
      
      // Check if collection item already exists
      const existing = db.prepare(`
        SELECT collection_guid, library_item_guid 
        FROM collection_items 
        WHERE collection_guid = ? AND library_item_guid = ?
      `).get(collectionGuid, phId);
      
      if (existing) {
        // Update existing collection item
        db.prepare(`
          UPDATE collection_items
          SET collection_number = ?, collection_page = ?, author = ?, tonality_guid = ?
          WHERE collection_guid = ? AND library_item_guid = ?
        `).run(stevilka, stran, avtor, tonalityGuid, collectionGuid, phId);
        console.log(`  Updated collection item (phId: ${phId}, collection: ${pesmarica})`);
      } else {
        // Insert new collection item
        db.prepare(`
          INSERT INTO collection_items (collection_guid, library_item_guid, collection_number, collection_page, author, tonality_guid)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(collectionGuid, phId, stevilka, stran, avtor, tonalityGuid);
        console.log(`  Imported collection item (phId: ${phId}, collection: ${pesmarica})`);
      }
      
      stats.collectionItems.imported++;
    } catch (error) {
      console.error(`  Error importing collection item:`, link, error.message);
      stats.collectionItems.errors++;
    }
  }
  
  console.log(`\nCollection items import complete: ${stats.collectionItems.imported} imported, ${stats.collectionItems.skipped} skipped, ${stats.collectionItems.errors} errors`);
}

/**
 * Import collections from Album table
 */
function importAlbumCollections() {
  console.log('\n=== Importing Collections from Album ===');
  
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'Pesmi', 'pesmi.json'), 'utf8'));
  const albums = data.tables.Album || data.tables.album || [];
  
  console.log(`Found ${albums.length} album collections to import`);
  
  // Build a map of pid -> guid for later lookup
  const pidToGuid = new Map();
  let nextGuid = 1;
  
  // First, get the max existing guid
  const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM collections').get()?.maxGuid || 0;
  nextGuid = maxGuid + 1;
  
  for (const album of albums) {
    try {
      const pid = album.pid;
      const ime = album.ime || '';
      const opis = album.opis || '';
      const datoteka = album.datoteka || null;
      
      if (pid === undefined || pid === null) {
        console.warn(`  Skipping album with missing pid:`, album);
        stats.albumCollections.skipped++;
        continue;
      }
      
      if (!ime) {
        console.warn(`  Skipping album with missing ime (pid: ${pid})`);
        stats.albumCollections.skipped++;
        continue;
      }
      
      // Check if collection already exists by label (ime)
      const existing = db.prepare('SELECT guid FROM collections WHERE label = ?').get(ime);
      let guid;
      
      if (existing) {
        guid = existing.guid;
        // Update existing collection
        db.prepare(`
          UPDATE collections
          SET title = ?, label = ?, source = ?
          WHERE guid = ?
        `).run(opis, ime, datoteka, guid);
        console.log(`  Updated album collection: ${opis} (ime: ${ime}, pid: ${pid}, guid: ${guid})`);
      } else {
        guid = nextGuid++;
        // Insert new collection
        db.prepare(`
          INSERT INTO collections (guid, title, label, source)
          VALUES (?, ?, ?, ?)
        `).run(guid, opis, ime, datoteka);
        console.log(`  Imported album collection: ${opis} (ime: ${ime}, pid: ${pid}, guid: ${guid})`);
      }
      
      pidToGuid.set(pid, guid);
      stats.albumCollections.imported++;
    } catch (error) {
      console.error(`  Error importing album collection:`, album, error.message);
      stats.albumCollections.errors++;
    }
  }
  
  console.log(`\nAlbum collections import complete: ${stats.albumCollections.imported} imported, ${stats.albumCollections.skipped} skipped, ${stats.albumCollections.errors} errors`);
  
  return pidToGuid;
}

/**
 * Import collection items from diasi table
 */
function importAlbumCollectionItems(pidToGuid) {
  console.log('\n=== Importing Collection Items from diasi ===');
  
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'Pesmi', 'pesmi.json'), 'utf8'));
  const diasi = data.tables.diasi || [];
  
  console.log(`Found ${diasi.length} diasi records to process`);
  
  // Build a map of (pid, phId) -> array of records to handle duplicates
  const pidPhIdMap = new Map();
  
  for (const dias of diasi) {
    const pid = dias.pid;
    const phId = dias.phId || dias.phid;
    
    if (!pid || !phId) {
      continue;
    }
    
    const key = `${pid}:${phId}`;
    if (!pidPhIdMap.has(key)) {
      pidPhIdMap.set(key, []);
    }
    pidPhIdMap.get(key).push(dias);
  }
  
  console.log(`Found ${pidPhIdMap.size} unique (pid, phId) combinations`);
  
  for (const [key, records] of pidPhIdMap.entries()) {
    try {
      const [pidStr, phIdStr] = key.split(':');
      const pid = parseInt(pidStr, 10);
      const phId = parseInt(phIdStr, 10);
      
      // Find collection guid by pid
      const collectionGuid = pidToGuid.get(pid);
      if (!collectionGuid) {
        console.warn(`  Skipping collection item - collection not found (pid: ${pid}, phId: ${phId})`);
        stats.albumCollectionItems.skipped++;
        continue;
      }
      
      // Check if library item exists
      const libraryItem = db.prepare('SELECT guid FROM library_items WHERE guid = ?').get(phId);
      if (!libraryItem) {
        console.warn(`  Skipping collection item - library item not found (phId: ${phId})`);
        stats.albumCollectionItems.skipped++;
        continue;
      }
      
      // Check if collection item already exists
      const existing = db.prepare(`
        SELECT collection_guid, library_item_guid 
        FROM collection_items 
        WHERE collection_guid = ? AND library_item_guid = ?
      `).get(collectionGuid, phId);
      
      if (existing) {
        // Already exists, skip (don't overwrite existing data from pesem_pesmarica)
        console.log(`  Collection item already exists (phId: ${phId}, collection guid: ${collectionGuid})`);
        stats.albumCollectionItems.skipped++;
        continue;
      }
      
      // Use the first record's dias value as collection_number if available
      const firstRecord = records[0];
      const collectionNumber = firstRecord.dias || null;
      
      // Insert new collection item
      db.prepare(`
        INSERT INTO collection_items (collection_guid, library_item_guid, collection_number)
        VALUES (?, ?, ?)
      `).run(collectionGuid, phId, collectionNumber);
      
      console.log(`  Imported collection item (phId: ${phId}, collection guid: ${collectionGuid}, number: ${collectionNumber})`);
      stats.albumCollectionItems.imported++;
    } catch (error) {
      console.error(`  Error importing collection item (key: ${key}):`, error.message);
      stats.albumCollectionItems.errors++;
    }
  }
  
  console.log(`\nAlbum collection items import complete: ${stats.albumCollectionItems.imported} imported, ${stats.albumCollectionItems.skipped} skipped, ${stats.albumCollectionItems.errors} errors`);
}

/**
 * Import library item tags from pesem_zvrst table
 */
function importLibraryItemTags() {
  console.log('\n=== Importing Library Item Tags from pesem_zvrst ===');
  
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'Pesmi', 'pesmi.json'), 'utf8'));
  const pesem_zvrst = data.tables.pesem_zvrst || [];
  
  console.log(`Found ${pesem_zvrst.length} tag links to import`);
  
  // Build a map of pesem -> zvrsti for efficient lookup
  const pesemToZvrsti = new Map();
  for (const link of pesem_zvrst) {
    const pesem = link.pesem || link.pesemId;
    const zvrst = link.zvrst || link.zvrstId;
    
    if (!pesem || !zvrst) {
      continue;
    }
    
    if (!pesemToZvrsti.has(pesem)) {
      pesemToZvrsti.set(pesem, []);
    }
    pesemToZvrsti.get(pesem).push(zvrst);
  }
  
  console.log(`Found ${pesemToZvrsti.size} unique library items with tags`);
  
  // Process each library item
  for (const [pesemId, zvrstiIds] of pesemToZvrsti.entries()) {
    try {
      // Check if library item exists
      const libraryItem = db.prepare('SELECT guid FROM library_items WHERE guid = ?').get(pesemId);
      if (!libraryItem) {
        console.warn(`  Skipping tag links for non-existent library item (phId: ${pesemId})`);
        stats.libraryItemTags.skipped++;
        continue;
      }
      
      // Remove existing tags for this library item
      db.prepare('DELETE FROM library_item_tags WHERE library_item_guid = ?').run(pesemId);
      
      // Insert new tags
      let insertedCount = 0;
      for (const zvrstId of zvrstiIds) {
        // Check if tag exists
        const tag = db.prepare('SELECT guid FROM tags WHERE guid = ?').get(zvrstId);
        if (!tag) {
          console.warn(`  Skipping non-existent tag (zid: ${zvrstId}) for library item (phId: ${pesemId})`);
          continue;
        }
        
        // Insert tag link
        try {
          db.prepare(`
            INSERT INTO library_item_tags (library_item_guid, tag_guid)
            VALUES (?, ?)
          `).run(pesemId, zvrstId);
          insertedCount++;
        } catch (error) {
          // Ignore duplicate key errors
          if (!error.message.includes('UNIQUE constraint')) {
            throw error;
          }
        }
      }
      
      if (insertedCount > 0) {
        console.log(`  Linked ${insertedCount} tag(s) to library item (phId: ${pesemId})`);
        stats.libraryItemTags.imported++;
      } else {
        stats.libraryItemTags.skipped++;
      }
    } catch (error) {
      console.error(`  Error importing tag links for library item (phId: ${pesemId}):`, error.message);
      stats.libraryItemTags.errors++;
    }
  }
  
  console.log(`\nLibrary item tags import complete: ${stats.libraryItemTags.imported} items linked, ${stats.libraryItemTags.skipped} skipped, ${stats.libraryItemTags.errors} errors`);
}

/**
 * Split a single page recursively until no more \\<br> markers are found
 * Returns array of new page GUIDs created
 */
function splitPageRecursively(pageGuid, content, nextGuidRef, libraryItemPageEntries) {
  const newPageGuids = [];
  
  // Check if content contains \\<br>
  if (!content.includes('\\\\<br>')) {
    return newPageGuids; // No more splits needed
  }
  
  // Split content at first \\<br>
  const parts = content.split('\\\\<br>');
  
  if (parts.length < 2) {
    return newPageGuids; // Should not happen, but handle gracefully
  }
  
  // First part: update current page (remove \\<br> marker)
  const firstPart = parts[0];
  db.prepare('UPDATE pages SET content = ? WHERE guid = ?').run(firstPart, pageGuid);
  console.log(`    Updated page ${pageGuid} with first part`);
  
  // Remaining part: create new page and recursively process it
  const remainingPart = parts.slice(1).join('\\\\<br>');
  const newPageGuid = nextGuidRef.value++;
  
  db.prepare('INSERT INTO pages (guid, content) VALUES (?, ?)').run(newPageGuid, remainingPart);
  console.log(`    Created new page ${newPageGuid} with remaining part`);
  stats.pageSplits.newPagesCreated++;
  newPageGuids.push(newPageGuid);
  
  // Process each library item that uses the original page
  const newLibraryItemPageEntries = [];
  for (const entry of libraryItemPageEntries) {
    const libraryItemGuid = entry.library_item_guid;
    const currentOrderNumber = entry.order_number;
    const insertOrderNumber = currentOrderNumber + 1;
    
    // First, increment all pages for the same library_item that have order_number >= insertOrderNumber
    // We need to do this BEFORE inserting the new page to avoid conflicts
    const pagesToUpdate = db.prepare(`
      SELECT page_guid, order_number 
      FROM library_item_pages 
      WHERE library_item_guid = ? 
        AND order_number >= ?
      ORDER BY order_number DESC
    `).all(libraryItemGuid, insertOrderNumber);
    
    // Update in reverse order (highest first) to avoid constraint violations
    for (const pageToUpdate of pagesToUpdate) {
      const oldOrder = pageToUpdate.order_number;
      const newOrder = oldOrder + 1;
      
      // Delete old entry
      db.prepare(`
        DELETE FROM library_item_pages 
        WHERE library_item_guid = ? AND page_guid = ? AND order_number = ?
      `).run(libraryItemGuid, pageToUpdate.page_guid, oldOrder);
      
      // Insert with new order
      db.prepare(`
        INSERT INTO library_item_pages (library_item_guid, page_guid, order_number)
        VALUES (?, ?, ?)
      `).run(libraryItemGuid, pageToUpdate.page_guid, newOrder);
      
      console.log(`      Updated page ${pageToUpdate.page_guid} order from ${oldOrder} to ${newOrder} (library_item: ${libraryItemGuid})`);
    }
    
    // Insert the new page into library_item_pages
    try {
      db.prepare(`
        INSERT INTO library_item_pages (library_item_guid, page_guid, order_number)
        VALUES (?, ?, ?)
      `).run(libraryItemGuid, newPageGuid, insertOrderNumber);
      console.log(`      Inserted new page ${newPageGuid} into library_item_pages (library_item: ${libraryItemGuid}, order: ${insertOrderNumber})`);
      
      // Store entry for recursive processing
      newLibraryItemPageEntries.push({
        library_item_guid: libraryItemGuid,
        order_number: insertOrderNumber
      });
    } catch (error) {
      console.warn(`      Warning: Could not insert new page into library_item_pages: ${error.message}`);
    }
  }
  
  // Recursively process the new page if it also contains \\<br>
  const newPageContent = db.prepare('SELECT content FROM pages WHERE guid = ?').get(newPageGuid)?.content || '';
  if (newPageContent.includes('\\\\<br>') && newLibraryItemPageEntries.length > 0) {
    console.log(`    New page ${newPageGuid} also contains \\\\<br> marker, splitting recursively...`);
    const additionalNewPages = splitPageRecursively(newPageGuid, newPageContent, nextGuidRef, newLibraryItemPageEntries);
    newPageGuids.push(...additionalNewPages);
  }
  
  return newPageGuids;
}

/**
 * Split pages that contain \\<br> marker
 */
function splitPagesOnBrMarker() {
  console.log('\n=== Splitting Pages on \\\\<br> Marker ===');
  
  // Get all pages
  const allPages = db.prepare('SELECT guid, content FROM pages').all();
  console.log(`Found ${allPages.length} pages to check`);
  
  // Get max guid for new pages
  const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM pages').get()?.maxGuid || 0;
  const nextGuidRef = { value: maxGuid + 1 }; // Use object to pass by reference
  
  // Process each page
  for (const page of allPages) {
    try {
      const pageGuid = page.guid;
      const content = page.content || '';
      
      // Check if content contains \\<br>
      if (!content.includes('\\\\<br>')) {
        continue;
      }
      
      console.log(`  Found \\\\<br> marker(s) in page ${pageGuid}, splitting recursively...`);
      
      // Find all library_item_pages entries that reference this page
      const libraryItemPageEntries = db.prepare(`
        SELECT library_item_guid, order_number 
        FROM library_item_pages 
        WHERE page_guid = ?
        ORDER BY order_number
      `).all(pageGuid);
      
      console.log(`    Found ${libraryItemPageEntries.length} library item(s) using this page`);
      
      // Recursively split the page
      const newPageGuids = splitPageRecursively(pageGuid, content, nextGuidRef, libraryItemPageEntries);
      
      if (newPageGuids.length > 0) {
        console.log(`    Created ${newPageGuids.length} new page(s) from page ${pageGuid}`);
        stats.pageSplits.pagesSplit++;
      }
    } catch (error) {
      console.error(`  Error splitting page ${page.guid}:`, error.message);
      stats.pageSplits.errors++;
    }
  }
  
  console.log(`\nPage splitting complete: ${stats.pageSplits.pagesSplit} pages split, ${stats.pageSplits.newPagesCreated} new pages created, ${stats.pageSplits.errors} errors`);
}

/**
 * Process page content: replace [] with <i></i> and {} with <chord></chord>
 * Chord replacement only happens if the text starts with a valid chord name
 * from dur or mol arrays, and chi tags are added for matching chi suffixes
 */
function processPageContent() {
  console.log('\n=== Processing Page Content (Brackets to Tags) ===');
  
  // Define chord arrays matching transpose function
  const dur = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'B', 'H'];
  const mol = ['c', 'cis', 'd', 'dis', 'e', 'f', 'fis', 'g', 'gis', 'a', 'b', 'h'];
  const chi = ['4', '7', 'maj7', 'dim', '5b', 'sus4', '6', '7/5#', '7/5b', '7/6', '7/4', '9', '9/5', '9/5b'];
  
  // Helper function to find the longest matching chord prefix
  function findChordPrefix(text, chordArrays) {
    let longestMatch = null;
    let longestLength = 0;
    
    for (const chordArray of chordArrays) {
      for (const chord of chordArray) {
        if (text.startsWith(chord) && chord.length > longestLength) {
          longestMatch = chord;
          longestLength = chord.length;
        }
      }
    }
    
    return longestMatch;
  }
  
  // Helper function to find the longest matching chi suffix
  function findChiSuffix(text, chiArray) {
    // Sort chi array by length (longest first) to match longest possible suffix first
    const sortedChi = [...chiArray].sort((a, b) => b.length - a.length);
    
    for (const chiItem of sortedChi) {
      if (text.endsWith(chiItem)) {
        return chiItem;
      }
    }
    
    return null;
  }
  
  // Get all pages
  const allPages = db.prepare('SELECT guid, content FROM pages').all();
  console.log(`Found ${allPages.length} pages to process`);
  
  // Process each page
  for (const page of allPages) {
    try {
      const pageGuid = page.guid;
      let content = page.content || '';
      
      if (!content) {
        continue;
      }
      
      let updated = false;
      let italicCount = 0;
      let chordCount = 0;
      let chiCount = 0;
      
      // Replace text inside [] brackets with <i></i> tags
      // Match [text] and replace with <i>text</i>
      const italicRegex = /\[([^\]]*)\]/g;
      const italicMatches = content.match(italicRegex);
      if (italicMatches) {
        content = content.replace(italicRegex, '<i>$1</i>');
        italicCount = italicMatches.length;
        updated = true;
      }
      
      // Replace text inside {} brackets with <chord></chord> tags
      // Only if it starts with a valid chord name from dur or mol arrays
      const chordRegex = /\{([^}]*)\}/g;
      content = content.replace(chordRegex, (match, chordText) => {
        // Trim whitespace
        const trimmed = chordText.trim();
        
        if (!trimmed) {
          return match; // Empty chord, don't replace
        }
        
        // Find the longest matching chord prefix from dur or mol arrays
        const chordPrefix = findChordPrefix(trimmed, [dur, mol]);
        
        if (!chordPrefix) {
          // Not a valid chord, don't replace
          return match;
        }
        
        // Extract remaining text after the chord prefix
        const remaining = trimmed.substring(chordPrefix.length);
        
        if (!remaining) {
          // Just the chord name, no suffix
          chordCount++;
          updated = true;
          return `<chord>${chordPrefix}</chord>`;
        }
        
        // Check if remaining text matches a chi suffix
        const chiSuffix = findChiSuffix(remaining, chi);
        
        if (chiSuffix) {
          // Extract the part before chi suffix (could be empty or have other characters)
          const beforeChi = remaining.substring(0, remaining.length - chiSuffix.length);
          
          // Build the chord tag with chi
          chordCount++;
          chiCount++;
          updated = true;
          
          if (beforeChi) {
            // There's text between chord and chi (e.g., "Cadd9" -> "Cadd" + "9")
            return `<chord>${chordPrefix}${beforeChi}<chi>${chiSuffix}</chi></chord>`;
          } else {
            // Chi suffix directly follows chord
            return `<chord>${chordPrefix}<chi>${chiSuffix}</chi></chord>`;
          }
        } else {
          // Valid chord but no chi suffix - keep the remaining text as part of chord
          chordCount++;
          updated = true;
          return `<chord>${chordPrefix}${remaining}</chord>`;
        }
      });
      
      // Update page if content was modified
      if (updated) {
        db.prepare('UPDATE pages SET content = ? WHERE guid = ?').run(content, pageGuid);
        const logParts = [];
        if (italicCount > 0) logParts.push(`${italicCount} italic replacement(s)`);
        if (chordCount > 0) logParts.push(`${chordCount} chord replacement(s)`);
        if (chiCount > 0) logParts.push(`${chiCount} chi tag replacement(s)`);
        console.log(`  Processed page ${pageGuid}: ${logParts.join(', ')}`);
        stats.pageContentProcessing.pagesProcessed++;
        stats.pageContentProcessing.italicReplacements += italicCount;
        stats.pageContentProcessing.chordReplacements += chordCount;
        stats.pageContentProcessing.chiTagReplacements += chiCount;
      }
    } catch (error) {
      console.error(`  Error processing page ${page.guid}:`, error.message);
      stats.pageContentProcessing.errors++;
    }
  }
  
  console.log(`\nPage content processing complete: ${stats.pageContentProcessing.pagesProcessed} pages processed, ${stats.pageContentProcessing.italicReplacements} italic replacements, ${stats.pageContentProcessing.chordReplacements} chord replacements, ${stats.pageContentProcessing.chiTagReplacements} chi tag replacements, ${stats.pageContentProcessing.errors} errors`);
}

/**
 * Clean up escaped br tags: replace \<br> with <br>
 */
function cleanBrTags() {
  console.log('\n=== Cleaning Br Tags (\\<br> to <br>) ===');
  
  // Get all pages
  const allPages = db.prepare('SELECT guid, content FROM pages').all();
  console.log(`Found ${allPages.length} pages to check`);
  
  // Process each page
  for (const page of allPages) {
    try {
      const pageGuid = page.guid;
      let content = page.content || '';
      
      if (!content) {
        continue;
      }
      
      // Check if content contains \<br> (escaped backslash before <br>)
      if (!content.includes('\\<br>')) {
        continue;
      }
      
      // Count replacements
      const brRegex = /\\<br>/g;
      const matches = content.match(brRegex);
      const replacementCount = matches ? matches.length : 0;
      
      if (replacementCount > 0) {
        // Replace \<br> with <br>
        content = content.replace(brRegex, '<br>');
        
        // Update page
        db.prepare('UPDATE pages SET content = ? WHERE guid = ?').run(content, pageGuid);
        console.log(`  Cleaned page ${pageGuid}: ${replacementCount} replacement(s)`);
        stats.brTagCleaning.pagesProcessed++;
        stats.brTagCleaning.replacements += replacementCount;
      }
    } catch (error) {
      console.error(`  Error cleaning br tags in page ${page.guid}:`, error.message);
      stats.brTagCleaning.errors++;
    }
  }
  
  console.log(`\nBr tag cleaning complete: ${stats.brTagCleaning.pagesProcessed} pages processed, ${stats.brTagCleaning.replacements} replacements, ${stats.brTagCleaning.errors} errors`);
}

/**
 * Main execution
 */
function main() {
  console.log('Starting import from pesmi.json...');
  console.log(`Log file: ${logFile}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);
  
  try {
    // Import in order: tags, library items, pages, library item pages, tonalities, collections, collection items, album collections, album collection items, then tag links
    importTags();
    importLibraryItems();
    importPages();
    importLibraryItemPages();
    importTonalities();
    const oznakaToGuid = importCollections();
    importCollectionItems(oznakaToGuid);
    const pidToGuid = importAlbumCollections();
    importAlbumCollectionItems(pidToGuid);
    importLibraryItemTags();
    
    // Split pages that contain \\<br> marker
    splitPagesOnBrMarker();
    
    // Process page content: replace brackets with tags
    processPageContent();
    
    // Clean up escaped br tags: replace \<br> with <br>
    cleanBrTags();
    
    // Print summary
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Tags:`);
    console.log(`  Imported: ${stats.tags.imported}`);
    console.log(`  Skipped: ${stats.tags.skipped}`);
    console.log(`  Errors: ${stats.tags.errors}`);
    console.log(`\nLibrary Items:`);
    console.log(`  Imported: ${stats.libraryItems.imported}`);
    console.log(`  Skipped: ${stats.libraryItems.skipped}`);
    console.log(`  Errors: ${stats.libraryItems.errors}`);
    console.log(`\nPages:`);
    console.log(`  Imported: ${stats.pages.imported}`);
    console.log(`  Skipped: ${stats.pages.skipped}`);
    console.log(`  Errors: ${stats.pages.errors}`);
    console.log(`\nLibrary Item Pages:`);
    console.log(`  Items linked: ${stats.libraryItemPages.imported}`);
    console.log(`  Skipped: ${stats.libraryItemPages.skipped}`);
    console.log(`  Errors: ${stats.libraryItemPages.errors}`);
    console.log(`\nTonalities:`);
    console.log(`  Imported: ${stats.tonalities.imported}`);
    console.log(`  Skipped: ${stats.tonalities.skipped}`);
    console.log(`  Errors: ${stats.tonalities.errors}`);
    console.log(`\nCollections:`);
    console.log(`  Imported: ${stats.collections.imported}`);
    console.log(`  Skipped: ${stats.collections.skipped}`);
    console.log(`  Errors: ${stats.collections.errors}`);
    console.log(`\nCollection Items:`);
    console.log(`  Imported: ${stats.collectionItems.imported}`);
    console.log(`  Skipped: ${stats.collectionItems.skipped}`);
    console.log(`  Errors: ${stats.collectionItems.errors}`);
    console.log(`\nAlbum Collections:`);
    console.log(`  Imported: ${stats.albumCollections.imported}`);
    console.log(`  Skipped: ${stats.albumCollections.skipped}`);
    console.log(`  Errors: ${stats.albumCollections.errors}`);
    console.log(`\nAlbum Collection Items:`);
    console.log(`  Imported: ${stats.albumCollectionItems.imported}`);
    console.log(`  Skipped: ${stats.albumCollectionItems.skipped}`);
    console.log(`  Errors: ${stats.albumCollectionItems.errors}`);
    console.log(`\nLibrary Item Tags:`);
    console.log(`  Items linked: ${stats.libraryItemTags.imported}`);
    console.log(`  Skipped: ${stats.libraryItemTags.skipped}`);
    console.log(`  Errors: ${stats.libraryItemTags.errors}`);
    console.log(`\nPage Splits:`);
    console.log(`  Pages split: ${stats.pageSplits.pagesSplit}`);
    console.log(`  New pages created: ${stats.pageSplits.newPagesCreated}`);
    console.log(`  Errors: ${stats.pageSplits.errors}`);
    console.log(`\nPage Content Processing:`);
    console.log(`  Pages processed: ${stats.pageContentProcessing.pagesProcessed}`);
    console.log(`  Italic replacements: ${stats.pageContentProcessing.italicReplacements}`);
    console.log(`  Chord replacements: ${stats.pageContentProcessing.chordReplacements}`);
    console.log(`  Chi tag replacements: ${stats.pageContentProcessing.chiTagReplacements}`);
    console.log(`  Errors: ${stats.pageContentProcessing.errors}`);
    console.log(`\nBr Tag Cleaning:`);
    console.log(`  Pages processed: ${stats.brTagCleaning.pagesProcessed}`);
    console.log(`  Replacements: ${stats.brTagCleaning.replacements}`);
    console.log(`  Errors: ${stats.brTagCleaning.errors}`);
    
    // Write summary to log file
    logStream.write('\n=== IMPORT SUMMARY ===\n');
    logStream.write(JSON.stringify(stats, null, 2));
    logStream.write('\n');
    
    console.log(`\nImport complete! Log file: ${logFile}`);
  } catch (error) {
    console.error('Fatal error during import:', error);
    logStream.write(`\nFATAL ERROR: ${error.message}\n${error.stack}\n`);
  } finally {
    logStream.end();
  }
}

// Run the import
main();

