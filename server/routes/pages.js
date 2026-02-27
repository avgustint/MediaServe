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
  const formattedPages = pages.map((page) => {
    let css = undefined;
    if (page.css) {
      try {
        css = typeof page.css === 'string' ? JSON.parse(page.css) : page.css;
      } catch (e) {
        css = undefined;
      }
    }
    const duration = page.duration != null && !isNaN(parseInt(page.duration, 10)) ? parseInt(page.duration, 10) : null;
    return {
      guid: page.guid,
      content: page.content || '',
      type: page.type || 'text',
      css,
      duration
    };
  });
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
  const content = req.body.content || '';
  const type = req.body.type || 'text';
  const css = req.body.css !== undefined ? req.body.css : null;
  const duration = req.body.duration !== undefined ? req.body.duration : null;
  const newPage = dbOps.createPage(content, type, css, duration);
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
  
  const content = req.body.content !== undefined ? req.body.content : (existingPage.content || '');
  const rawType = req.body.type;
  const type = (rawType !== undefined && rawType !== null && String(rawType).trim() !== '') 
    ? String(rawType).trim() 
    : (existingPage.type || 'text');
  const css = req.body.css !== undefined ? req.body.css : existingPage.css;
  const duration = req.body.duration !== undefined ? req.body.duration : existingPage.duration;
  const updatedPage = dbOps.updatePage(guid, content, type, css, duration);
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

