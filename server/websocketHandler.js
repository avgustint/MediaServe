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

  // Deduplicate Change messages to prevent multi-admin loops (same guid+page+location within window)
  const lastChangeByLocation = new Map();
  const CHANGE_DEDUPE_MS = 500;

  // In-memory contentVisible cache — always starts true on server start so a stale DB value
  // from a previous session never silently hides content on a fresh restart.
  // Updated only when SetDisplayVisible is explicitly received.
  const contentVisibleCache = new Map();
  function getContentVisible(locationId) {
    if (contentVisibleCache.has(locationId)) {
      return contentVisibleCache.get(locationId);
    }
    return true; // default: visible (fresh server start)
  }
  function setContentVisible(locationId, visible) {
    contentVisibleCache.set(locationId, visible);
    dbOps.setLocationContentVisible(locationId, visible);
  }

  // Autoplay state per location: { guid, page, duration, endAt, timer, hideDelayTimer, playlistPages }
  const autoplayState = new Map();
  // Hide delay phase: { timer } - allows cancelling when user changes page/item
  const hideDelayByLocation = new Map();

  function broadcastToLocation(locationId, msg) {
    const msgJson = JSON.stringify(msg);
    clients.forEach((client) => {
      const clientLocationId = clientLocations.get(client);
      if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
        try {
          client.send(msgJson);
        } catch (e) {
          clients.delete(client);
          clientLocations.delete(client);
        }
      }
    });
  }

  function stopAutoplayForLocation(locationId) {
    const state = autoplayState.get(locationId);
    if (state) {
      if (state.timer) clearTimeout(state.timer);
      if (state.hideDelayTimer) clearTimeout(state.hideDelayTimer);
      autoplayState.delete(locationId);
    }
    const hideDelay = hideDelayByLocation.get(locationId);
    if (hideDelay) {
      if (hideDelay.timer) clearTimeout(hideDelay.timer);
      hideDelayByLocation.delete(locationId);
    }
    broadcastToLocation(locationId, { type: 'AutoplayStopped', locationId });
    console.log(`Autoplay stopped for location ${locationId}`);
  }

  function startAutoplayForLocation(locationId, playlistPagesFromClient) {
    const locationState = locationStates.get(locationId) || {};
    const guid = locationState.currentLibraryItemGuid ?? dbOps.getLocationLastItem(locationId)?.guid;
    const page = locationState.currentLibraryItemPage ?? dbOps.getLocationLastItem(locationId)?.page ?? 1;
    if (!guid) return;

    const rawItem = dbOps.getLibraryItem(guid);
    const matchingItem = rawItem ? dbOps.formatLibraryItem(rawItem) : null;
    if (!matchingItem || !Array.isArray(matchingItem.content)) return;

    const pageNum = typeof page === 'string' ? parseInt(page, 10) : (page ?? 1);
    const pageItem = matchingItem.content.find(p => (typeof p.page === 'string' ? parseInt(p.page, 10) : p.page) === pageNum);
    const duration = pageItem?.duration ?? matchingItem.duration ?? null;
    if (duration == null || duration <= 0) return;

    let orderedPages = [];
    // Prefer playlistPages from client (admin sends when item from playlist with specific pages)
    if (playlistPagesFromClient && Array.isArray(playlistPagesFromClient) && playlistPagesFromClient.length > 0) {
      orderedPages = playlistPagesFromClient.map(p => typeof p === 'string' ? parseInt(p, 10) : p).filter(n => !isNaN(n));
    }
    if (orderedPages.length === 0) {
      const playlistGuid = locationState.currentPlaylistGuid;
      if (playlistGuid) {
        const playlistItems = dbOps.getPlaylistItems(playlistGuid);
        const currentItem = playlistItems?.find(pi => pi.guid === guid);
        if (currentItem?.pages && Array.isArray(currentItem.pages) && currentItem.pages.length > 0) {
          orderedPages = currentItem.pages;
        }
      }
    }
    if (orderedPages.length === 0) {
      orderedPages = matchingItem.content.map((p, i) => typeof p.page === 'string' ? parseInt(p.page, 10) : (p.page ?? i + 1));
    }

    stopAutoplayForLocation(locationId);
    const endAt = Date.now() + duration * 1000;
    const state = { guid, page: pageNum, duration, endAt, playlistPages: orderedPages };
    autoplayState.set(locationId, state);

    broadcastToLocation(locationId, {
      type: 'AutoplayStarted',
      locationId,
      endAt,
      totalSeconds: duration,
      page: pageNum,
      guid
    });

    function scheduleNextTick(locId) {
      const s = autoplayState.get(locId);
      if (!s || s.timer) return;
      const delay = Math.max(0, s.endAt - Date.now());
      s.timer = setTimeout(() => {
        s.timer = null;
        if (!autoplayState.has(locId)) return;
        advanceAutoplayOrHide(locId, s.guid, s.page, s.playlistPages);
      }, delay);
    }

    function advanceAutoplayOrHide(locId, curGuid, curPage, orderedPages) {
      const locState = locationStates.get(locId) || {};
      const rawItem = dbOps.getLibraryItem(curGuid);
      const fmt2 = rawItem ? dbOps.formatLibraryItem(rawItem) : null;
      if (!fmt2) {
        stopAutoplayForLocation(locId);
        return;
      }
      const idx = orderedPages.indexOf(curPage);
      const nextPage = idx >= 0 && idx < orderedPages.length - 1 ? orderedPages[idx + 1] : null;

      if (nextPage != null) {
        const nextPageItem = fmt2.content.find(p => (typeof p.page === 'string' ? parseInt(p.page, 10) : p.page) === nextPage);
        const nextDuration = nextPageItem?.duration ?? fmt2.duration ?? null;
        if (nextDuration != null && nextDuration > 0) {
          locState.currentLibraryItemGuid = curGuid;
          locState.currentLibraryItemPage = nextPage;
          locationStates.set(locId, locState);
          dbOps.setLocationLastItem(locId, curGuid, nextPage);

          const nextContent = fmt2.content.find(p => (typeof p.page === 'string' ? parseInt(p.page, 10) : p.page) === nextPage);
          const pageType = nextContent?.type || fmt2.type || 'text';
          let content = nextContent?.content ?? '';
          const pageCss = nextContent?.css;
          let mergedCss = fmt2.css || undefined;
          if (pageCss && typeof pageCss === 'object' && Object.keys(pageCss).length > 0) {
            mergedCss = { ...(mergedCss || {}), ...pageCss };
          }
          const settings = dbOps.getAllSettings();
          const chordVisibility = locState.chordVisibility || 'everywhere';
          const clientsShowChords = chordsVisibleForClients(chordVisibility);
          if (pageType === 'text' && typeof content === 'string' && !clientsShowChords) {
            content = content.replace(/<chord\b[^>]*>.*?<\/chord>/gi, '');
          }
          const locationContentData = {
            type: pageType,
            content,
            guid: curGuid,
            page: nextPage,
            duration: nextDuration,
            background_color: fmt2.background_color || settings.defaultBackgroundColor || '#000000',
            font_color: fmt2.font_color || settings.defaultFontColor || '#FFFFFF',
            chord_font_color: settings.defaultChordFontColor || '#FFD700',
            css: mergedCss,
            chordVisibility,
            chordsVisible: clientsShowChords,
            chordTransposition: locState.chordTransposition ?? 0,
            contentVisible: getContentVisible(locId)
          };
          locationContent.set(locId, locationContentData);
          broadcastToLocation(locId, locationContentData);

          const nextEndAt = Date.now() + nextDuration * 1000;
          const nextState = { guid: curGuid, page: nextPage, duration: nextDuration, endAt: nextEndAt, playlistPages: orderedPages };
          autoplayState.set(locId, nextState);
          broadcastToLocation(locId, {
            type: 'AutoplayStarted',
            locationId: locId,
            endAt: nextEndAt,
            totalSeconds: nextDuration,
            page: nextPage,
            guid: curGuid
          });
          scheduleNextTick(locId);
          return;
        }
      }

      autoplayState.delete(locId);
      const hideDelay = parseInt(dbOps.getAllSettings().autoplayHideDelaySeconds || '5', 10) || 5;
      const hideDelayEndAt = Date.now() + hideDelay * 1000;
      broadcastToLocation(locId, {
        type: 'AutoplayHideDelayStarted',
        locationId: locId,
        endAt: hideDelayEndAt,
        totalSeconds: hideDelay
      });
      const hideDelayTimer = setTimeout(() => {
        hideDelayByLocation.delete(locId);
        setContentVisible(locId, false);
        broadcastToLocation(locId, { type: 'AutoplayStopped', locationId: locId });
        const settings = dbOps.getAllSettings();
        const defaultBlankPageGuid = settings.defaultBlankPage;
        if (defaultBlankPageGuid && defaultBlankPageGuid.trim() !== '') {
          const defaultBlankPageGuidNum = parseInt(defaultBlankPageGuid, 10);
          const rawBlankPageItem = dbOps.getLibraryItem(defaultBlankPageGuidNum);
          const formattedItem = rawBlankPageItem ? dbOps.formatLibraryItem(rawBlankPageItem) : null;
          if (formattedItem) {
            let blankPageContent = '';
            let blankPageCss = undefined;
            const blankPageArray = formattedItem.content;
            const blankPageType = formattedItem.type || 'text';
            if (Array.isArray(blankPageArray) && blankPageArray.length > 0) {
              blankPageContent = blankPageArray[0].content || '';
              blankPageCss = blankPageArray[0].css;
            } else if (typeof blankPageArray === 'string') {
              blankPageContent = blankPageArray;
            }
            let mergedBlankCss = formattedItem.css || undefined;
            if (blankPageCss && typeof blankPageCss === 'object' && Object.keys(blankPageCss).length > 0) {
              mergedBlankCss = { ...(mergedBlankCss || {}), ...blankPageCss };
            }
            const locContentData = {
              type: blankPageType,
              content: blankPageContent,
              guid: defaultBlankPageGuidNum,
              page: 1,
              background_color: formattedItem.background_color || settings.defaultBackgroundColor || '#000000',
              font_color: formattedItem.font_color || settings.defaultFontColor || '#FFFFFF',
              chord_font_color: settings.defaultChordFontColor || '#FFD700',
              css: mergedBlankCss,
              contentVisible: false,
              isBlankPage: true
            };
            locationContent.set(locId, locContentData);
            broadcastToLocation(locId, locContentData);
          }
        } else {
          const minimalBlank = buildMinimalBlankContent(locId);
          locationContent.set(locId, minimalBlank);
          broadcastToLocation(locId, minimalBlank);
        }
      }, hideDelay * 1000);
      hideDelayByLocation.set(locId, { timer: hideDelayTimer });
    }

    scheduleNextTick(locationId);
  }

  /** Resolve chordVisibility from message. Supports chordVisibility (3-state) or legacy chordsVisible (boolean). */
  function resolveChordVisibility(msg) {
    if (msg.chordVisibility === 'everywhere' || msg.chordVisibility === 'local' || msg.chordVisibility === 'hidden') {
      return msg.chordVisibility;
    }
    return msg.chordsVisible === true ? 'everywhere' : 'local';
  }

  /** chordsVisible for clients: true only when everywhere */
  function chordsVisibleForClients(chordVisibility) {
    return chordVisibility === 'everywhere';
  }

  /** Build minimal blank content when no default blank page is configured. Display clients need
   *  a proper content message (with type) to clear the screen; {} or { contentVisible: false } are ignored. */
  function buildMinimalBlankContent(locationId) {
    const settings = dbOps.getAllSettings();
    const savedChordState = dbOps.getLocationChordState(locationId);
    return {
      type: 'text',
      content: '',
      guid: 0,
      page: 1,
      background_color: settings.defaultBackgroundColor || '#000000',
      font_color: settings.defaultFontColor || '#FFFFFF',
      chord_font_color: settings.defaultChordFontColor || '#FFD700',
      chordVisibility: savedChordState?.chordVisibility || 'everywhere',
      chordsVisible: chordsVisibleForClients(savedChordState?.chordVisibility || 'everywhere'),
      chordTransposition: savedChordState?.chordTransposition ?? 0,
      contentVisible: false,
      isBlankPage: true
    };
  }

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
            // Send content to new connection - respect contentVisible from DB on cold start
            let contentToSend = locationContent.get(locationIdFromUrl);
            if (!contentToSend) {
              const contentVisible = getContentVisible(locationIdFromUrl);
              if (!contentVisible) {
                const settings = dbOps.getAllSettings();
                const defaultBlankPageGuid = settings.defaultBlankPage;
                if (defaultBlankPageGuid && defaultBlankPageGuid.trim() !== '') {
                  const defaultBlankPageGuidNum = parseInt(defaultBlankPageGuid, 10);
                  const rawBlankPageItem = dbOps.getLibraryItem(defaultBlankPageGuidNum);
                  const formattedItem = rawBlankPageItem ? dbOps.formatLibraryItem(rawBlankPageItem) : null;
                  if (formattedItem) {
                    let blankPageContent = '';
                    let blankPageCss = undefined;
                    const blankPageArray = formattedItem.content;
                    const blankPageType = formattedItem.type || 'text';
                    if (Array.isArray(blankPageArray) && blankPageArray.length > 0) {
                      blankPageContent = blankPageArray[0].content || '';
                      blankPageCss = blankPageArray[0].css;
                    } else if (typeof blankPageArray === 'string') {
                      blankPageContent = blankPageArray;
                    }
                    let mergedBlankCss = formattedItem.css || undefined;
                    if (blankPageCss && typeof blankPageCss === 'object' && Object.keys(blankPageCss).length > 0) {
                      mergedBlankCss = { ...(mergedBlankCss || {}), ...blankPageCss };
                    }
                    const settings2 = dbOps.getAllSettings();
                    const savedChordState0 = dbOps.getLocationChordState(locationIdFromUrl);
                    contentToSend = {
                      type: blankPageType,
                      content: blankPageContent,
                      guid: defaultBlankPageGuidNum,
                      page: 1,
                      background_color: formattedItem.background_color || settings2.defaultBackgroundColor || '#000000',
                      font_color: formattedItem.font_color || settings2.defaultFontColor || '#FFFFFF',
                      chord_font_color: settings2.defaultChordFontColor || '#FFD700',
                      css: mergedBlankCss,
                      chordVisibility: savedChordState0.chordVisibility,
                      chordsVisible: chordsVisibleForClients(savedChordState0.chordVisibility),
                      chordTransposition: savedChordState0.chordTransposition,
                      isBlankPage: true
                    };
                    locationContent.set(locationIdFromUrl, contentToSend);
                  }
                }
              } else {
                const lastItem = dbOps.getLocationLastItem(locationIdFromUrl);
                if (lastItem) {
                  const rawItem = dbOps.getLibraryItem(lastItem.guid);
                  const matchingItem = rawItem ? dbOps.formatLibraryItem(rawItem) : null;
                  if (matchingItem) {
                    let matchingItemContent = matchingItem.content;
                    let pageType = matchingItem.type;
                    let pageCssCold = undefined;
                    const requestedPageNum = lastItem.page ?? 1;
                    if (Array.isArray(matchingItemContent) && matchingItemContent.length > 0) {
                      const pageItem = matchingItemContent.find(item => {
                        const itemPage = typeof item.page === 'string' ? parseInt(item.page, 10) : item.page;
                        return itemPage === requestedPageNum;
                      });
                      if (pageItem) {
                        pageType = pageItem.type || 'text';
                        matchingItemContent = pageItem.content !== undefined && pageItem.content !== null ? pageItem.content : '';
                        pageCssCold = pageItem.css;
                      } else {
                        pageType = matchingItemContent[0]?.type || 'text';
                        matchingItemContent = matchingItemContent[0]?.content || '';
                      }
                    } else if (typeof matchingItemContent === 'string') {
                      matchingItemContent = matchingItemContent || '';
                    } else {
                      matchingItemContent = '';
                    }
                    let mergedCssCold = matchingItem.css || undefined;
                    if (pageCssCold && typeof pageCssCold === 'object' && Object.keys(pageCssCold).length > 0) {
                      mergedCssCold = { ...(mergedCssCold || {}), ...pageCssCold };
                    }
                    const settings2 = dbOps.getAllSettings();
                    const savedChordState = dbOps.getLocationChordState(locationIdFromUrl);
                    const coldChordVisibility = savedChordState.chordVisibility;
                    const coldClientsShowChords = chordsVisibleForClients(coldChordVisibility);
                    // Strip chords for clients if needed
                    let coldContent = matchingItemContent;
                    if (pageType === 'text' && typeof matchingItemContent === 'string' && !coldClientsShowChords) {
                      coldContent = matchingItemContent.replace(/<chord\b[^>]*>.*?<\/chord>/gi, '');
                    }
                    contentToSend = {
                      type: pageType,
                      content: coldContent,
                      guid: lastItem.guid,
                      page: requestedPageNum,
                      background_color: matchingItem.background_color || settings2.defaultBackgroundColor || '#000000',
                      font_color: matchingItem.font_color || settings2.defaultFontColor || '#FFFFFF',
                      chord_font_color: settings2.defaultChordFontColor || '#FFD700',
                      css: mergedCssCold,
                      chordVisibility: coldChordVisibility,
                      chordsVisible: coldClientsShowChords,
                      chordTransposition: savedChordState.chordTransposition
                    };
                    locationContent.set(locationIdFromUrl, contentToSend);
                    const locState = locationStates.get(locationIdFromUrl) || {};
                    locState.currentLibraryItemGuid = lastItem.guid;
                    locState.currentLibraryItemPage = requestedPageNum;
                    locState.chordVisibility = coldChordVisibility;
                    locState.chordTransposition = savedChordState.chordTransposition;
                    locationStates.set(locationIdFromUrl, locState);
                  }
                }
              }
            }
            if (contentToSend && ws.readyState === WebSocket.OPEN) {
              const contentVisible = getContentVisible(locationIdFromUrl);
              const contentMessage = { ...contentToSend, locationId: locationIdFromUrl, contentVisible };
              try {
                ws.send(JSON.stringify(contentMessage));
                console.log(`Sent content to new client for location ${locationIdFromUrl}`);
              } catch (err) {
                console.error('Error sending initial content to new client:', err);
              }
            }
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
          
          // Deduplicate: ignore repeated identical Change within window (prevents multi-admin loop)
          const changeKey = `${locationId}:${message.guid}:${message.page ?? 1}`;
          const last = lastChangeByLocation.get(locationId);
          const now = Date.now();
          if (last && last.key === changeKey && (now - last.at) < CHANGE_DEDUPE_MS) {
            console.log('Ignoring duplicate Change (guid:', message.guid, ', page:', message.page, ') - dedupe window');
            return;
          }
          lastChangeByLocation.set(locationId, { key: changeKey, at: now });
          
          // Manual page/item change - reset autoplay
          stopAutoplayForLocation(locationId);
          
          // Store location for this client
          clientLocations.set(ws, locationId);
          
          console.log('Received Change message with guid:', message.guid, ', page:', message.page, ', locationId:', locationId);
          
          // Get library item using dbOps to ensure pages are loaded correctly
          const rawItem = dbOps.getLibraryItem(message.guid);
          const matchingItem = rawItem ? dbOps.formatLibraryItem(rawItem) : null;
          
          if (matchingItem) {
            let matchingItemContent = matchingItem.content;
            let pageType = matchingItem.type;
            const requestedPageNum = message.page !== undefined && message.page !== null
              ? (typeof message.page === 'string' ? parseInt(message.page, 10) : message.page)
              : 1;

            // Content is always array of { page, type, content, css, duration }; get type, content, css, duration from selected page
            let pageCss = undefined;
            let pageDuration = null;
            if (Array.isArray(matchingItemContent) && matchingItemContent.length > 0) {
              const pageItem = matchingItemContent.find(item => {
                const itemPage = typeof item.page === 'string' ? parseInt(item.page, 10) : item.page;
                return itemPage === requestedPageNum;
              });
              if (pageItem) {
                pageType = pageItem.type || 'text';
                matchingItemContent = pageItem.content !== undefined && pageItem.content !== null ? pageItem.content : '';
                pageCss = pageItem.css;
                pageDuration = pageItem.duration ?? matchingItem.duration ?? null;
              } else {
                const firstPage = matchingItemContent[0];
                pageType = firstPage?.type || 'text';
                matchingItemContent = firstPage?.content || '';
                pageDuration = firstPage?.duration ?? matchingItem.duration ?? null;
              }
            } else if (typeof matchingItemContent === 'string') {
              matchingItemContent = matchingItemContent || '';
            } else {
              matchingItemContent = '';
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
            
            // Build content for clients (display) and admin
            // chordVisibility: 'everywhere' = show on all, 'local' = admin only, 'hidden' = none
            const chordVisibility = resolveChordVisibility(message);
            const clientsShowChords = chordsVisibleForClients(chordVisibility);
            let finalContentForClients = matchingItemContent;
            let finalContentForAdmin = matchingItemContent;
            if (pageType === 'text' && typeof matchingItemContent === 'string') {
              if (!clientsShowChords) {
                // Remove chords for display clients (local and hidden)
                finalContentForClients = matchingItemContent.replace(/<chord\b[^>]*>.*?<\/chord>/gi, '');
                // Admin keeps full content with chords for local display
                finalContentForAdmin = matchingItemContent;
              }
            }

            // Merge css: page css overrides library item css
            let mergedCss = matchingItem.css || undefined;
            if (pageCss && typeof pageCss === 'object' && Object.keys(pageCss).length > 0) {
              mergedCss = { ...(mergedCss || {}), ...pageCss };
            }

            // Store current content for this location (what display clients see)
            const contentVisible = getContentVisible(locationId);
            const locationContentData = {
              type: pageType,
              content: finalContentForClients,
              guid: message.guid,
              page: requestedPageNum,
              duration: pageDuration,
              background_color: backgroundColor,
              font_color: fontColor,
              chord_font_color: chordFontColor,
              css: mergedCss,
              chordVisibility: chordVisibility,
              chordsVisible: clientsShowChords, // Keep for client backward compat
              chordTransposition: message.chordTransposition !== undefined ? message.chordTransposition : 0,
              contentVisible: contentVisible
            };
            locationContent.set(locationId, locationContentData);

            // Admin version: full content with chords when chordVisibility is 'local' (for local-only display)
            const adminContentData = clientsShowChords ? locationContentData : {
              ...locationContentData,
              content: finalContentForAdmin,
              chordVisibility: chordVisibility
            };
            
            // Store last selected library item, page and chord state for new connections
            const locationState = locationStates.get(locationId) || {};
            locationState.currentLibraryItemGuid = message.guid;
            locationState.currentLibraryItemPage = message.page ?? requestedPageNum ?? null;
            locationState.chordVisibility = chordVisibility;
            locationState.chordTransposition = message.chordTransposition !== undefined ? message.chordTransposition : 0;
            locationStates.set(locationId, locationState);
            dbOps.setLocationLastItem(locationId, message.guid, requestedPageNum);
            dbOps.setLocationChordState(locationId, chordVisibility, locationState.chordTransposition);
            
            const messageJsonForClients = JSON.stringify(locationContentData);
            const messageJsonForAdmin = JSON.stringify(adminContentData);
            let sentCount = 0;
            
            // Always update locationContent (used for new connections)
            locationContent.set(locationId, locationContentData);

            // Always send to the sender (admin app)
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(messageJsonForAdmin);
                sentCount++;
              } catch (error) {
                console.error('Error sending message to sender:', error);
                clients.delete(ws);
                clientLocations.delete(ws);
              }
            }
            
            // Broadcast to other clients:
            //   Admins always receive so their preview stays in sync.
            //   Display clients only receive when content is visible to the audience.
            const payloadForAdmins = clientsShowChords ? messageJsonForClients : messageJsonForAdmin;
            clients.forEach((client) => {
              if (client === ws) return;
              const clientLocationId = clientLocations.get(client);
              if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
                if (adminClients.has(client)) {
                  try {
                    client.send(payloadForAdmins);
                    sentCount++;
                  } catch (error) {
                    console.error('Error sending message to admin client:', error);
                    clients.delete(client);
                    clientLocations.delete(client);
                  }
                } else if (contentVisible) {
                  try {
                    client.send(messageJsonForClients);
                    sentCount++;
                  } catch (error) {
                    console.error('Error sending message to client:', error);
                    clients.delete(client);
                    clientLocations.delete(client);
                  }
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
        
        // Check if it's "SetDisplayVisible" or legacy "Clear" message (Clear = hide)
        if (message.type === 'SetDisplayVisible' || message.type === 'Clear') {
          const locationId = message.locationId ? parseInt(message.locationId, 10) : null;
          
          if (!locationId) {
            console.warn('Received SetDisplayVisible/Clear message without locationId, ignoring');
            return;
          }
          
          // Store location for this client
          clientLocations.set(ws, locationId);
          
          // Stop autoplay whenever visibility is toggled (Hide or Unhide)
          stopAutoplayForLocation(locationId);
          
          // visible: true = show content, false = show blank page. Clear means visible=false
          const visible = message.type === 'Clear' ? false : (message.visible !== false);
          
          console.log(`Received SetDisplayVisible for location ${locationId}, visible=${visible}`);
          
          // Persist to DB and in-memory cache
          setContentVisible(locationId, visible);
          
          // Notify all clients (admin and display) of the new visibility state
          const visibilityStateMsg = JSON.stringify({
            type: 'DisplayVisibleState',
            contentVisible: visible,
            locationId: locationId
          });
          clients.forEach((client) => {
            const clientLocationId = clientLocations.get(client);
            if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
              try { client.send(visibilityStateMsg); } catch (e) { /* ignore */ }
            }
          });
          
          const locationState = locationStates.get(locationId) || {};
          // Do NOT clear currentLibraryItemGuid/Page - we need them to restore when toggling back
          
          if (visible) {
            // Restore: send last selected item to display clients
            const guid = locationState.currentLibraryItemGuid ?? dbOps.getLocationLastItem(locationId)?.guid;
            const page = locationState.currentLibraryItemPage ?? dbOps.getLocationLastItem(locationId)?.page ?? 1;
            
            if (guid) {
              const rawItem = dbOps.getLibraryItem(guid);
              const matchingItem = rawItem ? dbOps.formatLibraryItem(rawItem) : null;
              if (matchingItem) {
                let matchingItemContent = matchingItem.content;
                let pageType = matchingItem.type;
                const requestedPageNum = page ?? 1;
                let pageCssRestore = undefined;
                let pageDurationRestore = null;
                if (Array.isArray(matchingItemContent) && matchingItemContent.length > 0) {
                  const pageItem = matchingItemContent.find(item => {
                    const itemPage = typeof item.page === 'string' ? parseInt(item.page, 10) : item.page;
                    return itemPage === requestedPageNum;
                  });
                  if (pageItem) {
                    pageType = pageItem.type || 'text';
                    matchingItemContent = pageItem.content !== undefined && pageItem.content !== null ? pageItem.content : '';
                    pageCssRestore = pageItem.css;
                    pageDurationRestore = pageItem.duration ?? matchingItem.duration ?? null;
                  } else {
                    const firstPage = matchingItemContent[0];
                    pageType = firstPage?.type || 'text';
                    matchingItemContent = firstPage?.content || '';
                    pageDurationRestore = firstPage?.duration ?? matchingItem.duration ?? null;
                  }
                } else if (typeof matchingItemContent === 'string') {
                  matchingItemContent = matchingItemContent || '';
                } else {
                  matchingItemContent = '';
                }
                let mergedCssRestore = matchingItem.css || undefined;
                if (pageCssRestore && typeof pageCssRestore === 'object' && Object.keys(pageCssRestore).length > 0) {
                  mergedCssRestore = { ...(mergedCssRestore || {}), ...pageCssRestore };
                }
                const settings = dbOps.getAllSettings();
                let backgroundColor = matchingItem.background_color;
                let fontColor = matchingItem.font_color;
                let chordFontColor = settings.defaultChordFontColor || '#FFD700';
                if (!backgroundColor) backgroundColor = settings.defaultBackgroundColor || '#000000';
                if (!fontColor) fontColor = settings.defaultFontColor || '#FFFFFF';
                // Preserve chordVisibility from previous state
                const chordVisibility = locationState.chordVisibility || 'everywhere';
                const clientsShowChords = chordsVisibleForClients(chordVisibility);
                let finalContent = matchingItemContent;
                if (pageType === 'text' && typeof matchingItemContent === 'string' && !clientsShowChords) {
                  finalContent = matchingItemContent.replace(/<chord\b[^>]*>.*?<\/chord>/gi, '');
                }
                const locationContentData = {
                  type: pageType,
                  content: finalContent,
                  guid: guid,
                  page: requestedPageNum,
                  duration: pageDurationRestore,
                  background_color: backgroundColor,
                  font_color: fontColor,
                  chord_font_color: chordFontColor,
                  css: mergedCssRestore,
                  chordVisibility: chordVisibility,
                  chordsVisible: clientsShowChords,
                  chordTransposition: locationContent.get(locationId)?.chordTransposition ?? 0,
                  contentVisible: true
                };
                locationState.currentLibraryItemGuid = guid;
                locationState.currentLibraryItemPage = requestedPageNum;
                locationStates.set(locationId, locationState);
                locationContent.set(locationId, locationContentData);
                dbOps.setLocationLastItem(locationId, guid, requestedPageNum);
                
                const messageJson = JSON.stringify(locationContentData);
                clients.forEach((client) => {
                  const clientLocationId = clientLocations.get(client);
                  if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
                    try {
                      client.send(messageJson);
                    } catch (error) {
                      console.error('Error sending message to client:', error);
                      clients.delete(client);
                      clientLocations.delete(client);
                    }
                  }
                });
                console.log(`Broadcasted restored item (guid ${guid}) to clients for location ${locationId}`);
              }
            } else {
              // No item to restore - send empty
              locationContent.delete(locationId);
              const clearMessage = {};
              clients.forEach((client) => {
                const clientLocationId = clientLocations.get(client);
                if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
                  try { client.send(JSON.stringify(clearMessage)); } catch (e) { clients.delete(client); clientLocations.delete(client); }
                }
              });
              console.log(`No item to restore for location ${locationId}, sent empty`);
            }
          } else {
            // Hide: send blank/clear page (do NOT clear locationState - keep for restore)
            const settings = dbOps.getAllSettings();
            const defaultBlankPageGuid = settings.defaultBlankPage;
            
            if (defaultBlankPageGuid && defaultBlankPageGuid.trim() !== '') {
              const defaultBlankPageGuidNum = parseInt(defaultBlankPageGuid, 10);
              const rawBlankPageItem = dbOps.getLibraryItem(defaultBlankPageGuidNum);
              const formattedItem = rawBlankPageItem ? dbOps.formatLibraryItem(rawBlankPageItem) : null;
              
              if (formattedItem) {
                let blankPageContent = '';
                let blankPageCssHide = undefined;
                const blankPageArray = formattedItem.content;
                const blankPageType = formattedItem.type || 'text';
                if (Array.isArray(blankPageArray) && blankPageArray.length > 0) {
                  blankPageContent = blankPageArray[0].content || '';
                  blankPageCssHide = blankPageArray[0].css;
                } else if (typeof blankPageArray === 'string') {
                  blankPageContent = blankPageArray;
                }
                let mergedBlankCssHide = formattedItem.css || undefined;
                if (blankPageCssHide && typeof blankPageCssHide === 'object' && Object.keys(blankPageCssHide).length > 0) {
                  mergedBlankCssHide = { ...(mergedBlankCssHide || {}), ...blankPageCssHide };
                }
                let backgroundColor = formattedItem.background_color;
                let fontColor = formattedItem.font_color;
                let chordFontColor = settings.defaultChordFontColor || '#FFD700';
                if (!backgroundColor) backgroundColor = settings.defaultBackgroundColor || '#000000';
                if (!fontColor) fontColor = settings.defaultFontColor || '#FFFFFF';
                
                const locationContentData = {
                  type: blankPageType,
                  content: blankPageContent,
                  guid: defaultBlankPageGuidNum,
                  page: 1,
                  background_color: backgroundColor,
                  font_color: fontColor,
                  chord_font_color: chordFontColor,
                  css: mergedBlankCssHide,
                  contentVisible: false,
                  isBlankPage: true
                };
                locationContent.set(locationId, locationContentData);
                const messageJson = JSON.stringify(locationContentData);
                clients.forEach((client) => {
                  const clientLocationId = clientLocations.get(client);
                  if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
                    try {
                      client.send(messageJson);
                    } catch (error) {
                      console.error('Error sending message to client:', error);
                      clients.delete(client);
                      clientLocations.delete(client);
                    }
                  }
                });
                console.log(`Broadcasted default blank page to clients for location ${locationId}`);
              } else {
                const minimalBlank = buildMinimalBlankContent(locationId);
                locationContent.set(locationId, minimalBlank);
                const minimalBlankJson = JSON.stringify(minimalBlank);
                clients.forEach((client) => {
                  const clientLocationId = clientLocations.get(client);
                  if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
                    try { client.send(minimalBlankJson); } catch (e) { clients.delete(client); clientLocations.delete(client); }
                  }
                });
              }
            } else {
              const minimalBlank = buildMinimalBlankContent(locationId);
              locationContent.set(locationId, minimalBlank);
              const minimalBlankJson = JSON.stringify(minimalBlank);
              clients.forEach((client) => {
                const clientLocationId = clientLocations.get(client);
                if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
                  try { client.send(minimalBlankJson); } catch (e) { clients.delete(client); clientLocations.delete(client); }
                }
              });
              console.log(`Broadcasted blank page to clients for location ${locationId}`);
            }
          }
          return; // Done processing SetDisplayVisible - prevent fall-through to other handlers
        }
        
        // Check if it's an "AdminClient" initialization message
        if (message.type === 'AdminClient') {
          // Mark client as admin if not already marked
          if (!adminClients.has(ws)) {
            adminClients.add(ws);
            console.log('Admin client registered');
          }
          
          // Store locationId if provided
          let adminLocationId = null;
          if (message.locationId) {
            const locationId = parseInt(message.locationId, 10);
            if (!isNaN(locationId)) {
              clientLocations.set(ws, locationId);
              adminLocationId = locationId;
            }
          }
          // Send last selected state and current content to new admin
          if (adminLocationId && ws.readyState === WebSocket.OPEN) {
            const locationState = locationStates.get(adminLocationId) || {};
            if (locationState.currentPlaylistGuid != null) {
              try {
                ws.send(JSON.stringify({
                  type: 'SelectPlaylist',
                  guid: locationState.currentPlaylistGuid,
                  locationId: adminLocationId
                }));
              } catch (err) {
                console.error('Error sending SelectPlaylist to new admin:', err);
              }
            }
            if (locationState.currentLibraryItemGuid != null) {
              try {
                ws.send(JSON.stringify({
                  type: 'SelectLibraryItem',
                  guid: locationState.currentLibraryItemGuid,
                  page: locationState.currentLibraryItemPage ?? undefined,
                  locationId: adminLocationId
                }));
              } catch (err) {
                console.error('Error sending SelectLibraryItem to new admin:', err);
              }
            }
            // Send content visible state for the visibility toggle button
            const contentVisible = getContentVisible(adminLocationId);
            try {
              ws.send(JSON.stringify({
                type: 'DisplayVisibleState',
                contentVisible: contentVisible,
                locationId: adminLocationId
              }));
            } catch (err) {
              console.error('Error sending DisplayVisibleState to admin:', err);
            }
            // Send autoplay state for restore on refresh
            const apState = autoplayState.get(adminLocationId);
            if (apState && ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({
                  type: 'AutoplayStarted',
                  locationId: adminLocationId,
                  endAt: apState.endAt,
                  totalSeconds: apState.duration,
                  page: apState.page,
                  guid: apState.guid
                }));
              } catch (err) {
                console.error('Error sending AutoplayState to admin:', err);
              }
            }
            // Re-send admin-version content (with chords) because the connection handler sent
            // the client-version (chords stripped) before this client was marked as admin.
            // When contentVisible is false, locationContent has the blank page. For admin preview
            // we need the last selected library item - fetch and send it only to this admin (ws).
            let adminContent = locationContent.get(adminLocationId);
            if (!contentVisible && adminContent && adminContent.isBlankPage) {
              const lastItem = locationState.currentLibraryItemGuid != null
                ? { guid: locationState.currentLibraryItemGuid, page: locationState.currentLibraryItemPage ?? 1 }
                : dbOps.getLocationLastItem(adminLocationId);
              if (lastItem) {
                const rawItemForPreview = dbOps.getLibraryItem(lastItem.guid);
                const matchingForPreview = rawItemForPreview ? dbOps.formatLibraryItem(rawItemForPreview) : null;
                if (matchingForPreview && Array.isArray(matchingForPreview.content)) {
                  const pageNum = lastItem.page ?? 1;
                  const pageItem = matchingForPreview.content.find(p => (typeof p.page === 'string' ? parseInt(p.page, 10) : p.page) === pageNum);
                  const pg = pageItem || matchingForPreview.content[0];
                  if (pg) {
                    const settings = dbOps.getAllSettings();
                    const chordVis = locationState.chordVisibility || 'everywhere';
                    const showChords = chordsVisibleForClients(chordVis);
                    let cnt = pg.content ?? '';
                    if (pg.type === 'text' && typeof cnt === 'string' && !showChords) {
                      cnt = cnt.replace(/<chord\b[^>]*>.*?<\/chord>/gi, '');
                    }
                    let mergedCss = matchingForPreview.css;
                    if (pg.css && typeof pg.css === 'object' && Object.keys(pg.css).length > 0) {
                      mergedCss = { ...(mergedCss || {}), ...pg.css };
                    }
                    adminContent = {
                      type: pg.type || 'text',
                      content: cnt,
                      guid: lastItem.guid,
                      page: pageNum,
                      duration: pg.duration ?? matchingForPreview.duration ?? null,
                      background_color: matchingForPreview.background_color || settings.defaultBackgroundColor || '#000000',
                      font_color: matchingForPreview.font_color || settings.defaultFontColor || '#FFFFFF',
                      chord_font_color: settings.defaultChordFontColor || '#FFD700',
                      css: mergedCss,
                      chordVisibility: chordVis,
                      chordsVisible: showChords,
                      chordTransposition: locationState.chordTransposition ?? 0,
                      contentVisible: false
                    };
                  }
                }
              }
            }
            const adminLocState = locationStates.get(adminLocationId) || {};
            if (adminContent && ws.readyState === WebSocket.OPEN) {
              try {
                const adminChordVisibility = adminLocState.chordVisibility || adminContent.chordVisibility || 'everywhere';
                const adminClientsShowChords = chordsVisibleForClients(adminChordVisibility);
                if (!contentVisible && adminContent.isBlankPage) {
                  ws.send(JSON.stringify({ ...adminContent, contentVisible: false }));
                } else if (!adminClientsShowChords && adminContent.type === 'text') {
                  const rawItemForAdmin = dbOps.getLibraryItem(adminContent.guid);
                  const formattedForAdmin = rawItemForAdmin ? dbOps.formatLibraryItem(rawItemForAdmin) : null;
                  if (formattedForAdmin) {
                    let adminRawContent = formattedForAdmin.content;
                    const adminPage = adminContent.page ?? 1;
                    if (Array.isArray(adminRawContent)) {
                      const pageItem = adminRawContent.find(p => {
                        const pn = typeof p.page === 'string' ? parseInt(p.page, 10) : p.page;
                        return pn === adminPage;
                      });
                      adminRawContent = pageItem ? (pageItem.content || '') : (adminRawContent[0]?.content || '');
                    }
                    ws.send(JSON.stringify({
                      ...adminContent,
                      content: adminRawContent,
                      chordVisibility: adminChordVisibility,
                      chordTransposition: adminLocState.chordTransposition ?? adminContent.chordTransposition ?? 0,
                      contentVisible: contentVisible
                    }));
                  }
                } else {
                  ws.send(JSON.stringify({
                    ...adminContent,
                    chordVisibility: adminChordVisibility,
                    chordTransposition: adminLocState.chordTransposition ?? adminContent.chordTransposition ?? 0,
                    contentVisible: contentVisible
                  }));
                }
              } catch (err) {
                console.error('Error sending admin content on AdminClient:', err);
              }
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
          
          // User changed library item selection - reset autoplay
          stopAutoplayForLocation(locationId);
          
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
        
        // Check if it's an "AutoplayStart" or "AutoplayStop" message
        if (message.type === 'AutoplayStart' || message.type === 'AutoplayStop') {
          const locationId = message.locationId ? parseInt(message.locationId, 10) : clientLocations.get(ws);
          if (!locationId) {
            console.warn('Received Autoplay message without locationId, ignoring');
            return;
          }
          clientLocations.set(ws, locationId);
          if (!adminClients.has(ws)) adminClients.add(ws);
          if (message.type === 'AutoplayStart' && message.play === true) {
            if (!getContentVisible(locationId)) {
              console.log('Ignoring AutoplayStart: content is hidden for location', locationId);
            } else {
              startAutoplayForLocation(locationId, message.playlistPages);
            }
          } else if (message.type === 'AutoplayStop' || message.play === false) {
            stopAutoplayForLocation(locationId);
          }
        }
        
        // Check if it's a direct content update message (with chordVisibility, chordsVisible, or chordTransposition)
        // This allows clients to send modified content with chord adjustments
        if ((message.type === 'text' || message.type === 'image' || message.type === 'url' || message.type === 'video' || message.type === 'iframe') && 
            (message.chordVisibility !== undefined || message.chordsVisible !== undefined || message.chordTransposition !== undefined) && 
            message.content !== undefined) {
          const locationId = message.locationId ? parseInt(message.locationId, 10) : null;
          
          if (!locationId) {
            console.warn('Received content update message without locationId, ignoring');
            return;
          }
          
          // Store location for this client
          clientLocations.set(ws, locationId);
          
          const chordVisibility = resolveChordVisibility(message);
          const clientsShowChords = chordsVisibleForClients(chordVisibility);
          console.log('Received content update message for location:', locationId, 'chordVisibility:', chordVisibility, 'chordTransposition:', message.chordTransposition);
          
          // Get chord font color from settings if not provided
          let chordFontColor = message.chord_font_color;
          if (!chordFontColor) {
            const settings = dbOps.getAllSettings();
            chordFontColor = settings.defaultChordFontColor || '#FFD700';
          }
          
          // message.content     = transposed content (for display clients)
          // message.rawContent  = untransposed original (for admins to store as originalContent)
          // Remove chords from content for clients when chordVisibility is not 'everywhere'
          let finalContent = message.content;
          if (message.type === 'text' && typeof message.content === 'string') {
            if (!clientsShowChords) {
              finalContent = message.content.replace(/<chord\b[^>]*>.*?<\/chord>/gi, '');
            }
          }
          
          // Get guid and page from message or stored location state (for client same-page detection)
          const locationState = locationStates.get(locationId) || {};
          const contentGuid = message.guid ?? locationState.currentLibraryItemGuid;
          const contentPage = message.page ?? locationState.currentLibraryItemPage ?? 1;
          locationState.chordVisibility = chordVisibility;
          locationState.chordTransposition = message.chordTransposition !== undefined ? message.chordTransposition : 0;
          locationStates.set(locationId, locationState);
          dbOps.setLocationChordState(locationId, chordVisibility, locationState.chordTransposition);

          // Update stored content for this location
          // Preserve CSS from current locationContent if the message doesn't include it
          const existingCss = locationContent.get(locationId)?.css;
          const locationContentData = {
            type: message.type,
            content: finalContent,
            guid: contentGuid,
            page: contentPage,
            background_color: message.background_color,
            font_color: message.font_color,
            chord_font_color: chordFontColor,
            css: message.css || existingCss || undefined,
            chordVisibility: chordVisibility,
            chordsVisible: clientsShowChords,
            chordTransposition: message.chordTransposition !== undefined ? message.chordTransposition : 0
          };
          locationContent.set(locationId, locationContentData);
          
          // Broadcast: admins receive rawContent (untransposed original) so they correctly store
          // originalContent without double-transposition on refresh; display clients receive the
          // transposed + chord-stripped content stored in locationContentData.
          const adminContentForBroadcast = message.rawContent || message.content;
          const messageJsonForDisplays = JSON.stringify(locationContentData);
          const messageJsonForAdmins = JSON.stringify({ ...locationContentData, content: adminContentForBroadcast });
          let sentCount = 0;
          
          // Admins always receive chord/transposition updates; display clients only when visible.
          const contentVisibleNow = getContentVisible(locationId);
          clients.forEach((client) => {
            const clientLocationId = clientLocations.get(client);
            if (client.readyState === WebSocket.OPEN && clientLocationId === locationId) {
              if (adminClients.has(client)) {
                try {
                  client.send(messageJsonForAdmins);
                  sentCount++;
                } catch (error) {
                  console.error('Error sending content update to admin:', error);
                  clients.delete(client);
                  clientLocations.delete(client);
                }
              } else if (contentVisibleNow) {
                try {
                  client.send(messageJsonForDisplays);
                  sentCount++;
                } catch (error) {
                  console.error('Error sending content update to display client:', error);
                  clients.delete(client);
                  clientLocations.delete(client);
                }
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

