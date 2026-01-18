# MediaServer

A comprehensive media player system for displaying content on displays/TVs with a web-based administration interface. The system consists of three main components: a Node.js server, an Angular admin application, and an Angular client application.

## 🏗️ Architecture

```
MediaServer/
├── server/          # Node.js backend server
├── admin/           # Angular admin web application
└── client/          # Angular client display application
```

### System Overview

- **Server**: Node.js/Express server with SQLite database, WebSocket support, and REST API endpoints for managing users, roles, permissions, playlists, and library items. Supports HDMI CEC commands for TV control.

- **Admin**: Angular web application for authenticated users to manage playlists, library items, users, roles, and permissions. Features real-time synchronization across multiple admin instances.

- **Client**: Angular fullscreen display application that receives content via WebSocket and displays it on a connected display/TV. Shows text, images, and URLs with automatic reconnection.

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18 or higher
- **npm** or **yarn**
- **Angular CLI** v17 or higher (for admin and client apps)
- **SQLite3** (included via better-sqlite3)
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

⚠️ **Important**: Change the default admin password in production!

## 📋 Features

### Server Features
- SQLite database for data persistence
- RESTful API for CRUD operations
- WebSocket server for real-time communication
- User authentication and authorization
- Role-based access control (RBAC)
- Permission system
- Playlist and library item management
- HDMI CEC integration for TV control
- Multi-client synchronization

### Admin Features
- User authentication with session management
- Playlist management and viewing
- Library item editor (text, images, URLs)
- Playlist editor
- User management
- Role and permission management
- Display control (TV power and volume)
- User profile management
- Multi-language support (i18n)
- Real-time synchronization across admin instances

### Client Features
- Fullscreen content display
- WebSocket connection with auto-reconnect
- Support for text, images (base64), and URLs
- Connection status indicator
- Loading animations
- Responsive content scaling

## 🔧 Configuration

### Server Configuration

The server can be configured via environment variables:

- `PORT`: Server port (default: `8080`)

Example:
```bash
PORT=3000 npm start
```

### Database

The server uses SQLite database located at `server/data/mediaserver.db`. The database is automatically initialized on first run with:
- Default admin user
- Default roles (admin, user)
- Default permissions
- Database schema

### CORS Configuration

The server is configured to allow requests from:
- Admin app: `http://localhost:4200`
- Client app: `http://localhost:4201`

Modify CORS settings in `server/httpEndpoints.js` if using different ports or domains.

## 📚 Documentation

For detailed documentation on each component, see:

- [Server Documentation](./server/README.md) - Complete server API and WebSocket documentation
- [Admin Documentation](./admin/README.md) - Admin application features and usage
- [Client Documentation](./client/README.md) - Client application setup and configuration

## 🔐 Security

- Passwords are hashed using MD5 (client-side) before sending to server
- Session-based authentication
- Role-based access control
- Permission-based route guards
- CORS protection
- SQL injection protection via parameterized queries

## 🌐 WebSocket Protocol

The system uses WebSocket for real-time communication. See [Server Documentation](./server/README.md) for detailed message formats and protocol specification.

## 📦 Building for Production

**Option 1: Build all projects together (recommended)**

This builds all projects and prepares a unified `dist/` folder ready for deployment:

```bash
npm run build
```

This will:
- Build the admin Angular app with production configuration
- Build the client Angular app with production configuration  
- Copy server files to `dist/server/`
- Generate configuration files from `build.config.js`
- Create a ready-to-deploy `dist/` folder

To clean and rebuild:
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

### Server
The server runs directly with Node.js - no build step required.

### Admin
```bash
cd admin-v2
npm run build
```
Output: `admin-v2/dist/media-player-admin-v2/`

### Client
```bash
cd client
npm run build
```
Output: `client/dist/media-player/`

### Build Configuration

You can customize build settings by editing `build.config.js` in the root directory:

- Override API URLs for production
- Set server ports and CORS origins
- Configure environment-specific settings

Example `build.config.js`:
```javascript
module.exports = {
  server: {
    port: 8080,
    nodeEnv: 'production',
    corsOrigin: [],
    corsCredentials: false
  },
  admin: {
    apiUrl: 'http://your-production-server.com:8080',
    wsUrl: 'ws://your-production-server.com:8080'
  },
  client: {
    apiUrl: 'http://your-production-server.com:8080',
    wsUrl: 'ws://your-production-server.com:8080'
  }
};
```

## 🐛 Troubleshooting

### Server won't start
- Check if port 8080 is already in use
- Verify Node.js version (v18+)
- Check database file permissions

### Admin app can't connect
- Verify server is running on port 8080
- Check CORS configuration
- Verify API endpoints in browser console

### Client not displaying content
- Check WebSocket connection status
- Verify server is running
- Check browser console for errors
- Ensure content is being sent via WebSocket

### TV control not working
- Verify `cec-client` is installed and accessible
- Check HDMI CEC connection
- Verify user has `ViewDisplay` permission

## 📝 License

ISC

## 🤝 Contributing

This is a private project. For issues or feature requests, contact the project maintainer.

## 📞 Support

For support, check the individual component READMEs or contact the development team.

