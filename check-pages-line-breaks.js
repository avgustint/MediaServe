const { getDatabase } = require('./server/database');
const fs = require('fs');

// Initialize database
const db = getDatabase();

console.log('Preverjam strani pesmi za prelome vrstic na začetku...\n');

// Get all pages
const allPages = db.prepare(`
  SELECT p.guid, p.content, lip.library_item_guid, lip.order_number
  FROM pages p
  LEFT JOIN library_item_pages lip ON p.guid = lip.page_guid
  WHERE p.content IS NOT NULL 
    AND p.content != ''
  ORDER BY lip.library_item_guid, lip.order_number
`).all();

// Filter pages that start with line breaks (newline chars or HTML <br> tags)
const pagesWithLineBreaks = allPages.filter(page => {
  if (!page.content || page.content.length === 0) return false;
  
  const content = page.content.trimStart();
  
  // Check if content starts with newline characters (before trimming)
  const trimmed = page.content.trimStart();
  const startsWithNewline = page.content.length > trimmed.length && 
                           (page.content.startsWith('\n') || page.content.startsWith('\r'));
  
  // Check first character code
  const firstChar = page.content.charCodeAt(0);
  const isNewlineChar = firstChar === 10 || firstChar === 13;
  
  // Check if content starts with <br> tag (case insensitive)
  const startsWithBr = /^\s*<br\s*\/?>/i.test(page.content);
  
  return startsWithNewline || isNewlineChar || startsWithBr;
});

// Group by library item
const itemsWithLineBreaks = {};

pagesWithLineBreaks.forEach(page => {
  if (page.library_item_guid) {
    if (!itemsWithLineBreaks[page.library_item_guid]) {
      itemsWithLineBreaks[page.library_item_guid] = {
        pages: []
      };
    }
    
    // Determine what type of line break
    let breakType = 'neznano';
    if (page.content.charCodeAt(0) === 10) breakType = '\\n';
    else if (page.content.charCodeAt(0) === 13) breakType = '\\r';
    else if (/^\s*<br\s*\/?>/i.test(page.content)) breakType = '<br>';
    else if (page.content.trimStart().length < page.content.length) breakType = 'whitespace';
    
    itemsWithLineBreaks[page.library_item_guid].pages.push({
      pageGuid: page.guid,
      orderNumber: page.order_number,
      breakType: breakType,
      contentStart: page.content.substring(0, 80).replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    });
  }
});

// Get library item names
const libraryItemGuids = Object.keys(itemsWithLineBreaks).map(Number);
if (libraryItemGuids.length > 0) {
  const placeholders = libraryItemGuids.map(() => '?').join(',');
  const items = db.prepare(`
    SELECT guid, name, type
    FROM library_items
    WHERE guid IN (${placeholders})
    ORDER BY guid
  `).all(...libraryItemGuids);

  // Add names to the result
  items.forEach(item => {
    if (itemsWithLineBreaks[item.guid]) {
      itemsWithLineBreaks[item.guid].name = item.name;
      itemsWithLineBreaks[item.guid].type = item.type;
    }
  });
}

// Build output
let output = `Preverjam strani pesmi za prelome vrstic na začetku...\n\n`;
output += `Najdenih ${Object.keys(itemsWithLineBreaks).length} pesmi s prelomi vrstic na začetku strani:\n\n`;

const results = [];
Object.keys(itemsWithLineBreaks).sort((a, b) => Number(a) - Number(b)).forEach(guid => {
  const item = itemsWithLineBreaks[guid];
  if (item.name) {
    results.push({
      guid: Number(guid),
      name: item.name,
      type: item.type,
      pagesCount: item.pages.length
    });
    output += `${item.name} (GUID: ${guid}, tip: ${item.type})\n`;
    output += `  Strani s prelomi: ${item.pages.length}\n`;
    item.pages.forEach(page => {
      output += `    - Stran ${page.orderNumber} (GUID: ${page.pageGuid}, tip: ${page.breakType}): "${page.contentStart}..."\n`;
    });
    output += '\n';
  }
});

output += '\n--- Povzetek ---\n';
output += `Skupaj pesmi: ${results.length}\n`;
output += '\nSeznam pesmi:\n';
results.forEach(item => {
  output += `  ${item.guid}: ${item.name} (${item.pagesCount} strani)\n`;
});

// Output to console
console.log(output);

// Save to file
const outputFile = 'pesmi-s-prelomi-vrstic.txt';
fs.writeFileSync(outputFile, output, 'utf8');
console.log(`\nSeznam shranjen v datoteko: ${outputFile}`);

