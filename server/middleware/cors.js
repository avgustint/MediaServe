const config = require('../config');

/**
 * CORS middleware
 */
function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  if (config.cors.origin.includes('*') || (origin && config.cors.origin.includes(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin || config.cors.origin[0]);
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (config.cors.credentials) {
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

