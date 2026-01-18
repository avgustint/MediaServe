const express = require('express');
const router = express.Router();

// Store reference to WebSocket server and helper functions
// This will be set by websocketHandler.js
let wssInstance = null;
let getServerIPs = null;
let isSameIP = null;
let clients = null;
let adminClients = null;
let clientIPs = null;

/**
 * Initialize keyboard routes with WebSocket server reference
 * @param {Object} wss - WebSocket server instance
 * @param {Function} getServerIPsFn - Function to get server IP addresses
 * @param {Function} isSameIPFn - Function to check if two IPs match
 * @param {Set} clientsSet - Set of all connected clients
 * @param {WeakSet} adminClientsSet - WeakSet of admin clients
 * @param {Map} clientIPsMap - Map of client IP addresses
 */
function initializeKeyboardRoutes(wss, getServerIPsFn, isSameIPFn, clientsSet, adminClientsSet, clientIPsMap) {
  wssInstance = wss;
  getServerIPs = getServerIPsFn;
  isSameIP = isSameIPFn;
  clients = clientsSet;
  adminClients = adminClientsSet;
  clientIPs = clientIPsMap;
}

/**
 * POST /api/keyboard/command
 * Receives keyboard command from client app or OS-level keyboard listener service
 * Forwards to admin clients on same IP as server
 */
router.post('/command', (req, res) => {
  // Get client IP address
  const remoteAddress = req.socket.remoteAddress || req.connection.remoteAddress || req.ip;
  const normalizedRemote = normalizeIP(remoteAddress);
  
  // Get server IP addresses for comparison
  const serverIPs = getServerIPs ? getServerIPs() : ['127.0.0.1', '::1'];
  
  // Validate that request comes from same IP as server
  // This allows requests from client app on same machine, or OS-level listener
  const checkSameIP = (clientIP, serverIPs) => {
    const normalizedClientIP = normalizeIP(clientIP);
    return serverIPs.some(serverIP => normalizeIP(serverIP) === normalizedClientIP);
  };
  
  if (!checkSameIP(normalizedRemote, serverIPs)) {
    console.warn('Keyboard command rejected from different IP:', normalizedRemote, 'Server IPs:', serverIPs);
    return res.status(403).json({ success: false, message: 'Request must come from same IP as server' });
  }

  const { key, timestamp } = req.body;

  if (!key) {
    return res.status(400).json({ success: false, message: 'Key is required' });
  }

  // Validate key is allowed (arrow keys, numbers, Enter, Escape)
  const allowedKeys = [
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'Enter', 'Escape'
  ];

  if (!allowedKeys.includes(key)) {
    console.warn('Keyboard command rejected - invalid key:', key);
    return res.status(400).json({ success: false, message: 'Invalid key' });
  }

  // Filter admin clients by IP - only send to clients on same IP as server
  const matchingAdminClients = [];
  if (clients && adminClients && clientIPs) {
    clients.forEach((client) => {
      if (adminClients.has(client) && client.readyState === 1) { // WebSocket.OPEN = 1
        const clientIP = clientIPs.get(client);
        if (clientIP && isSameIP && isSameIP(clientIP, serverIPs)) {
          matchingAdminClients.push(client);
        }
      }
    });
  }

  // Forward keyboard command to matching admin clients
  const keyboardMessage = JSON.stringify({
    type: 'KeyboardCommand',
    key: key,
    timestamp: timestamp || Date.now()
  });

  let sentCount = 0;
  matchingAdminClients.forEach((client) => {
    try {
      client.send(keyboardMessage);
      sentCount++;
    } catch (error) {
      console.error('Error sending keyboard command to admin client:', error);
    }
  });

  console.log(`Keyboard command '${key}' forwarded to ${sentCount} admin client(s) on same IP`);

  res.json({
    success: true,
    key: key,
    clientsNotified: sentCount
  });
});

/**
 * Helper to normalize IP addresses
 */
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

module.exports = { router, initializeKeyboardRoutes };

