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
      name TEXT NOT NULL
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
      description TEXT
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

  // Create indexes for better query performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_library_items_type ON library_items(type);
    CREATE INDEX IF NOT EXISTS idx_playlists_updated ON playlists(updated);
    CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_guid);
    CREATE INDEX IF NOT EXISTS idx_playlist_items_library ON playlist_items(library_item_guid);
    CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_guid);
    CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_guid);
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
