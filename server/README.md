# MediaServer - Server

Node.js backend server for the MediaServer system. Provides REST API endpoints, WebSocket server for real-time communication, SQLite database management, video file serving, and HDMI CEC integration for TV control.

## Features

- **RESTful API**: Complete CRUD operations for users, roles, permissions, playlists, library items, collections, tags, locations, and pages
- **WebSocket Server**: Real-time bidirectional communication with admin and client applications
- **SQLite Database**: Persistent data storage with automatic schema initialization and migrations
- **Authentication & Authorization**: Session-based auth with role-based access control (RBAC)
- **Permission System**: Fine-grained permission management with route-level enforcement
- **Multi-Location Support**: Content routing to specific displays via location assignments
- **HDMI CEC Integration**: TV control via `cec-client` commands (power, volume)
- **Multi-Admin Synchronization**: Real-time sync of playlist, item, page, and chord selections across admin instances
- **Content Visibility Control**: Show/hide content on displays without losing the current selection
- **CSS Merging**: Per-item and per-page CSS properties merged and delivered to clients
- **Chord Transposition**: Server-side chord transposition for text content
- **Video File Serving**: Upload and serve video files from the `data/videos/` directory
- **Library Item Duplication**: Deep copy of items including all pages

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm
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

The server starts on port `8080` by default. Override with the `PORT` environment variable:

```bash
PORT=3000 npm start
```

### Database Initialization

On first run, the server automatically:
- Creates the SQLite database at `data/mediaserver.db`
- Initializes all tables
- Creates default admin user (username: `admin`, password: `admin`)
- Creates default roles (admin, user) and permissions
- Assigns permissions to roles

**Important**: Change the default admin password immediately.

## Project Structure

```
server/
├── server.js              # Main server entry point
├── config.js              # Server configuration (ports, CORS, etc.)
├── httpEndpoints.js       # REST API route registration
├── websocketHandler.js    # WebSocket server and message handling
├── database.js            # Database initialization, schema, and migrations
├── dbOperations.js        # Database CRUD operations
├── duplicateLibraryItem.js # Library item duplication logic
├── routes/
│   ├── auth.js            # Authentication endpoints
│   ├── users.js           # User management
│   ├── roles.js           # Role management
│   ├── permissions.js     # Permission management
│   ├── library.js         # Library item CRUD
│   ├── pages.js           # Page management for library items
│   ├── playlist.js        # Legacy playlist endpoints
│   ├── playlists.js       # Playlist CRUD
│   ├── collections.js     # Collection management
│   ├── tags.js            # Tag management
│   ├── locations.js       # Location management
│   ├── keyboard.js        # Keyboard shortcut endpoints
│   └── settings.js        # General settings
├── data/
│   ├── mediaserver.db     # SQLite database
│   └── videos/            # Uploaded video files
└── package.json
```

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/login` | Authenticate user, create session |
| `GET` | `/me` | Get current user info (requires session) |

### Users

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/users` | List all users (admin only) |
| `GET` | `/users?username=x` | Get user by username |
| `POST` | `/users` | Create user (admin only) |
| `PUT` | `/users/:guid` | Update user (admin or self) |
| `DELETE` | `/users/:guid` | Delete user (admin only) |

### Roles & Permissions

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/roles` | List all roles |
| `GET` | `/roles/:guid` | Get role by GUID |
| `POST` | `/roles` | Create role (admin only) |
| `PUT` | `/roles/:guid` | Update role (admin only) |
| `DELETE` | `/roles/:guid` | Delete role (admin only) |
| `GET` | `/roles/:guid/permissions` | Get role permissions |
| `PUT` | `/roles/:guid/permissions` | Update role permissions (admin only) |
| `GET` | `/permissions` | List all permissions |
| `POST` | `/permissions` | Create permission (admin only) |

### Library Items

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/library` | List all library items (summary) |
| `GET` | `/library/search?q=term` | Search library items by name |
| `GET` | `/library/:guid` | Get full library item with pages |
| `POST` | `/library` | Create library item |
| `PUT` | `/library/:guid` | Update library item |
| `DELETE` | `/library/:guid` | Delete library item |
| `POST` | `/library/:guid/duplicate` | Duplicate library item |

### Pages

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/pages/library-item/:guid` | Get pages for a library item |
| `POST` | `/pages` | Create a page |
| `PUT` | `/pages/:guid` | Update a page |
| `DELETE` | `/pages/:guid` | Delete a page |

### Playlists

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/playlists` | List all playlists |
| `GET` | `/playlists/search?q=term` | Search playlists |
| `GET` | `/playlists/:guid` | Get playlist by GUID |
| `POST` | `/playlists` | Create playlist |
| `PUT` | `/playlists/:guid` | Update playlist |
| `DELETE` | `/playlists/:guid` | Delete playlist |
| `GET` | `/playlist/items?guid=x` | Get playlist items (optimized) |

