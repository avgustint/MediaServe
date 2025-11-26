const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const cache = require('../utils/cache');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateGuid, validatePagination, sanitizeString } = require('../middleware/validation');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const config = require('../config');

// Apply pagination middleware
router.use('/search', validatePagination);
router.use('/recent', validatePagination);

/**
 * GET /playlists/search
 * Search playlists
 */
router.get('/search', authMiddleware, requirePermission('ViewPlaylists'), asyncHandler(async (req, res) => {
  const searchTerm = sanitizeString(req.query.q || '');
  const cacheKey = `playlists:search:${searchTerm}`;
  
  let results = cache.get(cacheKey);
  if (!results || !config.performance.cacheEnabled) {
    results = dbOps.searchPlaylists(searchTerm);
    if (config.performance.cacheEnabled) {
      cache.set(cacheKey, results, 60000); // 1 minute cache
    }
  }
  
  res.json(results);
}));

/**
 * GET /playlists/recent
 * Get recently modified playlists
 */
router.get('/recent', authMiddleware, requirePermission('ViewPlaylists'), asyncHandler(async (req, res) => {
  const { limit, offset } = req.pagination;
  const cacheKey = `playlists:recent:${limit}:${offset}`;
  
  let playlists = cache.get(cacheKey);
  if (!playlists || !config.performance.cacheEnabled) {
    const allPlaylists = dbOps.getRecentlyModifiedPlaylists(limit + offset);
    playlists = allPlaylists.slice(offset, offset + limit);
    if (config.performance.cacheEnabled) {
      cache.set(cacheKey, playlists, 60000); // 1 minute cache
    }
  }
  
  res.json(playlists);
}));

/**
 * POST /playlists
 * Create playlist
 */
router.post('/', authMiddleware, requirePermission('ManagePlaylists'), asyncHandler(async (req, res) => {
  // Invalidate cache
  if (config.performance.cacheEnabled) {
    cache.deletePattern('playlists:search:*');
    cache.deletePattern('playlists:recent:*');
  }
  
  const playlistData = {
    ...req.body,
    name: sanitizeString(req.body.name || '')
  };
  
  const newPlaylist = dbOps.createPlaylist(playlistData);
  res.json(newPlaylist);
}));

/**
 * PUT /playlists/:guid
 * Update playlist
 */
router.put('/:guid', validateGuid, authMiddleware, requirePermission('ManagePlaylists'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  
  const existingPlaylist = dbOps.getPlaylist(guid);
  if (!existingPlaylist) {
    return res.status(404).json({
      success: false,
      message: 'Playlist not found'
    });
  }
  
  // Invalidate cache
  if (config.performance.cacheEnabled) {
    cache.deletePattern('playlists:search:*');
    cache.deletePattern('playlists:recent:*');
    cache.delete(`playlist:${guid}`);
    cache.delete(`playlist:items:${guid}`);
  }
  
  const playlistData = {
    ...req.body,
    name: sanitizeString(req.body.name || '')
  };
  
  const updatedPlaylist = dbOps.updatePlaylist(guid, playlistData);
  res.json(updatedPlaylist);
}));

/**
 * DELETE /playlists/:guid
 * Delete playlist
 */
router.delete('/:guid', validateGuid, authMiddleware, requirePermission('ManagePlaylists'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  
  const deleted = dbOps.deletePlaylist(guid);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Playlist not found'
    });
  }
  
  // Invalidate cache
  if (config.performance.cacheEnabled) {
    cache.deletePattern('playlists:search:*');
    cache.deletePattern('playlists:recent:*');
    cache.delete(`playlist:${guid}`);
    cache.delete(`playlist:items:${guid}`);
  }
  
  res.json({
    success: true,
    message: 'Playlist deleted'
  });
}));

module.exports = router;

