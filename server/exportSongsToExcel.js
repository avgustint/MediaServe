const ExcelJS = require('exceljs');
const path = require('path');
const { getDatabase } = require('./database');
const dbOps = require('./dbOperations');

/**
 * Exports all songs from database to Excel file
 * Creates two sheets: one sorted by ID, one sorted by title
 */
async function exportSongsToExcel() {
  try {
    // Initialize database
    const db = getDatabase();
    
    // Get all library items (songs)
    const allItems = dbOps.getAllLibraryItems();
    
    console.log(`Found ${allItems.length} items in database`);
    
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();
    
    // Format library items with pages information
    const formattedItems = allItems.map(item => {
      const formatted = {
        guid: item.guid,
        name: item.name || '',
        type: item.type || '',
        description: item.description || '',
        author: item.author || '',
        modified: item.modified || '',
        pageCount: 0
      };
      
      // For text items, get page count
      if (item.type === 'text') {
        const pages = dbOps.getLibraryItemPages(item.guid);
        formatted.pageCount = pages ? pages.length : 0;
      }
      
      return formatted;
    });
    
    // Sheet 1: Sorted by ID (guid)
    const sheetById = workbook.addWorksheet('Sortirano po ID');
    sheetById.columns = [
      { header: 'ID', key: 'guid', width: 10 },
      { header: 'Naslov', key: 'name', width: 40 },
      { header: 'Tip', key: 'type', width: 10 },
      { header: 'Opis', key: 'description', width: 50 },
      { header: 'Avtor', key: 'author', width: 30 },
      { header: 'Št. strani', key: 'pageCount', width: 12 },
      { header: 'Spremenjeno', key: 'modified', width: 20 }
    ];
    
    // Style header row
    sheetById.getRow(1).font = { bold: true };
    sheetById.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Add data sorted by ID
    const sortedById = [...formattedItems].sort((a, b) => a.guid - b.guid);
    sortedById.forEach(item => {
      sheetById.addRow(item);
    });
    
    // Sheet 2: Sorted by title (name)
    const sheetByTitle = workbook.addWorksheet('Sortirano po naslovih');
    sheetByTitle.columns = [
      { header: 'ID', key: 'guid', width: 10 },
      { header: 'Naslov', key: 'name', width: 40 },
      { header: 'Tip', key: 'type', width: 10 },
      { header: 'Opis', key: 'description', width: 50 },
      { header: 'Avtor', key: 'author', width: 30 },
      { header: 'Št. strani', key: 'pageCount', width: 12 },
      { header: 'Spremenjeno', key: 'modified', width: 20 }
    ];
    
    // Style header row
    sheetByTitle.getRow(1).font = { bold: true };
    sheetByTitle.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Add data sorted by title (case-insensitive)
    const sortedByTitle = [...formattedItems].sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB, 'sl');
    });
    sortedByTitle.forEach(item => {
      sheetByTitle.addRow(item);
    });
    
    // Format date column
    [sheetById, sheetByTitle].forEach(sheet => {
      sheet.getColumn('modified').numFmt = 'yyyy-mm-dd hh:mm:ss';
    });
    
    // Save the workbook
    const outputPath = path.join(__dirname, 'data', 'pesmi_export.xlsx');
    await workbook.xlsx.writeFile(outputPath);
    
    console.log(`Excel file created successfully: ${outputPath}`);
    console.log(`Exported ${formattedItems.length} songs`);
    console.log(`- Sheet 1: ${sortedById.length} songs sorted by ID`);
    console.log(`- Sheet 2: ${sortedByTitle.length} songs sorted by title`);
    
  } catch (error) {
    console.error('Error exporting songs to Excel:', error);
    process.exit(1);
  }
}

// Run the export
exportSongsToExcel()
  .then(() => {
    console.log('Export completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Export failed:', error);
    process.exit(1);
  });

