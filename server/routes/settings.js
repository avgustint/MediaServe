const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const { requirePermission } = require('../middleware/auth');

/**
 * GET /settings
 * Get all settings (requires ViewGeneralSettings permission)
 */
router.get('/', authMiddleware, requirePermission('ViewGeneralSettings'), asyncHandler(async (req, res) => {
  const settings = dbOps.getAllSettings();
  res.json(settings);
}));

/**
 * PUT /settings
 * Update settings (requires EditGeneralSettings permission)
 */
router.put('/', authMiddleware, requirePermission('EditGeneralSettings'), asyncHandler(async (req, res) => {
  // Update each setting
  if (req.body.defaultBackgroundColor !== undefined) {
    dbOps.setSetting('defaultBackgroundColor', req.body.defaultBackgroundColor || '');
  }
  if (req.body.defaultFontColor !== undefined) {
    dbOps.setSetting('defaultFontColor', req.body.defaultFontColor || '');
  }
  if (req.body.defaultBlankPage !== undefined) {
    dbOps.setSetting('defaultBlankPage', req.body.defaultBlankPage || '');
  }

  const allSettings = dbOps.getAllSettings();
  res.json(allSettings);
}));

module.exports = router;

