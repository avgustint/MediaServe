const dbOps = require('../dbOperations');
const bcrypt = require('bcrypt');

/**
 * Authentication middleware
 * Expects username in query parameter or Authorization header
 */
async function authMiddleware(req, res, next) {
  try {
    let username = null;
    
    // Try to get from Authorization header first (Bearer token)
    if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        // Bearer token contains the username (plain text for now, can be enhanced with JWT later)
        username = authHeader.substring(7).trim();
      }
    }
    
    // Fallback to query parameter (legacy support)
    if (!username && req.query.username) {
      username = req.query.username.trim();
    }
    
    if (!username || username === '') {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const user = dbOps.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional authentication - doesn't fail if no user
 */
async function optionalAuthMiddleware(req, res, next) {
  try {
    let username = null;
    
    // Try Authorization header first
    if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        username = authHeader.substring(7).trim();
      }
    }
    
    // Fallback to query parameter
    if (!username && req.query.username) {
      username = req.query.username.trim();
    }
    
    if (username && username !== '') {
      const user = dbOps.getUserByUsername(username);
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Check if user has permission
 */
function requirePermission(permissionName) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }
      
      const userRole = req.user.role ? dbOps.getRole(req.user.role) : null;
      if (!userRole) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
      
      // Admin users have all permissions
      if (userRole.is_admin === 1) {
        return next();
      }
      
      const permissionGuids = dbOps.getRolePermissions(req.user.role);
      const permissionNames = permissionGuids.map(guid => {
        const perm = dbOps.getPermission(guid);
        return perm ? perm.name : null;
      }).filter(Boolean);
      
      if (!permissionNames.includes(permissionName)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Check if user is administrator
 */
function requireAdmin(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const userRole = req.user.role ? dbOps.getRole(req.user.role) : null;
    if (!userRole || userRole.is_admin !== 1) {
      return res.status(403).json({
        success: false,
        message: 'Administrator access required'
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requirePermission,
  requireAdmin
};



