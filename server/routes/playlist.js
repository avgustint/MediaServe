const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const cache = require('../utils/cache');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateGuid } = require('../middleware/validation');
const config = require('../config');

/**
 * GET /playlist
 * Get playlist (last updated or by guid)
 */
router.get('/', asyncHandler(async (req, res) => {
  const requestedGuid = req.query.guid ? parseInt(req.query.guid, 10) : null;
  
  let selectedPlaylist = null;
  let cacheKey = null;
  
  if (requestedGuid) {
    if (isNaN(requestedGuid)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GUID'
      });
    }
    cacheKey = `playlist:${requestedGuid}`;
    selectedPlaylist = cache.get(cacheKey);
    
    if (!selectedPlaylist || !config.performance.cacheEnabled) {
      selectedPlaylist = dbOps.getPlaylist(requestedGuid);
      if (selectedPlaylist && config.performance.cacheEnabled) {
        cache.set(cacheKey, selectedPlaylist);
      }
    }
  } else {
    cacheKey = 'playlist:last';
    selectedPlaylist = cache.get(cacheKey);
    
    if (!selectedPlaylist || !config.performance.cacheEnabled) {
      selectedPlaylist = dbOps.getLastUpdatedPlaylist();
      if (selectedPlaylist && config.performance.cacheEnabled) {
        cache.set(cacheKey, selectedPlaylist);
      }
    }
  }
  
  if (!selectedPlaylist) {
    return res.status(404).json({
      success: false,
      message: requestedGuid ? 'Playlist not found' : 'No playlists available'
    });
  }
  
  res.json(selectedPlaylist);
}));

/**
 * GET /playlist/items
 * Get playlist items (optimized with JOIN)
 */
router.get('/items', asyncHandler(async (req, res) => {
  const requestedGuid = req.query.guid ? parseInt(req.query.guid, 10) : null;
  
  let playlistGuid = requestedGuid;
  if (!playlistGuid) {
    const lastPlaylist = dbOps.getLastUpdatedPlaylist();
    if (!lastPlaylist) {
      return res.status(404).json({
        success: false,
        message: 'No playlists available'
      });
    }
    playlistGuid = lastPlaylist.guid;
  }
  
  const cacheKey = `playlist:items:${playlistGuid}`;
  let items = cache.get(cacheKey);
  
  if (!items || !config.performance.cacheEnabled) {
    items = dbOps.getPlaylistItems(playlistGuid);
    if (items === null) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found'
      });
    }
    if (config.performance.cacheEnabled) {
      cache.set(cacheKey, items);
    }
  }
  
  res.json(items);
}));

module.exports = router;

