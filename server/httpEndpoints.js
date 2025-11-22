const http = require('http');
const dbOps = require('./dbOperations');
const { loadData } = require('./dataLoader');

/**
 * CORS helper function
 * @param {http.ServerResponse} res - HTTP response object
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/**
 * Helper function to read request body
 */
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Helper function to get user data with permissions (for login and /me endpoints)
 */
function getUserWithPermissions(user) {
  const userRole = user.role ? dbOps.getRole(user.role) : null;
  const permissionGuids = userRole ? dbOps.getRolePermissions(user.role) : [];
  
  const permissionNames = permissionGuids.map(guid => {
    const perm = dbOps.getPermission(guid);
    return perm ? perm.name : null;
  }).filter(Boolean);

  // Decode email from base64
  let decodedEmail = user.email;
  try {
    decodedEmail = Buffer.from(user.email, 'base64').toString('utf8');
  } catch (error) {
    console.warn('Failed to decode email for user:', user.username, error.message);
  }

  return {
    name: user.name,
    email: decodedEmail,
    username: user.username,
    role: userRole ? {
      guid: userRole.guid,
      name: userRole.name
    } : null,
    guid: user.guid,
    permissions: permissionNames,
    locale: user.locale || null
  };
}

function setupHttpEndpoints(data) {
  // Load initial data from database for WebSocket (library)
  const { library } = data;

  // Create HTTP server
  const server = http.createServer((req, res) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      setCorsHeaders(res);
      res.writeHead(200);
      res.end();
      return;
    }

    // Set CORS headers for all responses
    setCorsHeaders(res);

    // Handle playlist create endpoint (POST /playlists)
    if (req.url === '/playlists' && req.method === 'POST') {
      readRequestBody(req).then((playlistData) => {
        try {
          const newPlaylist = dbOps.createPlaylist(playlistData);
          res.writeHead(200, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify(newPlaylist));
        } catch (error) {
          console.error('Playlist create error:', error);
          res.writeHead(500, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Server error' }));
        }
      }).catch((error) => {
        console.error('Playlist create request error:', error);
        res.writeHead(400, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Invalid request format' }));
      });
      return;
    }
    else // Handle playlist update endpoint (PUT /playlists/:guid)
    if (req.url && req.url.startsWith('/playlists/') && req.method === 'PUT') {
      try {
        const urlParts = req.url.split('/');
        const guid = parseInt(urlParts[urlParts.length - 1], 10);

        if (isNaN(guid)) {
          res.writeHead(400, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Invalid GUID' }));
          return;
        }

        readRequestBody(req).then((playlistData) => {
          const existingPlaylist = dbOps.getPlaylist(guid);
          if (!existingPlaylist) {
            res.writeHead(404, {
              'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ success: false, message: 'Playlist not found' }));
            return;
          }

          const updatedPlaylist = dbOps.updatePlaylist(guid, playlistData);
          res.writeHead(200, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify(updatedPlaylist));
        }).catch((error) => {
          console.error('Playlist update request error:', error);
          res.writeHead(400, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Invalid request format' }));
        });
      } catch (error) {
        console.error('Playlist update error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
      return;
    }
    else // Handle playlist delete endpoint (DELETE /playlists/:guid)
    if (req.url && req.url.match(/^\/playlists\/\d+$/) && req.method === 'DELETE') {
      try {
        const urlParts = req.url.split('/');
        const guid = parseInt(urlParts[urlParts.length - 1], 10);

        if (isNaN(guid)) {
          res.writeHead(400, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Invalid GUID' }));
          return;
        }

        const deleted = dbOps.deletePlaylist(guid);
        if (!deleted) {
          res.writeHead(404, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Playlist not found' }));
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: true, message: 'Playlist deleted' }));
      } catch (error) {
        console.error('Playlist delete error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
      return;
    }
    else // Handle playlist search endpoint (must be checked BEFORE /playlist endpoint)
    if (req.url && req.url.startsWith('/playlists/search') && req.method === 'GET') {
      try {
        const urlParts = req.url.split('?');
        let searchTerm = '';
        if (urlParts.length > 1) {
          const queryParams = urlParts[1].split('&');
          for (const param of queryParams) {
            const [key, value] = param.split('=');
            if (key === 'q' && value !== undefined) {
              try {
                searchTerm = decodeURIComponent(value || '').trim();
              } catch (e) {
                searchTerm = (value || '').trim();
              }
              break;
            }
          }
        }

        const searchResults = dbOps.searchPlaylists(searchTerm);
        res.writeHead(200, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify(searchResults));
      } catch (error) {
        console.error('Playlist search error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
      return;
    }
    else // Handle playlist items endpoint (optimized - returns items with JOIN)
    if (req.url && req.url.startsWith('/playlist/items') && req.method === 'GET') {
      try {
        const urlParts = req.url.split('?');
        let requestedGuid = null;
        if (urlParts.length > 1) {
          const queryParams = urlParts[1].split('&');
          for (const param of queryParams) {
            const [key, value] = param.split('=');
            if (key === 'guid') {
              requestedGuid = parseInt(decodeURIComponent(value), 10);
              break;
            }
          }
        }

        let playlistGuid = requestedGuid;
        if (!playlistGuid) {
          // Get last updated playlist guid
          const lastPlaylist = dbOps.getLastUpdatedPlaylist();
          if (!lastPlaylist) {
            res.writeHead(404, {
              'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ success: false, message: 'No playlists available' }));
            return;
          }
          playlistGuid = lastPlaylist.guid;
        }

        const items = dbOps.getPlaylistItems(playlistGuid);
        if (items === null) {
          res.writeHead(404, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Playlist not found' }));
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify(items));
      } catch (error) {
        console.error('Playlist items endpoint error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
      return;
    }
    else // Handle playlist endpoint
    if (req.url && req.url.startsWith('/playlist')) {
      try {
        const urlParts = req.url.split('?');
        let requestedGuid = null;
        if (urlParts.length > 1) {
          const queryParams = urlParts[1].split('&');
          for (const param of queryParams) {
            const [key, value] = param.split('=');
            if (key === 'guid') {
              requestedGuid = parseInt(decodeURIComponent(value), 10);
              break;
            }
          }
        }

        let selectedPlaylist = null;
        if (requestedGuid) {
          selectedPlaylist = dbOps.getPlaylist(requestedGuid);
          if (!selectedPlaylist) {
            res.writeHead(404, {
              'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ success: false, message: 'Playlist not found' }));
            return;
          }
        } else {
          selectedPlaylist = dbOps.getLastUpdatedPlaylist();
          if (!selectedPlaylist) {
            res.writeHead(404, {
              'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ success: false, message: 'No playlists available' }));
            return;
          }
        }

        res.writeHead(200, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify(selectedPlaylist, null, 2));
      } catch (error) {
        console.error('Playlist endpoint error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
      return;
    }
    else // Handle library search endpoint (must be checked BEFORE /library endpoint)
    if (req.url && req.url.startsWith('/library/search') && req.method === 'GET') {
      try {
        const urlParts = req.url.split('?');
        let searchTerm = '';
        if (urlParts.length > 1) {
          const queryParams = urlParts[1].split('&');
          for (const param of queryParams) {
            const [key, value] = param.split('=');
            if (key === 'q' && value !== undefined) {
              try {
                searchTerm = decodeURIComponent(value || '').trim();
              } catch (e) {
                searchTerm = (value || '').trim();
              }
              break;
            }
          }
        }

        const filteredItems = dbOps.searchLibraryItems(searchTerm).map(item => dbOps.formatLibraryItem(item));
        res.writeHead(200, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify(filteredItems));
      } catch (error) {
        console.error('Library search error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
      return;
    }
    else // Handle library create endpoint (POST /library)
    if (req.url === '/library' && req.method === 'POST') {
      readRequestBody(req).then((itemData) => {
        try {
          const newItem = dbOps.createLibraryItem(itemData);
          const formattedItem = dbOps.formatLibraryItem(newItem);
          res.writeHead(200, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify(formattedItem));
        } catch (error) {
          console.error('Library create error:', error);
          res.writeHead(500, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Server error' }));
        }
      }).catch((error) => {
        console.error('Library create request error:', error);
        res.writeHead(400, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Invalid request format' }));
      });
      return;
    }
    else // Handle library update endpoint (PUT /library/:guid)
    if (req.url && req.url.startsWith('/library/') && req.method === 'PUT') {
      try {
        const urlParts = req.url.split('/');
        const guid = parseInt(urlParts[urlParts.length - 1], 10);

        if (isNaN(guid)) {
          res.writeHead(400, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Invalid GUID' }));
          return;
        }

        readRequestBody(req).then((itemData) => {
          const existingItem = dbOps.getLibraryItem(guid);
          if (!existingItem) {
            res.writeHead(404, {
              'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ success: false, message: 'Library item not found' }));
            return;
          }

          const updatedItem = dbOps.updateLibraryItem(guid, itemData);
          const formattedItem = dbOps.formatLibraryItem(updatedItem);
          res.writeHead(200, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify(formattedItem));
        }).catch((error) => {
          console.error('Library update request error:', error);
          res.writeHead(400, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Invalid request format' }));
        });
      } catch (error) {
        console.error('Library update error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
      return;
    }
    else // Handle library usage check endpoint (GET /library/:guid/usage)
    if (req.url && req.url.match(/^\/library\/\d+\/usage$/) && req.method === 'GET') {
      try {
        const urlParts = req.url.split('/');
        const guid = parseInt(urlParts[2], 10);

        if (isNaN(guid)) {
          res.writeHead(400, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Invalid GUID' }));
          return;
        }

        const usageInfo = dbOps.checkLibraryItemUsage(guid);
        res.writeHead(200, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify(usageInfo));
      } catch (error) {
        console.error('Library usage check error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
      return;
    }
    else // Handle library delete endpoint (DELETE /library/:guid)
    if (req.url && req.url.match(/^\/library\/\d+$/) && req.method === 'DELETE') {
      try {
        const urlParts = req.url.split('/');
        const guid = parseInt(urlParts[urlParts.length - 1], 10);

        if (isNaN(guid)) {
          res.writeHead(400, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Invalid GUID' }));
          return;
        }

        const deleted = dbOps.deleteLibraryItem(guid);
        if (!deleted) {
          res.writeHead(404, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Library item not found' }));
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: true, message: 'Library item deleted' }));
      } catch (error) {
        console.error('Library delete error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
      return;
    }
    else // Handle library endpoint
    if (req.url === '/library' && req.method === 'GET') {
      try {
        const allItems = dbOps.getAllLibraryItems().map(item => dbOps.formatLibraryItem(item));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(allItems, null, 2));
      } catch (error) {
        console.error('Library endpoint error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
      return;
    }
    else // Handle login endpoint
    if (req.url === '/login' && req.method === 'POST') {
      let body = '';
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const username = data.username;
          const password = data.password; // Password is already MD5 hashed from client
          
          const user = dbOps.getUserByUsername(username);
          
          if (user && user.password === password) {
            const userData = getUserWithPermissions(user);
            const response = {
              success: true,
              message: 'Login successful',
              user: userData
            };
            
            res.writeHead(200, {
              'Content-Type': 'application/json'
            });
            res.end(JSON.stringify(response));
          } else {
            res.writeHead(401, {
              'Content-Type': 'application/json'
            });
            res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
          }
        } catch (error) {
          console.error('Login error:', error);
          res.writeHead(400, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Invalid request format' }));
        }
      });
      
      req.on('error', (error) => {
        console.error('Login request error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      });
      
      return;
    }
    else // Handle /me endpoint to get current user data
    if (req.url && req.url.startsWith('/me') && req.method === 'GET') {
      try {
        const urlParts = req.url.split('?');
        let username = null;
        if (urlParts.length > 1) {
          const queryParams = urlParts[1].split('&');
          for (const param of queryParams) {
            const [key, value] = param.split('=');
            if (key === 'username') {
              username = decodeURIComponent(value);
              break;
            }
          }
        }
        
        if (!username) {
          res.writeHead(400, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'Username parameter required' }));
          return;
        }
        
        const user = dbOps.getUserByUsername(username);
        
        if (user) {
          const userData = getUserWithPermissions(user);
          const response = {
            success: true,
            user: userData
          };
          
          res.writeHead(200, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify(response));
        } else {
          res.writeHead(404, {
            'Content-Type': 'application/json'
          });
          res.end(JSON.stringify({ success: false, message: 'User not found' }));
        }
      } catch (error) {
        console.error('Get current user error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      }
      
      return;
    }

    // Handle other HTTP requests
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  return server;
}

module.exports = { setupHttpEndpoints };