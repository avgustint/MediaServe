const WebSocket = require('ws');

/**
 * Sets up WebSocket server and handles all WebSocket connections
 * @param {Object} server - HTTP server instance
 * @param {Array} library - Library items array
 * @returns {WebSocket.Server} WebSocket server instance
 */
function setupWebSocket(server, library) {
  // Create WebSocket server attached to HTTP server
  const wss = new WebSocket.Server({ server });

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
          
          // Find item in library with matching guid
          const matchingItem = library.find(item => item.guid === message.guid);
          
          if (matchingItem) {
            console.log('Found matching item:', matchingItem);
            let matchingItemContent = matchingItem.content;
          
            if (message.page && matchingItem.type === 'text' && matchingItemContent.length > 0) {
              matchingItemContent = matchingItemContent.find(item => item.page === message.page)?.content;
              if (matchingItemContent) {
                console.log('Found matching page content:', matchingItemContent);
              } else {
                console.warn(`No item found in library with guid: ${message.guid} and page: ${message.page}`);
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
            console.warn(`No item found in library with guid: ${message.guid}`);
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

  return wss;
}

module.exports = { setupWebSocket };

