const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateGuid } = require('../middleware/validation');
const { authMiddleware, requirePermission } = require('../middleware/auth');

/**
 * GET /locations
 * Get all locations (no authentication required - needed for login page)
 */
router.get('/', asyncHandler(async (req, res) => {
  const locations = dbOps.getAllLocations();
  res.json(locations);
}));

/**
 * GET /locations/:guid
 * Get single location
 */
router.get('/:guid', validateGuid, authMiddleware, requirePermission('ViewLocations'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const location = dbOps.getLocation(guid);
  if (!location) {
    return res.status(404).json(null);
  }
  res.json(location);
}));

/**
 * POST /locations
 * Create new location
 */
router.post('/', authMiddleware, requirePermission('ManageLocations'), asyncHandler(async (req, res) => {
  const locationData = {
    name: req.body.name || '',
    description: req.body.description || null
  };
  const newLocation = dbOps.createLocation(locationData);
  res.json(newLocation);
}));

/**
 * PUT /locations/:guid
 * Update location
 */
router.put('/:guid', validateGuid, authMiddleware, requirePermission('ManageLocations'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const existingLocation = dbOps.getLocation(guid);
  if (!existingLocation) {
    return res.status(404).json({
      success: false,
      message: 'Location not found'
    });
  }
  
  const locationData = {
    name: req.body.name !== undefined ? req.body.name : existingLocation.name,
    description: req.body.description !== undefined ? req.body.description : existingLocation.description
  };
  
  const updatedLocation = dbOps.updateLocation(guid, locationData);
  res.json(updatedLocation);
}));

/**
 * DELETE /locations/:guid
 * Delete location
 */
router.delete('/:guid', validateGuid, authMiddleware, requirePermission('ManageLocations'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const deleted = dbOps.deleteLocation(guid);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Location not found'
    });
  }
  res.json({
    success: true,
    message: 'Location deleted'
  });
}));

module.exports = router;

