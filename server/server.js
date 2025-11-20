const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load playlist from JSON file
let playlist = [];
try {
  const playlistData = fs.readFileSync(path.join(__dirname, 'playlist.json'), 'utf8');
  playlist = JSON.parse(playlistData);
  console.log(`Loaded ${playlist.length} messages from playlist.json`);
} catch (error) {
  console.error('Error loading playlist.json:', error.message);
  process.exit(1);
}

// Load library from JSON file
let library = [];
try {
  const libraryData = fs.readFileSync(path.join(__dirname, 'library.json'), 'utf8');
  library = JSON.parse(libraryData);
  console.log(`Loaded ${library.length} items from library.json`);
} catch (error) {
  console.error('Error loading library.json:', error.message);
  process.exit(1);
}

// CORS helper function
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:4200');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// Create HTTP server
const PORT = process.env.PORT || 8080;
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

  // Handle playlist.json endpoint
  if (req.url === '/playlist.json' || req.url === '/playlist') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(playlist, null, 2));
    return;
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
        const password = data.password;
        
        // MD5 hash of 'admin'
        const adminPasswordHash = crypto.createHash('md5').update('admin').digest('hex');
        
        // Check credentials
        if (username === 'admin' && password === adminPasswordHash) {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:4200',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end(JSON.stringify({ success: true, message: 'Login successful' }));
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

  // Handle other HTTP requests
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

// Start the server
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/playlist.json`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/library.json`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/login (POST)`);
  console.log(`WebSocket server available at ws://localhost:${PORT}`);
});

// Store all connected clients
const clients = new Set();

// Handle new client connections
wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'text',
    content: 'Connected to media player server'
  }));

  // Handle client disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      // Check if it's a "Change" message with guid
      if (message.type === 'Change' && message.guid) {
        console.log('Received Change message with guid:', message.guid, ' and page:', message.page);
        
        // Find item in playlist with matching guid
        const matchingItem = library.find(item => item.guid === message.guid);
        
        if (matchingItem) {
          console.log('Found matching item:', matchingItem);
          let matchingItemContent = matchingItem.content;
        
          if (message.page && matchingItem.type === 'text' && matchingItemContent.length > 0) {
            matchingItemContent = matchingItemContent.find(item => item.page === message.page).content;
            if (matchingItemContent) {
              console.log('Found matching page content:', matchingItemContent);
            }
            else{
              console.warn(`No item found in playlist with guid: ${message.guid} and page: ${message.page}`);
              matchingItemContent = '';
            }
          }

          // Broadcast the matching item to all connected clients
          const messageJson = JSON.stringify({
            type: matchingItem.type,
            content: matchingItemContent
          });
          let sentCount = 0;
          
          clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              try {
                client.send(messageJson);
                sentCount++;
              } catch (error) {
                console.error('Error sending message to client:', error);
                clients.delete(client);
              }
            }
          });
          
          if (sentCount > 0) {
            console.log(`Broadcasted item with guid ${message.guid} to ${sentCount} client(s)`);
          }
        } else {
          console.warn(`No item found in playlist with guid: ${message.guid}`);
        }
      }
      
      // Check if it's a "Clear" message
      if (message.type === 'Clear') {
        console.log('Received Clear message');
        
        // Broadcast a message with no content to all connected clients
        const clearMessage = {};
        const messageJson = JSON.stringify(clearMessage);
        let sentCount = 0;
        
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            try {
              client.send(messageJson);
              sentCount++;
            } catch (error) {
              console.error('Error sending message to client:', error);
              clients.delete(client);
            }
          }
        });
        
        if (sentCount > 0) {
          console.log(`Broadcasted Clear message to ${sentCount} client(s)`);
        }
      }
    } catch (error) {
      console.error('Error parsing incoming message:', error);
    }
  });
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  wss.close(() => {
    console.log('WebSocket server closed');
    process.exit(0);
  });
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

