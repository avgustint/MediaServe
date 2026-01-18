const path = require('path');
const https = require('https');
const fs = require('fs');
const { getDatabase } = require('./server/database');
const dbOps = require('./server/dbOperations');

// Setup logging to file
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const logFile = path.join(logDir, `import-${timestamp}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Override console methods to log to both console and file
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

function logToFile(...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ${message}\n`);
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

// Log script start
console.log(`\n========================================`);
console.log(`Import script started`);
console.log(`Log file: ${logFile}`);
console.log(`========================================\n`);

// Cleanup function
function cleanup() {
  logStream.end();
}

process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

// Base URL for Pevec data
const BASE_URL = 'https://zupnija-ajdovscina.rkc.si/uploads/Pevec/html/content';

// Initialize database
const db = getDatabase();

/**
 * Fetch JSON data from URL
 */
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Split text on \\\\\n\n (four backslashes + newline + newline) to create multiple pages
 * Returns array of text parts
 * 
 * In the raw JSON file:
 * - "\\\\\\\\\\n\n" (eight backslashes + n + newline) → becomes "\\\\\n\n" (four backslashes + newline + newline) after JSON.parse() → SPLIT INTO PAGES
 * - "\\\\\\n" (six backslashes + n) → becomes "\\\n" (three backslashes + newline) after JSON.parse() → BECOMES <br> TAG
 * 
 * So we need to:
 * 1. Split on "\\\\\n\n" (four backslashes + newline + newline) for page breaks
 * 2. Then replace "\\\n" (three backslashes + newline) with <br> in each part (handled in processTextContent)
 */
function splitTextOnDoubleEscapedNewline(text) {
  if (!text) return [text];
  
  // Split on \\\\\n\n (four backslashes + newline + newline) - this is the page break marker
  // In the parsed JSON string, "\\\\\\\\\\n\n" from raw JSON becomes "\\\\\n\n" (four backslashes + newline + newline)
  // We need to match: backslash, backslash, backslash, backslash, newline, newline
  // Use RegExp constructor to properly escape the pattern
  const pattern = new RegExp('\\\\\n');
  const parts = text.split(pattern);
  
  // If no split occurred (only one part), return original text as single item
  if (parts.length === 1) {
    return [text];
  }
  
  // Filter out empty parts and trim
  return parts
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

/**
 * Process text content: replace \\\n (three backslashes + newline) with <br>, [text] with <i>text</i>, {text} with <chord>text</chord>
 * 
 * Note: \\\\\n\n (four backslashes + newline + newline) should be split into pages BEFORE calling this function
 *       \\\n (three backslashes + newline) becomes <br> tag (handled here)
 * 
 * In the parsed JSON string:
 * - "\\\\\\n" (six backslashes + n) from raw JSON becomes "\\\n" (three backslashes + newline)
 * - This should be replaced with <br> tags for line breaks within a page
 */
function processTextContent(text) {
  if (!text) return text;
  
  let processed = text;
  
  // Replace \\\n (three backslashes + newline) with <br> tags
  // This is the newline marker within a page
  // In the parsed JSON string, "\\\\\\n" from raw JSON becomes "\\\n" (three backslashes + newline)
  // We match: backslash, backslash, backslash, newline
  // In regex literal, to match three backslashes we need six: /\\\\\\\n/g
  processed = processed.replace(/\\\n/g, '<br>');
  
  // Also replace actual newline characters (\n) with <br> tags
  // This handles any actual newlines that might exist (without preceding backslashes)
  processed = processed.replace(/\n/g, '<br>');
  
  // Replace text between { } with <chord> tags
  // Use non-greedy matching to handle multiple chords on the same line
  processed = processed.replace(/\{([^}]+)\}/g, '<chord>$1</chord>');
  
  // Replace text between [ ] with <i> tags (italic)
  // Use non-greedy matching to handle multiple italic sections
  processed = processed.replace(/\[([^\]]+)\]/g, '<i>$1</i>');
  
  return processed;
}

