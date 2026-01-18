const { getDatabase } = require('./server/database');

const db = getDatabase();

console.log('=== Checking for Duplicate Library Items with Same Pages and Ordering ===\n');

// Get all library items with their pages
const libraryItemsWithPages = db.prepare(`
  SELECT 
    li.guid as library_item_guid,
    li.name as library_item_name,
    lip.page_guid,
    lip.order_number
  FROM library_items li
  LEFT JOIN library_item_pages lip ON li.guid = lip.library_item_guid
  ORDER BY li.guid, lip.order_number
`).all();

// Group by library item and create a signature (page sequence)
const itemSignatures = new Map();

for (const item of libraryItemsWithPages) {
  const guid = item.library_item_guid;
  const name = item.library_item_name;
  
  if (!itemSignatures.has(guid)) {
    itemSignatures.set(guid, {
      name: name,
      pages: []
    });
  }
  
  if (item.page_guid !== null) {
    itemSignatures.get(guid).pages.push({
      page_guid: item.page_guid,
      order_number: item.order_number
    });
  }
}

// Create signatures (page sequence strings) for comparison
const signatureToItems = new Map();

for (const [guid, data] of itemSignatures.entries()) {
  // Create a signature: "page_guid1:order1,page_guid2:order2,..."
  const signature = data.pages
    .sort((a, b) => a.order_number - b.order_number)
    .map(p => `${p.page_guid}:${p.order_number}`)
    .join(',');
  
  if (!signatureToItems.has(signature)) {
    signatureToItems.set(signature, []);
  }
  
  signatureToItems.get(signature).push({
    guid: guid,
    name: data.name,
    pages: data.pages
  });
}

// Find duplicates (signatures with more than one item)
const duplicates = [];
for (const [signature, items] of signatureToItems.entries()) {
  if (items.length > 1) {
    duplicates.push({
      signature: signature,
      items: items
    });
  }
}

// Report results
console.log(`Total library items: ${itemSignatures.size}`);
console.log(`Items with pages: ${Array.from(itemSignatures.values()).filter(i => i.pages.length > 0).length}`);
console.log(`Items without pages: ${Array.from(itemSignatures.values()).filter(i => i.pages.length === 0).length}`);
console.log(`\nDuplicate groups found: ${duplicates.length}\n`);

if (duplicates.length > 0) {
  console.log('=== DUPLICATE GROUPS ===\n');
  
  for (let i = 0; i < duplicates.length; i++) {
    const group = duplicates[i];
    console.log(`Group ${i + 1}: ${group.items.length} items with identical page sequence`);
    console.log(`  Page sequence: ${group.signature}`);
    console.log(`  Items:`);
    
    for (const item of group.items) {
      console.log(`    - GUID: ${item.guid}, Name: "${item.name}"`);
      console.log(`      Pages (${item.pages.length}):`);
      for (const page of item.pages.sort((a, b) => a.order_number - b.order_number)) {
        // Get page content preview
        const pageContent = db.prepare('SELECT content FROM pages WHERE guid = ?').get(page.page_guid);
        const contentPreview = pageContent?.content 
          ? (pageContent.content.substring(0, 50).replace(/\n/g, ' ') + (pageContent.content.length > 50 ? '...' : ''))
          : 'N/A';
        console.log(`        Order ${page.order_number}: Page ${page.page_guid} - "${contentPreview}"`);
      }
    }
    console.log('');
  }
  
  // Summary statistics
  const totalDuplicateItems = duplicates.reduce((sum, group) => sum + group.items.length, 0);
  console.log(`\n=== SUMMARY ===`);
  console.log(`Total duplicate groups: ${duplicates.length}`);
  console.log(`Total items in duplicate groups: ${totalDuplicateItems}`);
  console.log(`Items that could potentially be merged: ${totalDuplicateItems - duplicates.length}`);
} else {
  console.log('No duplicates found! All library items have unique page sequences.');
}

