require('dotenv').config();
const sharedConfig = require('../shared-config.js');
const corsAllowedHosts = require('../cors-allowed-hosts');

module.exports = {
  // Use port from shared config (8080 for local, 5000 for raspberry)
  // Can be overridden with PORT environment variable
  port: process.env.PORT || sharedConfig.serverPort,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  cors: {
    // Origins from CORS_ORIGIN env, or built from cors-allowed-hosts.js
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : corsAllowedHosts.buildCorsOrigins(),
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },
  
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10
  },
  
  performance: {
    cacheEnabled: process.env.CACHE_ENABLED !== 'false',
    cacheTTL: parseInt(process.env.CACHE_TTL) || 300000, // 5 minutes default
    pagination: {
      defaultLimit: parseInt(process.env.PAGINATION_DEFAULT_LIMIT) || 50,
      maxLimit: parseInt(process.env.PAGINATION_MAX_LIMIT) || 1000
    }
  },
  
  bodySizeLimit: process.env.BODY_SIZE_LIMIT || '50mb' // Default 50 MB for JSON/URL-encoded body parser (library items can contain multiple base64 images)
};

