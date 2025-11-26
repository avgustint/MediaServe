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
  db.exec(`
    CREATE TABLE IF NOT EXISTS library_items (
      guid INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('text', 'image', 'url')),
      content TEXT NOT NULL,
      description TEXT,
      modified TEXT
    )
  `);

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

  // Pages table - stores reusable page content
  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      guid INTEGER PRIMARY KEY,
      content TEXT
    )
  `);

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
      PRIMARY KEY (collection_guid, library_item_guid),
      FOREIGN KEY (collection_guid) REFERENCES collections(guid) ON DELETE CASCADE,
      FOREIGN KEY (library_item_guid) REFERENCES library_items(guid) ON DELETE CASCADE
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
