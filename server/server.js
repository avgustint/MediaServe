const { loadData } = require('./dataLoader');
const { setupHttpEndpoints } = require('./httpEndpoints');
const { setupWebSocket } = require('./websocketHandler');

// Load all data files
const data = loadData();

// Create HTTP server with endpoints
const server = setupHttpEndpoints(data);

// Setup WebSocket server
setupWebSocket(server, data.library);

// Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/playlist (or /playlist?guid=X)`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/playlist/items (or /playlist/items?guid=X) - optimized playlist items`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/playlists/search?q=term (GET)`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/library`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/login (POST)`);
  console.log(`HTTP endpoint available at http://localhost:${PORT}/me (GET)`);
  console.log(`WebSocket server available at ws://localhost:${PORT}`);
});
