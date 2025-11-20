# MediaPlayer Angular App

An Angular application that displays content received via WebSocket connection. Supports displaying text, images (base64), and URLs in an iframe.

## Features

- **WebSocket Connection**: Connects to a backend server via WebSocket
- **Text Display**: Shows text content centered on screen with dynamically adjusted font size
- **Image Display**: Displays base64-encoded images that fit the screen size
- **URL Display**: Shows websites in an iframe

## Installation

1. Install dependencies:
```bash
npm install
```

## Configuration

The WebSocket URL is configured in `src/app/app.component.ts`. By default, it connects to `ws://localhost:8080`. You can modify this in the `ngOnInit` method:

```typescript
this.websocketService.connect('ws://your-websocket-url:port');
```

## WebSocket Message Format

The application expects messages in the following JSON format:

```json
{
  "type": "text" | "image" | "url",
  "content": "string content"
}
```

### Examples:

**Text message:**
```json
{
  "type": "text",
  "content": "Hello, World!"
}
```

**Image message (base64):**
```json
{
  "type": "image",
  "content": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

Or without data URI prefix:
```json
{
  "type": "image",
  "content": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

**URL message:**
```json
{
  "type": "url",
  "content": "https://example.com"
}
```

## Development

Run the development server:
```bash
npm start
```

The app will be available at `http://localhost:4200`

## Build

Build for production:
```bash
npm run build
```

