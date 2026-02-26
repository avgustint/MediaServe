# MediaServer Client

Angular fullscreen display application that receives content via WebSocket and renders it on a connected screen or TV. Designed for digital signage, kiosk mode, and live presentation displays.

## Features

- **Content Types**: Text (with chord annotations), images, URLs (iframe), embedded iframes (paste embed code), and videos
- **Smooth Transitions**: Slide animations between text pages; fade transitions for media content
- **Custom CSS Styling**: Per-item and per-page CSS properties applied via server (background color, font color, custom styles)
- **Chord Display**: Renders chord annotations above text lines; visibility controlled by admin (show/hide); transposition applied server-side
- **Location-Based Routing**: Supports multi-display setups where each screen receives content for its assigned location
- **Auto-Reconnect**: Automatically reconnects to WebSocket server after disconnection with exponential backoff
- **Connection Status Indicator**: Visual dot indicator (green = connected, red = disconnected)
- **Loading State**: Animated spinner shown when not connected
- **Location Selector**: Choose which location this display belongs to (or auto-select via configuration)
- **Responsive Scaling**: Content scales to fit the display

## Getting Started

### Prerequisites

- Node.js v18 or higher
- Angular CLI v19 or higher
- MediaServer backend running

### Installation

```bash
npm install
```

### Development Server

```bash
npm start
```

Runs on `http://localhost:4201`.

### Production Build

```bash
npm run build
```

Output: `dist/media-player/`

## Project Structure

```
client/
├── src/
│   ├── app/
│   │   ├── app.component.ts          # Main component (content display logic)
│   │   ├── app.component.html        # Display template with all content types
│   │   ├── app.component.scss        # Styles including transitions
│   │   ├── websocket.service.ts      # WebSocket connection and message handling
│   │   ├── format-text.pipe.ts       # Text formatting with chord parsing
│   │   └── api.config.ts             # API/WebSocket URL configuration
│   ├── index.html
│   ├── main.ts
│   └── styles.css
├── angular.json
├── package.json
└── tsconfig.json
```

## Content Types

### Text
- Rendered as HTML with automatic font sizing
- Chord annotations displayed above text lines (when enabled by admin)
- Supports multi-page text items with slide transitions between pages
- Custom CSS properties (background color, font color, etc.) applied from server

### Image
- Base64-encoded images or image URLs
- Scales to fit screen while maintaining aspect ratio
- Supports PNG, JPEG, GIF, WebP, and other formats
- Multi-page image items supported with page navigation

### URL
- Displays external websites in a fullscreen iframe
- Supports autoplay, encrypted media, and picture-in-picture

### Embedded iFrame
- Renders pasted embed code (e.g., YouTube embeds, maps, widgets)
- Displayed in a sandboxed wrapper

### Video
- Plays video files served by the MediaServer backend
- Native video controls (play, pause, seek, volume)
- Custom CSS styling support

## WebSocket Protocol

### Connection

Connects to the server WebSocket endpoint (auto-detected via `shared-config.ts`).

### Incoming Messages

| Type | Description |
|---|---|
| `text` | Text content with optional chords and CSS |
| `image` | Image content (base64 or URL) with optional CSS |
| `url` | URL to display in iframe |
| `iframe` | Embedded HTML/iframe code |
| `video` | Video file URL |
| `DisplayVisibleState` | Show/hide content on this display |
| `LocationsList` | Available locations for selection |

### Outgoing Messages

| Type | Description |
|---|---|
| `ClientConnect` | Sent on connection with location ID |
| `SelectLocation` | Select a location for this display |

### Message Fields

Content messages include:
- `content`: The content to display
- `css`: Optional CSS properties object (`{ "background-color": "#000", ... }`)
- `chordVisibility`: Chord display state (`local`, `everywhere`, `hidden`)
- `contentVisible`: Whether content should be visible on this display
- `guid`: Library item GUID
- `page`: Current page number

## Configuration

### Runtime Configuration

The client uses `shared-config.ts` to auto-detect the server URL based on hostname:
- `localhost`: Connects to `ws://localhost:8080`
- Other hostnames: Connects to the same host on port 5000

### Auto-Login Location

Set `AUTO_LOGIN_LOCATION_ID` in `api.config.ts` (or via `build.config.js` for production builds) to automatically select a location without showing the location picker. Set to `0` to show the picker.

## Kiosk Mode

For production use as a digital signage display:

```bash
chromium-browser --kiosk --autoplay-policy=no-user-gesture-required http://localhost:4201
```

For Raspberry Pi deployment with auto-start services, see the [Raspberry Pi Deployment Guide](../deployment/raspberry-pi/README.md).

## Troubleshooting

### No content displayed
- Check the connection status indicator (bottom-left dot)
- Verify the server is running
- Ensure a location is selected (check browser console)
- Verify content is being sent from the admin app

### Content not styled correctly
- CSS properties are sent per-item and per-page from the server
- Check that the library item or page has CSS defined in the admin editor

### Chords not showing
- Chord visibility is controlled by the admin app
- Check the chord display mode in the admin projection view

### Video not playing
- Ensure autoplay policy allows playback (kiosk mode flag: `--autoplay-policy=no-user-gesture-required`)
- Check that the video file exists on the server

## License

ISC
