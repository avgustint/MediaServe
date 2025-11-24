# MediaServer - Client Application

Angular fullscreen display application that receives content via WebSocket and displays it on a connected display or TV. Designed for kiosk mode and digital signage.

## 📋 Features

- **Fullscreen Display**: Optimized for fullscreen presentation
- **WebSocket Connection**: Real-time content delivery with auto-reconnect
- **Multiple Content Types**: Supports text, images (base64), and URLs
- **Connection Status Indicator**: Visual feedback for connection state
- **Loading Animations**: Smooth loading states
- **Auto-reconnect**: Automatically reconnects on connection loss
- **Responsive Content**: Content scales to fit screen size

## 🚀 Getting Started

### Prerequisites

- Node.js v18 or higher
- npm or yarn
- Angular CLI v17 or higher
- MediaServer backend running on `http://localhost:8080`

### Installation

```bash
npm install
```

### Development Server

```bash
npm start
```

The application will be available at `http://localhost:4201` (different port from admin to avoid conflicts).

### Production Build

```bash
npm run build
```

Output: `dist/media-player/`

## 📁 Project Structure

```
client/
├── src/
│   ├── app/
│   │   ├── app.component.ts          # Main component
│   │   ├── app.component.html        # Display template
│   │   ├── app.component.scss        # Styles
│   │   └── websocket.service.ts       # WebSocket service
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── angular.json
├── package.json
└── tsconfig.json
```

## 🎯 Features

### Content Display

The application displays three types of content:

#### Text Content
- Centered on screen
- Font size automatically adjusts to fit content
- Fullscreen display

#### Image Content
- Base64 encoded images
- Scales to fit screen while maintaining aspect ratio
- Supports PNG, JPEG, GIF, and other formats

#### URL Content
- Displays websites in an iframe
- Fullscreen iframe
- Supports any web-accessible URL

### Connection Management

- **Auto-connect**: Connects to WebSocket on application start
- **Auto-reconnect**: Automatically reconnects after 5 seconds on disconnect
- **Connection Status**: Visual indicator (green/red dot) in bottom-left corner
- **Loading State**: Shows loading spinner when not connected or connection dropped

### Connection Status Indicator

A small circular dot in the bottom-left corner indicates connection status:
- **Green**: Connected to WebSocket server
- **Red**: Disconnected or connecting

## 🔌 WebSocket Protocol

### Connection

Connects to `ws://localhost:8080` (or configured server URL).

### Message Format

The application expects JSON messages with the following structure:

```json
{
  "type": "text" | "image" | "url",
  "content": "content string"
}
```

### Message Types

#### Text Message
```json
{
  "type": "text",
  "content": "Hello, World!"
}
```

#### Image Message (with data URI)
```json
{
  "type": "image",
  "content": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

#### Image Message (base64 only)
```json
{
  "type": "image",
  "content": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

The application automatically handles both formats.

#### URL Message
```json
{
  "type": "url",
  "content": "https://example.com"
}
```

## 🔧 Configuration

### WebSocket URL

The WebSocket URL is configured in `src/app/websocket.service.ts`:

```typescript
private wsUrl = 'ws://localhost:8080';
```

To change the server URL, modify this value.

### Reconnection Delay

The reconnection delay is set to 5 seconds. To change:

```typescript
// In websocket.service.ts
this.reconnectTimeout = setTimeout(() => this.connect(), 5000);
```

### Port

Default port is `4201`. To change:

```bash
ng serve --port 4202
```

Or modify `package.json` scripts:

```json
{
  "scripts": {
    "start": "ng serve --port 4202"
  }
}
```

## 🎨 Styling

### Content Display

- **Text**: White text on black background, centered, auto-sizing font
- **Image**: Centered, max-width/height 100%, maintains aspect ratio
- **URL**: Fullscreen iframe, no borders

### Connection Status

- **Dot**: 12px diameter, positioned bottom-left (20px from edges)
- **Green**: `#4CAF50` when connected
- **Red**: `#F44336` when disconnected/connecting

### Loading Spinner

- Centered on screen
- Animated CSS spinner
- Only shown when not connected or connection dropped

## 🖥️ Kiosk Mode Setup

For production use as a digital signage display:

### Chrome Kiosk Mode (Linux)

```bash
chromium-browser --kiosk --disable-infobars http://localhost:4201
```

### Chrome Kiosk Mode (Windows)

```bash
chrome.exe --kiosk --disable-infobars http://localhost:4201
```

### Auto-start on Boot

Create a systemd service (Linux) or startup script (Windows) to:
1. Start the Angular app (or serve built files)
2. Launch browser in kiosk mode

### Fullscreen API

The application can use the Fullscreen API for true fullscreen:

```typescript
// Request fullscreen
document.documentElement.requestFullscreen();
```

## 🏗️ Building for Production

```bash
npm run build
```

Output: `dist/media-player/`

### Serving Production Build

You can serve the production build using:

```bash
# Using http-server
npx http-server dist/media-player -p 4201

# Using serve
npx serve -s dist/media-player -p 4201

# Using nginx
# Configure nginx to serve dist/media-player/
```

## 🔄 Auto-reconnect Behavior

The application automatically reconnects when:
- WebSocket connection is closed
- WebSocket connection errors occur
- Initial connection fails

Reconnection happens after a 5-second delay to avoid overwhelming the server.

## 🐛 Troubleshooting

### No Content Displayed

- Check WebSocket connection status (green/red dot)
- Verify server is running on port 8080
- Check browser console for errors
- Verify content is being sent from server/admin

### Connection Issues

- Verify server WebSocket is running
- Check network connectivity
- Review browser console for WebSocket errors
- Verify WebSocket URL in `websocket.service.ts`

### Image Not Displaying

- Verify image is valid base64
- Check image format is supported (PNG, JPEG, GIF)
- Review browser console for image loading errors
- Ensure data URI format is correct

### URL Not Loading

- Verify URL is accessible
- Check for CORS issues
- Ensure URL uses HTTPS if required
- Review browser console for iframe errors

### Build Errors

- Check Node.js and Angular CLI versions
- Clear `node_modules` and reinstall
- Verify TypeScript version compatibility

## 📦 Dependencies

### Main Dependencies

- `@angular/*`: Angular framework (v17)
- `rxjs`: Reactive programming for WebSocket observables

### Dev Dependencies

- `@angular/cli`: Angular CLI
- `@angular-devkit/build-angular`: Build tools
- `typescript`: TypeScript compiler

## 🔐 Security Considerations

- The client app does not require authentication (public display)
- Content is received from trusted server via WebSocket
- URLs are displayed in iframes (sandboxed)
- No user input or sensitive data handling

## 📄 License

ISC
