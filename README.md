# MediaServer

A comprehensive media player system for displaying content on screens/TVs with a web-based administration interface. The system consists of three main components: a Node.js server, an Angular admin application, and an Angular client display application.

## Architecture

```
MediaServer/
├── server/          # Node.js backend server
├── admin-v2/        # Angular admin web application
├── client/          # Angular client display application
├── shared-config.ts # Shared runtime configuration (auto-detects local vs deployment)
└── deployment/      # Deployment scripts and service files
    └── raspberry-pi/
```

### System Overview

- **Server**: Node.js/Express server with SQLite database, WebSocket support, and REST API. Manages users, roles, permissions, playlists, library items, collections, tags, locations, and HDMI CEC commands for TV control. Supports multi-location content delivery and real-time synchronization across multiple admin and client instances.

- **Admin**: Angular web application for authenticated users to manage playlists, library items (text, images, URLs, videos, iframes), collections, tags, users, roles, permissions, and locations. Features real-time synchronization across multiple admin instances, multi-language support (English, Slovenian, Italian), chord display and transposition for text content, content visibility control, recently selected items history, and TV remote control (CEC).

- **Client**: Angular fullscreen display application that receives content via WebSocket and displays it on a connected screen/TV. Supports text (with chord annotations), images, URLs, embedded iframes, and videos with smooth page transitions, auto-reconnect, custom CSS styling per item/page, and location-based content routing.

## Quick Start

### Prerequisites

- **Node.js** v18 or higher
- **npm**
- **Angular CLI** v19 or higher
- **SQLite3** (included via `better-sqlite3`)
- **HDMI CEC** tools (optional, for TV control via `cec-client`)

### Installation

**Option 1: Install all projects at once (recommended)**
```bash
npm run install:all
```

**Option 2: Install projects individually**

1. **Install server dependencies**:
   ```bash
   cd server
   npm install
   ```

2. **Install admin dependencies**:
   ```bash
   cd admin-v2
   npm install
   ```

3. **Install client dependencies**:
   ```bash
   cd client
   npm install
   ```

### Running the System

**Option 1: Start all projects together (development mode)**
```bash
npm start
```
This will start:
- Server on `http://localhost:8080`
- Admin app on `http://localhost:4200`
- Client app on `http://localhost:4201`

**Option 2: Start projects individually**

1. **Start the server** (from `server/` directory):
   ```bash
   npm start
   ```
   Server runs on `http://localhost:8080` by default.

2. **Start the admin app** (from `admin-v2/` directory):
   ```bash
   npm start
   ```
   Admin app runs on `http://localhost:4200` by default.

3. **Start the client app** (from `client/` directory):
   ```bash
   npm start
   ```
   Client app runs on `http://localhost:4201` by default.

### Default Credentials

- **Username**: `admin`
- **Password**: `admin`

**Important**: Change the default admin password in production!

## Features

### Server Features
- SQLite database for data persistence
- RESTful API for CRUD operations on all entities
- WebSocket server for real-time bidirectional communication
- User authentication and session management
- Role-based access control (RBAC) with fine-grained permissions
- Library item management with multi-page support (text, image, URL, video, iframe)
- Per-item and per-page CSS styling
- Playlist management with per-item page selection
- Collection and tag management for organizing library items
- Location-based content routing (multi-display support)
- HDMI CEC integration for TV power and volume control
- Multi-admin synchronization (playlist, item, and page selections)
- Content visibility control (hide/show content on displays)
- Chord transposition support for text content
- Video file upload and serving
- Library item duplication

### Admin Features
- User authentication with session management
- Three content selection modes: Playlist, Search (with filters), and Numpad (GUID entry)
- Library item editor supporting text, images, URLs, videos, and embedded iframes
- Multi-page library items with drag-and-drop page ordering
- Per-item and per-page CSS property editor
- Chord annotation support with display modes (local, everywhere, hidden) and transposition
- Playlist editor with item ordering and per-item page selection
- Collection management for grouping library items
- Tag management with multi-tag filtering
- Advanced search with collection and tag filters
- Recently selected items history (persisted, last 20)
- Content preview with fullscreen mode
- Content visibility toggle (hide/show on audience display)
- User, role, and permission management
- Location management for multi-display setups
- TV remote control (power on/off, volume up/down via HDMI CEC)
- User profile management (name, email, password, language)
- Multi-language support (English, Slovenian, Italian)
- Real-time synchronization across multiple admin instances
- Responsive design for desktop, tablet, and mobile
- Keyboard navigation support (arrow keys for page/item navigation)
- Auto-login support for kiosk deployments

