const config = require('../config');

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  // Don't leak error details in production
  const isDevelopment = config.nodeEnv === 'development';
  
  const statusCode = err.statusCode || err.status || 500;
  const message = isDevelopment ? err.message : 'Internal server error';
  const stack = isDevelopment ? err.stack : undefined;
  
  res.status(statusCode).json({
    success: false,
    message: message,
    ...(stack && { stack })
  });
}

/**
 * Async error wrapper
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler
};

