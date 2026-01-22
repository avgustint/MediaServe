const { getDatabase } = require('./server/database');
const fs = require('fs');

// Initialize database
const db = getDatabase();

console.log('Preverjam pesmi za 2 zaporedna preloma strani...\n');

// Get all pages with their library items and order numbers
const allPages = db.prepare(`
  SELECT p.guid, p.content, lip.library_item_guid, lip.order_number
  FROM pages p
  LEFT JOIN library_item_pages lip ON p.guid = lip.page_guid
  WHERE p.content IS NOT NULL 
    AND p.content != ''
    AND lip.library_item_guid IS NOT NULL
  ORDER BY lip.library_item_guid, lip.order_number
`).all();

/**
 * Check if a page has 2 consecutive page breaks (at start or anywhere in content)
 * @param {string} content - Page content
 * @returns {boolean} True if page has 2 consecutive breaks
 */
function hasConsecutivePageBreaks(content) {
  if (!content || content.length === 0) return false;
  
  // Check if content starts with newline characters (before trimming)
  const trimmed = content.trimStart();
  const startsWithNewline = content.length > trimmed.length && 
                           (content.startsWith('\n') || content.startsWith('\r'));
  
  // Check first character code
  const firstChar = content.charCodeAt(0);
  const isNewlineChar = firstChar === 10 || firstChar === 13;
  
  // Check if content starts with <br> tag (case insensitive) - including multiple consecutive <br> tags
  // This matches: <br>, <br/>, <br />, <br><br>, <br/><br/>, etc.
  const startsWithBr = /^\s*(<br\s*\/?>)+/i.test(content);
  
  // Check for multiple consecutive newlines at start (2 or more)
  const startsWithMultipleNewlines = /^[\r\n]{2,}/.test(content);
  
  // Check for combination of whitespace and breaks at start
  const startsWithWhitespaceAndBreak = /^\s+((<br\s*\/?>)+|[\r\n]+)/i.test(content);
  
  // Check if page contains 2 consecutive <br> tags anywhere (with optional whitespace between)
  const hasDoubleBr = /<br\s*\/?>\s*<br\s*\/?>/i.test(content);
  
  // Check for 2 or more consecutive newlines anywhere
  const hasDoubleNewline = /[\r\n]{2,}/.test(content);
  
  // Check for 2 consecutive breaks at start OR anywhere in content
  return startsWithNewline || isNewlineChar || startsWithBr || startsWithMultipleNewlines || 
         startsWithWhitespaceAndBreak || hasDoubleBr || hasDoubleNewline;
}

/**
 * Determine the type of page break
 * @param {string} content - Page content
 * @returns {string} Type of break
 */
function getBreakType(content) {
  if (!content || content.length === 0) return 'neznano';
  
  // Check for 2 consecutive <br> tags anywhere
  const doubleBrMatch = content.match(/(<br\s*\/?>\s*<br\s*\/?>)/gi);
  if (doubleBrMatch && doubleBrMatch.length > 0) {
    return `2x <br> (${doubleBrMatch.length} occurrences)`;
  }
  
  // Check for 2+ consecutive newlines anywhere
  const doubleNewlineMatch = content.match(/[\r\n]{2,}/g);
  if (doubleNewlineMatch && doubleNewlineMatch.length > 0) {
    const maxNewlines = Math.max(...doubleNewlineMatch.map(m => m.length));
    return `${maxNewlines}x newline (${doubleNewlineMatch.length} occurrences)`;
  }
  
  // Check at start
  const firstChar = content.charCodeAt(0);
  if (/^\s*(<br\s*\/?>){2,}/i.test(content)) {
    const brCount = (content.match(/<br\s*\/?>/gi) || []).length;
    return `<br> x${brCount} (at start)`;
  }
  if (/^\s*<br\s*\/?>/i.test(content)) return '<br> (at start)';
  if (/^[\r\n]{2,}/.test(content)) {
    const newlineCount = content.match(/^[\r\n]+/)[0].length;
    return `${newlineCount}x newline (at start)`;
  }
  if (firstChar === 10) return '\\n (at start)';
  if (firstChar === 13) return '\\r (at start)';
  if (content.trimStart().length < content.length) return 'whitespace (at start)';
  return 'neznano';
}

// Group pages by library item
const pagesByItem = {};

