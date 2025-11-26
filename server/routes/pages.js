const express = require('express');
const router = express.Router();
const dbOps = require('../dbOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const { validateGuid } = require('../middleware/validation');
const { authMiddleware, requirePermission } = require('../middleware/auth');

/**
 * GET /pages
 * Get all pages
 */
router.get('/', authMiddleware, requirePermission('ViewPages'), asyncHandler(async (req, res) => {
  const pages = dbOps.getAllPages();
  res.json(pages);
}));

/**
 * GET /pages/library-item/:libraryItemGuid
 * Get all pages for a specific library item
 * NOTE: This route must be defined BEFORE /pages/:guid to ensure proper matching
 */
router.get('/library-item/:libraryItemGuid', (req, res, next) => {
  // Custom validation for libraryItemGuid parameter
  const libraryItemGuid = parseInt(req.params.libraryItemGuid, 10);
  if (isNaN(libraryItemGuid) || libraryItemGuid <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid libraryItemGuid'
    });
  }
  req.params.libraryItemGuid = libraryItemGuid;
  next();
}, authMiddleware, requirePermission('ViewPages'), asyncHandler(async (req, res) => {
  const { libraryItemGuid } = req.params;
  const pages = dbOps.getLibraryItemPages(libraryItemGuid);
  // Format pages to match Page interface (guid, content)
  const formattedPages = pages.map((page, index) => ({
    guid: page.guid,
    content: page.content || ''
  }));
  res.json(formattedPages);
}));

/**
 * GET /pages/:guid
 * Get single page
 */
router.get('/:guid', validateGuid, authMiddleware, requirePermission('ViewPages'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const page = dbOps.getPage(guid);
  if (!page) {
    return res.status(404).json(null);
  }
  res.json(page);
}));

/**
 * POST /pages
 * Create new page
 */
router.post('/', authMiddleware, requirePermission('ManagePages'), asyncHandler(async (req, res) => {
  const pageData = {
    content: req.body.content || ''
  };
  const newPage = dbOps.createPage(pageData.content);
  res.json(newPage);
}));

/**
 * PUT /pages/:guid
 * Update page
 */
router.put('/:guid', validateGuid, authMiddleware, requirePermission('ManagePages'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const existingPage = dbOps.getPage(guid);
  if (!existingPage) {
    return res.status(404).json({
      success: false,
      message: 'Page not found'
    });
  }
  
  const updatedPage = dbOps.updatePage(guid, req.body.content || '');
  res.json(updatedPage);
}));

/**
 * DELETE /pages/:guid
 * Delete page
 */
router.delete('/:guid', validateGuid, authMiddleware, requirePermission('ManagePages'), asyncHandler(async (req, res) => {
  const { guid } = req.params;
  const deleted = dbOps.deletePage(guid);
  if (!deleted) {
    return res.status(404).json({
      success: false,
      message: 'Page not found'
    });
  }
  res.json({
    success: true,
    message: 'Page deleted'
  });
}));

module.exports = router;

