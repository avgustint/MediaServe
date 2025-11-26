require('dotenv').config();

module.exports = {
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  cors: {
    // Allow multiple dev origins by default (admin, client display, etc.)
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:4200', 'http://localhost:4201'],
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
  
  bodySizeLimit: process.env.BODY_SIZE_LIMIT || '10mb' // Default 10 MB for JSON/URL-encoded body parser
};

