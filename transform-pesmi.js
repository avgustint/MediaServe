const fs = require('fs');
const path = require('path');

// Read the input file
const inputPath = path.join(__dirname, 'Pesmi', 'pesmi.json');
const outputPath = path.join(__dirname, 'Pesmi', 'library-items.json');

console.log('Reading input file...');
const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

const pesmi = inputData.tables.pesmi || [];
const diasi = inputData.tables.diasi || [];
const kitice = inputData.tables.kitice || [];

console.log(`Found ${pesmi.length} pesmi records`);
console.log(`Found ${diasi.length} diasi records`);
console.log(`Found ${kitice.length} kitice records`);

// Create maps for faster lookups
const kiticeMap = new Map();
kitice.forEach(k => {
  kiticeMap.set(k.cid, k);
});

const diasiByPhId = new Map();
diasi.forEach(d => {
  if (!diasiByPhId.has(d.phId)) {
    diasiByPhId.set(d.phId, []);
  }
  diasiByPhId.get(d.phId).push(d);
});

// Transform pesmi to library items
const libraryItems = [];

pesmi.forEach(pesem => {
  // Create base library item
  const libraryItem = {
    guid: pesem.phId,
    name: pesem.naslov || '',
    description: pesem.naslov1 || undefined,
    author: pesem.avtor || undefined,
    type: 'text',
    content: []
  };

  // Find all diasi records for this phId
  const relatedDiasi = diasiByPhId.get(pesem.phId) || [];

  // Deduplicate by cid - use Set to track unique cids we've already processed
  const processedCids = new Set();
  const pages = [];
  
  relatedDiasi.forEach(dias => {
    // Skip if we've already processed this cid
    if (processedCids.has(dias.cid)) {
      return;
    }
    
    const kitica = kiticeMap.get(dias.cid);
    if (kitica) {
      processedCids.add(dias.cid);
      
      // Convert escaped newlines to actual newlines
      let content = kitica.besedilo || '';
      // The original content has backslash followed by actual newline character
      // Replace backslash+newline with just newline, and backslash+n (literal) with newline
      content = content.replace(/\\(\r?\n)/g, '$1'); // Remove backslash before actual newlines
      content = content.replace(/\\n/g, '\n'); // Replace literal \n with newline
      
      pages.push({
        page: kitica.kitica,
        content: content
      });
    }
  });

  // Sort pages by page number
  pages.sort((a, b) => a.page - b.page);

  // Only add the library item if it has at least one page
  if (pages.length > 0) {
    libraryItem.content = pages;
    libraryItems.push(libraryItem);
  } else {
    // If no pages found, create empty content with page 1
    libraryItem.content = [{ page: 1, content: '' }];
    libraryItems.push(libraryItem);
  }
});

// Sort by guid
libraryItems.sort((a, b) => a.guid - b.guid);

console.log(`\nTransformed ${libraryItems.length} library items`);
console.log(`Writing to ${outputPath}...`);

// Write output
fs.writeFileSync(outputPath, JSON.stringify(libraryItems, null, 2), 'utf8');

console.log('Transformation complete!');
console.log(`\nSample of first item:`);
console.log(JSON.stringify(libraryItems[0], null, 2));

