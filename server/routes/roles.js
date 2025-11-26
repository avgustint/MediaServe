const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateGuid, sanitizeString } = require('../middleware/validation');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

/**
 * GET /roles
 * Get all roles
 */
router.get('/', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const roles = dbOps.getAllRoles();
  res.json(roles);
}));

/**
 * POST /roles
 * Create new role
 */
router.post('/', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  if (!req.body.name || req.body.name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Role name is required'
    });
  }
  
  const newRole = dbOps.createRole({
    name: sanitizeString(req.body.name.trim()),
    is_admin: req.body.is_admin || 0
  });
  
  res.json(newRole);
}));

/**
 * PUT /roles/:guid
 * Update role
 */
router.put('/:guid', validateGuid, authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { guid } = req.params;
  
  const existingRole = dbOps.getRole(guid);
  if (!existingRole) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }
  
  if (!req.body.name || req.body.name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Role name is required'
    });
  }
  
  const updatedRole = dbOps.updateRole(guid, {
    name: sanitizeString(req.body.name.trim()),
    is_admin: req.body.is_admin !== undefined ? req.body.is_admin : existingRole.is_admin
  });
  
  if (!updatedRole) {
    return res.status(404).json({
      success: false,
      message: 'Role not found'
    });
  }
  
  res.json(updatedRole);
}));

/**
 * DELETE /roles/:guid
 * Delete role
 */
router.delete('/:guid', validateGuid, authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { guid } = req.params;
  
  try {
    const deleted = dbOps.deleteRole(guid);
    if (deleted) {
      res.json({
        success: true,
        message: 'Role deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }
  } catch (deleteError) {
    res.status(400).json({
      success: false,
      message: deleteError.message
    });
  }
}));

/**
 * GET /roles/:guid/usage
 * Check if role is used by any users
 */
router.get('/:guid/usage', validateGuid, authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { guid } = req.params;
  
  const isUsed = dbOps.checkRoleUsage(guid);
  const role = dbOps.getRole(guid);
  const isAdmin = role && role.is_admin === 1;
  
  res.json({
    isUsed,
    isAdmin,
    canDelete: !isAdmin && !isUsed
  });
}));

/**
 * GET /roles/:guid/permissions
 * Get permissions for a role
 */
router.get('/:guid/permissions', validateGuid, authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { guid } = req.params;
  
  const permissionGuids = dbOps.getRolePermissions(guid);
  res.json(permissionGuids);
}));

/**
 * PUT /roles/:guid/permissions
 * Update permissions for a role
 */
router.put('/:guid/permissions', validateGuid, authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const { guid } = req.params;
  
  const permissionGuids = Array.isArray(req.body.permissions) ? req.body.permissions : [];
  const updatedPermissions = dbOps.updateRolePermissions(guid, permissionGuids);
  
  res.json(updatedPermissions);
}));

module.exports = router;

