const { getDatabase } = require('./database');

/**
 * Database operations helper module
 */
const dbOps = {
  // Library operations
  createLibraryItem(item) {
    const db = getDatabase();
    const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM library_items').get()?.maxGuid || 0;
    const newGuid = maxGuid + 1;

    const contentStr = typeof item.content === 'string'
      ? item.content
      : JSON.stringify(item.content);

    const modified = new Date().toISOString();

    db.prepare(`
      INSERT INTO library_items (guid, name, type, content, description, modified)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      newGuid,
      item.name || '',
      item.type || 'text',
      contentStr,
      item.description || null,
      modified
    );

    return { ...item, guid: newGuid, modified };
  },

  updateLibraryItem(guid, item) {
    const db = getDatabase();
    const contentStr = typeof item.content === 'string'
      ? item.content
      : JSON.stringify(item.content);

    const modified = new Date().toISOString();

    db.prepare(`
      UPDATE library_items
      SET name = ?, type = ?, content = ?, description = ?, modified = ?
      WHERE guid = ?
    `).run(
      item.name || '',
      item.type || 'text',
      contentStr,
      item.description || null,
      modified,
      guid
    );

    return { ...item, guid, modified };
  },

  deleteLibraryItem(guid) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM library_items WHERE guid = ?').run(guid);
    return result.changes > 0;
  },

  getLibraryItem(guid) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM library_items WHERE guid = ?').get(guid);
  },

  getAllLibraryItems() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM library_items ORDER BY guid').all();
  },

  getRecentlyModifiedLibraryItems(limit = 50) {
    const db = getDatabase();
    const items = db.prepare(`
      SELECT * FROM library_items 
      WHERE modified IS NOT NULL
      ORDER BY modified DESC 
      LIMIT ?
    `).all(limit);
    
    return items.map(item => {
      // Parse content for text items
      if (item.type === 'text' && item.content) {
        try {
          item.content = JSON.parse(item.content);
        } catch (e) {
          item.content = [{ page: 1, content: item.content }];
        }
      }
      return item;
    });
  },

  searchLibraryItems(searchTerm) {
    const db = getDatabase();
    
    if (!searchTerm || searchTerm.trim().length === 0) {
      return [];
    }

    const trimmedTerm = searchTerm.trim();
    
    // Check if the entire search term is a valid GUID number
    const isEntireTermNumeric = /^\d+$/.test(trimmedTerm);
    if (isEntireTermNumeric) {
      const guidValue = parseInt(trimmedTerm, 10);
      // If it's a valid GUID, search for exact GUID match OR text match (excluding image content)
      const term = `%${trimmedTerm}%`;
      return db.prepare(`
        SELECT * FROM library_items 
        WHERE guid = ? 
           OR LOWER(name) LIKE ? 
           OR LOWER(description) LIKE ? 
           OR (type != 'image' AND LOWER(content) LIKE ?)
      `).all(guidValue, term, term, term);
    }

    // Split search term by spaces and filter out empty strings
    const searchWords = trimmedTerm.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    
    if (searchWords.length === 0) {
      return [];
    }

    // Build SQL query with AND conditions for each word
    // Each word must appear in name OR description OR content (if not image) OR guid (if numeric)
    let query = 'SELECT * FROM library_items WHERE ';
    const params = [];

    searchWords.forEach((word, index) => {
      if (index > 0) {
        query += ' AND ';
      }
      const term = `%${word}%`;
      const isNumeric = /^\d+$/.test(word);
      
      if (isNumeric) {
        // If word is numeric, also search for GUID matching
        const guidValue = parseInt(word, 10);
        query += `(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR (type != 'image' AND LOWER(content) LIKE ?) OR guid = ?)`;
        params.push(term, term, term, guidValue);
      } else {
        // If word is not numeric, only search in text fields (excluding image content)
        query += `(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR (type != 'image' AND LOWER(content) LIKE ?))`;
        params.push(term, term, term);
      }
    });

    return db.prepare(query).all(...params);
  },

  checkLibraryItemUsage(guid) {
    const db = getDatabase();
    const playlists = db.prepare(`
      SELECT DISTINCT p.guid, p.name
      FROM playlists p
      JOIN playlist_items pi ON p.guid = pi.playlist_guid
      WHERE pi.library_item_guid = ?
    `).all(guid);

    return {
      isUsed: playlists.length > 0,
      playlists: playlists
    };
  },

  // Playlist operations
  createPlaylist(playlist) {
    const db = getDatabase();
    const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM playlists').get()?.maxGuid || 0;
    const newGuid = maxGuid + 1;

    db.prepare(`
      INSERT INTO playlists (guid, name, description, updated)
      VALUES (?, ?, ?, ?)
    `).run(
      newGuid,
      playlist.name || '',
      playlist.description || null,
      new Date().toISOString()
    );

    // Insert playlist items
    if (playlist.items && Array.isArray(playlist.items)) {
      const insertItem = db.prepare(`
        INSERT INTO playlist_items (playlist_guid, library_item_guid, page, pages, description, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      playlist.items.forEach((item, index) => {
        // Convert pages array to JSON string, or null if not set (meaning all pages)
        let pagesJson = null;
        if (item.pages && Array.isArray(item.pages) && item.pages.length > 0) {
          pagesJson = JSON.stringify(item.pages);
        }
        // Support legacy single page field for backward compatibility
        else if (item.page !== undefined && item.page !== null) {
          pagesJson = JSON.stringify([item.page]);
        }
        
        insertItem.run(
          newGuid,
          item.guid,
          item.page || null, // Keep for backward compatibility
          pagesJson,
          item.description || null,
          index
        );
      });
    }

    return this.getPlaylist(newGuid);
  },

  updatePlaylist(guid, playlist) {
    const db = getDatabase();
    
    // Update playlist
    db.prepare(`
      UPDATE playlists
      SET name = ?, description = ?, updated = ?
      WHERE guid = ?
    `).run(
      playlist.name || '',
      playlist.description || null,
      new Date().toISOString(),
      guid
    );

    // Delete existing playlist items
    db.prepare('DELETE FROM playlist_items WHERE playlist_guid = ?').run(guid);

    // Insert new playlist items
    if (playlist.items && Array.isArray(playlist.items)) {
      const insertItem = db.prepare(`
        INSERT INTO playlist_items (playlist_guid, library_item_guid, page, pages, description, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      playlist.items.forEach((item, index) => {
        // Convert pages array to JSON string, or null if not set (meaning all pages)
        let pagesJson = null;
        if (item.pages && Array.isArray(item.pages) && item.pages.length > 0) {
          pagesJson = JSON.stringify(item.pages);
        }
        // Support legacy single page field for backward compatibility
        else if (item.page !== undefined && item.page !== null) {
          pagesJson = JSON.stringify([item.page]);
        }
        
        insertItem.run(
          guid,
          item.guid,
          item.page || null, // Keep for backward compatibility
          pagesJson,
          item.description || null,
          index
        );
      });
    }

    return this.getPlaylist(guid);
  },

  deletePlaylist(guid) {
    const db = getDatabase();
    db.prepare('DELETE FROM playlist_items WHERE playlist_guid = ?').run(guid);
    const result = db.prepare('DELETE FROM playlists WHERE guid = ?').run(guid);
    return result.changes > 0;
  },

  getPlaylist(guid) {
    const db = getDatabase();
    const playlist = db.prepare('SELECT * FROM playlists WHERE guid = ?').get(guid);
    if (!playlist) return null;

    const items = db.prepare(`
      SELECT library_item_guid as guid, page, pages, description
      FROM playlist_items
      WHERE playlist_guid = ?
      ORDER BY sort_order
    `).all(guid);

    return {
      guid: playlist.guid,
      name: playlist.name,
      description: playlist.description,
      updated: playlist.updated,
      items: items.map(item => {
        // Parse pages array from JSON, or use legacy page field
        let pages = undefined;
        if (item.pages) {
          try {
            pages = JSON.parse(item.pages);
          } catch (e) {
            // If parsing fails, try to use legacy page field
            if (item.page !== null && item.page !== undefined) {
              pages = [item.page];
            }
          }
        } else if (item.page !== null && item.page !== undefined) {
          // Legacy support: convert single page to pages array
          pages = [item.page];
        }
        // If pages is null/undefined, it means all pages should be used
        
        return {
          guid: item.guid,
          page: item.page || undefined, // Keep for backward compatibility
          pages: pages,
          description: item.description || undefined
        };
      })
    };
  },

  getLastUpdatedPlaylist() {
    const db = getDatabase();
    const playlist = db.prepare(`
      SELECT * FROM playlists
      ORDER BY updated DESC
      LIMIT 1
    `).get();
    
    if (!playlist) return null;
    return this.getPlaylist(playlist.guid);
  },

  // Optimized method to get playlist items with library details (JOIN query)
  getPlaylistItems(guid) {
    const db = getDatabase();
    
    // First check if playlist exists
    const playlist = db.prepare('SELECT guid FROM playlists WHERE guid = ?').get(guid);
    if (!playlist) {
      return null;
    }

    // Get playlist items with library details using JOIN
    const items = db.prepare(`
      SELECT 
        li.guid,
        li.name,
        li.type,
        li.content,
        li.description as library_description,
        pi.pages as playlist_pages,
        pi.description as playlist_description
      FROM playlist_items pi
      JOIN library_items li ON pi.library_item_guid = li.guid
      WHERE pi.playlist_guid = ?
      ORDER BY pi.sort_order
    `).all(guid);

    return items.map(item => {
      let pages = undefined;
      let availablePages = [];

      // For text items, parse content to get page numbers
      if (item.type === 'text' && item.content) {
        try {
          const content = JSON.parse(item.content);
          if (Array.isArray(content)) {
            availablePages = content.map(page => page.page);
          }
        } catch (e) {
          // If parsing fails, content might be a string (single page)
          // In that case, we'll have no pages to show
        }

        // Check if playlist has specific pages selected
        if (item.playlist_pages) {
          try {
            const selectedPages = JSON.parse(item.playlist_pages);
            if (Array.isArray(selectedPages) && selectedPages.length > 0) {
              // Filter available pages to only include selected ones
              pages = availablePages.filter(page => selectedPages.includes(page));
            }
          } catch (e) {
            // If parsing fails, use all available pages
          }
        }

        // If pages is still undefined, use all available pages
        if (pages === undefined) {
          pages = availablePages;
        }
      }

      return {
        guid: item.guid,
        name: item.name,
        type: item.type,
        description: item.playlist_description || item.library_description || undefined,
        pages: pages // Only for text items, array of page numbers
      };
    });
  },

  searchPlaylists(searchTerm) {
    const db = getDatabase();
    const term = `%${searchTerm.toLowerCase()}%`;
    return db.prepare(`
      SELECT guid, name, description
      FROM playlists
      WHERE LOWER(name) LIKE ? OR LOWER(description) LIKE ?
    `).all(term, term);
  },

  getAllPlaylists() {
    const db = getDatabase();
    const playlists = db.prepare('SELECT * FROM playlists ORDER BY guid').all();
    return playlists.map(p => this.getPlaylist(p.guid));
  },

  getAllPlaylistsMetadata() {
    const db = getDatabase();
    return db.prepare('SELECT guid, name, description, updated FROM playlists').all();
  },

  getRecentlyModifiedPlaylists(limit = 50) {
    const db = getDatabase();
    return db.prepare(`
      SELECT guid, name, description, updated 
      FROM playlists 
      WHERE updated IS NOT NULL
      ORDER BY updated DESC 
      LIMIT ?
    `).all(limit);
  },

  // User operations
  getUserByUsername(username) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  getUserById(guid) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users WHERE guid = ?').get(guid);
  },

  getAllUsers() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM users ORDER BY guid').all();
  },

  createUser(user) {
    const db = getDatabase();
    const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM users').get()?.maxGuid || 0;
    const newGuid = maxGuid + 1;

    // Encode email to base64
    const encodedEmail = Buffer.from(user.email || '').toString('base64');

    db.prepare(`
      INSERT INTO users (guid, name, email, username, password, role, locale)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newGuid,
      user.name || '',
      encodedEmail,
      user.username || '',
      user.password || '',
      user.role || null,
      user.locale || null
    );

    return this.getUserById(newGuid);
  },

  updateUser(guid, user) {
    const db = getDatabase();
    
    // Encode email to base64 if provided
    let encodedEmail = null;
    if (user.email !== undefined) {
      encodedEmail = Buffer.from(user.email || '').toString('base64');
    } else {
      // Get existing email if not provided
      const existingUser = this.getUserById(guid);
      if (existingUser) {
        encodedEmail = existingUser.email;
      }
    }

    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, username = ?, password = COALESCE(?, password), role = ?, locale = ?
      WHERE guid = ?
    `).run(
      user.name !== undefined ? user.name : null,
      encodedEmail,
      user.username !== undefined ? user.username : null,
      user.password || null,
      user.role !== undefined ? user.role : null,
      user.locale !== undefined ? user.locale : null,
      guid
    );

    return this.getUserById(guid);
  },

  deleteUser(guid) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM users WHERE guid = ?').run(guid);
    return result.changes > 0;
  },

  // Role operations
  getRole(guid) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM roles WHERE guid = ?').get(guid);
  },

  getAllRoles() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM roles ORDER BY guid').all();
  },

  // Permission operations
  getPermission(guid) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM permissions WHERE guid = ?').get(guid);
  },

  getAllPermissions() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM permissions ORDER BY guid').all();
  },

  getRolePermissions(roleGuid) {
    const db = getDatabase();
    return db.prepare(`
      SELECT permission_guid
      FROM role_permissions
      WHERE role_guid = ?
    `).all(roleGuid).map(r => r.permission_guid);
  },

  updateRolePermissions(roleGuid, permissionGuids) {
    const db = getDatabase();
    
    db.transaction(() => {
      // Delete existing permissions for this role
      db.prepare('DELETE FROM role_permissions WHERE role_guid = ?').run(roleGuid);
      
      // Insert new permissions
      if (permissionGuids && Array.isArray(permissionGuids) && permissionGuids.length > 0) {
        const insertStmt = db.prepare(`
          INSERT INTO role_permissions (role_guid, permission_guid)
          VALUES (?, ?)
        `);
        permissionGuids.forEach(permGuid => {
          insertStmt.run(roleGuid, permGuid);
        });
      }
    })();

    return this.getRolePermissions(roleGuid);
  },

  // Helper to format library item with parsed content
  formatLibraryItem(item) {
    if (!item) return null;

    let content = item.content;
    
    // If content is already parsed (array), use it as-is
    if (Array.isArray(content)) {
      // Content is already parsed, use as-is
    } else if (typeof content === 'string' && item.type === 'text' && !content.startsWith('http')) {
      // Content is a string, try to parse it for text items
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
      modified: item.modified || undefined
    };
  }
};

module.exports = dbOps;
