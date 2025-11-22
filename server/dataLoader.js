const { getDatabase } = require('./database');

/**
 * Loads all data from SQLite database
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

  // Load library items
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
      description: item.description || undefined
    };
  });
  console.log(`Loaded ${library.length} items from database`);

  // Load playlists
  const playlistRows = db.prepare('SELECT * FROM playlists ORDER BY guid').all();
  const playlists = playlistRows.map(playlist => {
    // Load playlist items
    const playlistItems = db.prepare(`
      SELECT library_item_guid as guid, page, description
      FROM playlist_items
      WHERE playlist_guid = ?
      ORDER BY sort_order
    `).all(playlist.guid);

    return {
      guid: playlist.guid,
      name: playlist.name,
      description: playlist.description || undefined,
      updated: playlist.updated || undefined,
      items: playlistItems.map(item => ({
        guid: item.guid,
        page: item.page || undefined,
        description: item.description || undefined
      }))
    };
  });

  console.log(`Loaded ${playlists.length} playlists from database`);
  playlists.forEach((playlist) => {
    console.log(`  - "${playlist.name}" (guid: ${playlist.guid}) with ${playlist.items.length} items`);
  });

  return {
    playlists,
    library,
    users,
    roles,
    permissions
  };
}

module.exports = { loadData };