const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const cache = require('../utils/cache');
const { invalidateLibraryCache } = require('../dataLoader');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateGuid, validatePagination, sanitizeString } = require('../middleware/validation');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const config = require('../config');

// Apply pagination middleware to list endpoints
router.use('/search', validatePagination);
router.use('/recent', validatePagination);

/**
 * GET /library
 * Get all library items
 */
router.get('/', authMiddleware, requirePermission('ViewLibrary'), asyncHandler(async (req, res) => {
  const cacheKey = 'library:all';
  let items = cache.get(cacheKey);
  
  if (!items || !config.performance.cacheEnabled) {
    items = dbOps.getAllLibraryItems().map(item => dbOps.formatLibraryItem(item));
    if (config.performance.cacheEnabled) {
      cache.set(cacheKey, items);
    }
  }
  
  res.json(items);
}));

/**
 * GET /library/recent
 * Get recently modified library items
 */
router.get('/recent', authMiddleware, requirePermission('ViewLibrary'), asyncHandler(async (req, res) => {
  const { limit, offset } = req.pagination;
  const cacheKey = `library:recent:${limit}:${offset}`;
  
  let items = cache.get(cacheKey);
  if (!items || !config.performance.cacheEnabled) {
    const allItems = dbOps.getRecentlyModifiedLibraryItems(limit + offset);
    items = allItems.slice(offset, offset + limit).map(item => dbOps.formatLibraryItem(item));
    if (config.performance.cacheEnabled) {
      cache.set(cacheKey, items, 60000); // 1 minute cache for recent items
    }
  }
  
  res.json(items);
}));

/**
 * GET /library/search
 * Search library items
 */
router.get('/search', authMiddleware, requirePermission('ViewLibrary'), asyncHandler(async (req, res) => {
  const searchTerm = sanitizeString(req.query.q || '');
  
  if (!searchTerm || searchTerm.trim().length === 0) {
    return res.json([]);
  }
  
  const cacheKey = `library:search:${searchTerm}`;
  let items = cache.get(cacheKey);
  
  if (!items || !config.performance.cacheEnabled) {
    items = dbOps.searchLibraryItems(searchTerm).map(item => dbOps.formatLibraryItem(item));
    if (config.performance.cacheEnabled) {
      cache.set(cacheKey, items, 60000); // 1 minute cache for search results
    }
  }
  
  res.json(items);
}));

/**
 * GET /library/:guid
 * Get single library item
 */
router.get('/:guid', validateGuid, authMiddleware, requirePermission('ViewLibrary'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const cacheKey = `library:item:${guid}`;
  
  let item = cache.get(cacheKey);
  if (!item || !config.performance.cacheEnabled) {
    const dbItem = dbOps.getLibraryItem(guid);
    if (!dbItem) {
      return res.status(404).json(null);
    }
    item = dbOps.formatLibraryItem(dbItem);
    if (config.performance.cacheEnabled) {
      cache.set(cacheKey, item);
    }
  }
  
  res.json(item);
}));

/**
 * GET /library/:guid/usage
 * Check library item usage
 */
router.get('/:guid/usage', validateGuid, authMiddleware, requirePermission('ManageLibrary'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const usageInfo = dbOps.checkLibraryItemUsage(guid);
  res.json(usageInfo);
}));

/**
 * POST /library
 * Create library item
 */
router.post('/', authMiddleware, requirePermission('ManageLibrary'), asyncHandler(async (req, res) => {
  // Invalidate cache
  if (config.performance.cacheEnabled) {
    cache.delete('library:all');
    cache.deletePattern('library:recent:*');
    cache.deletePattern('library:search:*');
  }
  invalidateLibraryCache();
  
  const itemData = {
    ...req.body,
    name: sanitizeString(req.body.name || '')
  };
  
  const newItem = dbOps.createLibraryItem(itemData);
  const formattedItem = dbOps.formatLibraryItem(newItem);
  
  res.json(formattedItem);
}));

/**
 * PUT /library/:guid
 * Update library item
 */
router.put('/:guid', validateGuid, authMiddleware, requirePermission('ManageLibrary'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  
  const existingItem = dbOps.getLibraryItem(guid);
  if (!existingItem) {
    return res.status(404).json({
      success: false,
      message: 'Library item not found'
    });
  }
  
  // Invalidate cache
  if (config.performance.cacheEnabled) {
    cache.delete('library:all');
    cache.delete(`library:item:${guid}`);
    cache.deletePattern('library:recent:*');
    cache.deletePattern('library:search:*');
  }
  invalidateLibraryCache();
  
  const itemData = {
    ...req.body,
    name: sanitizeString(req.body.name || '')
  };
  
  const updatedItem = dbOps.updateLibraryItem(guid, itemData);
  const formattedItem = dbOps.formatLibraryItem(updatedItem);
  
  res.json(formattedItem);
}));

/**
 * DELETE /library/:guid
 * Delete library item
 */
router.delete('/:guid', validateGuid, authMiddleware, requirePermission('ManageLibrary'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  
  const deleted = dbOps.deleteLibraryItem(guid);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Library item not found'
    });
  }
  
  // Invalidate cache
  if (config.performance.cacheEnabled) {
    cache.delete('library:all');
    cache.delete(`library:item:${guid}`);
    cache.deletePattern('library:recent:*');
    cache.deletePattern('library:search:*');
  }
  invalidateLibraryCache();
  
  res.json({
    success: true,
    message: 'Library item deleted'
  });
}));

module.exports = router;

