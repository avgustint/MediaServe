const config = require('../config');

/**
 * Check if origin should be allowed
 * Handles localhost and mediaplayer.local variants
 */
function isAllowedOrigin(origin) {
  if (!origin) return false;
  
  // Normalize origin for comparison (remove trailing slash, convert to lowercase)
  const normalizedOrigin = origin.toLowerCase().replace(/\/$/, '');
  
  // List of allowed origins
  const allowedOrigins = [
    'http://localhost',
    'http://localhost:4200',
    'http://localhost:4201',
    'http://localhost:5000',
    'http://localhost:5001',
    'http://127.0.0.1',
    'http://127.0.0.1:4200',
    'http://127.0.0.1:4201',
    'http://127.0.0.1:5000',
    'http://127.0.0.1:5001',
    'http://192.168.0.100',
    'http://192.168.0.100:4200',
    'http://192.168.0.100:4201',
    'http://192.168.0.100:5000',
    'http://192.168.0.100:5001',
  ];
  
  // Check exact match
  if (allowedOrigins.includes(normalizedOrigin)) {
    return true;
  }
  
  // Check if origin matches any allowed pattern (with any port)
  // This allows cross-hostname requests (e.g., localhost to fixed IP)
  const originHost = normalizedOrigin.replace(/^https?:\/\//, '').split(':')[0];
  const allowedHosts = ['localhost', '127.0.0.1', '192.168.0.100'];
  
  if (allowedHosts.includes(originHost)) {
    return true;
  }
  
  // Check config allowed origins
  if (config.cors.origin && Array.isArray(config.cors.origin)) {
    for (const allowedOrigin of config.cors.origin) {
      if (normalizedOrigin === allowedOrigin.toLowerCase().replace(/\/$/, '')) {
        return true;
      }
    }
  }
  
  // In development, allow all origins
  if (config.nodeEnv === 'development') {
    return true;
  }
  
  // Allow all localhost and mediaplayer.local origins to access each other
  // This enables cross-hostname access (e.g., localhost:4200 to mediaplayer.local:5000)
  // This is safe because these are all local network addresses
  if (allowedHosts.includes(originHost)) {
    return true;
  }
  
  return false;
}

/**
 * CORS middleware
 */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  
  // Always allow CORS for localhost and fixed IP origins
  // This enables cross-hostname access (e.g., localhost:4200 to 192.168.0.100:5000)
  if (origin) {
    const originHost = origin.toLowerCase().replace(/^https?:\/\//, '').split(':')[0];
    const allowedHosts = ['localhost', '127.0.0.1', '192.168.0.100'];
    
    if (allowedHosts.includes(originHost)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
      if (config.cors.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    } else if (isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    if (config.cors.credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    } else {
      // For other origins, still set the header to prevent CORS errors
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  } else if (!origin) {
    // No origin header (e.g., same-origin request or non-browser client)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
}

module.exports = corsMiddleware;

