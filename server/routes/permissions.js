const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

/**
 * GET /permissions
 * Get all permissions
 */
router.get('/', authMiddleware, requireAdmin, asyncHandler(async (req, res) => {
  const permissions = dbOps.getAllPermissions();
  res.json(permissions);
}));

module.exports = router;

