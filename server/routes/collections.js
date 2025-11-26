const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateGuid } = require('../middleware/validation');
const { authMiddleware, requirePermission } = require('../middleware/auth');

/**
 * GET /collections
 * Get all collections
 */
router.get('/', authMiddleware, requirePermission('ViewCollections'), asyncHandler(async (req, res) => {
  const collections = dbOps.getAllCollections();
  res.json(collections);
}));

/**
 * GET /collections/:guid
 * Get single collection
 */
router.get('/:guid', validateGuid, authMiddleware, requirePermission('ViewCollections'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const collection = dbOps.getCollection(guid);
  if (!collection) {
    return res.status(404).json(null);
  }
  res.json(collection);
}));

/**
 * GET /collections/:guid/items
 * Get all items in a collection
 */
router.get('/:guid/items', validateGuid, authMiddleware, requirePermission('ViewCollections'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const items = dbOps.getCollectionItems(guid);
  res.json(items);
}));

/**
 * POST /collections
 * Create new collection
 */
router.post('/', authMiddleware, requirePermission('ManageCollections'), asyncHandler(async (req, res) => {
  const collectionData = {
    title: req.body.title || '',
    label: req.body.label || null,
    year: req.body.year || null,
    publisher: req.body.publisher || null,
    source: req.body.source || null
  };
  const newCollection = dbOps.createCollection(collectionData);
  res.json(newCollection);
}));

/**
 * PUT /collections/:guid
 * Update collection
 */
router.put('/:guid', validateGuid, authMiddleware, requirePermission('ManageCollections'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const existingCollection = dbOps.getCollection(guid);
  if (!existingCollection) {
    return res.status(404).json({
      success: false,
      message: 'Collection not found'
    });
  }
  
  const collectionData = {
    title: req.body.title !== undefined ? req.body.title : existingCollection.title,
    label: req.body.label !== undefined ? req.body.label : existingCollection.label,
    year: req.body.year !== undefined ? req.body.year : existingCollection.year,
    publisher: req.body.publisher !== undefined ? req.body.publisher : existingCollection.publisher,
    source: req.body.source !== undefined ? req.body.source : existingCollection.source
  };
  
  const updatedCollection = dbOps.updateCollection(guid, collectionData);
  res.json(updatedCollection);
}));

/**
 * DELETE /collections/:guid
 * Delete collection
 */
router.delete('/:guid', validateGuid, authMiddleware, requirePermission('ManageCollections'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const deleted = dbOps.deleteCollection(guid);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Collection not found'
    });
  }
  res.json({
    success: true,
    message: 'Collection deleted'
  });
}));

/**
 * POST /collections/:guid/items
 * Add library item to collection
 */
router.post('/:guid/items', validateGuid, authMiddleware, requirePermission('ManageCollections'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const { library_item_guid, collection_number, collection_page, author } = req.body;
  
  if (!library_item_guid) {
    return res.status(400).json({
      success: false,
      message: 'library_item_guid is required'
    });
  }
  
  const itemData = {
    collection_number: collection_number || null,
    collection_page: collection_page || null,
    author: author || null
  };
  
  const collectionItem = dbOps.addCollectionItem(guid, library_item_guid, itemData);
  res.json(collectionItem);
}));

/**
 * DELETE /collections/:guid/items/:library_item_guid
 * Remove library item from collection
 */
router.delete('/:guid/items/:library_item_guid', validateGuid, authMiddleware, requirePermission('ManageCollections'), asyncHandler(async (req, res) => {
  const { guid, library_item_guid } = req.params;
  const libraryItemGuid = parseInt(library_item_guid, 10);
  
  if (isNaN(libraryItemGuid)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid library_item_guid'
    });
  }
  
  const deleted = dbOps.removeCollectionItem(guid, libraryItemGuid);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Collection item not found'
    });
  }
  res.json({
    success: true,
    message: 'Item removed from collection'
  });
}));

module.exports = router;