/**
 * Fetch text data (tdata.js) - it's a JavaScript file that exports an array
 */
function fetchTextData() {
  return new Promise((resolve, reject) => {
    https.get(`${BASE_URL}/tdata.js`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          // tdata.js is a JavaScript file, we need to extract the array
          // It's likely in format: ["text1","text2","text3"]
          // Remove any wrapper code and extract just the array
          const arrayMatch = data.match(/\[(.*)\]/s);
          if (arrayMatch) {
            // Parse as JSON array
            const arrayStr = '[' + arrayMatch[1] + ']';
            // Replace escaped quotes and newlines
            const cleaned = arrayStr.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
            // Try to parse
            const texts = JSON.parse(cleaned);
            resolve(texts);
          } else {
            // Try to parse directly as JSON
            resolve(JSON.parse(data));
          }
        } catch (e) {
          // If parsing fails, try to extract strings manually
          const texts = [];
          const stringRegex = /"([^"\\]*(\\.[^"\\]*)*)"/g;
          let match;
          while ((match = stringRegex.exec(data)) !== null) {
            texts.push(match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\'));
          }
          resolve(texts);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Import tags from pesmi2.json
 */
function importTags() {
  console.log('\n=== Importing Tags ===\n');
  
  // Read pesmi2.json
  const pesmi2Path = path.join(__dirname, 'Pesmi', 'pesmi2.json');
  const pesmi2Data = JSON.parse(fs.readFileSync(pesmi2Path, 'utf8'));
  const zvrst = pesmi2Data.tables?.zvrst || pesmi2Data.tables?.zvrsti || [];

  console.log(`Found ${zvrst.length} zvrst records to import`);

  // Function to check if tag exists by name
  function tagExists(name) {
    const existing = db.prepare('SELECT guid FROM tags WHERE name = ?').get(name);
    return existing !== undefined;
  }

  // Import tags
  const imported = [];
  const skipped = [];

  for (const z of zvrst) {
    // Skip if Oznaka or zvrst is empty
    if (!z.Oznaka || z.Oznaka.trim() === '' || !z.zvrst || z.zvrst.trim() === '') {
      skipped.push(z);
      continue;
    }

    // Check if tag with same name already exists
    if (tagExists(z.Oznaka)) {
      console.log(`Skipping duplicate: "${z.Oznaka}" (already exists)`);
      skipped.push(z);
      continue;
    }

    // Map fields
    const tagData = {
      name: z.Oznaka || '',
      description: z.zvrst || null
    };

    try {
      const newTag = dbOps.createTag(tagData);
      imported.push(newTag);
      console.log(`Imported: "${newTag.name}" (${newTag.description || 'no description'}) (GUID: ${newTag.guid})`);
    } catch (error) {
      console.error(`Error importing "${tagData.name}":`, error.message);
      skipped.push(z);
    }
  }

  console.log(`\nTags import complete!`);
  console.log(`- Imported: ${imported.length} tags`);
  console.log(`- Skipped: ${skipped.length} records`);

  if (skipped.length > 0 && skipped.length <= 10) {
    console.log(`\nSkipped records:`);
    skipped.forEach(z => {
      console.log(`  - "${z.Oznaka || 'no oznaka'}" (${z.zvrst || 'no zvrst'})`);
    });
  }

  return { imported: imported.length, skipped: skipped.length };
}

/**
 * Import collections from pesmi2.json (pesmarice - songbooks)
 */
function importCollections() {
  console.log('\n=== Importing Collections (Pesmarice) ===\n');
  
  // Read pesmi2.json
  const pesmi2Path = path.join(__dirname, 'Pesmi', 'pesmi2.json');
  const pesmi2Data = JSON.parse(fs.readFileSync(pesmi2Path, 'utf8'));
  const pesmarice = pesmi2Data.tables?.pesmarice || [];

  console.log(`Found ${pesmarice.length} pesmarice records to import`);

  // Function to check if collection exists by title
  function collectionExists(title) {
    const existing = db.prepare('SELECT guid FROM collections WHERE title = ?').get(title);
    return existing !== undefined;
  }

  // Import collections
  const imported = [];
  const skipped = [];

  for (const pesmarica of pesmarice) {
    // Skip if naslov is "Neznano" or empty
    if (!pesmarica.naslov || pesmarica.naslov.trim() === '' || pesmarica.naslov === 'Neznano') {
      skipped.push(pesmarica);
      continue;
    }

    // Check if collection with same title already exists
    if (collectionExists(pesmarica.naslov)) {
      console.log(`Skipping duplicate: "${pesmarica.naslov}" (already exists)`);
      skipped.push(pesmarica);
      continue;
    }

    // Map fields
    const collectionData = {
      title: pesmarica.naslov || '',
      label: pesmarica.oznaka || null,
      year: pesmarica['leto izida'] && pesmarica['leto izida'] > 0 ? pesmarica['leto izida'] : null,
      publisher: pesmarica.Založba || null,
      source: pesmarica.vir || null
    };

    try {
      const newCollection = dbOps.createCollection(collectionData);
      imported.push(newCollection);
      console.log(`Imported: "${newCollection.title}" (GUID: ${newCollection.guid})`);
    } catch (error) {
      console.error(`Error importing "${collectionData.title}":`, error.message);
      skipped.push(pesmarica);
    }
  }

  console.log(`\nCollections (Pesmarice) import complete!`);
  console.log(`- Imported: ${imported.length} collections`);
  console.log(`- Skipped: ${skipped.length} records`);

  if (skipped.length > 0 && skipped.length <= 10) {
    console.log(`\nSkipped records:`);
    skipped.forEach(p => {
      console.log(`  - "${p.naslov}" (${p.oznaka || 'no label'})`);
    });
  }

  return { imported: imported.length, skipped: skipped.length };
}

/**
 * Import albums from pesmi.json as collections
 */
function importAlbums() {
  console.log('\n=== Importing Albums as Collections ===\n');
  
  // Read pesmi.json
  const pesmiPath = path.join(__dirname, 'Pesmi', 'pesmi.json');
  const pesmiData = JSON.parse(fs.readFileSync(pesmiPath, 'utf8'));
  const albums = pesmiData.tables?.Album || [];

  console.log(`Found ${albums.length} albums to import`);

  // Function to check if collection exists by title
  function collectionExists(title) {
    const existing = db.prepare('SELECT guid FROM collections WHERE title = ?').get(title);
    return existing !== undefined;
  }

  // Import albums as collections
  const imported = [];
  const skipped = [];

  for (const album of albums) {
    // Skip if ime or opis is empty
    if (!album.ime || album.ime.trim() === '' || !album.opis || album.opis.trim() === '') {
      skipped.push(album);
      continue;
    }

    // Use opis as title, or ime if opis is not available
    const title = album.opis || album.ime;

    // Check if collection with same title already exists
    if (collectionExists(title)) {
      console.log(`Skipping duplicate: "${title}" (already exists)`);
      skipped.push(album);
      continue;
    }

    // Map fields
    const collectionData = {
      title: title,
      label: album.ime || null,
      year: null, // Albums don't have year info
      publisher: null, // Albums don't have publisher info
      source: 'pesmi.json - Album'
    };

    try {
      const newCollection = dbOps.createCollection(collectionData);
      imported.push(newCollection);
      console.log(`Imported: "${newCollection.title}" (${album.ime}) (GUID: ${newCollection.guid})`);
    } catch (error) {
      console.error(`Error importing "${collectionData.title}":`, error.message);
      skipped.push(album);
    }
  }

  console.log(`\nAlbums import complete!`);
  console.log(`- Imported: ${imported.length} albums as collections`);
  console.log(`- Skipped: ${skipped.length} records`);

  if (skipped.length > 0 && skipped.length <= 10) {
    console.log(`\nSkipped records:`);
    skipped.forEach(a => {
      console.log(`  - "${a.ime || 'no ime'}" (${a.opis || 'no opis'})`);
    });
  }

  return { imported: imported.length, skipped: skipped.length };
}

/**
 * Find an available title by adding incremental number if title already exists
 * Returns the original title if available, or title with (2), (3), etc. if needed
 */
function findAvailableTitle(originalTitle) {
  // Check if original title is available
  const existing = db.prepare('SELECT guid FROM library_items WHERE name = ?').get(originalTitle);
  if (!existing) {
    return originalTitle;
  }
  
  // Find the next available number
  let number = 2;
  let newTitle = `${originalTitle} (${number})`;
  
  while (db.prepare('SELECT guid FROM library_items WHERE name = ?').get(newTitle)) {
    number++;
    newTitle = `${originalTitle} (${number})`;
  }
  
  return newTitle;
}

/**
 * Build mapping from tag name (Oznaka) to tag guid
 */
function buildTagNameToGuidMap() {
  const tags = dbOps.getAllTags();
  const tagMap = new Map();
  for (const tag of tags) {
    tagMap.set(tag.name, tag.guid);
  }
  return tagMap;
}

/**
 * Build mapping from zvrst zid to tag guid
 * Uses pesmi.json zvrsti table and maps via Oznaka to tag name
 */
function buildZvrstIdToTagGuidMap() {
  const pesmiPath = path.join(__dirname, 'Pesmi', 'pesmi.json');
  const pesmiData = JSON.parse(fs.readFileSync(pesmiPath, 'utf8'));
  const zvrsti = pesmiData.tables?.zvrsti || [];
  
  const tagNameToGuid = buildTagNameToGuidMap();
  const zvrstIdToTagGuid = new Map();
  
  for (const zvrst of zvrsti) {
    if (zvrst.Oznaka && tagNameToGuid.has(zvrst.Oznaka)) {
      zvrstIdToTagGuid.set(zvrst.zid, tagNameToGuid.get(zvrst.Oznaka));
    }
  }
  
  return zvrstIdToTagGuid;
}

/**
 * Get tag GUIDs for a song based on pesem_zvrst table
 */
function getTagGuidsForSong(phId, pesem_zvrst, zvrstIdToTagGuid) {
  const tagGuids = [];
  const songTags = pesem_zvrst.filter(pz => pz.pesem === phId);
  
  for (const songTag of songTags) {
    if (zvrstIdToTagGuid.has(songTag.zvrst)) {
      const tagGuid = zvrstIdToTagGuid.get(songTag.zvrst);
      if (!tagGuids.includes(tagGuid)) {
        tagGuids.push(tagGuid);
      }
    }
  }
  
  return tagGuids;
}

/**
 * Import songs from pesmi.json that are not in any collection
 */
function importUncategorizedSongs() {
  console.log('\n=== Importing Uncategorized Songs from pesmi.json ===\n');
  
  // Read pesmi.json
  const pesmiPath = path.join(__dirname, 'Pesmi', 'pesmi.json');
  const pesmiData = JSON.parse(fs.readFileSync(pesmiPath, 'utf8'));
  
  const pesmi = pesmiData.tables?.pesmi || [];
  const diasi = pesmiData.tables?.diasi || [];
  const kitice = pesmiData.tables?.kitice || [];
  const pesem_kitica = pesmiData.tables?.pesem_kitica || [];
  const pesem_zvrst = pesmiData.tables?.pesem_zvrst || [];
  
  console.log(`Found ${pesmi.length} songs, ${diasi.length} diasi records, ${kitice.length} kitice records`);
  console.log(`Found ${pesem_zvrst.length} song-tag links`);
  
  // Build mapping from zvrst zid to tag guid
  const zvrstIdToTagGuid = buildZvrstIdToTagGuidMap();
  console.log(`Built tag mapping: ${zvrstIdToTagGuid.size} zvrst IDs mapped to tags`);
  
  // Find songs that are not in any album (not linked via diasi)
  const songsWithDiasi = new Set(diasi.map(d => d.phId));
  const uncategorizedSongs = pesmi.filter(p => !songsWithDiasi.has(p.phId));
  
  console.log(`Found ${uncategorizedSongs.length} songs not in any album`);
  
  let imported = 0;
  let skipped = 0;
  let songsWithTags = 0;
  let renamedSongs = 0;
  const renamedSongsList = []; // Store all renamed songs for logging
  const skipReasons = {
    noTitle: 0,
    noStanzas: 0,
    error: 0
  };
  
  for (const song of uncategorizedSongs) {
    // Skip if no title
    if (!song.naslov || song.naslov.trim() === '') {
      skipped++;
      skipReasons.noTitle++;
      continue;
    }
    
    // Find available title (with incremental number if needed)
    const finalTitle = findAvailableTitle(song.naslov);
    const wasRenamed = finalTitle !== song.naslov;
    if (wasRenamed) {
      renamedSongs++;
      renamedSongsList.push({ original: song.naslov, renamed: finalTitle });
    }
    
    // Get stanzas for this song using pesem_kitica
    const songStanzas = pesem_kitica
      .filter(pk => pk.phid === song.phId)
      .sort((a, b) => (a.ordun || 0) - (b.ordun || 0))
      .map(pk => {
        const kitica = kitice.find(k => k.cid === pk.cid);
        return kitica;
      })
      .filter(k => k && k.besedilo); // Only include stanzas with text
    
    if (songStanzas.length === 0) {
      skipped++;
      skipReasons.noStanzas++;
      if (imported + skipped <= 10) {
        console.log(`  Skipped: "${song.naslov}" - no stanzas found`);
      }
      continue;
    }
    
    // Create pages from stanzas
    const pageGuids = [];
    for (const stanza of songStanzas) {
      try {
        // First unescape quotes
        let text = stanza.besedilo.replace(/\\"/g, '"');
        
        // Check if text contains \\n (two backslashes + n) - split into multiple pages
        // This pattern comes from \\\\n (four backslashes + n) in raw JSON
        const textParts = splitTextOnDoubleEscapedNewline(text);
        
        for (const part of textParts) {
          // Process each part (chords, italics, newlines)
          // This will convert \n (backslash + newline) to <br> tags
          const processedText = processTextContent(part);
          
          // Only create page if there's actual content
          if (processedText && processedText.trim().length > 0) {
            const newPage = dbOps.createPage(processedText);
            pageGuids.push(newPage.guid);
          }
        }
      } catch (error) {
        console.error(`    Error creating page for "${song.naslov}":`, error.message);
        // Clean up already created pages
        for (const pageGuid of pageGuids) {
          try {
            db.prepare('DELETE FROM pages WHERE guid = ?').run(pageGuid);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
        throw error;
      }
    }
    
    // Get tags for this song
    const tagGuids = getTagGuidsForSong(song.phId, pesem_zvrst, zvrstIdToTagGuid);
    if (tagGuids.length > 0) {
      songsWithTags++;
    }
    
    // Create library item
    try {
      const itemData = {
        name: finalTitle,
        type: 'text',
        description: song.naslov1 || null,
        author: song.avtor || null,
        pageGuids: pageGuids,
        tagGuids: tagGuids
      };
      
      const newItem = dbOps.createLibraryItem(itemData);
      imported++;
      
      if (imported % 10 === 0 || imported <= 10) {
        console.log(`  Imported: "${newItem.name}" (${songStanzas.length} stanzas, GUID: ${newItem.guid})`);
      }
    } catch (error) {
      console.error(`  Error creating library item "${song.naslov}":`, error.message);
      // Clean up pages
      for (const pageGuid of pageGuids) {
        try {
          db.prepare('DELETE FROM pages WHERE guid = ?').run(pageGuid);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      skipped++;
      skipReasons.error++;
    }
  }
  
  console.log(`\nUncategorized songs import complete!`);
  console.log(`- Imported: ${imported} songs`);
  console.log(`- Skipped: ${skipped} songs`);
  console.log(`- Renamed (duplicate titles): ${renamedSongs} songs`);
  console.log(`- Songs with tags: ${songsWithTags}`);
  
  // Log all renamed songs
  if (renamedSongsList.length > 0) {
    console.log(`\nRenamed songs (${renamedSongsList.length}):`);
    renamedSongsList.forEach(({ original, renamed }) => {
      console.log(`  "${original}" -> "${renamed}"`);
    });
  }
  
  console.log(`\nSkip reasons breakdown:`);
  console.log(`  - Missing title: ${skipReasons.noTitle}`);
  console.log(`  - No stanzas found: ${skipReasons.noStanzas}`);
  console.log(`  - Error during creation: ${skipReasons.error}`);
  
  return { imported, skipped, skipReasons, songsWithTags, renamed: renamedSongs };
}

/**
 * Import songs from Pevec API
 */
async function importSongs() {
  console.log('\n=== Importing Songs from Pevec ===\n');
  
  try {
    console.log('Fetching index data...');
    const indexData = await fetchJSON(`${BASE_URL}/index.js`);
    
    console.log('Fetching text data...');
    const textData = await fetchTextData();
    console.log(`Loaded ${textData.length} text entries`);
    
    const collections = indexData.pesmarice || [];
    const projekcije = indexData.projekcije || [];
    
    console.log(`Found ${collections.length} pesmarice and ${projekcije.length} projekcije`);
    
    // Import collections first
    const collectionMap = new Map(); // Maps collection pid to guid
    const collectionNameMap = new Map(); // Maps collection name/pid to lex identifier
    
    for (const coll of collections) {
      // Check if collection exists
      const existing = db.prepare('SELECT guid FROM collections WHERE title = ?').get(coll.description || coll.name);
      if (existing) {
        collectionMap.set(coll.pid, existing.guid);
        collectionNameMap.set(coll.pid, coll.name); // Store name for matching with song.info[].lex
        collectionNameMap.set(coll.name, coll.name); // Also map by name
        console.log(`Collection "${coll.description || coll.name}" already exists (GUID: ${existing.guid})`);
        continue;
      }
      
      // Create collection
      const collectionData = {
        title: coll.description || coll.name,
        label: coll.name,
        source: 'Pevec - zupnija-ajdovscina.rkc.si'
      };
      
      const newCollection = dbOps.createCollection(collectionData);
      collectionMap.set(coll.pid, newCollection.guid);
      collectionNameMap.set(coll.pid, coll.name);
      collectionNameMap.set(coll.name, coll.name);
      console.log(`Created collection: "${newCollection.title}" (GUID: ${newCollection.guid})`);
    }
    
    // Process each collection
    let totalSongs = 0;
    let importedSongs = 0;
    let skippedSongs = 0;
    let renamedSongs = 0;
    const renamedSongsList = []; // Store all renamed songs for logging
    const skipReasons = {
      noTitle: 0,
      noDsl: 0,
      noPages: 0,
      error: 0
    };
    
    for (const coll of collections) {
      try {
        console.log(`\nProcessing collection: ${coll.description || coll.name} (${coll.url})`);
        const songsData = await fetchJSON(`${BASE_URL}/${coll.url}`);
        
        if (!Array.isArray(songsData)) {
          console.log(`  Skipping - not an array`);
          continue;
        }
        
        console.log(`  Found ${songsData.length} songs in collection`);
        
        for (const song of songsData) {
          totalSongs++;
          
          if (!song.title || !song.dsl || !Array.isArray(song.dsl) || song.dsl.length === 0) {
            skippedSongs++;
            if (!song.title) {
              skipReasons.noTitle++;
            } else {
              skipReasons.noDsl++;
            }
            if (totalSongs <= 5 || skippedSongs <= 10) {
              console.log(`    Skipped: "${song.title || 'NO TITLE'}" - ${!song.title ? 'missing title' : 'missing/invalid dsl'}`);
            }
            continue;
          }
          
          // Extract text content from dsl references
          const pages = [];
          for (const dslItem of song.dsl) {
            if (dslItem.c !== undefined && textData[dslItem.c - 1]) {
              // dsl.c is 1-based index into textData array
              const rawText = textData[dslItem.c - 1];
              if (rawText && rawText.trim()) {
                // First unescape quotes
                let text = rawText.replace(/\\"/g, '"');
                
                // Check if text contains \\\\n (double escaped newline) - split into multiple pages
                const textParts = splitTextOnDoubleEscapedNewline(text);
                
                for (const part of textParts) {
                  // Process each part (chords, italics, newlines)
                  const processedText = processTextContent(part);
                  
                  // Only add page if there's actual content
                  if (processedText && processedText.trim().length > 0) {
                    pages.push({
                      page: pages.length + 1,
                      content: processedText
                    });
                  }
                }
              }
            }
          }
          
          if (pages.length === 0) {
            skippedSongs++;
            skipReasons.noPages++;
            if (totalSongs <= 5 || skippedSongs <= 10) {
              console.log(`    Skipped: "${song.title}" - no pages extracted (dsl references may be invalid)`);
            }
            continue;
          }
          
          // Get collection-specific info (find matching lex identifier)
          let collectionInfo = null;
          let author = null;
          let collectionNumber = null;
          let collectionPage = null;
          
          if (song.info && Array.isArray(song.info) && song.info.length > 0) {
            // Find info entry that matches current collection
            const collectionLex = coll.name; // e.g., "sg88", "clp61"
            collectionInfo = song.info.find(info => info.lex === collectionLex);
            
            // If not found, try to find any info with match=true (preferred version)
            if (!collectionInfo) {
              collectionInfo = song.info.find(info => info.match === true);
            }
            
            // If still not found, use first info
            if (!collectionInfo) {
              collectionInfo = song.info[0];
            }
            
            if (collectionInfo) {
              author = collectionInfo.auth || null;
              collectionNumber = collectionInfo.no || null;
              collectionPage = collectionInfo.pg || null;
            }
          }
          
          // Find available title (with incremental number if needed)
          const finalTitle = findAvailableTitle(song.title);
          const wasRenamed = finalTitle !== song.title;
          if (wasRenamed) {
            renamedSongs++;
            renamedSongsList.push({ original: song.title, renamed: finalTitle });
          }
          
          // Create library item
          const itemData = {
            name: finalTitle,
            type: 'text',
            description: `From ${coll.description || coll.name}`,
            author: author, // Use author from collection-specific info
            pageGuids: [] // Will be set after creating pages
          };
          
          // Create pages first
          const pageGuids = [];
          for (const page of pages) {
            try {
              // createPage expects only content string, not an object
              const newPage = dbOps.createPage(page.content);
              pageGuids.push(newPage.guid);
            } catch (error) {
              console.error(`    Error creating page for "${song.title}":`, error.message);
              throw error;
            }
          }
          
          itemData.pageGuids = pageGuids;
          
          // Create library item
          try {
            const newItem = dbOps.createLibraryItem(itemData);
            
            // Link to collection with collection item data
            const collectionGuid = collectionMap.get(coll.pid);
            if (collectionGuid && newItem.guid) {
              try {
                const collectionItemData = {
                  collection_number: collectionNumber,
                  collection_page: collectionPage,
                  author: author // Collection-specific author (may differ from library item author)
                };
                dbOps.addCollectionItem(collectionGuid, newItem.guid, collectionItemData);
              } catch (error) {
                console.error(`    Error adding collection item for "${song.title}":`, error.message);
                // Continue even if collection item addition fails
              }
            }
            
            importedSongs++;
            if (importedSongs % 10 === 0) {
              console.log(`  Imported ${importedSongs} songs...`);
            }
          } catch (error) {
            console.error(`    Error creating library item "${song.title}":`, error.message);
            // Clean up pages if item creation fails
            for (const pageGuid of pageGuids) {
              try {
                db.prepare('DELETE FROM pages WHERE guid = ?').run(pageGuid);
              } catch (e) {
                // Ignore cleanup errors
              }
            }
            skippedSongs++;
            skipReasons.error++;
            continue;
          }
        }
      } catch (error) {
        console.error(`Error processing collection ${coll.name}:`, error.message);
      }
    }
    
    console.log(`\nSongs import complete!`);
    console.log(`Total songs processed: ${totalSongs}`);
    console.log(`Imported: ${importedSongs}`);
    console.log(`Skipped: ${skippedSongs}`);
    console.log(`Renamed (duplicate titles): ${renamedSongs} songs`);
    
    // Log all renamed songs
    if (renamedSongsList.length > 0) {
      console.log(`\nRenamed songs (${renamedSongsList.length}):`);
      renamedSongsList.forEach(({ original, renamed }) => {
        console.log(`  "${original}" -> "${renamed}"`);
      });
    }
    
    console.log(`\nSkip reasons breakdown:`);
    console.log(`  - Missing title: ${skipReasons.noTitle}`);
    console.log(`  - Missing/invalid dsl: ${skipReasons.noDsl}`);
    console.log(`  - No pages extracted: ${skipReasons.noPages}`);
    console.log(`  - Error during creation: ${skipReasons.error}`);
    
    return { 
      imported: importedSongs, 
      skipped: skippedSongs, 
      total: totalSongs,
      skipReasons: skipReasons,
      renamed: renamedSongs
    };
    
  } catch (error) {
    console.error('Import error:', error);
    throw error;
  }
}

/**
 * Main import function
 */
async function runAllImports() {
  console.log('========================================');
  console.log('Starting Combined Import Process');
  console.log('========================================\n');
  
  const results = {
    tags: { imported: 0, skipped: 0 },
    collections: { imported: 0, skipped: 0 },
    albums: { imported: 0, skipped: 0 },
    uncategorizedSongs: { imported: 0, skipped: 0 },
    songs: { imported: 0, skipped: 0, total: 0 }
  };
  
  try {
    // 1. Import tags
    results.tags = importTags();
    
    // 2. Import collections (pesmarice - songbooks)
    results.collections = importCollections();
    
    // 3. Import albums as collections
    results.albums = importAlbums();
    
    // 4. Import uncategorized songs from pesmi.json
    results.uncategorizedSongs = importUncategorizedSongs();
    
    // 5. Import songs from Pevec API
    results.songs = await importSongs();
    
    // Summary
    console.log('\n========================================');
    console.log('Import Summary');
    console.log('========================================');
    console.log(`Tags: ${results.tags.imported} imported, ${results.tags.skipped} skipped`);
    console.log(`Collections (Pesmarice): ${results.collections.imported} imported, ${results.collections.skipped} skipped`);
    console.log(`Albums: ${results.albums.imported} imported, ${results.albums.skipped} skipped`);
    console.log(`Uncategorized Songs: ${results.uncategorizedSongs.imported} imported, ${results.uncategorizedSongs.skipped} skipped${results.uncategorizedSongs.renamed ? `, ${results.uncategorizedSongs.renamed} renamed` : ''}`);
    console.log(`Songs (Pevec): ${results.songs.imported} imported, ${results.songs.skipped} skipped (${results.songs.total} total processed)${results.songs.renamed ? `, ${results.songs.renamed} renamed` : ''}`);
    console.log('========================================\n');
    
    console.log('✅ All imports completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error during import process:', error);
    process.exit(1);
  }
}

// Run all imports
runAllImports().then(() => {
  console.log('\nDone!');
  console.log(`\nLog file saved to: ${logFile}`);
  cleanup();
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  console.error(`\nLog file saved to: ${logFile}`);
  cleanup();
  process.exit(1);
});

