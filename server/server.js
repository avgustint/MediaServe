const express = require('express');
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

// Create Express app
const app = express();

// Middleware
app.use(express.json({ limit: config.bodySizeLimit }));
app.use(express.urlencoded({ extended: true, limit: config.bodySizeLimit }));
app.use(corsMiddleware);

// Load initial data (for WebSocket)
const data = loadData();

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Create HTTP server
const server = require('http').createServer(app);

// Setup WebSocket server
setupWebSocket(server, data.library);

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
