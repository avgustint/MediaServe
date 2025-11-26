const path = require('path');
const fs = require('fs');
const { getDatabase } = require('./server/database');
const dbOps = require('./server/dbOperations');

// Initialize database
const db = getDatabase();

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

console.log(`\nImport complete!`);
console.log(`- Imported: ${imported.length} tags`);
console.log(`- Skipped: ${skipped.length} records`);

if (skipped.length > 0) {
  console.log(`\nSkipped records:`);
  skipped.forEach(z => {
    console.log(`  - "${z.Oznaka || 'no oznaka'}" (${z.zvrst || 'no zvrst'})`);
  });
}

// Database will be closed when process exits
console.log('\nDone!');

