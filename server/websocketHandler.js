const WebSocket = require('ws');
const { exec } = require('child_process');
const { loadLibrary } = require('./dataLoader');
const dbOps = require('./dbOperations');

/**
 * Sets up WebSocket server and handles all WebSocket connections
 * @param {Object} server - HTTP server instance
 * @param {Array} library - Library items array (initial load, will be reloaded on demand)
 * @returns {WebSocket.Server} WebSocket server instance
 */
function setupWebSocket(server, library) {
  // Create WebSocket server attached to HTTP server
  const wss = new WebSocket.Server({ server });

  // Store all connected clients
  const clients = new Set();
  // Track which clients are admin apps (send SelectLibraryItem/SelectPlaylist messages)
  const adminClients = new WeakSet();
  // Track locationId for each client
  const clientLocations = new Map();
  
  // Store current selection state per location
  const locationStates = new Map();
  
  // Store current content being displayed per location
  const locationContent = new Map();

  // Handle new client connections
  // Note: request is available to read query parameters (e.g., locationId)
  wss.on('connection', (ws, request) => {
    console.log('New client connected');
    clients.add(ws);
    
    // Try to read locationId from WebSocket URL query parameters so display clients
    // can register their location without sending Change/Clear messages.
    try {
      if (request && request.url) {
        const url = new URL(request.url, 'ws://localhost');
        const locationParam = url.searchParams.get('locationId') || url.searchParams.get('location');
        if (locationParam) {
          const locationIdFromUrl = parseInt(locationParam, 10);
          if (!isNaN(locationIdFromUrl)) {
            clientLocations.set(ws, locationIdFromUrl);
            console.log('Client registered locationId from URL:', locationIdFromUrl);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to parse WebSocket URL for locationId:', err);
    }
    
    // Note: Location ID will also be set/updated when client sends Change/Clear message with locationId
    
    // Note: Selection sync messages (SelectLibraryItem, SelectPlaylist) are only sent to admin clients
    // Admin clients are identified when they send such messages themselves

    // Handle client disconnection
    ws.on('close', () => {
      console.log('Client disconnected');
      clients.delete(ws);
      // Clean up location tracking
      const locationId = clientLocations.get(ws);
      if (locationId) {
        clientLocations.delete(ws);
      }
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
          const locationId = message.locationId ? parseInt(message.locationId, 10) : null;
          
          if (!locationId) {
            console.warn('Received Change message without locationId, ignoring');
            return;
          }
          
          // Store location for this client
          clientLocations.set(ws, locationId);
          
          console.log('Received Change message with guid:', message.guid, ', page:', message.page, ', locationId:', locationId);
          
          // Get library item using dbOps to ensure pages are loaded correctly
          const rawItem = dbOps.getLibraryItem(message.guid);
          const matchingItem = rawItem ? dbOps.formatLibraryItem(rawItem) : null;
          
          if (matchingItem) {
            console.log('Found matching item:', JSON.stringify(matchingItem, null, 2).substring(0, 500));
            let matchingItemContent = matchingItem.content;
            console.log('Initial content type:', typeof matchingItemContent, 'isArray:', Array.isArray(matchingItemContent));
          
            // Handle text items with pages
            if (matchingItem.type === 'text' && Array.isArray(matchingItemContent) && matchingItemContent.length > 0) {
              console.log('Content array length:', matchingItemContent.length, 'Requested page:', message.page);
              if (message.page !== undefined && message.page !== null) {
                // Find specific page - ensure both are numbers for comparison
                const requestedPage = typeof message.page === 'string' ? parseInt(message.page, 10) : message.page;
                const pageItem = matchingItemContent.find(item => {
                  const itemPage = typeof item.page === 'string' ? parseInt(item.page, 10) : item.page;
                  return itemPage === requestedPage;
                });
                console.log('Page item found:', pageItem ? 'yes' : 'no', pageItem);
                if (pageItem && pageItem.content !== undefined && pageItem.content !== null) {
                  matchingItemContent = pageItem.content;
                  console.log('Found matching page content for page:', requestedPage, 'Content length:', matchingItemContent.length);
                } else {
                  console.warn(`No page found in library with guid: ${message.guid} and page: ${requestedPage}. Available pages:`, matchingItemContent.map(p => p.page));
                  matchingItemContent = '';
                }
              } else {
                // No page specified, use first page's content
                matchingItemContent = matchingItemContent[0].content || '';
                console.log('No page specified, using first page content. Content length:', matchingItemContent.length);
              }
            } else if (matchingItem.type === 'text' && !Array.isArray(matchingItemContent)) {
              // Legacy format: content is a string, not an array
              matchingItemContent = matchingItemContent || '';
              console.log('Legacy format, using content as string. Content length:', matchingItemContent.length);
            } else {
              console.warn('Content extraction issue - type:', matchingItem.type, 'content type:', typeof matchingItemContent, 'isArray:', Array.isArray(matchingItemContent), 'length:', Array.isArray(matchingItemContent) ? matchingItemContent.length : 'N/A');
            }

            // Get colors from item or general settings
            let backgroundColor = matchingItem.background_color;
            let fontColor = matchingItem.font_color;
            
            // If colors not set on item, get from general settings
            if (!backgroundColor || !fontColor) {
              const settings = dbOps.getAllSettings();
              if (!backgroundColor) {
                backgroundColor = settings.defaultBackgroundColor || '#000000';
              }
              if (!fontColor) {
                fontColor = settings.defaultFontColor || '#FFFFFF';
              }
            }
            
            // Store current content for this location
            const locationContentData = {
              type: matchingItem.type,
              content: matchingItemContent,
              background_color: backgroundColor,
              font_color: fontColor
            };
            console.log('Final content data:', {
              type: locationContentData.type,
              contentLength: typeof locationContentData.content === 'string' ? locationContentData.content.length : 'not a string',
              contentPreview: typeof locationContentData.content === 'string' ? locationContentData.content.substring(0, 100) : locationContentData.content
            });
            locationContent.set(locationId, locationContentData);
            
            // Broadcast the matching item only to clients with matching locationId
            const messageJson = JSON.stringify(locationContentData);
            let sentCount = 0;
            
            // Always send to the sender first (admin app that requested the change)
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(messageJson);
                sentCount++;
              } catch (error) {
                console.error('Error sending message to sender:', error);
                clients.delete(ws);
                clientLocations.delete(ws);
              }
            }
            
            // Then broadcast to all other clients with matching locationId
            clients.forEach((client) => {
              // Skip the sender (already sent above)
              if (client === ws) {
                return;
              }
              
              const clientLocationId = clientLocations.get(client);
              if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
                try {
                  client.send(messageJson);
                  sentCount++;
                } catch (error) {
                  console.error('Error sending message to client:', error);
                  clients.delete(client);
                  clientLocations.delete(client);
                }
              }
            });
            
            if (sentCount > 0) {
              console.log(`Broadcasted item with guid ${message.guid} to ${sentCount} client(s) for location ${locationId}`);
            }
          } else {
            console.warn(`No item found in library with guid: ${message.guid}`);
          }
        }
        
        // Check if it's a "Clear" message
        if (message.type === 'Clear') {
          const locationId = message.locationId ? parseInt(message.locationId, 10) : null;
          
          if (!locationId) {
            console.warn('Received Clear message without locationId, ignoring');
            return;
          }
          
          // Store location for this client
          clientLocations.set(ws, locationId);
          
          console.log('Received Clear message for location:', locationId);
          
          // Clear current selection for this location
          const locationState = locationStates.get(locationId) || {};
          locationState.libraryItemGuid = null;
          locationState.libraryItemPage = null;
          locationStates.set(locationId, locationState);
          
          // Check if default blank page is set
          const settings = dbOps.getAllSettings();
          const defaultBlankPageGuid = settings.defaultBlankPage;
          
          if (defaultBlankPageGuid && defaultBlankPageGuid.trim() !== '') {
            // Load library and find the default blank page item
            const currentLibrary = loadLibrary();
            // Convert GUID to number for comparison (settings store as string, but item.guid is number)
            const defaultBlankPageGuidNum = parseInt(defaultBlankPageGuid, 10);
            const blankPageItem = currentLibrary.find(item => item.guid === defaultBlankPageGuidNum);
            
            if (blankPageItem) {
              console.log('Found default blank page item:', blankPageItem);
              
              // Format the item to ensure content is properly parsed
              const formattedItem = dbOps.formatLibraryItem(blankPageItem);
              let blankPageContent = formattedItem.content;
              
              // For text items, get the first page if it's an array
              if (formattedItem.type === 'text' && Array.isArray(blankPageContent) && blankPageContent.length > 0) {
                blankPageContent = blankPageContent[0].content || '';
              }
              
              // Get colors from item or general settings
              let backgroundColor = formattedItem.background_color;
              let fontColor = formattedItem.font_color;
              
              // If colors not set on item, get from general settings
              if (!backgroundColor) {
                backgroundColor = settings.defaultBackgroundColor || '#000000';
              }
              if (!fontColor) {
                fontColor = settings.defaultFontColor || '#FFFFFF';
              }
              
              // Store current content for this location
              const locationContentData = {
                type: formattedItem.type,
                content: blankPageContent,
                background_color: backgroundColor,
                font_color: fontColor
              };
              locationContent.set(locationId, locationContentData);
              
              // Broadcast the default blank page only to clients with matching locationId
              const messageJson = JSON.stringify(locationContentData);
              let sentCount = 0;
              
              clients.forEach((client) => {
                const clientLocationId = clientLocations.get(client);
                if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
                  try {
                    client.send(messageJson);
                    sentCount++;
                  } catch (error) {
                    console.error('Error sending message to client:', error);
                    clients.delete(client);
                    clientLocations.delete(client);
                  }
                }
              });
              
              if (sentCount > 0) {
                console.log(`Broadcasted default blank page (guid: ${defaultBlankPageGuid}) to ${sentCount} client(s) for location ${locationId}`);
              }
            } else {
              console.warn(`Default blank page item with guid ${defaultBlankPageGuid} not found in library`);
              // Fall through to send empty content
              locationContent.delete(locationId);
              
              // Broadcast a message with no content only to clients with matching locationId
              const clearMessage = {};
              const messageJson = JSON.stringify(clearMessage);
              let sentCount = 0;
              
              clients.forEach((client) => {
                const clientLocationId = clientLocations.get(client);
                if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
                  try {
                    client.send(messageJson);
                    sentCount++;
                  } catch (error) {
                    console.error('Error sending message to client:', error);
                    clients.delete(client);
                    clientLocations.delete(client);
                  }
                }
              });
              
              if (sentCount > 0) {
                console.log(`Broadcasted Clear message (empty content) to ${sentCount} client(s) for location ${locationId}`);
              }
            }
          } else {
            // No default blank page set, send empty content
            locationContent.delete(locationId);
            
            // Broadcast a message with no content only to clients with matching locationId
            const clearMessage = {};
            const messageJson = JSON.stringify(clearMessage);
            let sentCount = 0;
            
            clients.forEach((client) => {
              const clientLocationId = clientLocations.get(client);
              if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
                try {
                  client.send(messageJson);
                  sentCount++;
                } catch (error) {
                  console.error('Error sending message to client:', error);
                  clients.delete(client);
                  clientLocations.delete(client);
                }
              }
            });
            
            if (sentCount > 0) {
              console.log(`Broadcasted Clear message (empty content) to ${sentCount} client(s) for location ${locationId}`);
            }
          }
        }
        
        // Check if it's an "Action" message
        if (message.type === 'Action' && message.actionType) {
          console.log('Received Action message with type:', message.actionType);
          handleCecAction(message.actionType);
        }
        
        // Check if it's a "SelectPlaylist" message
        if (message.type === 'SelectPlaylist' && message.guid !== undefined) {
          console.log('Received SelectPlaylist message with guid:', message.guid);
          
          // Get locationId from message or client's stored locationId
          const locationId = message.locationId ? parseInt(message.locationId, 10) : clientLocations.get(ws);
          
          if (!locationId) {
            console.warn('Received SelectPlaylist message without locationId, ignoring');
            return;
          }
          
          // Store location for this client if not already set
          if (!clientLocations.has(ws)) {
            clientLocations.set(ws, locationId);
          }
          
          // Mark this client as an admin client
          const isNewAdmin = !adminClients.has(ws);
          adminClients.add(ws);
          
          // Get or create location state
          const locationState = locationStates.get(locationId) || {};
          
          // If this is a newly identified admin client, send current selection state for this location
          if (isNewAdmin) {
            if (locationState.currentPlaylistGuid !== null && locationState.currentPlaylistGuid !== undefined) {
              const playlistMessage = JSON.stringify({
                type: 'SelectPlaylist',
                guid: locationState.currentPlaylistGuid,
                locationId: locationId
              });
              try {
                ws.send(playlistMessage);
              } catch (error) {
                console.error('Error sending current playlist selection to new admin client:', error);
              }
            }
            if (locationState.currentLibraryItemGuid !== null && locationState.currentLibraryItemGuid !== undefined) {
              const itemMessage = JSON.stringify({
                type: 'SelectLibraryItem',
                guid: locationState.currentLibraryItemGuid,
                page: locationState.currentLibraryItemPage || undefined,
                locationId: locationId
              });
              try {
                ws.send(itemMessage);
              } catch (error) {
                console.error('Error sending current library item selection to new admin client:', error);
              }
            }
          }
          
          // Update location state
          locationState.currentPlaylistGuid = message.guid;
          locationStates.set(locationId, locationState);
          
          // Broadcast to all other admin clients with matching locationId
          const playlistMessage = JSON.stringify({
            type: 'SelectPlaylist',
            guid: message.guid,
            locationId: locationId
          });
          let sentCount = 0;
          
          clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN && adminClients.has(client)) {
              const clientLocationId = clientLocations.get(client);
              // Only send to clients with matching locationId
              if (clientLocationId === locationId) {
                try {
                  client.send(playlistMessage);
                  sentCount++;
                } catch (error) {
                  console.error('Error sending playlist selection to client:', error);
                  clients.delete(client);
                }
              }
            }
          });
          
          if (sentCount > 0) {
            console.log(`Broadcasted SelectPlaylist message to ${sentCount} admin client(s) for location ${locationId}`);
          }
        }
        
        // Check if it's a "SelectLibraryItem" message
        if (message.type === 'SelectLibraryItem' && message.guid !== undefined) {
          console.log('Received SelectLibraryItem message with guid:', message.guid, 'and page:', message.page);
          
          // Get locationId from message or client's stored locationId
          const locationId = message.locationId ? parseInt(message.locationId, 10) : clientLocations.get(ws);
          
          if (!locationId) {
            console.warn('Received SelectLibraryItem message without locationId, ignoring');
            return;
          }
          
          // Store location for this client if not already set
          if (!clientLocations.has(ws)) {
            clientLocations.set(ws, locationId);
          }
          
          // Mark this client as an admin client
          const isNewAdmin = !adminClients.has(ws);
          adminClients.add(ws);
          
          // Get or create location state
          const locationState = locationStates.get(locationId) || {};
          
          // If this is a newly identified admin client, send current selection state for this location
          if (isNewAdmin) {
            if (locationState.currentPlaylistGuid !== null && locationState.currentPlaylistGuid !== undefined) {
              const playlistMessage = JSON.stringify({
                type: 'SelectPlaylist',
                guid: locationState.currentPlaylistGuid,
                locationId: locationId
              });
              try {
                ws.send(playlistMessage);
              } catch (error) {
                console.error('Error sending current playlist selection to new admin client:', error);
              }
            }
            if (locationState.currentLibraryItemGuid !== null && locationState.currentLibraryItemGuid !== undefined && locationState.currentLibraryItemGuid !== message.guid) {
              const itemMessage = JSON.stringify({
                type: 'SelectLibraryItem',
                guid: locationState.currentLibraryItemGuid,
                page: locationState.currentLibraryItemPage || undefined,
                locationId: locationId
              });
              try {
                ws.send(itemMessage);
              } catch (error) {
                console.error('Error sending current library item selection to new admin client:', error);
              }
            }
          }
          
          // Update location state
          locationState.currentLibraryItemGuid = message.guid;
          locationState.currentLibraryItemPage = message.page || null;
          locationStates.set(locationId, locationState);
          
          // Broadcast to all other admin clients with matching locationId
          const itemMessage = JSON.stringify({
            type: 'SelectLibraryItem',
            guid: message.guid,
            page: message.page || undefined,
            locationId: locationId
          });
          let sentCount = 0;
          
          clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN && adminClients.has(client)) {
              const clientLocationId = clientLocations.get(client);
              // Only send to clients with matching locationId
              if (clientLocationId === locationId) {
                try {
                  client.send(itemMessage);
                  sentCount++;
                } catch (error) {
                  console.error('Error sending library item selection to client:', error);
                  clients.delete(client);
                }
              }
            }
          });
          
          if (sentCount > 0) {
            console.log(`Broadcasted SelectLibraryItem message to ${sentCount} admin client(s) for location ${locationId}`);
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

/**
 * Handle HDMI CEC actions by executing cec-client commands
 * @param {string} actionType - The type of action (powerOn, powerOff, volumeUp, volumeDown)
 */
function handleCecAction(actionType) {
  let cecCommand;
  
  switch (actionType) {
    case 'powerOn':
      // Send "Image View On" command to device 0 (TV)
      // Format: on <destination>
      cecCommand = 'echo "on 0" | cec-client -s -d 1';
      break;
    case 'powerOff':
      // Send "Standby" command to device 0 (TV)
      // Format: standby <destination>
      cecCommand = 'echo "standby 0" | cec-client -s -d 1';
      break;
    case 'volumeUp':
      // Send "Volume Up" command
      // Format: tx <source><destination> <opcode>
      // 4F = broadcast address, 44 = Volume Up opcode
      cecCommand = 'echo "tx 4F 44" | cec-client -s -d 1';
      break;
    case 'volumeDown':
      // Send "Volume Down" command
      // Format: tx <source><destination> <opcode>
      // 4F = broadcast address, 45 = Volume Down opcode
      cecCommand = 'echo "tx 4F 45" | cec-client -s -d 1';
      break;
    default:
      console.warn(`Unknown action type: ${actionType}`);
      return;
  }
  
  exec(cecCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing CEC command for ${actionType}:`, error);
      if (error.code === 'ENOENT') {
        console.error('cec-client not found. Please install libcec-utils package (e.g., sudo apt-get install cec-utils).');
      }
      return;
    }
    if (stderr && !stderr.includes('waiting for input')) {
      console.error(`CEC command stderr for ${actionType}:`, stderr);
    }
    if (stdout) {
      console.log(`CEC command output for ${actionType}:`, stdout);
    }
    console.log(`CEC command executed successfully for ${actionType}`);
  });
}

module.exports = { setupWebSocket };

