# MediaServer Admin

Angular web application for managing the MediaServer system. Provides a full-featured interface for controlling content on displays, managing library items, playlists, users, and settings.

## Features

### Playlist / Projection View
The main operational view with three content selection modes:

- **Playlist Tab**: Browse and select items from playlists. Supports per-item page selection and ordered navigation with prev/next controls.
- **Search Tab**: Full-text search with advanced filters (collection, tags). Shows recently selected items (last 20, persisted) when no search is active.
- **Manual / Numpad Tab**: Enter a library item GUID directly via numeric keypad. Shows recently selected items below the keypad for quick access.

Content preview with:
- Live preview of the content being displayed on the audience screen
- Page navigation buttons for multi-page items (all content types)
- Content visibility toggle (show/hide on audience display without losing selection)
- Fullscreen preview mode
- Chord display controls (show locally, show everywhere, hide) with transposition (+/- semitones)
- Prev/next navigation across pages and playlist items

### Library Editor
- Create and edit library items: text, image, URL, video, and embedded iframe types
- Multi-page support with drag-and-drop page ordering
- Per-item and per-page CSS property editor (background color, font color, custom styles)
- Chord annotations in text content (parsed and rendered automatically)
- Description and author fields
- Item duplication
- Tag assignment

### Playlist Editor
- Create and manage playlists with ordered items
- Add items via search with collection/tag filters
- Per-item page selection (choose which pages to include)
- Drag-and-drop item reordering

### Collection Editor
- Organize library items into collections
- Collection title and year fields
- Add/remove items from collections

### Tag Editor
- Create and manage tags for categorizing library items
- Tag name and description

### Settings
- **User Management**: Create, edit, and delete users. Assign roles and set locale.
- **Role Management**: Create and edit roles with admin flag.
- **Permission Management**: Assign permissions to roles (ViewPlaylist, ViewEditor, ViewSettings, ViewDisplay, etc.)
- **Location Management**: Create and manage locations for multi-display setups.
- **General Settings**: System-wide configuration.

### Display / TV Remote
- Power on/off via HDMI CEC
- Volume up/down via HDMI CEC
- Translated button labels and error messages

### User Profile
- Edit name, email, and password
- Language selection (English, Slovenian, Italian)

### Cross-Cutting Features
- **Multi-language**: Full i18n support for English, Slovenian, and Italian
- **Real-time sync**: Multiple admin instances stay synchronized (playlist selection, item selection, page, chord settings, visibility)
- **Responsive design**: Works on desktop, tablet, and mobile devices
- **Keyboard navigation**: Arrow keys for page/item navigation in projection view
- **Auto-login**: Configurable auto-login for kiosk deployments

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

Runs on `http://localhost:4200` by default.

### Production Build

```bash
npm run build
```

Output: `dist/media-player-admin-v2/`

## Architecture

- **Standalone components**: All components use Angular standalone API
- **Feature-based structure**: Components organized by feature domain under `src/app/features/`
- **Core services**: Authentication, WebSocket, API, Translation, User, Viewport, Keyboard commands
- **Shared pipes**: TranslatePipe, FormatTextPipe, LocalizedDatePipe
- **PrimeNG**: UI component library for dropdowns, multiselects, and other form controls
- **RxJS**: Reactive state management with BehaviorSubjects and Observables

### Feature Modules

```
src/app/features/
├── auth/           # Login with auto-login support
├── playlist/       # Projection view (playlist, search, manual tabs)
│   ├── playlist-view/    # Main view with content preview
│   ├── playlist-list/    # Playlist tab content
│   ├── playlist-item/    # Individual playlist item
│   ├── search/           # Search tab with filters and recent items
│   ├── manual/           # Numpad tab with recent items
│   └── services/         # PlaylistService, ChordSettingsService, RecentItemsService
├── editor/         # Library, playlist, collection, and tag editors
├── display/        # TV remote control (CEC commands)
├── settings/       # User, role, permission, location management
└── user-profile/   # User profile editor
```

## License

ISC
