const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateGuid } = require('../middleware/validation');
const { authMiddleware, requirePermission } = require('../middleware/auth');

/**
 * GET /tags
 * Get all tags
 */
router.get('/', authMiddleware, requirePermission('ViewTags'), asyncHandler(async (req, res) => {
  const tags = dbOps.getAllTags();
  res.json(tags);
}));

/**
 * GET /tags/:guid
 * Get single tag
 */
router.get('/:guid', validateGuid, authMiddleware, requirePermission('ViewTags'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const tag = dbOps.getTag(guid);
  if (!tag) {
    return res.status(404).json(null);
  }
  res.json(tag);
}));

/**
 * GET /tags/:guid/usage
 * Check if tag is used by any library items
 */
router.get('/:guid/usage', validateGuid, authMiddleware, requirePermission('ManageTags'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const usageInfo = dbOps.checkTagUsage(guid);
  res.json(usageInfo);
}));

/**
 * POST /tags
 * Create new tag
 */
router.post('/', authMiddleware, requirePermission('ManageTags'), asyncHandler(async (req, res) => {
  const tagData = {
    name: req.body.name || '',
    description: req.body.description || null
  };
  const newTag = dbOps.createTag(tagData);
  res.json(newTag);
}));

/**
 * PUT /tags/:guid
 * Update tag
 */
router.put('/:guid', validateGuid, authMiddleware, requirePermission('ManageTags'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const existingTag = dbOps.getTag(guid);
  if (!existingTag) {
    return res.status(404).json({
      success: false,
      message: 'Tag not found'
    });
  }
  
  const tagData = {
    name: req.body.name !== undefined ? req.body.name : existingTag.name,
    description: req.body.description !== undefined ? req.body.description : existingTag.description
  };
  
  const updatedTag = dbOps.updateTag(guid, tagData);
  res.json(updatedTag);
}));

/**
 * DELETE /tags/:guid
 * Delete tag
 */
router.delete('/:guid', validateGuid, authMiddleware, requirePermission('ManageTags'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const deleted = dbOps.deleteTag(guid);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Tag not found'
    });
  }
  res.json({
    success: true,
    message: 'Tag deleted'
  });
}));

module.exports = router;