allPages.forEach(page => {
  if (page.library_item_guid) {
    if (!pagesByItem[page.library_item_guid]) {
      pagesByItem[page.library_item_guid] = [];
    }
    
    pagesByItem[page.library_item_guid].push({
      pageGuid: page.guid,
      content: page.content,
      orderNumber: page.order_number
    });
  }
});

// Find songs with consecutive page breaks
const itemsWithConsecutiveBreaks = {};

Object.keys(pagesByItem).forEach(itemGuid => {
  const pages = pagesByItem[itemGuid].sort((a, b) => a.orderNumber - b.orderNumber);
  
  // Check for consecutive pages with breaks
  for (let i = 0; i < pages.length - 1; i++) {
    const currentPage = pages[i];
    const nextPage = pages[i + 1];
    
    // Check if both consecutive pages have 2 consecutive breaks
    if (hasConsecutivePageBreaks(currentPage.content) && hasConsecutivePageBreaks(nextPage.content)) {
      if (!itemsWithConsecutiveBreaks[itemGuid]) {
        itemsWithConsecutiveBreaks[itemGuid] = {
          pages: []
        };
      }
      
      // Check if this pair is already recorded
      const existingPair = itemsWithConsecutiveBreaks[itemGuid].pages.find(
        p => p.orderNumber1 === currentPage.orderNumber && p.orderNumber2 === nextPage.orderNumber
      );
      
      if (!existingPair) {
        itemsWithConsecutiveBreaks[itemGuid].pages.push({
          orderNumber1: currentPage.orderNumber,
          pageGuid1: currentPage.pageGuid,
          breakType1: getBreakType(currentPage.content),
          contentStart1: currentPage.content.substring(0, 80).replace(/\n/g, '\\n').replace(/\r/g, '\\r'),
          orderNumber2: nextPage.orderNumber,
          pageGuid2: nextPage.pageGuid,
          breakType2: getBreakType(nextPage.content),
          contentStart2: nextPage.content.substring(0, 80).replace(/\n/g, '\\n').replace(/\r/g, '\\r')
        });
      }
    }
  }
});

// Get library item names
const libraryItemGuids = Object.keys(itemsWithConsecutiveBreaks).map(Number);
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
    if (itemsWithConsecutiveBreaks[item.guid]) {
      itemsWithConsecutiveBreaks[item.guid].name = item.name;
      itemsWithConsecutiveBreaks[item.guid].type = item.type;
    }
  });
}

// Build console output (detailed)
let consoleOutput = `Preverjam pesmi za 2 zaporedna preloma strani...\n\n`;
consoleOutput += `Najdenih ${Object.keys(itemsWithConsecutiveBreaks).length} pesmi z 2 zaporednima prelomoma strani:\n\n`;

const results = [];
Object.keys(itemsWithConsecutiveBreaks).sort((a, b) => Number(a) - Number(b)).forEach(guid => {
  const item = itemsWithConsecutiveBreaks[guid];
  if (item.name) {
    results.push({
      guid: Number(guid),
      name: item.name,
      type: item.type,
      pairsCount: item.pages.length
    });
    consoleOutput += `${item.name} (GUID: ${guid}, tip: ${item.type})\n`;
    consoleOutput += `  Zaporednih parov s prelomi: ${item.pages.length}\n`;
    item.pages.forEach(pair => {
      consoleOutput += `    - Strani ${pair.orderNumber1} in ${pair.orderNumber2}:\n`;
      consoleOutput += `      Stran ${pair.orderNumber1} (GUID: ${pair.pageGuid1}, tip: ${pair.breakType1}): "${pair.contentStart1}..."\n`;
      consoleOutput += `      Stran ${pair.orderNumber2} (GUID: ${pair.pageGuid2}, tip: ${pair.breakType2}): "${pair.contentStart2}..."\n`;
    });
    consoleOutput += '\n';
  }
});

consoleOutput += '\n--- Povzetek ---\n';
consoleOutput += `Skupaj pesmi: ${results.length}\n`;

// Build file output (simple list)
let fileOutput = '';
results.forEach(item => {
  fileOutput += `${item.name}\n`;
});

// Output to console
console.log(consoleOutput);

// Save to file (simple list)
const outputFile = 'songs-with-consecutive-page-breaks.txt';
fs.writeFileSync(outputFile, fileOutput, 'utf8');
console.log(`\nSeznam shranjen v datoteko: ${outputFile}`);

