const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'mediaserver.db');

let db = null;

/**
 * Initializes the database connection
 * @returns {Database} Database instance
 */
function initDatabase() {
  if (db) {
    return db;
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // Enable Write-Ahead Logging for better concurrency

  // Create tables if they don't exist
  createTables();

  return db;
}

/**
 * Creates all necessary database tables
 */
function createTables() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      guid INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role INTEGER NOT NULL,
      locale TEXT
    )
  `);

  // Roles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      guid INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0
    )
  `);

  // Permissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      guid INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    )
  `);

  // Role-Permissions junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_guid INTEGER NOT NULL,
      permission_guid INTEGER NOT NULL,
      PRIMARY KEY (role_guid, permission_guid),
      FOREIGN KEY (role_guid) REFERENCES roles(guid),
      FOREIGN KEY (permission_guid) REFERENCES permissions(guid)
    )
  `);

  // Library items table
  // Check if table exists and if it needs migration for 'video' type
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='library_items'").get();
  const tempTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='library_items_new'").get();
  
  // Clean up any leftover temp table from previous failed migration
  if (tempTableExists && !tableExists) {
    console.log('Found incomplete migration - completing it...');
    // Disable foreign key constraints temporarily
    db.pragma('foreign_keys = OFF');
    try {
      // Rename temp table to original name
      db.exec(`ALTER TABLE library_items_new RENAME TO library_items`);
      // Recreate indexes
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_library_items_type ON library_items(type);
        CREATE INDEX IF NOT EXISTS idx_library_items_modified ON library_items(modified);
      `);
      console.log('Completed incomplete migration: library_items table now supports iframe type');
    } finally {
      db.pragma('foreign_keys = ON');
    }
  } else if (tempTableExists && tableExists) {
    // Both tables exist - drop the temp table
    console.log('Cleaning up leftover temp table from previous migration...');
    db.pragma('foreign_keys = OFF');
    try {
      db.exec(`DROP TABLE library_items_new`);
    } finally {
      db.pragma('foreign_keys = ON');
    }
  }
  
  if (tableExists) {
    // Table exists - check if it needs migration
    // Try to get the table schema to see if it includes 'video' in the CHECK constraint
    const tableSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='library_items'").get();
    
    if (tableSchema && tableSchema.sql && !tableSchema.sql.includes("'iframe'")) {
      // Table exists but doesn't have 'iframe' in CHECK constraint - need to migrate
      console.log('Migrating library_items table to support iframe type...');
      
      // Disable foreign key constraints temporarily
      db.pragma('foreign_keys = OFF');
      
      try {
        // Get all existing columns to preserve them
        const existingColumns = db.prepare("PRAGMA table_info(library_items)").all();
        const columnNames = existingColumns.map(col => col.name);
        
        // Drop temp table if it exists
        const tempExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='library_items_new'").get();
        if (tempExists) {
          db.exec(`DROP TABLE library_items_new`);
        }
        
        // Create new table with updated constraint (include iframe) and all existing columns
        db.exec(`
          CREATE TABLE library_items_new (
            guid INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('text', 'image', 'url', 'video', 'iframe')),
            content TEXT NOT NULL,
            description TEXT,
            modified TEXT,
            background_color TEXT,
            font_color TEXT,
            author TEXT,
            css TEXT
          )
        `);
        
        // Copy all data from old table to new table (only columns that exist in both)
        const columnsToCopy = ['guid', 'name', 'type', 'content', 'description', 'modified', 
                              'background_color', 'font_color', 'author', 'css']
          .filter(col => columnNames.includes(col));
        
        const selectColumns = columnsToCopy.join(', ');
        const insertColumns = columnsToCopy.join(', ');
        
        db.exec(`
          INSERT INTO library_items_new (${insertColumns})
          SELECT ${selectColumns} FROM library_items
        `);
        
        // Drop old table
        db.exec(`DROP TABLE library_items`);
        
        // Rename new table to original name
        db.exec(`ALTER TABLE library_items_new RENAME TO library_items`);
        
        // Recreate indexes that might have been dropped
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_library_items_type ON library_items(type);
          CREATE INDEX IF NOT EXISTS idx_library_items_modified ON library_items(modified);
        `);
        
        console.log('Migration completed: library_items table now supports iframe type');
      } finally {
        // Re-enable foreign key constraints
        db.pragma('foreign_keys = ON');
      }
    } else {
      // Table exists and already has 'iframe' in constraint, or constraint check failed
      // Just ensure the table exists with CREATE IF NOT EXISTS (won't recreate if exists)
      db.exec(`
        CREATE TABLE IF NOT EXISTS library_items (
          guid INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('text', 'image', 'url', 'video', 'iframe')),
          content TEXT NOT NULL,
          description TEXT,
          modified TEXT
        )
      `);
    }
  } else {
    // Table doesn't exist - create it with the new constraint
    db.exec(`
      CREATE TABLE library_items (
        guid INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('text', 'image', 'url', 'video', 'iframe')),
        content TEXT NOT NULL,
        description TEXT,
        modified TEXT
      )
    `);
  }

  // Playlists table
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      guid INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      updated TEXT
    )
  `);

  // Playlist items junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlist_items (
      playlist_guid INTEGER NOT NULL,
      library_item_guid INTEGER NOT NULL,
      page INTEGER,
      pages TEXT,
      description TEXT,
      sort_order INTEGER NOT NULL,
      PRIMARY KEY (playlist_guid, library_item_guid, sort_order),
      FOREIGN KEY (playlist_guid) REFERENCES playlists(guid),
      FOREIGN KEY (library_item_guid) REFERENCES library_items(guid)
    )
  `);
  
  // Add pages column if it doesn't exist (for existing databases)
  const tableInfo = db.prepare("PRAGMA table_info(playlist_items)").all();
  const hasPagesColumn = tableInfo.some(col => col.name === 'pages');
  if (!hasPagesColumn) {
    db.exec(`
      ALTER TABLE playlist_items 
      ADD COLUMN pages TEXT
    `);
  }

  // Add modified column to library_items if it doesn't exist (for existing databases)
  const libraryTableInfo = db.prepare("PRAGMA table_info(library_items)").all();
  const hasModifiedColumn = libraryTableInfo.some(col => col.name === 'modified');
  if (!hasModifiedColumn) {
    db.exec(`
      ALTER TABLE library_items 
      ADD COLUMN modified TEXT
    `);
    // Set modified timestamp for existing items to current time
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE library_items
      SET modified = ?
      WHERE modified IS NULL
    `).run(now);
  }

  // Add background_color and font_color columns to library_items if they don't exist
  const hasBackgroundColor = libraryTableInfo.some(col => col.name === 'background_color');
  if (!hasBackgroundColor) {
    db.exec(`
      ALTER TABLE library_items 
      ADD COLUMN background_color TEXT
    `);
  }
  const hasFontColor = libraryTableInfo.some(col => col.name === 'font_color');
  if (!hasFontColor) {
    db.exec(`
      ALTER TABLE library_items 
      ADD COLUMN font_color TEXT
    `);
  }
  // Add author column to library_items if it doesn't exist
  const hasAuthor = libraryTableInfo.some(col => col.name === 'author');
  if (!hasAuthor) {
    db.exec(`
      ALTER TABLE library_items 
      ADD COLUMN author TEXT
    `);
  }
  // Add css column to library_items if it doesn't exist (stores JSON with CSS custom properties)
  const hasCss = libraryTableInfo.some(col => col.name === 'css');
  if (!hasCss) {
    db.exec(`
      ALTER TABLE library_items 
      ADD COLUMN css TEXT
    `);
  }

  // Pages table - stores reusable page content
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      guid INTEGER PRIMARY KEY,
      content TEXT,
      type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'image', 'url', 'video', 'iframe'))
    )
  `);

  // Migration: Add 'iframe' to pages type constraint if table was created with old schema
  const pagesTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='pages'").get();
  if (pagesTableSql?.sql && !pagesTableSql.sql.includes("'iframe'")) {
    const existingPages = db.prepare("SELECT guid, content, type FROM pages").all();
    const existingLinks = db.prepare("SELECT library_item_guid, page_guid, order_number FROM library_item_pages").all();
    db.exec(`DROP TABLE IF EXISTS library_item_pages`);
    db.exec(`DROP TABLE IF EXISTS pages`);
    db.exec(`
      CREATE TABLE pages (
        guid INTEGER PRIMARY KEY,
        content TEXT,
        type TEXT NOT NULL DEFAULT 'text' CHECK(type IN ('text', 'image', 'url', 'video', 'iframe'))
      )
    `);
    const insertPage = db.prepare("INSERT INTO pages (guid, content, type) VALUES (?, ?, ?)");
    for (const p of existingPages) {
      const t = ['text', 'image', 'url', 'video', 'iframe'].includes(p.type) ? p.type : 'text';
      insertPage.run(p.guid, p.content || '', t);
    }
    db.exec(`
      CREATE TABLE library_item_pages (
        library_item_guid INTEGER NOT NULL,
        page_guid INTEGER NOT NULL,
        order_number INTEGER NOT NULL,
        PRIMARY KEY (library_item_guid, page_guid, order_number),
        FOREIGN KEY (library_item_guid) REFERENCES library_items(guid) ON DELETE CASCADE,
        FOREIGN KEY (page_guid) REFERENCES pages(guid) ON DELETE CASCADE
      )
    `);
    const insertLink = db.prepare("INSERT INTO library_item_pages (library_item_guid, page_guid, order_number) VALUES (?, ?, ?)");
    for (const l of existingLinks) {
      insertLink.run(l.library_item_guid, l.page_guid, l.order_number);
    }
    console.log('Migration: Added iframe type to pages table');
  }

  // Migration: Add type column to existing pages table if it doesn't exist
  const pagesTableInfo = db.prepare("PRAGMA table_info(pages)").all();
  const hasPagesTypeColumn = pagesTableInfo.some(col => col.name === 'type');
  if (!hasPagesTypeColumn) {
    db.exec(`
      ALTER TABLE pages 
      ADD COLUMN type TEXT NOT NULL DEFAULT 'text'
    `);
    console.log('Added type column to pages table');

    // Data migration: move type from library_items to pages
    const libraryItems = db.prepare('SELECT guid, type, content FROM library_items').all();
    for (const item of libraryItems) {
      if (item.type === 'image' || item.type === 'url' || item.type === 'video') {
        // Create a page with the content and type, link to library item
        const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM pages').get()?.maxGuid || 0;
        const newPageGuid = maxGuid + 1;
        const content = item.content || '';
        db.prepare('INSERT INTO pages (guid, content, type) VALUES (?, ?, ?)').run(newPageGuid, content, item.type);
        db.prepare(`
          INSERT INTO library_item_pages (library_item_guid, page_guid, order_number)
          VALUES (?, ?, ?)
        `).run(item.guid, newPageGuid, 1);
        // Clear content on library item (now stored in page)
        db.prepare('UPDATE library_items SET content = ? WHERE guid = ?').run('', item.guid);
      } else {
        // Text items: update all linked pages to have type = 'text'
        const linkedPages = db.prepare(`
          SELECT page_guid FROM library_item_pages WHERE library_item_guid = ?
        `).all(item.guid);
        for (const lp of linkedPages) {
          db.prepare('UPDATE pages SET type = ? WHERE guid = ?').run('text', lp.page_guid);
        }
        // If text item has no pages but has legacy content, create page(s)
        if (linkedPages.length === 0 && item.content) {
          let pageContents = [];
          try {
            const parsed = JSON.parse(item.content);
            if (Array.isArray(parsed)) {
              pageContents = parsed.map(p => (typeof p === 'object' && p.content !== undefined) ? p.content : String(p));
            } else {
              pageContents = [item.content];
            }
          } catch (e) {
            pageContents = [item.content];
          }
          if (pageContents.length === 0) pageContents = [''];
          const insertPage = db.prepare('INSERT INTO pages (guid, content, type) VALUES (?, ?, ?)');
          const linkPage = db.prepare(`
            INSERT INTO library_item_pages (library_item_guid, page_guid, order_number)
            VALUES (?, ?, ?)
          `);
          let nextGuid = (db.prepare('SELECT MAX(guid) as maxGuid FROM pages').get()?.maxGuid || 0) + 1;
          for (let i = 0; i < pageContents.length; i++) {
            insertPage.run(nextGuid, pageContents[i] || '', 'text');
            linkPage.run(item.guid, nextGuid, i + 1);
            nextGuid++;
          }
          db.prepare('UPDATE library_items SET content = ? WHERE guid = ?').run('', item.guid);
        }
      }
    }
    console.log('Migration completed: type moved from library_items to pages');
  }

  // Migration: Add css column to pages table if it doesn't exist
  const pagesTableInfo2 = db.prepare("PRAGMA table_info(pages)").all();
  const hasPagesCssColumn = pagesTableInfo2.some(col => col.name === 'css');
  if (!hasPagesCssColumn) {
    db.exec(`ALTER TABLE pages ADD COLUMN css TEXT`);
    console.log('Added css column to pages table');
  }

  // Library item pages junction table - links library items to pages with order
  db.exec(`
    CREATE TABLE IF NOT EXISTS library_item_pages (
      library_item_guid INTEGER NOT NULL,
      page_guid INTEGER NOT NULL,
      order_number INTEGER NOT NULL,
      PRIMARY KEY (library_item_guid, page_guid, order_number),
      FOREIGN KEY (library_item_guid) REFERENCES library_items(guid) ON DELETE CASCADE,
      FOREIGN KEY (page_guid) REFERENCES pages(guid) ON DELETE CASCADE
    )
  `);

  // Tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      guid INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    )
  `);

  // Library item tags junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS library_item_tags (
      library_item_guid INTEGER NOT NULL,
      tag_guid INTEGER NOT NULL,
      PRIMARY KEY (library_item_guid, tag_guid),
      FOREIGN KEY (library_item_guid) REFERENCES library_items(guid) ON DELETE CASCADE,
      FOREIGN KEY (tag_guid) REFERENCES tags(guid) ON DELETE CASCADE
    )
  `);

  // Collections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      guid INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      label TEXT,
      year INTEGER,
      publisher TEXT,
      source TEXT
    )
  `);

  // Collection items junction table - links collections to library items
  db.exec(`
    CREATE TABLE IF NOT EXISTS collection_items (
      collection_guid INTEGER NOT NULL,
      library_item_guid INTEGER NOT NULL,
      collection_number INTEGER,
      collection_page INTEGER,
      author TEXT,
      tonality_guid INTEGER,
      PRIMARY KEY (collection_guid, library_item_guid),
      FOREIGN KEY (collection_guid) REFERENCES collections(guid) ON DELETE CASCADE,
      FOREIGN KEY (library_item_guid) REFERENCES library_items(guid) ON DELETE CASCADE,
      FOREIGN KEY (tonality_guid) REFERENCES tonalities(guid) ON DELETE SET NULL
    )
  `);

  // Settings table for general settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Locations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      guid INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    )
  `);

  // Tonalities table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tonalities (
      guid INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      alternations TEXT,
      dur TEXT,
      mol TEXT,
      dur_scale TEXT,
      mol_scale TEXT
    )
  `);

  // Add is_admin column to roles table if it doesn't exist (for existing databases)
  const rolesTableInfo = db.prepare("PRAGMA table_info(roles)").all();
  const hasIsAdminColumn = rolesTableInfo.some(col => col.name === 'is_admin');
  if (!hasIsAdminColumn) {
    db.exec(`
      ALTER TABLE roles 
      ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0
    `);
    // Set is_admin = 1 for Administrator role
    db.prepare(`
      UPDATE roles
      SET is_admin = 1
      WHERE LOWER(name) = 'administrator'
    `).run();
  }

  // Add tonality_guid column to collection_items table if it doesn't exist (for existing databases)
  try {
    const collectionItemsTableInfo = db.prepare("PRAGMA table_info(collection_items)").all();
    const hasTonalityGuidColumn = collectionItemsTableInfo.some(col => col.name === 'tonality_guid');
    if (!hasTonalityGuidColumn) {
      db.exec(`
        ALTER TABLE collection_items 
        ADD COLUMN tonality_guid INTEGER
      `);
      // Add foreign key constraint if possible (SQLite has limited ALTER TABLE support)
      // Note: SQLite doesn't support adding foreign key constraints via ALTER TABLE
      // The foreign key will be enforced by the application layer
    }
  } catch (error) {
    console.warn('Could not add tonality_guid column to collection_items:', error.message);
  }

  // Add ViewDisplay permission and assign it to all roles except user role
  try {
    const dbOps = require('./dbOperations');
    
    // Check if ViewDisplay permission exists
    const viewDisplayPerm = dbOps.getPermissionByName('ViewDisplay');
    if (!viewDisplayPerm) {
      // Create ViewDisplay permission
      const newPerm = dbOps.createPermission({
        name: 'ViewDisplay',
        description: 'Permission to view and access the display component'
      });
      
      // Get all roles
      const allRoles = dbOps.getAllRoles();
      
      // Find user role (case-insensitive)
      const userRole = allRoles.find(role => role.name.toLowerCase() === 'user');
      
      // Add ViewDisplay permission to all roles except user role
      for (const role of allRoles) {
        // Skip user role
        if (userRole && role.guid === userRole.guid) {
          continue;
        }
        
        // Get current permissions for this role
        const currentPermissions = dbOps.getRolePermissions(role.guid);
        
        // Check if ViewDisplay permission is already assigned
        if (!currentPermissions.includes(newPerm.guid)) {
          // Add ViewDisplay permission to this role
          const updatedPermissions = [...currentPermissions, newPerm.guid];
          dbOps.updateRolePermissions(role.guid, updatedPermissions);
        }
      }
      
      console.log('ViewDisplay permission created and assigned to all roles except user role');
    }

    // Add ViewGeneralSettings and EditGeneralSettings permissions
    const viewGeneralSettingsPerm = dbOps.getPermissionByName('ViewGeneralSettings');
    if (!viewGeneralSettingsPerm) {
      dbOps.createPermission({
        name: 'ViewGeneralSettings',
        description: 'Permission to view general settings'
      });
    }

    const editGeneralSettingsPerm = dbOps.getPermissionByName('EditGeneralSettings');
    if (!editGeneralSettingsPerm) {
      dbOps.createPermission({
        name: 'EditGeneralSettings',
        description: 'Permission to edit general settings'
      });
    }

    // Add ManageTags permission
    const manageTagsPerm = dbOps.getPermissionByName('ManageTags');
    if (!manageTagsPerm) {
      dbOps.createPermission({
        name: 'ManageTags',
        description: 'Permission to manage tags'
      });
    }

    // Add ManageCollections permission
    const manageCollectionsPerm = dbOps.getPermissionByName('ManageCollections');
    if (!manageCollectionsPerm) {
      dbOps.createPermission({
        name: 'ManageCollections',
        description: 'Permission to manage collections'
      });
    }

    // Add ViewLocations and ManageLocations permissions
    const viewLocationsPerm = dbOps.getPermissionByName('ViewLocations');
    if (!viewLocationsPerm) {
      dbOps.createPermission({
        name: 'ViewLocations',
        description: 'Permission to view locations'
      });
    }

    const manageLocationsPerm = dbOps.getPermissionByName('ManageLocations');
    if (!manageLocationsPerm) {
      dbOps.createPermission({
        name: 'ManageLocations',
        description: 'Permission to manage locations (create, update, delete)'
      });
    }

    // Add view-only permissions for library, playlists, pages, tags, collections, and locations
    const viewPermissions = [
      { name: 'ViewLibrary', description: 'Permission to view library items' },
      { name: 'ViewPlaylists', description: 'Permission to view playlists' },
      { name: 'ViewPages', description: 'Permission to view pages' },
      { name: 'ViewTags', description: 'Permission to view tags' },
      { name: 'ViewCollections', description: 'Permission to view collections' },
      { name: 'ViewLocations', description: 'Permission to view locations' }
    ];

    viewPermissions.forEach(perm => {
      const existingPerm = dbOps.getPermissionByName(perm.name);
      if (!existingPerm) {
        dbOps.createPermission(perm);
      }
    });

    // Add ManagePages permission (separate from ManageLibrary)
    const managePagesPerm = dbOps.getPermissionByName('ManagePages');
    if (!managePagesPerm) {
      dbOps.createPermission({
        name: 'ManagePages',
        description: 'Permission to manage pages'
      });
    }

    // Add ManageLibrary permission
    const manageLibraryPerm = dbOps.getPermissionByName('ManageLibrary');
    if (!manageLibraryPerm) {
      dbOps.createPermission({
        name: 'ManageLibrary',
        description: 'Permission to manage library items (create, update, delete)'
      });
    }

    // Add ManagePlaylists permission
    const managePlaylistsPerm = dbOps.getPermissionByName('ManagePlaylists');
    if (!managePlaylistsPerm) {
      dbOps.createPermission({
        name: 'ManagePlaylists',
        description: 'Permission to manage playlists (create, update, delete)'
      });
    }

    // Assign permissions to admin role only
    const allRoles = dbOps.getAllRoles();
    const adminRole = allRoles.find(role => role.is_admin === 1);
    if (adminRole) {
      const permissionsToAssign = [
        'ViewGeneralSettings',
        'EditGeneralSettings',
        'ManageTags',
        'ManageCollections',
        'ViewLibrary',
        'ViewPlaylists',
        'ViewPages',
        'ViewTags',
        'ViewCollections',
        'ViewLocations',
        'ManagePages',
        'ManageLibrary',
        'ManagePlaylists',
        'ManageLocations'
      ];
      
      const currentPermissions = dbOps.getRolePermissions(adminRole.guid);
      let updatedPermissions = [...currentPermissions];
      let hasNewPermissions = false;
      
      permissionsToAssign.forEach(permName => {
        const perm = dbOps.getPermissionByName(permName);
        if (perm && !currentPermissions.includes(perm.guid)) {
          updatedPermissions.push(perm.guid);
          hasNewPermissions = true;
        }
      });
      
      if (hasNewPermissions) {
        dbOps.updateRolePermissions(adminRole.guid, updatedPermissions);
        console.log('View and manage permissions assigned to admin role');
      }
    }
  } catch (error) {
    console.warn('Error adding permissions during initialization:', error.message);
    // Don't fail initialization if permission setup fails
  }

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_library_items_type ON library_items(type);
    CREATE INDEX IF NOT EXISTS idx_library_items_modified ON library_items(modified);
    CREATE INDEX IF NOT EXISTS idx_playlists_updated ON playlists(updated);
    CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_guid);
    CREATE INDEX IF NOT EXISTS idx_playlist_items_library ON playlist_items(library_item_guid);
    CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_guid);
    CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_guid);
    CREATE INDEX IF NOT EXISTS idx_library_item_pages_item ON library_item_pages(library_item_guid);
    CREATE INDEX IF NOT EXISTS idx_library_item_pages_page ON library_item_pages(page_guid);
    CREATE INDEX IF NOT EXISTS idx_library_item_tags_item ON library_item_tags(library_item_guid);
    CREATE INDEX IF NOT EXISTS idx_library_item_tags_tag ON library_item_tags(tag_guid);
    CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_guid);
    CREATE INDEX IF NOT EXISTS idx_collection_items_library ON collection_items(library_item_guid);
  `);
}

/**
 * Gets the database instance
 * @returns {Database} Database instance
 */
function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Closes the database connection
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  initDatabase,
  getDatabase,
  closeDatabase
};
