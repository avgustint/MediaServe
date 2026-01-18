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
  // Track client IP addresses for keyboard command filtering
  const clientIPs = new Map();
  
  // Store current selection state per location
  const locationStates = new Map();
  
  // Store current content being displayed per location
  const locationContent = new Map();

  // Helper to normalize IP addresses
  function normalizeIP(ip) {
    if (!ip) return 'unknown';
    // Handle IPv6 mapped IPv4 (::ffff:127.0.0.1 -> 127.0.0.1)
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }
    // Handle IPv6 localhost variants (::1 -> 127.0.0.1)
    if (ip === '::1') {
      return '127.0.0.1';
    }
    return ip;
  }

  // Helper to get server IP addresses
  function getServerIPs() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const serverIPs = ['127.0.0.1', '::1', 'localhost']; // Always include localhost
    
    // Add all network interface IPs
    Object.values(interfaces).forEach(iface => {
      iface.forEach(address => {
        if (address.family === 'IPv4' || address.family === 'IPv6') {
          const normalized = normalizeIP(address.address);
          if (!serverIPs.includes(normalized)) {
            serverIPs.push(normalized);
          }
        }
      });
    });
    
    return serverIPs;
  }

  // Helper to check if client IP matches server IP
  function isSameIP(clientIP, serverIPs) {
    const normalizedClientIP = normalizeIP(clientIP);
    return serverIPs.some(serverIP => normalizeIP(serverIP) === normalizedClientIP);
  }

  // Handle new client connections
  // Note: request is available to read query parameters (e.g., locationId)
  wss.on('connection', (ws, request) => {
    console.log('New client connected');
    clients.add(ws);
    
    // Track client IP address
    const clientIP = request.socket.remoteAddress || 
                     request.connection.remoteAddress ||
                     request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                     'unknown';
    const normalizedClientIP = normalizeIP(clientIP);
    clientIPs.set(ws, normalizedClientIP);
    console.log('Client IP:', normalizedClientIP);
    
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
      // Clean up IP tracking
      clientIPs.delete(ws);
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
            let chordFontColor = null;
            
            // If colors not set on item, get from general settings
            if (!backgroundColor || !fontColor) {
              const settings = dbOps.getAllSettings();
              if (!backgroundColor) {
                backgroundColor = settings.defaultBackgroundColor || '#000000';
              }
              if (!fontColor) {
                fontColor = settings.defaultFontColor || '#FFFFFF';
              }
              // Always get chord font color from settings
              chordFontColor = settings.defaultChordFontColor || '#FFD700';
            } else {
              // Even if item has colors, get chord font color from settings
              const settings = dbOps.getAllSettings();
              chordFontColor = settings.defaultChordFontColor || '#FFD700';
            }
            
            // Remove chords from content if chordsVisible is false
            // Default to false if not specified (chords hidden by default)
            let finalContent = matchingItemContent;
            if (matchingItem.type === 'text' && typeof matchingItemContent === 'string') {
              const chordsVisible = message.chordsVisible !== undefined ? message.chordsVisible : false;
              if (!chordsVisible) {
                // Remove all <chord> tags and their content
                finalContent = matchingItemContent.replace(/<chord\b[^>]*>.*?<\/chord>/gi, '');
              }
            }
            
            // Store current content for this location
            // Only include chordsVisible if explicitly set, otherwise default to false
            const locationContentData = {
              type: matchingItem.type,
              content: finalContent,
              background_color: backgroundColor,
              font_color: fontColor,
              chord_font_color: chordFontColor,
              css: matchingItem.css || undefined,
              chordsVisible: message.chordsVisible !== undefined ? message.chordsVisible : false,
              chordTransposition: message.chordTransposition !== undefined ? message.chordTransposition : 0
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
            // Get the default blank page item using dbOps to ensure pages are loaded correctly
            const defaultBlankPageGuidNum = parseInt(defaultBlankPageGuid, 10);
            const rawBlankPageItem = dbOps.getLibraryItem(defaultBlankPageGuidNum);
            const formattedItem = rawBlankPageItem ? dbOps.formatLibraryItem(rawBlankPageItem) : null;
            
            if (formattedItem) {
              console.log('Found default blank page item:', formattedItem);
              let blankPageContent = formattedItem.content;
              
              // For text items, get the first page if it's an array
              if (formattedItem.type === 'text' && Array.isArray(blankPageContent) && blankPageContent.length > 0) {
                blankPageContent = blankPageContent[0].content || '';
              }
              
              // Get colors from item or general settings
              let backgroundColor = formattedItem.background_color;
              let fontColor = formattedItem.font_color;
              let chordFontColor = settings.defaultChordFontColor || '#FFD700';
              
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
                font_color: fontColor,
                chord_font_color: chordFontColor,
                css: formattedItem.css || undefined
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
        
        // Check if it's an "AdminClient" initialization message
        if (message.type === 'AdminClient') {
          // Mark client as admin if not already marked
          if (!adminClients.has(ws)) {
            adminClients.add(ws);
            console.log('Admin client registered');
          }
          
          // Store locationId if provided
          if (message.locationId) {
            const locationId = parseInt(message.locationId, 10);
            if (!isNaN(locationId)) {
              clientLocations.set(ws, locationId);
            }
          }
          return; // No further processing needed for AdminClient message
        }
        
        // Check if it's an "Action" message
        if (message.type === 'Action' && message.actionType) {
          // Mark client as admin if not already marked
          if (!adminClients.has(ws)) {
            adminClients.add(ws);
          }
          console.log('Received Action message with type:', message.actionType);
          const sourceName = message.sourceName || null;
          handleCecAction(message.actionType, ws, sourceName);
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
        
        // Check if it's a "UrlPlayPause" message
        if (message.type === 'UrlPlayPause' && message.play !== undefined) {
          const locationId = message.locationId ? parseInt(message.locationId, 10) : null;
          
          if (!locationId) {
            console.warn('Received UrlPlayPause message without locationId, ignoring');
            return;
          }
          
          // Store location for this client
          clientLocations.set(ws, locationId);
          
          console.log('Received UrlPlayPause message for location:', locationId, 'play:', message.play);
          
          // Broadcast to all clients (both admin and regular clients) with matching locationId
          const playPauseMessage = JSON.stringify({
            type: 'UrlPlayPause',
            play: message.play,
            locationId: locationId
          });
          
          let sentCount = 0;
          
          // Broadcast to all clients with matching locationId (including sender for sync across admin instances)
          clients.forEach((client) => {
            const clientLocationId = clientLocations.get(client);
            if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
              try {
                client.send(playPauseMessage);
                sentCount++;
              } catch (error) {
                console.error('Error sending UrlPlayPause message to client:', error);
                clients.delete(client);
                clientLocations.delete(client);
              }
            }
          });
          
          if (sentCount > 0) {
            console.log(`Broadcasted UrlPlayPause message to ${sentCount} client(s) for location ${locationId}`);
          }
        }
        
        // Check if it's a direct content update message (with chordsVisible or chordTransposition properties)
        // This allows clients to send modified content with chord adjustments
        if ((message.type === 'text' || message.type === 'image' || message.type === 'url') && 
            (message.chordsVisible !== undefined || message.chordTransposition !== undefined) && 
            message.content !== undefined) {
          const locationId = message.locationId ? parseInt(message.locationId, 10) : null;
          
          if (!locationId) {
            console.warn('Received content update message without locationId, ignoring');
            return;
          }
          
          // Store location for this client
          clientLocations.set(ws, locationId);
          
          console.log('Received content update message for location:', locationId, 'chordsVisible:', message.chordsVisible, 'chordTransposition:', message.chordTransposition);
          
          // Get chord font color from settings if not provided
          let chordFontColor = message.chord_font_color;
          if (!chordFontColor) {
            const settings = dbOps.getAllSettings();
            chordFontColor = settings.defaultChordFontColor || '#FFD700';
          }
          
          // Remove chords from content if chordsVisible is false
          // Default to false if not specified (chords hidden by default)
          let finalContent = message.content;
          if (message.type === 'text' && typeof message.content === 'string') {
            const chordsVisible = message.chordsVisible !== undefined ? message.chordsVisible : false;
            if (!chordsVisible) {
              // Remove all <chord> tags and their content
              finalContent = message.content.replace(/<chord\b[^>]*>.*?<\/chord>/gi, '');
            }
          }
          
          // Update stored content for this location
          // Only include chordsVisible if explicitly set, otherwise default to false
          const locationContentData = {
            type: message.type,
            content: finalContent,
            background_color: message.background_color,
            font_color: message.font_color,
            chord_font_color: chordFontColor,
            css: message.css || undefined,
            chordsVisible: message.chordsVisible !== undefined ? message.chordsVisible : false,
            chordTransposition: message.chordTransposition !== undefined ? message.chordTransposition : 0
          };
          locationContent.set(locationId, locationContentData);
          
          // Broadcast the updated content to all clients with matching locationId
          // EXCLUDE the sender (admin app) to prevent rebroadcast loops
          const messageJson = JSON.stringify(locationContentData);
          let sentCount = 0;
          
          clients.forEach((client) => {
            // Skip the sender (admin app that sent the update)
            if (client === ws) {
              return;
            }
            
            const clientLocationId = clientLocations.get(client);
            if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
              try {
                client.send(messageJson);
                sentCount++;
              } catch (error) {
                console.error('Error sending content update message to client:', error);
                clients.delete(client);
                clientLocations.delete(client);
              }
            }
          });
          
          if (sentCount > 0) {
            console.log(`Broadcasted content update message to ${sentCount} client(s) for location ${locationId}`);
          }
        }
      } catch (error) {
        console.error('Error parsing incoming message:', error);
      }
    });
  });

  /**
   * Send action feedback to admin clients
   * @param {WebSocket} ws - WebSocket connection of the sender
   * @param {string} actionType - The action type
   * @param {string} status - Status: 'processing', 'success', 'error'
   * @param {string} message - Optional status message
   */
  function sendActionFeedback(ws, actionType, status, message = '') {
    const feedback = {
      type: 'ActionResponse',
      actionType: actionType,
      status: status,
      message: message,
      timestamp: new Date().toISOString()
    };
    
    // Send feedback to all admin clients (including the sender)
    // WeakSet doesn't have forEach, so iterate over all clients and check if they're admin
    clients.forEach((client) => {
      if (adminClients.has(client) && client.readyState === WebSocket.OPEN) {
        try {
          client.send(JSON.stringify(feedback));
        } catch (error) {
          console.error('Error sending action feedback:', error);
        }
      }
    });
  }

  /**
   * Handle HDMI CEC actions by executing cec-client commands
   * @param {string} actionType - The type of action (powerOn, powerOff, volumeUp, volumeDown, selectSource)
   * @param {WebSocket} ws - WebSocket connection of the sender
   * @param {string} sourceName - Optional source name or device number for source selection
   */
  function handleCecAction(actionType, ws, sourceName = null) {
  let cecCommands = [];
  
  // Send processing feedback
  sendActionFeedback(ws, actionType, 'processing', 'Executing command...');
  
  switch (actionType) {
    case 'powerOn':
      // Send "Image View On" command to device 0 (TV)
      // Then send "Active Source" command to switch to this input
      cecCommands = [
        'echo "on 0" | cec-client -s -d 1',
        'echo "as" | cec-client -s -d 1'
      ];
      break;
    case 'powerOff':
      // Send "Standby" command to device 0 (TV)
      cecCommands = ['echo "standby 0" | cec-client -s -d 1'];
      break;
    case 'volumeUp':
      // Send "User Control Pressed" with Volume Up opcode (0x41)
      // Format: tx <source><destination> <opcode>
      // Source: device 1 (0x1), Destination: device 0/TV (0x0) = 0x10
      // Opcode: 0x41 (Volume Up)
      cecCommands = ['echo "tx 10 41" | cec-client -s -d 1'];
      break;
    case 'volumeDown':
      // Send "User Control Pressed" with Volume Down opcode (0x42)
      // Format: tx <source><destination> <opcode>
      // Source: device 1 (0x1), Destination: device 0/TV (0x0) = 0x10
      // Opcode: 0x42 (Volume Down)
      cecCommands = ['echo "tx 10 42" | cec-client -s -d 1'];
      break;
    case 'selectSource':
      // Select source by device number or name
      // If sourceName is a number, use it directly; otherwise try to find it
      if (sourceName) {
        // Try to parse as device number (0-15)
        const deviceNum = parseInt(sourceName, 10);
        if (!isNaN(deviceNum) && deviceNum >= 0 && deviceNum <= 15) {
          // Select specific device as active source
          cecCommands = [`echo "as ${deviceNum}" | cec-client -s -d 1`];
        } else {
          // Try to use source name (common names: HDMI1, HDMI2, HDMI3, HDMI4, etc.)
          // Extract number from names like "HDMI1" -> device 1
          const match = sourceName.match(/(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num >= 1 && num <= 4) {
              // HDMI inputs are typically devices 1-4
              cecCommands = [`echo "as ${num}" | cec-client -s -d 1`];
            } else {
              sendActionFeedback(ws, actionType, 'error', `Invalid source: ${sourceName}`);
              return;
            }
          } else {
            // Default to device 1 if name not recognized
            cecCommands = ['echo "as 1" | cec-client -s -d 1'];
          }
        }
      } else {
        // Default: set this device (device 1) as active source
        cecCommands = ['echo "as" | cec-client -s -d 1'];
      }
      break;
    default:
      console.warn(`Unknown action type: ${actionType}`);
      sendActionFeedback(ws, actionType, 'error', `Unknown action type: ${actionType}`);
      return;
  }
  
  // Execute commands sequentially
  let commandIndex = 0;
  const executeNextCommand = () => {
    if (commandIndex >= cecCommands.length) {
      return;
    }
    
    const cecCommand = cecCommands[commandIndex];
    commandIndex++;
    
    exec(cecCommand, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing CEC command ${commandIndex}/${cecCommands.length} for ${actionType}:`, error);
          let errorMessage = `Command failed: ${error.message || 'Unknown error'}`;
          
          // Error code 127 means "command not found" on Unix systems
          if (error.code === 127 || error.code === 'ENOENT') {
            errorMessage = 'cec-client not found. Please install cec-utils package.';
            console.error('cec-client not found. Please install cec-utils package:');
            console.error('  On Debian/Ubuntu: sudo apt-get install cec-utils');
            console.error('  On macOS: brew install libcec');
            console.error('  On Fedora/RHEL: sudo dnf install cec-utils');
            console.error('Note: CEC functionality requires HDMI-CEC capable hardware and will be disabled until cec-client is installed.');
          } else {
            errorMessage = `CEC command failed with code ${error.code}`;
            console.error(`CEC command failed with code ${error.code}. Check if cec-client is properly configured and has access to HDMI-CEC device.`);
          }
          
          // Send error feedback if this is the last command or if we should stop
          if (commandIndex >= cecCommands.length) {
            sendActionFeedback(ws, actionType, 'error', errorMessage);
          }
          
          // Continue with next command even if this one failed (for powerOn with multiple commands)
          if (commandIndex < cecCommands.length) {
            setTimeout(executeNextCommand, 100); // Small delay between commands
          }
          return;
        }
        
        // Check for CEC errors in stderr
        let hasError = false;
        if (stderr && !stderr.includes('waiting for input') && !stderr.includes('opening a connection')) {
          // Check for CEC_TRANSMIT errors
          if (stderr.includes('CEC_TRANSMIT failed') || stderr.includes('ERROR')) {
            hasError = true;
            const errorMatch = stderr.match(/ERROR:\s*(.+)/);
            const errorMsg = errorMatch ? errorMatch[1].trim() : 'CEC command failed';
            console.error(`CEC command stderr for ${actionType} (command ${commandIndex}/${cecCommands.length}):`, stderr);
            
            // Send error feedback if this is the last command
            if (commandIndex >= cecCommands.length) {
              sendActionFeedback(ws, actionType, 'error', errorMsg);
            }
          } else {
            console.error(`CEC command stderr for ${actionType} (command ${commandIndex}/${cecCommands.length}):`, stderr);
          }
        }
        
        if (stdout && !stdout.includes('opening a connection')) {
          console.log(`CEC command output for ${actionType} (command ${commandIndex}/${cecCommands.length}):`, stdout);
        }
        
        // Execute next command if there are more
        if (commandIndex < cecCommands.length) {
          setTimeout(executeNextCommand, 100); // Small delay between commands
        } else {
          // All commands completed
          if (!hasError) {
            console.log(`All CEC commands executed successfully for ${actionType}`);
            const successMessage = sourceName ? `Successfully executed ${actionType}${sourceName ? ` for ${sourceName}` : ''}` : `Successfully executed ${actionType}`;
            sendActionFeedback(ws, actionType, 'success', successMessage);
          }
        }
      });
    };
    
    // Start executing commands
    executeNextCommand();
  }

  // Initialize keyboard routes with WebSocket references
  // This allows keyboard routes to access client IPs and send commands
  try {
    const { initializeKeyboardRoutes } = require('./routes/keyboard');
    initializeKeyboardRoutes(wss, getServerIPs, isSameIP, clients, adminClients, clientIPs);
  } catch (error) {
    console.warn('Failed to initialize keyboard routes:', error.message);
  }

  // Handle server shutdown gracefully
  // Only register handler once to prevent multiple shutdown messages
  if (!process.listenerCount || process.listenerCount('SIGINT') === 0) {
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
  }

  return wss;
}

module.exports = { setupWebSocket };

