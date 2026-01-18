const config = require('../config');

/**
 * CORS middleware
 */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  
  // Allow all origins - set to request origin if present, otherwise allow all
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Only set credentials if origin is specified (can't use * with credentials)
  if (origin && config.cors.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
}

module.exports = corsMiddleware;