### Collections

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/collections` | List all collections |
| `GET` | `/collections/:guid` | Get collection with items |
| `POST` | `/collections` | Create collection |
| `PUT` | `/collections/:guid` | Update collection |
| `DELETE` | `/collections/:guid` | Delete collection |
| `GET` | `/collections/:guid/items` | Get collection items |
| `POST` | `/collections/:guid/items` | Add items to collection |
| `DELETE` | `/collections/:guid/items/:itemGuid` | Remove item from collection |

### Tags

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/tags` | List all tags |
| `GET` | `/tags/:guid` | Get tag |
| `POST` | `/tags` | Create tag |
| `PUT` | `/tags/:guid` | Update tag |
| `DELETE` | `/tags/:guid` | Delete tag |
| `GET` | `/library/:guid/tags` | Get tags for library item |
| `POST` | `/library/:guid/tags` | Set tags for library item |

### Locations

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/locations` | List all locations |
| `GET` | `/locations/:guid` | Get location |
| `POST` | `/locations` | Create location |
| `PUT` | `/locations/:guid` | Update location |
| `DELETE` | `/locations/:guid` | Delete location |

### Videos

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/upload/video` | Upload video file |
| `GET` | `/videos/:filename` | Serve video file |

## WebSocket Protocol

### Connection

Connect to `ws://<server-host>:<port>` (default: `ws://localhost:8080`).

### Client-to-Server Messages

| Type | Description | Key Fields |
|---|---|---|
| `ClientConnect` | Register as admin or display client | `clientType`, `locationId` |
| `Change` | Change displayed content | `guid`, `page`, `locationId`, `chordVisibility`, `chordTransposition` |
| `SelectPlaylist` | Sync playlist selection | `guid`, `locationId` |
| `SelectLibraryItem` | Sync item selection | `guid`, `page`, `locationId` |
| `SelectLocation` | Client selects a location | `locationId` |
| `SetDisplayVisible` | Show/hide content on display | `visible`, `locationId` |
| `Action` | HDMI CEC command | `actionType` (`powerOn`, `powerOff`, `volumeUp`, `volumeDown`) |
| `Clear` | Clear the display | `locationId` |

### Server-to-Client Messages

| Type | Description | Key Fields |
|---|---|---|
| `text` | Text content | `content`, `css`, `guid`, `page`, `chordVisibility`, `contentVisible` |
| `image` | Image content | `content`, `css`, `guid`, `page`, `contentVisible` |
| `url` | URL content | `content`, `css`, `guid`, `contentVisible` |
| `iframe` | Embedded iframe | `content`, `css`, `guid`, `contentVisible` |
| `video` | Video content | `content`, `css`, `guid`, `contentVisible` |
| `SelectPlaylist` | Playlist sync (admin only) | `guid` |
| `SelectLibraryItem` | Item sync (admin only) | `guid`, `page` |
| `DisplayVisibleState` | Visibility state update | `contentVisible` |
| `LocationsList` | Available locations | `locations` |
| `ActionResponse` | CEC command result | `actionType`, `status`, `message` |

### Content Delivery

When a `Change` message is received:
1. Server loads the library item and its pages from the database
2. CSS properties are merged (item-level + page-level, page overrides item)
3. For text content, chord transposition is applied if requested
4. Content is sent to all display clients for the matching location
5. Content state is cached per location for new client connections

### Initial State Sync

When a new client connects, the server sends:
1. `LocationsList` with available locations
2. Current content for the client's location (if any)
3. For admin clients: current playlist selection, item selection, and visibility state

## Database Schema

### Core Tables
- **users**: User accounts with role assignment and locale preference
- **roles**: User roles with admin flag
- **permissions**: System permissions (ViewPlaylist, ViewEditor, ViewSettings, ViewDisplay, etc.)
- **role_permissions**: Role-to-permission mappings

### Content Tables
- **library_items**: Library items (name, description, type, CSS, author)
- **pages**: Individual content pages (content, type, CSS)
- **library_item_pages**: Item-to-page mappings with ordering

### Organization Tables
- **playlists**: Playlist definitions
- **playlist_items**: Playlist-to-item mappings with ordering and per-item page selection
- **collections**: Content collections (title, year, description)
- **collection_items**: Collection-to-item mappings
- **tags**: Categorization tags
- **library_item_tags**: Item-to-tag mappings

### System Tables
- **locations**: Display locations for multi-screen setups
- **settings**: Key-value system settings

## HDMI CEC Integration

TV control via `cec-client`:

| Action | CEC Command |
|---|---|
| Power On | `echo "on 0" \| cec-client -s -d 1` |
| Power Off | `echo "standby 0" \| cec-client -s -d 1` |
| Volume Up | `echo "volup" \| cec-client -s -d 1` |
| Volume Down | `echo "voldown" \| cec-client -s -d 1` |

Requires `cec-utils` package: `sudo apt install cec-utils`

## Configuration

Server configuration via `config.js` and environment variables:

| Setting | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server listening port |
| `NODE_ENV` | `development` | Environment mode |
| `CORS_ORIGIN` | dev origins | Allowed CORS origins (comma-separated) |
| `CORS_CREDENTIALS` | `false` | Allow credentials in CORS |
| `BODY_SIZE_LIMIT` | `50mb` | Max request body size |
| `CACHE_ENABLED` | `true` | Enable response caching |
| `CACHE_TTL` | `300000` | Cache TTL in milliseconds |

## Dependencies

- `better-sqlite3`: SQLite database driver
- `ws`: WebSocket server
- `dotenv`: Environment variable loading
- `xlsx`: Excel file processing
- `multer`: File upload handling (videos)

## License

ISC
