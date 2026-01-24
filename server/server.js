const express = require('express');
const path = require('path');
const fs = require('fs');
const { loadData } = require('./dataLoader');
const { setupWebSocket } = require('./websocketHandler');
const config = require('./config');

// Import middleware
const corsMiddleware = require('./middleware/cors');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const libraryRoutes = require('./routes/library');
const playlistRoutes = require('./routes/playlist');
const playlistsRoutes = require('./routes/playlists');
const usersRoutes = require('./routes/users');
const rolesRoutes = require('./routes/roles');
const permissionsRoutes = require('./routes/permissions');
const settingsRoutes = require('./routes/settings');
const pagesRoutes = require('./routes/pages');
const tagsRoutes = require('./routes/tags');
const collectionsRoutes = require('./routes/collections');
const locationsRoutes = require('./routes/locations');
const { router: keyboardRoutes } = require('./routes/keyboard');

// Create Express app
const app = express();

// Middleware
app.use(express.json({ limit: config.bodySizeLimit }));
app.use(express.urlencoded({ extended: true, limit: config.bodySizeLimit }));
app.use(corsMiddleware);

// Ensure videos directory exists
const videosDir = path.join(__dirname, 'data', 'videos');
if (!fs.existsSync(videosDir)) {
  fs.mkdirSync(videosDir, { recursive: true });
  console.log('Created videos directory:', videosDir);
}

// Load initial data (for WebSocket)
const data = loadData();

// Serve admin app static files (before API routes to allow Angular routes to work)
const adminAppPath = path.join(__dirname, '../admin-v2/dist/media-player-admin-v2/browser');
app.use(express.static(adminAppPath));

// Serve video files as static files
app.use('/videos', express.static(videosDir, {
  setHeaders: (res, filePath) => {
    // Set appropriate MIME types for video files
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogv': 'video/ogg',
      '.ogg': 'video/ogg',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska'
    };
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
  }
}));

// Middleware to handle browser requests to routes that are both API and Angular routes
// Routes like /settings, /playlist are both API endpoints and Angular pages
app.use((req, res, next) => {
  // Only handle GET requests
  if (req.method !== 'GET') {
    return next();
  }
  
  // Check if this is a browser page request (not an API call)
  const acceptHeader = req.get('Accept') || '';
  const isBrowserRequest = acceptHeader.includes('text/html');
  
  if (!isBrowserRequest) {
    return next(); // Let API calls go through to API routes
  }
  
  // Routes that exist in both API and Angular app
  // If it's a browser request to these exact paths (no sub-paths), serve Angular app
  const angularRoutes = ['/settings', '/playlist', '/editor', '/display', '/user', '/login'];
  const isExactAngularRoute = angularRoutes.includes(req.path);
  
  if (isExactAngularRoute) {
    // Browser is requesting an Angular page - serve the app
    return res.sendFile(path.join(adminAppPath, 'index.html'));
  }
  
  // For other routes, let them continue to API routes or fallback
  next();
});

// Routes
app.use('/', authRoutes); // Login and /me routes are defined in authRoutes
app.use('/library', libraryRoutes);
app.use('/playlist', playlistRoutes);
app.use('/playlists', playlistsRoutes);
app.use('/users', usersRoutes);
app.use('/roles', rolesRoutes);
app.use('/permissions', permissionsRoutes);
app.use('/settings', settingsRoutes);
app.use('/pages', pagesRoutes);
app.use('/tags', tagsRoutes);
app.use('/collections', collectionsRoutes);
app.use('/locations', locationsRoutes);
app.use('/api/keyboard', keyboardRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html for Angular client-side routing
// This serves index.html for browser page requests that don't match API routes
app.get('*', (req, res, next) => {
  // Check if this is a browser page request (not an API call)
  const acceptHeader = req.get('Accept') || '';
  const isBrowserRequest = acceptHeader.includes('text/html');
  
  if (isBrowserRequest) {
    // Browser is requesting a page - serve Angular app
    // Angular router will handle the client-side routing
    res.sendFile(path.join(adminAppPath, 'index.html'));
  } else {
    // API call or other non-HTML request - let it fall through to 404 handler
    next();
  }
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Create HTTP server
const server = require('http').createServer(app);

// Setup WebSocket server (must be before server.listen)
// The WebSocket server handles upgrade requests automatically
setupWebSocket(server, data.library);

// Log WebSocket setup
console.log('WebSocket server attached to HTTP server');

// Start the server
const PORT = config.port;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/playlist (or /playlist?guid=X)`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/playlist/items (or /playlist/items?guid=X) - optimized playlist items`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/playlists/search?q=term (GET)`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/library`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/login (POST)`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/me (GET)`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
  console.log(`WebSocket server available at ws://localhost:${PORT}`);
});
