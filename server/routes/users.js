const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const { getUserWithPermissions, isAdministrator } = require('../utils/helpers');
const { hashPassword, comparePassword } = require('../utils/password');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateGuid, sanitizeString } = require('../middleware/validation');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

/**
 * GET /users
 * Get all users
 */
router.get('/', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const users = dbOps.getAllUsers().map(user => {
    // Decode email
    let decodedEmail = user.email;
    try {
      decodedEmail = Buffer.from(user.email, 'base64').toString('utf8');
    } catch (e) {
      // Keep original if decoding fails
    }
    return {
      guid: user.guid,
      name: user.name,
      email: decodedEmail,
      username: user.username,
      role: user.role,
      locale: user.locale || null
    };
  });
  res.json(users);
}));

/**
 * POST /users
 * Create user
 */
router.post('/', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const userData = {
    ...req.body,
    name: sanitizeString(req.body.name || ''),
    username: sanitizeString(req.body.username || ''),
    email: req.body.email ? Buffer.from(req.body.email).toString('base64') : ''
  };
  
  // Hash password if provided
  if (userData.password) {
    userData.password = await hashPassword(userData.password);
  }
  
  const newUser = dbOps.createUser(userData);
  
  // Decode email for response
  let decodedEmail = newUser.email;
  try {
    decodedEmail = Buffer.from(newUser.email, 'base64').toString('utf8');
  } catch (e) {
    // If decoding fails, email might already be decoded or invalid
  }
  
  const responseUser = {
    guid: newUser.guid,
    name: newUser.name,
    email: decodedEmail,
    username: newUser.username,
    role: newUser.role,
    locale: newUser.locale || null
  };
  
  res.json(responseUser);
}));

/**
 * PUT /users/:guid
 * Update user
 */
router.put('/:guid', validateGuid, authMiddleware, asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const currentUser = req.user;
  
  // Get target user being updated
  const targetUser = dbOps.getUserById(guid);
  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Check if trying to modify administrator role
  const targetIsAdmin = isAdministrator(targetUser);
  const currentIsAdmin = isAdministrator(currentUser);
  const newRole = req.body.role !== undefined ? req.body.role : targetUser.role;
  const newRoleObj = newRole ? dbOps.getRole(newRole) : null;
  const wouldBeAdmin = newRoleObj && newRoleObj.is_admin === 1;
  
  // Only administrators can set/remove administrator role
  if ((targetIsAdmin || wouldBeAdmin) && !currentIsAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Only administrators can modify administrator roles'
    });
  }
  
  const userData = { ...req.body };
  
  // Verify current password if password is being changed
  if (userData.password && userData.currentPassword) {
    // User is changing their own password - verify current password
    if (targetUser.guid === currentUser.guid) {
      const passwordCheck = await comparePassword(userData.currentPassword, targetUser.password);
      if (!passwordCheck.match) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
    } else {
      // Admin is changing another user's password - no current password verification needed
      delete userData.currentPassword;
    }
  } else if (userData.password && targetUser.guid === currentUser.guid) {
    // Password is being changed but no current password provided
    return res.status(400).json({
      success: false,
      message: 'Current password is required to change password'
    });
  }
  
  // Remove currentPassword from userData
  const { currentPassword, ...updateData } = userData;
  
  // Hash new password if provided
  if (updateData.password) {
    updateData.password = await hashPassword(updateData.password);
  }
  
  // Encode email if provided
  if (updateData.email !== undefined) {
    updateData.email = Buffer.from(updateData.email).toString('base64');
  }
  
  // Sanitize string fields
  if (updateData.name !== undefined) {
    updateData.name = sanitizeString(updateData.name);
  }
  if (updateData.username !== undefined) {
    updateData.username = sanitizeString(updateData.username);
  }
  
  const updatedUser = dbOps.updateUser(guid, updateData);
  if (!updatedUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Decode email from base64 for response
  let decodedEmail = updatedUser.email;
  try {
    decodedEmail = Buffer.from(updatedUser.email, 'base64').toString('utf8');
  } catch (e) {
    // If decoding fails, email might already be decoded or invalid
  }
  
  const responseUser = {
    guid: updatedUser.guid,
    name: updatedUser.name,
    email: decodedEmail,
    username: updatedUser.username,
    role: updatedUser.role,
    locale: updatedUser.locale || null
  };
  
  res.json(responseUser);
}));

/**
 * DELETE /users/:guid
 * Delete user
 */
router.delete('/:guid', validateGuid, authMiddleware, asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const currentUser = req.user;
  
  // Get target user being deleted
  const targetUser = dbOps.getUserById(guid);
  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  // Only administrators can delete other administrators
  const targetIsAdmin = isAdministrator(targetUser);
  const currentIsAdmin = isAdministrator(currentUser);
  
  if (targetIsAdmin && !currentIsAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Only administrators can delete other administrators'
    });
  }
  
  const deleted = dbOps.deleteUser(guid);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  res.json({
    success: true,
    message: 'User deleted'
  });
}));

module.exports = router;

