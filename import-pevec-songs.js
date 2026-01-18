const path = require('path');
const https = require('https');
const fs = require('fs');
const { getDatabase } = require('./server/database');
const dbOps = require('./server/dbOperations');

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
 * Process text content: replace \n with <br>, [text] with <i>text</i>, {text} with <chord>text</chord>
 */
function processTextContent(text) {
  if (!text) return text;
  
  let processed = text;
  
  // Replace newlines with <br> tags
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
 * Main import function
 */
async function importSongs() {
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
            continue;
          }
          
          // Extract text content from dsl references
          const pages = [];
          for (const dslItem of song.dsl) {
            if (dslItem.c !== undefined && textData[dslItem.c - 1]) {
              // dsl.c is 1-based index into textData array
              const rawText = textData[dslItem.c - 1];
              if (rawText && rawText.trim()) {
                // First unescape the text (handle escaped newlines and quotes)
                let text = rawText.replace(/\\n/g, '\n').replace(/\\"/g, '"');
                // Then process it to add HTML tags for formatting
                text = processTextContent(text);
                pages.push({
                  page: pages.length + 1,
                  content: text
                });
              }
            }
          }
          
          if (pages.length === 0) {
            skippedSongs++;
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
          
          // Check if song already exists (by name)
          const existing = db.prepare('SELECT guid FROM library_items WHERE name = ?').get(song.title);
          if (existing) {
            // Song exists - check if it's already linked to this collection
            const collectionGuid = collectionMap.get(coll.pid);
            if (collectionGuid) {
              const existingCollectionItem = dbOps.getCollectionItem(collectionGuid, existing.guid);
              if (!existingCollectionItem) {
                // Link existing song to collection
                try {
                  const collectionItemData = {
                    collection_number: collectionNumber,
                    collection_page: collectionPage,
                    author: author
                  };
                  dbOps.addCollectionItem(collectionGuid, existing.guid, collectionItemData);
                  console.log(`    Linked existing song "${song.title}" to collection`);
                } catch (error) {
                  console.error(`    Error linking existing song "${song.title}":`, error.message);
                }
              }
            }
            skippedSongs++;
            continue;
          }
          
          // Create library item
          const itemData = {
            name: song.title,
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
            continue;
          }
        }
      } catch (error) {
        console.error(`Error processing collection ${coll.name}:`, error.message);
      }
    }
    
    console.log(`\n=== Import Complete ===`);
    console.log(`Total songs processed: ${totalSongs}`);
    console.log(`Imported: ${importedSongs}`);
    console.log(`Skipped: ${skippedSongs}`);
    
  } catch (error) {
    console.error('Import error:', error);
    process.exit(1);
  }
}

// Run import
importSongs().then(() => {
  console.log('\nDone!');
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

