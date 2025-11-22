const fs = require('fs');
const path = require('path');
const { initDatabase, closeDatabase } = require('./database');

const dataFolder = path.join(__dirname, 'data');

/**
 * Loads JSON data from a file
 */
function loadJsonFile(filename) {
  const filePath = path.join(dataFolder, filename);
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Migrates all JSON data to SQLite database
 */
function migrate() {
  console.log('Starting migration from JSON files to SQLite...\n');

  const db = initDatabase();

  try {
    // Start transaction for atomic migration
    const transaction = db.transaction(() => {
      // Clear existing data (optional - comment out if you want to keep existing data)
      db.exec(`
        DELETE FROM playlist_items;
        DELETE FROM playlists;
        DELETE FROM library_items;
        DELETE FROM role_permissions;
        DELETE FROM permissions;
        DELETE FROM roles;
        DELETE FROM users;
      `);

      // Migrate users
      console.log('Migrating users...');
      const users = loadJsonFile('users.json');
      const insertUser = db.prepare(`
        INSERT INTO users (guid, name, email, username, password, role, locale)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      users.forEach(user => {
        insertUser.run(
          user.guid,
          user.name,
          user.email,
          user.username,
          user.password,
          user.role,
          user.locale || null
        );
      });
      console.log(`  Migrated ${users.length} users`);

      // Migrate roles
      console.log('Migrating roles...');
      const roles = loadJsonFile('roles.json');
      const insertRole = db.prepare(`
        INSERT INTO roles (guid, name)
        VALUES (?, ?)
      `);
      roles.forEach(role => {
        insertRole.run(role.guid, role.name);
      });
      console.log(`  Migrated ${roles.length} roles`);

      // Migrate permissions
      console.log('Migrating permissions...');
      const permissions = loadJsonFile('permisions.json');
      const insertPermission = db.prepare(`
        INSERT INTO permissions (guid, name, description)
        VALUES (?, ?, ?)
      `);
      permissions.forEach(permission => {
        insertPermission.run(
          permission.guid,
          permission.name,
          permission.description || null
        );
      });
      console.log(`  Migrated ${permissions.length} permissions`);

      // Migrate role-permissions relationships
      console.log('Migrating role-permissions...');
      const insertRolePermission = db.prepare(`
        INSERT INTO role_permissions (role_guid, permission_guid)
        VALUES (?, ?)
      `);
      roles.forEach(role => {
        if (role.permissions && Array.isArray(role.permissions)) {
          role.permissions.forEach(permissionGuid => {
            insertRolePermission.run(role.guid, permissionGuid);
          });
        }
      });
      console.log('  Migrated role-permission relationships');

      // Migrate library items
      console.log('Migrating library items...');
      const library = loadJsonFile('library.json');
      const insertLibraryItem = db.prepare(`
        INSERT INTO library_items (guid, name, type, content, description)
        VALUES (?, ?, ?, ?, ?)
      `);
      library.forEach(item => {
        // Serialize content to JSON string if it's an array/object
        const contentStr = typeof item.content === 'string'
          ? item.content
          : JSON.stringify(item.content);
        
        insertLibraryItem.run(
          item.guid,
          item.name,
          item.type,
          contentStr,
          item.description || null
        );
      });
      console.log(`  Migrated ${library.length} library items`);

      // Migrate playlists
      console.log('Migrating playlists...');
      const playlists = loadJsonFile('playlists.json');
      const insertPlaylist = db.prepare(`
        INSERT INTO playlists (guid, name, description, updated)
        VALUES (?, ?, ?, ?)
      `);
      const insertPlaylistItem = db.prepare(`
        INSERT INTO playlist_items (playlist_guid, library_item_guid, page, description, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `);

      playlists.forEach(playlist => {
        insertPlaylist.run(
          playlist.guid,
          playlist.name,
          playlist.description || null,
          playlist.updated || null
        );

        // Migrate playlist items
        if (playlist.items && Array.isArray(playlist.items)) {
          playlist.items.forEach((item, index) => {
            insertPlaylistItem.run(
              playlist.guid,
              item.guid,
              item.page || null,
              item.description || null,
              index
            );
          });
        }
      });
      console.log(`  Migrated ${playlists.length} playlists with their items`);

      console.log('\nMigration completed successfully!');
    });

    transaction();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    closeDatabase();
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate };
