# Media Player Admin

Angular admin application for managing and monitoring the Media Player system.

## Features

- **Login Page**: Secure authentication to access the admin panel
- **Playlist Management**: View all playlist items from the NodeServer
- **Real-time Content Display**: Monitor WebSocket messages showing current content (text, images, URLs)
- **Connection Status**: Visual indicator of WebSocket connection status

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Angular CLI (v17 or higher)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Make sure the NodeServer is running on `http://localhost:8080`

3. Start the development server:
```bash
npm start
```

4. Navigate to `http://localhost:4200` in your browser

### Default Login Credentials

- Username: `admin`
- Password: `admin`

## Project Structure

```
Admin/
├── src/
│   ├── app/
│   │   ├── login/          # Login component
│   │   ├── main/            # Main dashboard component
│   │   ├── auth.service.ts  # Authentication service
│   │   ├── auth.guard.ts    # Route guard for authentication
│   │   ├── playlist.service.ts  # Service to fetch playlist from NodeServer
│   │   ├── websocket.service.ts  # WebSocket service for real-time updates
│   │   ├── app.component.ts      # Root component
│   │   └── app.routes.ts         # Application routes
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── angular.json
├── package.json
└── tsconfig.json
```

## Features Description

### Login Page
- Simple authentication form
- Validates credentials before allowing access
- Redirects to main page on successful login

### Main Page
- **Left Sidebar**: Displays playlist items fetched from NodeServer
  - Shows item number, type (Text/Image/URL), and preview
  - Scrollable list of all playlist items
  
- **Right Content Area**: Displays real-time WebSocket content
  - Text content with auto-sizing
  - Image content with proper scaling
  - URL content in iframe
  - Connection status indicator

## Development

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

## Configuration

The application connects to:
- **API Endpoint**: `http://localhost:8080/playlist.json`
- **WebSocket**: `ws://localhost:8080`

Update these in the respective service files if your server runs on a different port or host.

