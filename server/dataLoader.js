const { getDatabase } = require('./database');

// Cache for library items (used by WebSocket)
let libraryCache = null;
let libraryCacheTime = null;
const LIBRARY_CACHE_TTL = 60000; // 1 minute

/**
 * Loads library items (with caching for WebSocket)
 * @returns {Array} Library items array
 */
function loadLibrary() {
  const now = Date.now();
  
  // Return cached library if still valid
  if (libraryCache && libraryCacheTime && (now - libraryCacheTime) < LIBRARY_CACHE_TTL) {
    return libraryCache;
  }
  
  const db = getDatabase();
  const libraryRows = db.prepare('SELECT * FROM library_items ORDER BY guid').all();
  const library = libraryRows.map(item => {
    // Try to parse content as JSON if it's not a string URL
    let content = item.content;
    if (item.type === 'text' && content && !content.startsWith('http')) {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          content = parsed;
        }
      } catch (e) {
        // If parsing fails, use content as-is
      }
    }

    return {
      guid: item.guid,
      name: item.name,
      type: item.type,
      content: content,
      description: item.description || undefined,
      background_color: item.background_color || undefined,
      font_color: item.font_color || undefined,
      author: item.author || undefined
    };
  });
  
  // Update cache
  libraryCache = library;
  libraryCacheTime = now;
  
  console.log(`Loaded ${library.length} items from database`);
  return library;
}

/**
 * Invalidate library cache (call when library is updated)
 */
function invalidateLibraryCache() {
  libraryCache = null;
  libraryCacheTime = null;
}

/**
 * Loads all data from SQLite database (for initial setup)
 * Note: Library is now loaded lazily via loadLibrary()
 * @returns {Object} Object containing playlists, library, users, roles, and permissions
 */
function loadData() {
  const db = getDatabase();

  // Load users
  const users = db.prepare('SELECT * FROM users ORDER BY guid').all();
  console.log(`Loaded ${users.length} users from database`);

  // Load roles
  const roles = db.prepare('SELECT * FROM roles ORDER BY guid').all();
  console.log(`Loaded ${roles.length} roles from database`);

  // Load permissions
  const permissions = db.prepare('SELECT * FROM permissions ORDER BY guid').all();
  console.log(`Loaded ${permissions.length} permissions from database`);

  // Load role-permission relationships
  const rolePermissions = db.prepare(`
    SELECT role_guid, permission_guid 
    FROM role_permissions
  `).all();

  // Attach permissions to roles
  roles.forEach(role => {
    role.permissions = rolePermissions
      .filter(rp => rp.role_guid === role.guid)
      .map(rp => rp.permission_guid);
  });

  // Load library items (lazy loading with cache)
  const library = loadLibrary();

  // Load playlists (metadata only, items loaded on demand)
  const playlistRows = db.prepare('SELECT * FROM playlists ORDER BY guid').all();
  const playlists = playlistRows.map(playlist => ({
    guid: playlist.guid,
    name: playlist.name,
    description: playlist.description || undefined,
    updated: playlist.updated || undefined
  }));

  console.log(`Loaded ${playlists.length} playlists from database`);

  return {
    playlists,
    library,
    users,
    roles,
    permissions
  };
}

module.exports = { 
  loadData,
  loadLibrary,
  invalidateLibraryCache
};