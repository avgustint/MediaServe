const http = require('http');

/**
 * CORS helper function
 * @param {http.ServerResponse} res - HTTP response object
 */
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

/**
 * Sets up HTTP server with all endpoints
 * @param {Object} data - Object containing playlists, library, users, roles, permissions
 * @returns {http.Server} HTTP server instance
 */
function setupHttpEndpoints(data) {
  const { playlists, library, users, roles, permissions } = data;

  // Validate that playlists is an array
  if (!Array.isArray(playlists)) {
    console.error('Error: playlists is not an array:', typeof playlists);
    throw new Error('playlists must be an array');
  }

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

    // Handle playlist search endpoint (must be checked BEFORE /playlist endpoint)
    if (req.url && req.url.startsWith('/playlists/search') && req.method === 'GET') {
      try {
        // Parse search term from query string
        const urlParts = req.url.split('?');
        let searchTerm = '';
        if (urlParts.length > 1) {
          const queryParams = urlParts[1].split('&');
          for (const param of queryParams) {
            const [key, value] = param.split('=');
            if (key === 'q' && value !== undefined) {
              try {
                searchTerm = decodeURIComponent(value || '').toLowerCase().trim();
              } catch (e) {
                searchTerm = (value || '').toLowerCase().trim();
              }
              break;
            }
          }
        }
        
        // Debug logging
        console.log(`Search endpoint called with term: "${searchTerm}"`);
        console.log(`Total playlists available: ${playlists ? playlists.length : 0}`);
        console.log(`Playlists type: ${Array.isArray(playlists) ? 'array' : typeof playlists}`);
        
        // Ensure playlists is an array
        if (!Array.isArray(playlists)) {
          console.error('Error: playlists is not an array in search endpoint');
          res.writeHead(500, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:4200',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end(JSON.stringify({ error: 'Internal server error: playlists is not an array' }));
          return;
        }
        
        // Filter playlists by name or description (case-insensitive)
        let filteredPlaylists = [];
        if (searchTerm && searchTerm.length > 0) {
          filteredPlaylists = playlists.filter(playlist => {
            const playlistName = (playlist.name || '').toLowerCase();
            const playlistDesc = (playlist.description || '').toLowerCase();
            const nameMatch = playlistName.includes(searchTerm);
            const descMatch = playlistDesc.includes(searchTerm);
            const matches = nameMatch || descMatch;
            if (matches) {
              console.log(`  - Match found: "${playlist.name}" (name: ${nameMatch}, desc: ${descMatch})`);
            }
            return matches;
          });
        }
        
        console.log(`Filtered playlists count: ${filteredPlaylists.length}`);
        
        // Return array of matching playlists with guid, name and description
        const searchResults = filteredPlaylists.map(playlist => ({
          guid: playlist.guid,
          name: playlist.name || '',
          description: playlist.description || ''
        }));
        
        console.log(`Returning ${searchResults.length} search results`);
        console.log(`Search results JSON: ${JSON.stringify(searchResults)}`);
        
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:4200',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify(searchResults));
        return;
      } catch (error) {
        console.error('Playlist search error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:4200',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
        return;
      }
    }
    else // Handle playlist.json endpoint
    if (req.url && (req.url.startsWith('/playlist.json') || req.url.startsWith('/playlist'))) {
      try {
        // Parse guid from query string
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
          // Find playlist with matching guid
          selectedPlaylist = playlists.find(p => p.guid === requestedGuid);
          if (!selectedPlaylist) {
            res.writeHead(404, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:4200',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(JSON.stringify({ success: false, message: 'Playlist not found' }));
            return;
          }
        } else {
          // Return last updated playlist (most recent updated timestamp)
          if (playlists.length === 0) {
            res.writeHead(404, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:4200',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(JSON.stringify({ success: false, message: 'No playlists available' }));
            return;
          }
          
          // Sort playlists by updated timestamp (most recent first)
          selectedPlaylist = [...playlists].sort((a, b) => {
            const dateA = new Date(a.updated || 0);
            const dateB = new Date(b.updated || 0);
            return dateB.getTime() - dateA.getTime();
          })[0];
        }
        
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:4200',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify(selectedPlaylist, null, 2));
        return;
      } catch (error) {
        console.error('Playlist endpoint error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:4200',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
        return;
      }
    }
    else // Handle library.json endpoint
    if (req.url === '/library.json' || req.url === '/library') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(library, null, 2));
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
          
          // Find user in users.json that matches username and password
          // Password is already hashed, so compare directly
          const user = users.find(u => u.username === username && u.password === password);
          
          if (user) {
            // Find the user's role
            const userRole = roles.find(r => r.guid === user.role);
            
            // Get permission names linked by user roles
            const permissionNames = [];
            if (userRole && userRole.permissions) {
              userRole.permissions.forEach(permissionGuid => {
                const permission = permissions.find(p => p.guid === permissionGuid);
                if (permission) {
                  permissionNames.push(permission.name);
                }
              });
            }
            
            // Decode email from base64
            let decodedEmail = user.email;
            try {
              decodedEmail = Buffer.from(user.email, 'base64').toString('utf8');
            } catch (error) {
              // If decoding fails, use original email (might not be base64 encoded)
              console.warn('Failed to decode email for user:', user.username, error.message);
            }
            
            // Return all user data and permission names
            const response = {
              success: true,
              message: 'Login successful',
              user: {
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
              }
            };
            
            res.writeHead(200, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:4200',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(JSON.stringify(response));
          } else {
            res.writeHead(401, {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': 'http://localhost:4200',
              'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(JSON.stringify({ success: false, message: 'Invalid credentials' }));
          }
        } catch (error) {
          console.error('Login error:', error);
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:4200',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end(JSON.stringify({ success: false, message: 'Invalid request format' }));
        }
      });
      
      req.on('error', (error) => {
        console.error('Login request error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:4200',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify({ success: false, message: 'Server error' }));
      });
      
      return;
    }
    else // Handle /me endpoint to get current user data
    if (req.url && req.url.startsWith('/me') && req.method === 'GET') {
      try {
        // Parse username from query string
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
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:4200',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end(JSON.stringify({ success: false, message: 'Username parameter required' }));
          return;
        }
        
        // Find user by username
        const user = users.find(u => u.username === username);
        
        if (user) {
          // Find the user's role
          const userRole = roles.find(r => r.guid === user.role);
          
          // Get permission names linked by user roles
          const permissionNames = [];
          if (userRole && userRole.permissions) {
            userRole.permissions.forEach(permissionGuid => {
              const permission = permissions.find(p => p.guid === permissionGuid);
              if (permission) {
                permissionNames.push(permission.name);
              }
            });
          }
          
          // Decode email from base64
          let decodedEmail = user.email;
          try {
            decodedEmail = Buffer.from(user.email, 'base64').toString('utf8');
          } catch (error) {
            // If decoding fails, use original email (might not be base64 encoded)
            console.warn('Failed to decode email for user:', user.username, error.message);
          }
          
          // Return user data and permission names (same format as login)
          const response = {
            success: true,
            user: {
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
            }
          };
          
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:4200',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end(JSON.stringify(response));
        } else {
          res.writeHead(404, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:4200',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end(JSON.stringify({ success: false, message: 'User not found' }));
        }
      } catch (error) {
        console.error('Get current user error:', error);
        res.writeHead(500, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': 'http://localhost:4200',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
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