### Client Features
- Fullscreen content display optimized for digital signage
- Content types: text (with optional chords), images, URLs, embedded iframes, videos
- Smooth slide transitions between pages and content changes
- Custom CSS styling support (per-item and per-page properties)
- Chord visibility control (show/hide based on admin settings)
- Location-based content routing (auto-select or manual location picker)
- WebSocket connection with automatic reconnect
- Connection status indicator
- Loading animations
- Auto-login location support for kiosk deployments
- Responsive content scaling

## Configuration

### Shared Configuration

The project uses `shared-config.ts` (for Angular apps) and `shared-config.js` (for the server) to automatically detect the runtime environment based on hostname:
- `localhost` / `127.0.0.1`: Uses local development ports (server: 8080, admin: 4200, client: 4201)
- Any other hostname: Uses deployment ports (server: 5000, client: 5001)

### Server Configuration

The server can be configured via environment variables or `server/config.js`:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `CORS_ORIGIN` | dev origins | Comma-separated allowed origins |
| `BODY_SIZE_LIMIT` | `50mb` | Max request body size |

### Database

The server uses SQLite located at `server/data/mediaserver.db`. Automatically initialized on first run with default admin user, roles, and permissions.

## Building for Production

**Option 1: Build all projects together (recommended)**

```bash
npm run build
```

This builds admin and client apps with production configuration, copies server files, and generates configuration from `build.config.js`. To clean and rebuild:

```bash
npm run build:clean
```

The output structure:
```
dist/
├── server/          # Server application
├── admin/           # Built admin app (served by server)
├── client/          # Built client app
└── package.json     # Dependencies for deployment
```

**To deploy from dist:**
```bash
cd dist
npm install
npm start
```

**Option 2: Build projects individually**

```bash
# Admin
cd admin-v2 && npm run build

# Client
cd client && npm run build
```

### Build Configuration

Customize production settings in `build.config.js`:

```javascript
module.exports = {
  server: {
    port: 8080,
    nodeEnv: 'production',
    corsOrigin: [],
    corsCredentials: false
  },
  admin: {
    apiUrl: 'http://your-server:8080',
    wsUrl: 'ws://your-server:8080'
  },
  client: {
    apiUrl: 'http://your-server:8080',
    wsUrl: 'ws://your-server:8080'
  }
};
```

## Deployment

For Raspberry Pi deployment with kiosk mode, auto-start services, and Chromium fullscreen display, see the detailed guide:

- **[Raspberry Pi Deployment Guide](./deployment/raspberry-pi/README.md)**

## Security

- Passwords are hashed (MD5 client-side) before transmission
- Session-based authentication with server-side session storage
- Role-based access control with fine-grained permissions
- Permission-based route guards in admin app
- CORS protection with configurable origins
- SQL injection protection via parameterized queries

## Documentation

- [Server Documentation](./server/README.md) - API endpoints, WebSocket protocol, database schema
- [Admin Documentation](./admin-v2/README.md) - Admin application features and architecture
- [Client Documentation](./client/README.md) - Client display application
- [Raspberry Pi Deployment](./deployment/raspberry-pi/README.md) - Production deployment guide

## Troubleshooting

### Server won't start
- Check if the configured port is already in use
- Verify Node.js version (v18+)
- Check database file permissions in `server/data/`

### Admin app can't connect
- Verify server is running
- Check CORS configuration in `server/config.js`
- Check browser console for errors

### Client not displaying content
- Check WebSocket connection status indicator (green = connected)
- Verify server is running and content is being sent
- Ensure the correct location is selected (if using multi-location)

### TV control not working
- Verify `cec-client` is installed (`sudo apt install cec-utils`)
- Check HDMI CEC connection and TV settings
- Verify user has `ViewDisplay` permission

### Pages not showing for non-text items
- Ensure library items have multiple pages defined in the editor
- Page navigation works for all content types (text, image, URL, video, iframe)

## License

ISC
