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

1. **Clone the repository** (if applicable)

2. **Install server dependencies**:
   ```bash
   cd server
   npm install
   ```

3. **Install admin dependencies**:
   ```bash
   cd admin
   npm install
   ```

4. **Install client dependencies**:
   ```bash
   cd client
   npm install
   ```

### Running the System

1. **Start the server** (from `server/` directory):
   ```bash
   npm start
   ```
   Server runs on `http://localhost:8080` by default.

2. **Start the admin app** (from `admin/` directory):
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

### Server
The server runs directly with Node.js - no build step required.

### Admin
```bash
cd admin
npm run build
```
Output: `admin/dist/media-player-admin/`

### Client
```bash
cd client
npm run build
```
Output: `client/dist/media-player/`

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

