const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateGuid, sanitizeString } = require('../middleware/validation');
const { authMiddleware, requirePermission } = require('../middleware/auth');

/**
 * GET /lists
 * Get all lists for current user
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const userGuid = req.user.guid;
  const lists = dbOps.getAllLists(userGuid);
  res.json(lists);
}));

/**
 * GET /lists/favorites
 * Get or create Favorites list, return its items (must be before :guid routes)
 */
router.get('/favorites', authMiddleware, asyncHandler(async (req, res) => {
  const userGuid = req.user.guid;
  const list = dbOps.getOrCreateFavoritesList(userGuid);
  const items = dbOps.getListItems(list.guid);
  res.json({ list, items });
}));

/**
 * GET /lists/check/:listGuid/:libraryItemGuid
 * Check if item is in list (must be before :guid routes)
 */
router.get('/check/:listGuid/:libraryItemGuid', authMiddleware, asyncHandler(async (req, res) => {
  const listGuid = parseInt(req.params.listGuid, 10);
  const libraryItemGuid = parseInt(req.params.libraryItemGuid, 10);
  const userGuid = req.user.guid;
  const list = dbOps.getList(listGuid);
  if (!list || list.created_by_user_guid !== userGuid) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }
  const inList = dbOps.isItemInList(listGuid, libraryItemGuid);
  res.json({ inList });
}));

/**
 * GET /lists/:guid/items
 * Get items in a list
 */
router.get('/:guid/items', validateGuid, authMiddleware, asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const userGuid = req.user.guid;
  const list = dbOps.getList(parseInt(guid, 10));
  if (!list || list.created_by_user_guid !== userGuid) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }
  const items = dbOps.getListItems(list.guid);
  res.json(items);
}));

/**
 * PUT /lists/:guid
 * Update list name and description
 */
router.put('/:guid', validateGuid, authMiddleware, requirePermission('ManageLists'), asyncHandler(async (req, res) => {
  const listGuid = parseInt(req.params.guid, 10);
  const userGuid = req.user.guid;
  const list = dbOps.getList(listGuid);
  if (!list || list.created_by_user_guid !== userGuid) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }
  const name = sanitizeString(req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ success: false, message: 'List name is required' });
  }
  const description = sanitizeString(req.body.description || '') || null;
  const updated = dbOps.updateList(listGuid, { name, description });
  if (!updated) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }
  res.json(updated);
}));

/**
 * POST /lists
 * Create new list
 */
router.post('/', authMiddleware, requirePermission('ManageLists'), asyncHandler(async (req, res) => {
  const userGuid = req.user.guid;
  const name = sanitizeString(req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ success: false, message: 'List name is required' });
  }
  if (dbOps.listNameExists(userGuid, name)) {
    return res.status(400).json({ success: false, message: 'List with this name already exists' });
  }
  const list = dbOps.createList({
    name,
    description: sanitizeString(req.body.description || '') || null,
    created_by_user_guid: userGuid,
    is_favorites: 0
  });
  res.status(201).json(list);
}));

/**
 * POST /lists/:guid/items
 * Add library item to list (any authenticated user can add to own lists)
 */
router.post('/:guid/items', validateGuid, authMiddleware, asyncHandler(async (req, res) => {
  const listGuid = parseInt(req.params.guid, 10);
  const libraryItemGuid = parseInt(req.body.libraryItemGuid || req.body.guid, 10);
  const userGuid = req.user.guid;
  const list = dbOps.getList(listGuid);
  if (!list || list.created_by_user_guid !== userGuid) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }
  const result = dbOps.addItemToList(listGuid, libraryItemGuid);
  if (result === 'updated') {
    return res.status(200).json({ success: true, message: 'Item moved to top', alreadyInList: true });
  }
  res.status(201).json({ success: true, message: 'Item added to list' });
}));

/**
 * DELETE /lists/:guid/items/:libraryItemGuid
 * Remove item from list (any authenticated user can remove from own lists)
 */
router.delete('/:guid/items/:libraryItemGuid', validateGuid, authMiddleware, asyncHandler(async (req, res) => {
  const listGuid = parseInt(req.params.guid, 10);
  const libraryItemGuid = parseInt(req.params.libraryItemGuid, 10);
  const userGuid = req.user.guid;
  const list = dbOps.getList(listGuid);
  if (!list || list.created_by_user_guid !== userGuid) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }
  dbOps.removeItemFromList(listGuid, libraryItemGuid);
  res.json({ success: true, message: 'Item removed from list' });
}));

/**
 * DELETE /lists/:guid
 * Delete list (not Favorites)
 */
router.delete('/:guid', validateGuid, authMiddleware, requirePermission('ManageLists'), asyncHandler(async (req, res) => {
  const listGuid = parseInt(req.params.guid, 10);
  const userGuid = req.user.guid;
  const list = dbOps.getList(listGuid);
  if (!list || list.created_by_user_guid !== userGuid) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }
  if (list.is_favorites === 1) {
    return res.status(400).json({ success: false, message: 'Cannot delete Favorites list' });
  }
  const deleted = dbOps.deleteList(listGuid);
  if (!deleted) {
    return res.status(404).json({ success: false, message: 'List not found' });
  }
  res.json({ success: true, message: 'List deleted' });
}));

module.exports = router;
