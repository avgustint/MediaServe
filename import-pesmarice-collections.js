const path = require('path');
const fs = require('fs');
const { getDatabase } = require('./server/database');
const dbOps = require('./server/dbOperations');

// Initialize database
const db = getDatabase();

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

console.log(`\nImport complete!`);
console.log(`- Imported: ${imported.length} collections`);
console.log(`- Skipped: ${skipped.length} records`);

if (skipped.length > 0) {
  console.log(`\nSkipped records:`);
  skipped.forEach(p => {
    console.log(`  - "${p.naslov}" (${p.oznaka || 'no label'})`);
  });
}

// Database will be closed when process exits
console.log('\nDone!');

