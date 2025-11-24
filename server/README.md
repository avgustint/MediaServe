# MediaServer - Server

Node.js backend server for the MediaServer system. Provides REST API endpoints, WebSocket server, SQLite database management, and HDMI CEC integration for TV control.

## 📋 Features

- **RESTful API**: Complete CRUD operations for users, roles, permissions, playlists, and library items
- **WebSocket Server**: Real-time bidirectional communication with admin and client applications
- **SQLite Database**: Persistent data storage with automatic schema initialization
- **Authentication & Authorization**: Session-based auth with role-based access control (RBAC)
- **Permission System**: Fine-grained permission management
- **HDMI CEC Integration**: TV control via `cec-client` commands
- **Multi-client Synchronization**: Real-time sync of selections across admin instances

## 🚀 Getting Started

### Prerequisites

- Node.js v18 or higher
- npm or yarn
- SQLite3 (included via `better-sqlite3`)
- HDMI CEC tools (optional, for TV control)

### Installation

```bash
npm install
```

### Running the Server

```bash
npm start
```

The server will start on port `8080` by default. You can change the port using the `PORT` environment variable:

```bash
PORT=3000 npm start
```

### Database Initialization

On first run, the server automatically:
- Creates the SQLite database at `data/mediaserver.db`
- Initializes all tables (users, roles, permissions, library_items, playlists, etc.)
- Creates default admin user (username: `admin`, password: `admin`)
- Creates default roles (admin, user)
- Creates default permissions
- Assigns permissions to roles

⚠️ **Security**: Change the default admin password immediately!

## 📁 Project Structure

```
server/
├── server.js              # Main server entry point
├── httpEndpoints.js       # REST API endpoints
├── websocketHandler.js    # WebSocket server and message handling
├── database.js            # Database initialization and setup
├── dbOperations.js        # Database CRUD operations
├── dataLoader.js          # Data loading utilities
├── data/
│   └── mediaserver.db     # SQLite database file
└── package.json
```

## 🔌 API Endpoints

### Authentication

#### `POST /login`
Authenticate a user and create a session.

**Request Body:**
```json
{
  "username": "admin",
  "password": "hashed_password_md5"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_guid",
  "user": {
    "guid": "user_guid",
    "username": "admin",
    "name": "Administrator",
    "email": "admin@example.com",
    "role": {
      "guid": "role_guid",
      "name": "admin",
      "is_admin": 1
    },
    "permissions": ["ViewPlaylist", "ViewEditor", ...],
    "locale": "en"
  }
}
```

#### `GET /me`
Get current user information (requires session cookie).

**Response:** Same as `/login` user object.

### Users

#### `GET /users`
Get all users (admin only).

#### `GET /users?username=username`
Get user by username.

#### `POST /users`
Create a new user (admin only).

**Request Body:**
```json
{
  "username": "newuser",
  "password": "hashed_password_md5",
  "name": "New User",
  "email": "user@example.com",
  "role": "role_guid",
  "locale": "en"
}
```

#### `PUT /users/:guid`
Update a user (admin only, or own profile).

**Request Body:** (all fields optional)
```json
{
  "name": "Updated Name",
  "email": "newemail@example.com",
  "password": "new_hashed_password_md5",
  "currentPassword": "current_hashed_password_md5",
  "role": "role_guid",
  "locale": "en"
}
```

#### `DELETE /users/:guid`
Delete a user (admin only).

### Roles

#### `GET /roles`
Get all roles.

#### `GET /roles/:guid`
Get role by GUID.

#### `POST /roles`
Create a new role (admin only).

**Request Body:**
```json
{
  "name": "Role Name",
  "is_admin": 0
}
```

#### `PUT /roles/:guid`
Update a role (admin only).

**Request Body:**
```json
{
  "name": "Updated Role Name"
}
```

#### `DELETE /roles/:guid`
Delete a role (admin only, cannot delete admin role).

#### `GET /roles/:guid/permissions`
Get permissions for a role.

#### `PUT /roles/:guid/permissions`
Update permissions for a role (admin only).

**Request Body:**
```json
{
  "permissions": ["permission_guid1", "permission_guid2", ...]
}
```

### Permissions

#### `GET /permissions`
Get all permissions.

#### `POST /permissions`
Create a new permission (admin only).

**Request Body:**
```json
{
  "name": "PermissionName",
  "description": "Permission description"
}
```

### Library Items

#### `GET /library`
Get all library items.

#### `GET /library/:guid`
Get library item by GUID.

#### `POST /library`
Create a new library item (requires permission).

**Request Body:**
```json
{
  "name": "Item Name",
  "type": "text" | "image" | "url",
  "content": "content string",
  "pages": [
    {
      "content": "page 1 content"
    },
    {
      "content": "page 2 content"
    }
  ]
}
```

#### `PUT /library/:guid`
Update a library item (requires permission).

**Request Body:** Same as POST, all fields optional.

#### `DELETE /library/:guid`
Delete a library item (requires permission).

### Playlists

#### `GET /playlists`
Get all playlists.

#### `GET /playlists/search?q=search_term`
Search playlists by name.

#### `GET /playlists/:guid`
Get playlist by GUID.

#### `POST /playlists`
Create a new playlist (requires permission).

**Request Body:**
```json
{
  "name": "Playlist Name",
  "items": ["library_item_guid1", "library_item_guid2", ...]
}
```

#### `PUT /playlists/:guid`
Update a playlist (requires permission).

**Request Body:**
```json
{
  "name": "Updated Playlist Name",
  "items": ["library_item_guid1", "library_item_guid2", ...]
}
```

#### `DELETE /playlists/:guid`
Delete a playlist (requires permission).

#### `GET /playlist?guid=playlist_guid`
Get playlist items (legacy endpoint).

#### `GET /playlist/items?guid=playlist_guid`
Get optimized playlist items.

## 🔌 WebSocket Protocol

### Connection

Connect to `ws://localhost:8080` (or your server URL).

### Message Types

#### From Client to Server

##### `Change`
Request to change displayed content.

```json
{
  "type": "Change",
  "guid": "library_item_guid",
  "page": 1
}
```

##### `SelectPlaylist`
Select a playlist (admin only, syncs across instances).

```json
{
  "type": "SelectPlaylist",
  "guid": "playlist_guid"
}
```

##### `SelectLibraryItem`
Select a library item (admin only, syncs across instances).

```json
{
  "type": "SelectLibraryItem",
  "guid": "library_item_guid",
  "page": 1
}
```

##### `Action`
Send HDMI CEC command to TV (admin only, requires `ViewDisplay` permission).

```json
{
  "type": "Action",
  "actionType": "powerOn" | "powerOff" | "volumeUp" | "volumeDown"
}
```

##### `Clear`
Clear the display.

```json
{
  "type": "Clear"
}
```

#### From Server to Client

##### `text`
Display text content.

```json
{
  "type": "text",
  "content": "Text to display"
}
```

##### `image`
Display image (base64 encoded).

```json
{
  "type": "image",
  "content": "data:image/png;base64,iVBORw0KGgo..."
}
```

##### `url`
Display URL in iframe.

```json
{
  "type": "url",
  "content": "https://example.com"
}
```

##### `SelectPlaylist`
Sync playlist selection (admin only).

```json
{
  "type": "SelectPlaylist",
  "guid": "playlist_guid"
}
```

##### `SelectLibraryItem`
Sync library item selection (admin only).

```json
{
  "type": "SelectLibraryItem",
  "guid": "library_item_guid",
  "page": 1
}
```

### Client Types

The server distinguishes between:
- **Admin clients**: Receive sync messages (`SelectPlaylist`, `SelectLibraryItem`) and can send `Action` messages
- **Display clients**: Receive content messages (`text`, `image`, `url`)

### Initial State Sync

When a new admin client connects, the server automatically sends:
1. `SelectPlaylist` message (if a playlist is selected)
2. `SelectLibraryItem` message (if an item is selected)
3. `Change` message with current content (if content is being displayed)

## 🗄️ Database Schema

### Tables

- **users**: User accounts
- **roles**: User roles
- **permissions**: System permissions
- **role_permissions**: Role-permission mappings
- **library_items**: Content library items
- **library_item_pages**: Multi-page library item content
- **playlists**: Playlist definitions
- **playlist_items**: Playlist-item mappings

See `database.js` for complete schema definitions.

## 🔐 Authentication & Authorization

### Session Management

- Sessions are stored in memory (session ID → user GUID mapping)
- Session cookies are sent to clients on successful login
- Sessions expire on server restart (in-memory storage)

### Permission System

Permissions control access to:
- Routes in admin app (via `permissionGuard`)
- API endpoints (checked in `httpEndpoints.js`)
- Features (checked via `UserService.hasPermission()`)

### Default Permissions

- `ViewPlaylist`: View playlists
- `ViewLibraryEditor`: Edit library items
- `ViewPlaylistEditor`: Edit playlists
- `ViewSettings`: Access settings
- `ViewDisplay`: Access display control
- And more...

## 📺 HDMI CEC Integration

The server supports TV control via HDMI CEC using the `cec-client` command.

### Supported Actions

- `powerOn`: Turn TV on
- `powerOff`: Turn TV off
- `volumeUp`: Increase volume
- `volumeDown`: Decrease volume

### Requirements

- `cec-client` must be installed and accessible in PATH
- HDMI CEC must be enabled on the TV
- Proper HDMI connection

### Implementation

Commands are executed via `child_process.exec()` in `websocketHandler.js`.

## 🔧 Configuration

### Environment Variables

- `PORT`: Server port (default: `8080`)

### CORS

CORS is configured to allow:
- Origin: `http://localhost:4200` (admin app)
- Methods: `GET, POST, PUT, DELETE, OPTIONS`
- Headers: `Content-Type`
- Credentials: `true`

Modify `setCorsHeaders()` in `httpEndpoints.js` for different origins.

## 🐛 Troubleshooting

### Database Issues

- **Database locked**: Ensure only one server instance is running
- **Schema errors**: Delete `data/mediaserver.db` and restart (will recreate)
- **Migration issues**: Check `database.js` for schema changes

### WebSocket Issues

- **Connection refused**: Check server is running and port is correct
- **Messages not received**: Check message format matches protocol
- **Sync not working**: Verify admin client is authenticated

### HDMI CEC Issues

- **Command not found**: Install `cec-client` package
- **No response**: Check HDMI CEC connection and TV settings
- **Permission denied**: Check `cec-client` executable permissions

## 📝 Development

### Adding New Endpoints

1. Add route handler in `httpEndpoints.js`
2. Add database operations in `dbOperations.js` if needed
3. Update this README with endpoint documentation

### Adding New WebSocket Messages

1. Add message handler in `websocketHandler.js`
2. Update message type in client/admin services
3. Update this README with message format

## 📦 Dependencies

- `better-sqlite3`: SQLite database driver
- `ws`: WebSocket server implementation

## 📄 License

ISC
