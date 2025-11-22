const fs = require('fs');
const path = require('path');

/**
 * Loads all JSON data files needed by the server
 * @returns {Object} Object containing playlists, library, users, roles, and permissions
 */
function loadData() {
  // Load playlists from JSON file
  let playlists = [];
  try {
    const playlistsData = fs.readFileSync(path.join(__dirname, 'data/playlists.json'), 'utf8');
    playlists = JSON.parse(playlistsData);
    console.log(`Loaded ${playlists.length} playlists from playlists.json`);
    playlists.forEach((playlist) => {
      console.log(`  - "${playlist.name}" (guid: ${playlist.guid}) with ${playlist.items.length} items`);
    });
  } catch (error) {
    console.error('Error loading playlists.json:', error.message);
    process.exit(1);
  }

  // Load library from JSON file
  let library = [];
  try {
    const libraryData = fs.readFileSync(path.join(__dirname, 'data/library.json'), 'utf8');
    library = JSON.parse(libraryData);
    console.log(`Loaded ${library.length} items from library.json`);
  } catch (error) {
    console.error('Error loading library.json:', error.message);
    process.exit(1);
  }

  // Load users from JSON file
  let users = [];
  try {
    const usersData = fs.readFileSync(path.join(__dirname, 'data/users.json'), 'utf8');
    users = JSON.parse(usersData);
    console.log(`Loaded ${users.length} users from users.json`);
  } catch (error) {
    console.error('Error loading users.json:', error.message);
    process.exit(1);
  }

  // Load roles from JSON file
  let roles = [];
  try {
    const rolesData = fs.readFileSync(path.join(__dirname, 'data/roles.json'), 'utf8');
    roles = JSON.parse(rolesData);
    console.log(`Loaded ${roles.length} roles from roles.json`);
  } catch (error) {
    console.error('Error loading roles.json:', error.message);
    process.exit(1);
  }

  // Load permissions from JSON file
  let permissions = [];
  try {
    const permissionsData = fs.readFileSync(path.join(__dirname, 'data/permisions.json'), 'utf8');
    permissions = JSON.parse(permissionsData);
    console.log(`Loaded ${permissions.length} permissions from permisions.json`);
  } catch (error) {
    console.error('Error loading permisions.json:', error.message);
    process.exit(1);
  }

  return {
    playlists,
    library,
    users,
    roles,
    permissions
  };
}

module.exports = { loadData };

