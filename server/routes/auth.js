const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const { getUserWithPermissions } = require('../utils/helpers');
const { comparePassword, hashPassword } = require('../utils/password');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateRequired } = require('../middleware/validation');
const rateLimit = require('express-rate-limit');

// Rate limiting for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { success: false, message: 'Too many login attempts, please try again later' }
});

/**
 * POST /login
 * Login endpoint
 */
router.post('/login', loginLimiter, validateRequired(['username', 'password', 'locationId']), asyncHandler(async (req, res) => {
  const { username, password, locationId } = req.body;
  
  // Validate locationId
  const locationIdNum = parseInt(locationId, 10);
  if (isNaN(locationIdNum)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid location ID'
    });
  }
  
  // Verify location exists
  const location = dbOps.getLocation(locationIdNum);
  if (!location) {
    return res.status(400).json({
      success: false,
      message: 'Location not found'
    });
  }
  
  const user = dbOps.getUserByUsername(username);
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
  
  // Compare password (supports both MD5 and bcrypt)
  const passwordCheck = await comparePassword(password, user.password);
  
  if (!passwordCheck.match) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
  
  // Upgrade MD5 password to bcrypt if needed
  if (passwordCheck.needsUpgrade) {
    const newHash = await hashPassword(password);
    dbOps.updateUser(user.guid, { password: newHash });
    console.log(`Upgraded password for user: ${username}`);
  }
  
  const userData = getUserWithPermissions(user);
  // Add location to user data
  userData.locationId = locationIdNum;
  userData.location = location;
  
  res.json({
    success: true,
    message: 'Login successful',
    user: userData
  });
}));

/**
 * GET /me
 * Get current user data
 */
router.get('/me', asyncHandler(async (req, res) => {
  const username = req.query.username;
  
  if (!username) {
    return res.status(400).json({
      success: false,
      message: 'Username parameter required'
    });
  }
  
  const user = dbOps.getUserByUsername(username);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  const userData = getUserWithPermissions(user);
  
  res.json({
    success: true,
    user: userData
  });
}));

module.exports = router;

