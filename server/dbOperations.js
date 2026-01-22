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

    // For text items, content will be handled via pages
    // For other types, store content as string
    let contentStr = '';
    if (item.type === 'text') {
      // Text items will use pages, so content can be empty or legacy format
      contentStr = typeof item.content === 'string' ? item.content : '';
    } else {
      contentStr = typeof item.content === 'string'
        ? item.content
        : JSON.stringify(item.content || '');
    }

    const modified = new Date().toISOString();

    // Serialize CSS object to JSON string if provided
    const cssStr = item.css ? (typeof item.css === 'string' ? item.css : JSON.stringify(item.css)) : null;

    db.transaction(() => {
      db.prepare(`
        INSERT INTO library_items (guid, name, type, content, description, modified, background_color, font_color, author, css)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newGuid,
        item.name || '',
        item.type || 'text',
        contentStr,
        item.description || null,
        modified,
        item.background_color || null,
        item.font_color || null,
        item.author || null,
        cssStr
      );

      // Handle pages for text items
      if (item.type === 'text' && item.pageGuids && Array.isArray(item.pageGuids) && item.pageGuids.length > 0) {
        this.setLibraryItemPages(newGuid, item.pageGuids);
      }

      // Handle tags
      if (item.tagGuids && Array.isArray(item.tagGuids) && item.tagGuids.length > 0) {
        this.setLibraryItemTags(newGuid, item.tagGuids);
      }
    })();

    return this.formatLibraryItem({ ...item, guid: newGuid, modified });
  },

  updateLibraryItem(guid, item) {
    const db = getDatabase();
    const existingItem = this.getLibraryItem(guid);
    if (!existingItem) {
      return null;
    }

    // For text items, content will be handled via pages
    // For other types, store content as string
    let contentStr = existingItem.content;
    if (item.type !== 'text' && item.content !== undefined) {
      contentStr = typeof item.content === 'string'
        ? item.content
        : JSON.stringify(item.content || '');
    }

    const modified = new Date().toISOString();

    // Determine author value - explicitly set to null if author is undefined or empty
    let authorValue = existingItem.author;
    if (item.author !== undefined) {
      // If author is explicitly set (even if null or empty string), use it
      authorValue = (item.author !== null && item.author !== undefined && item.author.trim() !== '') ? item.author.trim() : null;
    }

    // Serialize CSS object to JSON string if provided
    let cssValue = existingItem.css;
    if (item.css !== undefined) {
      cssValue = item.css ? (typeof item.css === 'string' ? item.css : JSON.stringify(item.css)) : null;
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE library_items
        SET name = ?, type = ?, content = ?, description = ?, modified = ?, background_color = ?, font_color = ?, author = ?, css = ?
        WHERE guid = ?
      `).run(
        item.name !== undefined ? item.name : existingItem.name,
        item.type !== undefined ? item.type : existingItem.type,
        contentStr,
        item.description !== undefined ? item.description : existingItem.description,
        modified,
        item.background_color !== undefined ? item.background_color : existingItem.background_color,
        item.font_color !== undefined ? item.font_color : existingItem.font_color,
        authorValue,
        cssValue,
        guid
      );

      // Handle pages for text items
      if (item.type === 'text' && item.pageGuids !== undefined) {
        this.setLibraryItemPages(guid, item.pageGuids || []);
      }

      // Handle tags
      if (item.tagGuids !== undefined) {
        this.setLibraryItemTags(guid, item.tagGuids || []);
      }
    })();

    return this.formatLibraryItem({ ...existingItem, ...item, guid, modified });
  },

  deleteLibraryItem(guid) {
    const db = getDatabase();
    const item = this.getLibraryItem(guid);
    
    // If it's a video item, delete the associated video file
    if (item && item.type === 'video' && item.content) {
      try {
        const fs = require('fs');
        const path = require('path');
        const videosDir = path.join(__dirname, 'data', 'videos');
        
        // Extract filename from content URL (e.g., /videos/filename.mp4 -> filename.mp4)
        const urlMatch = item.content.match(/\/videos\/(.+)$/);
        if (urlMatch) {
          const filename = urlMatch[1];
          const filePath = path.join(videosDir, filename);
          
          // Delete file if it exists
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted video file: ${filePath}`);
          }
        }
      } catch (error) {
        console.warn(`Failed to delete video file for library item ${guid}:`, error.message);
        // Continue with deletion even if file deletion fails
      }
    }
    
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

  /**
   * Strip HTML tags and chord content from text for searching
   */
  stripHtmlAndChords(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }
    
    // Remove all content inside <chord> tags (including the tags themselves)
    let cleaned = text.replace(/<chord[^>]*>.*?<\/chord>/gi, '');
    
    // Remove all other HTML tags
    cleaned = cleaned.replace(/<[^>]+>/g, '');
    
    // Decode HTML entities
    cleaned = cleaned.replace(/&nbsp;/g, ' ');
    cleaned = cleaned.replace(/&amp;/g, '&');
    cleaned = cleaned.replace(/&lt;/g, '<');
    cleaned = cleaned.replace(/&gt;/g, '>');
    cleaned = cleaned.replace(/&quot;/g, '"');
    cleaned = cleaned.replace(/&#39;/g, "'");
    
    return cleaned;
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
      const term = `%${trimmedTerm}%`;
      
      // Priority 1a: Exact GUID match
      const exactGuidMatches = db.prepare(`
        SELECT DISTINCT li.* FROM library_items li
        WHERE li.guid = ?
      `).all(guidValue);
      
      // Priority 1b: Partial GUID matches (GUID contains the search term)
      const partialGuidMatches = db.prepare(`
        SELECT DISTINCT li.* FROM library_items li
        WHERE li.guid != ? AND CAST(li.guid AS TEXT) LIKE ?
      `).all(guidValue, term);
      
      // Combine exact and partial GUID matches
      const guidMatches = [...exactGuidMatches, ...partialGuidMatches];
      const guidSet = new Set(guidMatches.map(item => item.guid));
      
      // Priority 2: Name matches (excluding items already matched by GUID)
      const allItemsForNameSearch = db.prepare('SELECT * FROM library_items').all();
      const nameMatches = [];
      for (const item of allItemsForNameSearch) {
        if (guidSet.has(item.guid)) continue;
        if (item.name && item.name.toLowerCase().includes(trimmedTerm.toLowerCase())) {
          nameMatches.push(item);
          guidSet.add(item.guid);
        }
      }
      
      // Priority 3: Content matches (ignoring HTML tags and chord content)
      const allItems = db.prepare('SELECT * FROM library_items').all();
      const contentMatches = [];
      
      for (const item of allItems) {
        if (guidSet.has(item.guid)) continue;
        
        // Check direct content (for non-image items)
        if (item.type !== 'image' && item.content) {
          const contentStr = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
          const cleanedContent = this.stripHtmlAndChords(contentStr);
          if (cleanedContent.toLowerCase().includes(trimmedTerm.toLowerCase())) {
            contentMatches.push(item);
            guidSet.add(item.guid);
            continue;
          }
        }
        
        // Check linked pages content
        const pages = db.prepare(`
          SELECT p.content FROM library_item_pages lip
          JOIN pages p ON lip.page_guid = p.guid
          WHERE lip.library_item_guid = ?
        `).all(item.guid);
        
        for (const page of pages) {
          const cleanedContent = this.stripHtmlAndChords(page.content || '');
          if (cleanedContent.toLowerCase().includes(trimmedTerm.toLowerCase())) {
            contentMatches.push(item);
            guidSet.add(item.guid);
            break;
          }
        }
      }
      
      // Combine results in priority order
      return [...guidMatches, ...nameMatches, ...contentMatches];
    }

    // Split search term by spaces and filter out empty strings
    const searchWords = trimmedTerm.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    
    if (searchWords.length === 0) {
      return [];
    }

    // Priority 1: GUID matches (exact and partial)
    const guidMatches = [];
    const guidSet = new Set();
    
    for (const word of searchWords) {
      if (/^\d+$/.test(word)) {
        const guidValue = parseInt(word, 10);
        const guidPattern = `%${word}%`;
        
        // Exact GUID match
        const exactItem = db.prepare('SELECT * FROM library_items WHERE guid = ?').get(guidValue);
        if (exactItem && !guidSet.has(exactItem.guid)) {
          guidMatches.push(exactItem);
          guidSet.add(exactItem.guid);
        }
        
        // Partial GUID matches (GUID contains the search word)
        const partialItems = db.prepare(`
          SELECT * FROM library_items 
          WHERE guid != ? AND CAST(guid AS TEXT) LIKE ?
        `).all(guidValue, guidPattern);
        
        for (const item of partialItems) {
          if (!guidSet.has(item.guid)) {
            guidMatches.push(item);
            guidSet.add(item.guid);
          }
        }
      }
    }
    
    // Priority 2: Name matches (check if ALL words match in name)
    const nameMatches = [];
    const nameSet = new Set();
    
    const allItems = db.prepare('SELECT * FROM library_items').all();
    for (const item of allItems) {
      if (guidSet.has(item.guid)) continue;
      
      if (item.name) {
        const itemNameLower = item.name.toLowerCase();
        let allWordsInName = true;
        for (const word of searchWords) {
          if (!itemNameLower.includes(word)) {
            allWordsInName = false;
            break;
          }
        }
        if (allWordsInName) {
          nameMatches.push(item);
          nameSet.add(item.guid);
        }
      }
    }
    
    // Priority 3: Content matches (ignoring HTML tags and chord content)
    const contentMatches = [];
    const contentSet = new Set([...guidSet, ...nameSet]);
    
    for (const item of allItems) {
      if (contentSet.has(item.guid)) continue;
      
      let allWordsMatch = true;
      
      // Check if all words match in content
      for (const word of searchWords) {
        let wordFound = false;
        
        // Check direct content (for non-image items)
        if (item.type !== 'image' && item.content) {
          const contentStr = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
          const cleanedContent = this.stripHtmlAndChords(contentStr);
          if (cleanedContent.toLowerCase().includes(word)) {
            wordFound = true;
          }
        }
        
        // If not found in direct content, check linked pages
        if (!wordFound) {
          const pages = db.prepare(`
            SELECT p.content FROM library_item_pages lip
            JOIN pages p ON lip.page_guid = p.guid
            WHERE lip.library_item_guid = ?
          `).all(item.guid);
          
          for (const page of pages) {
            const cleanedContent = this.stripHtmlAndChords(page.content || '');
            if (cleanedContent.toLowerCase().includes(word)) {
              wordFound = true;
              break;
            }
          }
        }
        
        if (!wordFound) {
          allWordsMatch = false;
          break;
        }
      }
      
      if (allWordsMatch) {
        contentMatches.push(item);
        contentSet.add(item.guid);
      }
    }
    
    // Return results in priority order: GUID matches, then name matches, then content matches
    return [...guidMatches, ...nameMatches, ...contentMatches];
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
      
      console.log(`[getPlaylistItems] Item ${item.guid} (${item.name}): type=${item.type}, hasContent=${!!item.content}, playlist_pages=${item.playlist_pages}`);

      // For text items, load content from library_item_pages if it exists
      let content = item.content;
      if (item.type === 'text') {
        const itemPages = this.getLibraryItemPages(item.guid);
        if (itemPages && itemPages.length > 0) {
          // Use pages from new structure
          content = itemPages.map((page, index) => ({
            page: page.order_number || (index + 1), // Use order_number from database
            content: page.content || ''
          }));
          console.log(`[getPlaylistItems] Item ${item.guid}: loaded ${itemPages.length} pages from library_item_pages`);
        } else if (typeof content === 'string' && content) {
          // Fallback to old content format (backward compatibility)
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
              content = parsed;
            }
          } catch (e) {
            // If parsing fails, content might be a string (single page)
            content = null;
          }
        }
      }

      // For text items, parse content to get page numbers
      if (item.type === 'text' && content) {
        console.log(`[getPlaylistItems] Item ${item.guid}: parsing content, type=${item.type}, content exists=${!!content}, content type=${typeof content}, isArray=${Array.isArray(content)}`);
        if (Array.isArray(content)) {
          availablePages = content.map(page => page.page || page.order_number || 1);
          console.log(`[getPlaylistItems] Item ${item.guid}: extracted availablePages=`, availablePages);
        } else {
          console.log(`[getPlaylistItems] Item ${item.guid}: content is not an array`);
        }

        // Check if playlist has specific pages selected
        if (item.playlist_pages) {
          try {
            const selectedPages = JSON.parse(item.playlist_pages);
            console.log(`[getPlaylistItems] Item ${item.guid}: playlist_pages=${item.playlist_pages}, selectedPages=`, selectedPages, 'availablePages=', availablePages);
            if (Array.isArray(selectedPages) && selectedPages.length > 0) {
              // Filter available pages to only include selected ones
              pages = availablePages.filter(page => selectedPages.includes(page));
              console.log(`[getPlaylistItems] Item ${item.guid}: filtered pages=`, pages);
            }
          } catch (e) {
            console.error(`[getPlaylistItems] Item ${item.guid}: Error parsing playlist_pages:`, e);
            // If parsing fails, use all available pages
          }
        } else {
          console.log(`[getPlaylistItems] Item ${item.guid}: playlist_pages is null/undefined, will use all available pages`);
        }

        // If pages is still undefined, use all available pages
        if (pages === undefined) {
          pages = availablePages;
          console.log(`[getPlaylistItems] Item ${item.guid}: pages was undefined, using all available pages:`, pages);
        } else {
          console.log(`[getPlaylistItems] Item ${item.guid}: final pages=`, pages);
        }
      } else {
        // For non-text items, pages should be undefined
        console.log(`[getPlaylistItems] Item ${item.guid}: not a text item or no content, type=${item.type}, hasContent=${!!item.content}`);
        pages = undefined;
      }

      const result = {
        guid: item.guid,
        name: item.name,
        type: item.type,
        description: item.playlist_description || item.library_description || undefined,
        pages: pages // Only for text items, array of page numbers (or undefined for non-text items)
      };
      console.log(`[getPlaylistItems] Item ${item.guid} (${item.name}): returning pages=`, result.pages, 'type=', result.type);
      return result;
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

    // Email is already base64 encoded from frontend, use as-is
    // Password should already be hashed (bcrypt) from route handler, use as-is
    db.prepare(`
      INSERT INTO users (guid, name, email, username, password, role, locale)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newGuid,
      user.name || '',
      user.email || '', // Already base64 encoded
      user.username || '',
      user.password || '', // Already hashed (bcrypt)
      user.role || null,
      user.locale || null
    );

    return this.getUserById(newGuid);
  },

  updateUser(guid, user) {
    const db = getDatabase();
    
    // Get existing user data to preserve fields that aren't being updated
    const existingUser = this.getUserById(guid);
    if (!existingUser) {
      throw new Error('User not found');
    }
    
    // Email is already base64 encoded from frontend, use as-is
    let email = existingUser.email;
    if (user.email !== undefined) {
      email = user.email;
    }
    
    // Preserve existing name if not provided
    let name = existingUser.name;
    if (user.name !== undefined) {
      name = user.name;
    }
    
    // Preserve existing username if not provided
    let username = existingUser.username;
    if (user.username !== undefined) {
      username = user.username;
    }

    // Password should already be hashed (bcrypt) from route handler, use as-is
    db.prepare(`
      UPDATE users
      SET name = ?, email = ?, username = ?, password = COALESCE(?, password), role = ?, locale = ?
      WHERE guid = ?
    `).run(
      name,
      email,
      username,
      user.password || null,
      user.role !== undefined ? user.role : existingUser.role,
      user.locale !== undefined ? user.locale : existingUser.locale,
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

  createRole(role) {
    const db = getDatabase();
    const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM roles').get()?.maxGuid || 0;
    const newGuid = maxGuid + 1;

    db.prepare(`
      INSERT INTO roles (guid, name, is_admin)
      VALUES (?, ?, ?)
    `).run(
      newGuid,
      role.name || '',
      role.is_admin || 0
    );

    return this.getRole(newGuid);
  },

  updateRole(guid, role) {
    const db = getDatabase();
    const existingRole = this.getRole(guid);
    if (!existingRole) {
      return null;
    }

    // For admin roles, only allow name to be changed
    if (existingRole.is_admin === 1) {
      db.prepare(`
        UPDATE roles
        SET name = ?
        WHERE guid = ?
      `).run(role.name || existingRole.name, guid);
    } else {
      // For non-admin roles, allow name and is_admin to be changed
      db.prepare(`
        UPDATE roles
        SET name = ?, is_admin = ?
        WHERE guid = ?
      `).run(
        role.name !== undefined ? role.name : existingRole.name,
        role.is_admin !== undefined ? role.is_admin : existingRole.is_admin,
        guid
      );
    }

    return this.getRole(guid);
  },

  checkRoleUsage(guid) {
    const db = getDatabase();
    const usersWithRole = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get(guid);
    return usersWithRole.count > 0;
  },

  deleteRole(guid) {
    const db = getDatabase();
    const role = this.getRole(guid);
    if (!role) {
      return false;
    }

    // Prevent deleting admin roles
    if (role.is_admin === 1) {
      throw new Error('Cannot delete administrator role');
    }

    // Check if role is used by any users
    if (this.checkRoleUsage(guid)) {
      throw new Error('Role is used by one or more users');
    }

    // Delete role permissions first
    db.prepare('DELETE FROM role_permissions WHERE role_guid = ?').run(guid);

    // Delete the role
    const result = db.prepare('DELETE FROM roles WHERE guid = ?').run(guid);
    return result.changes > 0;
  },

  // Permission operations
  getPermission(guid) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM permissions WHERE guid = ?').get(guid);
  },

  getPermissionByName(name) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM permissions WHERE name = ?').get(name);
  },

  createPermission(permission) {
    const db = getDatabase();
    // Check if permission already exists
    const existing = this.getPermissionByName(permission.name);
    if (existing) {
      return existing;
    }

    const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM permissions').get()?.maxGuid || 0;
    const newGuid = maxGuid + 1;

    db.prepare(`
      INSERT INTO permissions (guid, name, description)
      VALUES (?, ?, ?)
    `).run(
      newGuid,
      permission.name || '',
      permission.description || null
    );

    return this.getPermission(newGuid);
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

  // Helper to format library item with parsed content and pages
  formatLibraryItem(item) {
    if (!item) return null;

    let content = item.content;
    
    // For text items, load pages from library_item_pages if they exist
    if (item.type === 'text') {
      const pages = this.getLibraryItemPages(item.guid);
      if (pages && pages.length > 0) {
        // Use pages from new structure
        content = pages.map((page, index) => ({
          page: index + 1, // Order number
          content: page.content || ''
        }));
      } else if (typeof content === 'string' && !content.startsWith('http')) {
        // Fallback to old content format (backward compatibility)
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            content = parsed;
          }
        } catch (e) {
          // If parsing fails, use content as-is or create default page
          content = [{ page: 1, content: content || '' }];
        }
      } else if (Array.isArray(content)) {
        // Content is already parsed (array), use as-is
        content = content;
      } else {
        // Default empty page
        content = [{ page: 1, content: '' }];
      }
    } else if (Array.isArray(content)) {
      // For non-text items, content should be a string
      content = item.content;
    }

    // Get tags
    const tags = this.getLibraryItemTags(item.guid);

    // Parse CSS from JSON string if present
    let css = undefined;
    if (item.css) {
      try {
        css = typeof item.css === 'string' ? JSON.parse(item.css) : item.css;
      } catch (e) {
        // If parsing fails, use as-is or undefined
        css = undefined;
      }
    }

    return {
      guid: item.guid,
      name: item.name,
      type: item.type,
      content: content,
      description: item.description || undefined,
      modified: item.modified || undefined,
      background_color: item.background_color || undefined,
      font_color: item.font_color || undefined,
      author: item.author || undefined,
      css: css,
      tags: tags.map(t => ({ guid: t.guid, name: t.name, description: t.description }))
    };
  },

  // Settings operations
  getSetting(key) {
    const db = getDatabase();
    const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return result ? result.value : null;
  },

  setSetting(key, value) {
    const db = getDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value)
      VALUES (?, ?)
    `).run(key, value);
    return this.getSetting(key);
  },

  getAllSettings() {
    const db = getDatabase();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    return settings;
  },

  // Page operations
  createPage(content = '') {
    const db = getDatabase();
    const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM pages').get()?.maxGuid || 0;
    const newGuid = maxGuid + 1;
    db.prepare('INSERT INTO pages (guid, content) VALUES (?, ?)').run(newGuid, content || '');
    return this.getPage(newGuid);
  },

  getPage(guid) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM pages WHERE guid = ?').get(guid);
  },

  getAllPages() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM pages ORDER BY guid').all();
  },

  updatePage(guid, content) {
    const db = getDatabase();
    db.prepare('UPDATE pages SET content = ? WHERE guid = ?').run(content || '', guid);
    return this.getPage(guid);
  },

  deletePage(guid) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM pages WHERE guid = ?').run(guid);
    return result.changes > 0;
  },

  // Library item pages operations
  setLibraryItemPages(libraryItemGuid, pageGuids) {
    const db = getDatabase();
    // Delete existing pages for this library item
    db.prepare('DELETE FROM library_item_pages WHERE library_item_guid = ?').run(libraryItemGuid);
    
    // Insert new pages with order
    if (pageGuids && Array.isArray(pageGuids) && pageGuids.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO library_item_pages (library_item_guid, page_guid, order_number)
        VALUES (?, ?, ?)
      `);
      pageGuids.forEach((pageGuid, index) => {
        insertStmt.run(libraryItemGuid, pageGuid, index + 1);
      });
    }
  },

  getLibraryItemPages(libraryItemGuid) {
    const db = getDatabase();
    return db.prepare(`
      SELECT p.guid, p.content, lip.order_number
      FROM library_item_pages lip
      JOIN pages p ON lip.page_guid = p.guid
      WHERE lip.library_item_guid = ?
      ORDER BY lip.order_number
    `).all(libraryItemGuid);
  },

  // Tag operations
  createTag(tag) {
    const db = getDatabase();
    const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM tags').get()?.maxGuid || 0;
    const newGuid = maxGuid + 1;
    db.prepare(`
      INSERT INTO tags (guid, name, description)
      VALUES (?, ?, ?)
    `).run(
      newGuid,
      tag.name || '',
      tag.description || null
    );
    return this.getTag(newGuid);
  },

  getTag(guid) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tags WHERE guid = ?').get(guid);
  },

  getAllTags() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM tags ORDER BY name').all();
  },

  updateTag(guid, tag) {
    const db = getDatabase();
    db.prepare(`
      UPDATE tags
      SET name = ?, description = ?
      WHERE guid = ?
    `).run(
      tag.name !== undefined ? tag.name : null,
      tag.description !== undefined ? tag.description : null,
      guid
    );
    return this.getTag(guid);
  },

  deleteTag(guid) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM tags WHERE guid = ?').run(guid);
    return result.changes > 0;
  },

  checkTagUsage(tagGuid) {
    const db = getDatabase();
    const count = db.prepare('SELECT COUNT(*) as count FROM library_item_tags WHERE tag_guid = ?').get(tagGuid).count;
    return { isUsed: count > 0, itemCount: count };
  },

  // Library item tags operations
  setLibraryItemTags(libraryItemGuid, tagGuids) {
    const db = getDatabase();
    // Delete existing tags for this library item
    db.prepare('DELETE FROM library_item_tags WHERE library_item_guid = ?').run(libraryItemGuid);
    
    // Insert new tags
    if (tagGuids && Array.isArray(tagGuids) && tagGuids.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO library_item_tags (library_item_guid, tag_guid)
        VALUES (?, ?)
      `);
      tagGuids.forEach(tagGuid => {
        insertStmt.run(libraryItemGuid, tagGuid);
      });
    }
  },

  getLibraryItemTags(libraryItemGuid) {
    const db = getDatabase();
    return db.prepare(`
      SELECT t.guid, t.name, t.description
      FROM library_item_tags lit
      JOIN tags t ON lit.tag_guid = t.guid
      WHERE lit.library_item_guid = ?
      ORDER BY t.name
    `).all(libraryItemGuid);
  },

  // Collection operations
  createCollection(collection) {
    const db = getDatabase();
    const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM collections').get()?.maxGuid || 0;
    const newGuid = maxGuid + 1;
    db.prepare(`
      INSERT INTO collections (guid, title, label, year, publisher, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      newGuid,
      collection.title || '',
      collection.label || null,
      collection.year || null,
      collection.publisher || null,
      collection.source || null
    );
    return this.getCollection(newGuid);
  },

  getCollection(guid) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM collections WHERE guid = ?').get(guid);
  },

  getAllCollections() {
    const db = getDatabase();
    const collections = db.prepare('SELECT * FROM collections ORDER BY title').all();
    // Add item count to each collection
    return collections.map(collection => ({
      ...collection,
      itemCount: this.getCollectionItemCount(collection.guid)
    }));
  },

  updateCollection(guid, collection) {
    const db = getDatabase();
    const existing = this.getCollection(guid);
    if (!existing) return null;
    
    db.prepare(`
      UPDATE collections
      SET title = ?, label = ?, year = ?, publisher = ?, source = ?
      WHERE guid = ?
    `).run(
      collection.title !== undefined ? collection.title : existing.title,
      collection.label !== undefined ? collection.label : existing.label,
      collection.year !== undefined ? collection.year : existing.year,
      collection.publisher !== undefined ? collection.publisher : existing.publisher,
      collection.source !== undefined ? collection.source : existing.source,
      guid
    );
    return this.getCollection(guid);
  },

  deleteCollection(guid) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM collections WHERE guid = ?').run(guid);
    return result.changes > 0;
  },

  // Collection items operations
  addCollectionItem(collectionGuid, libraryItemGuid, itemData) {
    const db = getDatabase();
    // Check if already exists
    const existing = db.prepare(`
      SELECT * FROM collection_items
      WHERE collection_guid = ? AND library_item_guid = ?
    `).get(collectionGuid, libraryItemGuid);
    
    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE collection_items
        SET collection_number = ?, collection_page = ?, author = ?
        WHERE collection_guid = ? AND library_item_guid = ?
      `).run(
        itemData.collection_number || null,
        itemData.collection_page || null,
        itemData.author || null,
        collectionGuid,
        libraryItemGuid
      );
    } else {
      // Insert new
      db.prepare(`
        INSERT INTO collection_items (collection_guid, library_item_guid, collection_number, collection_page, author)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        collectionGuid,
        libraryItemGuid,
        itemData.collection_number || null,
        itemData.collection_page || null,
        itemData.author || null
      );
    }
    return this.getCollectionItem(collectionGuid, libraryItemGuid);
  },

  getCollectionItem(collectionGuid, libraryItemGuid) {
    const db = getDatabase();
    return db.prepare(`
      SELECT * FROM collection_items
      WHERE collection_guid = ? AND library_item_guid = ?
    `).get(collectionGuid, libraryItemGuid);
  },

  getCollectionItems(collectionGuid) {
    const db = getDatabase();
    return db.prepare(`
      SELECT li.guid, li.name, li.type, ci.collection_number, ci.collection_page, ci.author
      FROM collection_items ci
      JOIN library_items li ON ci.library_item_guid = li.guid
      WHERE ci.collection_guid = ?
      ORDER BY ci.collection_number, li.name
    `).all(collectionGuid);
  },

  getCollectionItemCount(collectionGuid) {
    const db = getDatabase();
    const result = db.prepare(`
      SELECT COUNT(*) as count
      FROM collection_items
      WHERE collection_guid = ?
    `).get(collectionGuid);
    return result ? result.count : 0;
  },

  getLibraryItemCollections(libraryItemGuid) {
    const db = getDatabase();
    return db.prepare(`
      SELECT c.guid, c.title, c.label, ci.collection_number, ci.collection_page, ci.author
      FROM collection_items ci
      JOIN collections c ON ci.collection_guid = c.guid
      WHERE ci.library_item_guid = ?
      ORDER BY c.title
    `).all(libraryItemGuid);
  },

  removeCollectionItem(collectionGuid, libraryItemGuid) {
    const db = getDatabase();
    const result = db.prepare(`
      DELETE FROM collection_items
      WHERE collection_guid = ? AND library_item_guid = ?
    `).run(collectionGuid, libraryItemGuid);
    return result.changes > 0;
  },

  // Location operations
  createLocation(location) {
    const db = getDatabase();
    const maxGuid = db.prepare('SELECT MAX(guid) as maxGuid FROM locations').get()?.maxGuid || 0;
    const newGuid = maxGuid + 1;
    db.prepare(`
      INSERT INTO locations (guid, name, description)
      VALUES (?, ?, ?)
    `).run(
      newGuid,
      location.name || '',
      location.description || null
    );
    return this.getLocation(newGuid);
  },

  getLocation(guid) {
    const db = getDatabase();
    return db.prepare('SELECT * FROM locations WHERE guid = ?').get(guid);
  },

  getAllLocations() {
    const db = getDatabase();
    return db.prepare('SELECT * FROM locations ORDER BY name').all();
  },

  updateLocation(guid, location) {
    const db = getDatabase();
    db.prepare(`
      UPDATE locations
      SET name = ?, description = ?
      WHERE guid = ?
    `).run(
      location.name !== undefined ? location.name : null,
      location.description !== undefined ? location.description : null,
      guid
    );
    return this.getLocation(guid);
  },

  deleteLocation(guid) {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM locations WHERE guid = ?').run(guid);
    return result.changes > 0;
  }
};

module.exports = dbOps;
