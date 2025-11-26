/**
 * Validation middleware
 */

/**
 * Validate GUID parameter
 */
function validateGuid(req, res, next) {
  // Check for guid, id, or libraryItemGuid parameters
  const guidValue = req.params.guid || req.params.id || req.params.libraryItemGuid;
  const guid = parseInt(guidValue, 10);
  
  if (isNaN(guid) || guid <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid GUID'
    });
  }
  
  // Update the appropriate parameter
  if (req.params.guid) {
    req.params.guid = guid;
  }
  if (req.params.libraryItemGuid) {
    req.params.libraryItemGuid = guid;
  }
  next();
}

/**
 * Validate pagination parameters
 */
function validatePagination(req, res, next) {
  const config = require('../config');
  const limit = parseInt(req.query.limit) || config.performance.pagination.defaultLimit;
  const offset = parseInt(req.query.offset) || 0;
  
  req.pagination = {
    limit: Math.min(limit, config.performance.pagination.maxLimit),
    offset: Math.max(0, offset)
  };
  
  next();
}

/**
 * Sanitize string input
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/[<>]/g, '');
}

/**
 * Validate required fields
 */
function validateRequired(fields) {
  return (req, res, next) => {
    const missing = [];
    
    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }
    
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`
      });
    }
    
    next();
  };
}

module.exports = {
  validateGuid,
  validatePagination,
  sanitizeString,
  validateRequired
};

