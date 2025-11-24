# MediaServer - Admin Application

Angular web application for managing the MediaServer system. Provides a comprehensive interface for managing users, roles, permissions, playlists, library items, and controlling displays.

## 📋 Features

- **User Authentication**: Secure login with session management
- **Playlist Management**: View, search, and navigate playlists
- **Library Editor**: Create and edit library items (text, images, URLs) with multi-page support
- **Playlist Editor**: Create and edit playlists, add/remove items
- **User Management**: Create, edit, and delete users
- **Role & Permission Management**: Manage roles and assign permissions
- **Display Control**: Control TV power and volume via HDMI CEC
- **User Profile**: Edit own profile, change password
- **Real-time Synchronization**: Sync selections across multiple admin instances
- **Multi-language Support**: Internationalization (i18n) with locale switching
- **Responsive Design**: Works on desktop and mobile devices

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

The application will be available at `http://localhost:4200`.

### Default Login Credentials

- **Username**: `admin`
- **Password**: `admin`

⚠️ **Security**: Change the default admin password in production!

## 📁 Project Structure

```
admin/
├── src/
│   ├── app/
│   │   ├── login/                    # Login component
│   │   ├── playlist/                 # Playlist components
│   │   │   ├── playlist/             # Main playlist view
│   │   │   ├── playlist-list/        # Playlist list/search
│   │   │   ├── playlist-item/        # Playlist item display
│   │   │   └── manual/               # Manual item navigation
│   │   ├── editor/                   # Editor components
│   │   │   ├── library-editor/       # Library item editor
│   │   │   └── playlist-editor/      # Playlist editor
│   │   ├── settings/                 # Settings components
│   │   │   ├── user-editor/          # User editor
│   │   │   ├── role-editor/          # Role editor
│   │   │   └── role-permissions-editor/ # Permission assignment
│   │   ├── display/                  # Display control component
│   │   ├── user-profile/             # User profile component
│   │   ├── shared/                   # Shared components
│   │   │   ├── confirm-dialog/       # Confirmation dialogs
│   │   │   ├── error-popup/          # Error messages
│   │   │   └── library-item-search/  # Library item search
│   │   ├── auth.service.ts           # Authentication service
│   │   ├── auth.guard.ts             # Route guard for auth
│   │   ├── permission.guard.ts       # Route guard for permissions
│   │   ├── user.service.ts           # User data service
│   │   ├── playlist.service.ts       # Playlist API service
│   │   ├── websocket.service.ts      # WebSocket service
│   │   ├── translation.service.ts    # i18n service
│   │   └── app.routes.ts             # Application routes
│   ├── assets/                       # Static assets
│   │   └── webfonts/                 # Font Awesome fonts
│   ├── index.html
│   ├── main.ts
│   └── styles.css                    # Global styles
├── angular.json
├── package.json
└── tsconfig.json
```

## 🎯 Main Features

### Authentication

- Login page with username/password
- Session-based authentication
- Automatic redirect to login if not authenticated
- Session persistence across page refreshes

### Playlist Management

- **Playlist List**: Search and select playlists
- **Playlist View**: Display playlist items in a grid
- **Item Navigation**: Click items to display content
- **Multi-page Support**: Navigate through pages of multi-page items
- **Real-time Sync**: Selections sync across admin instances

### Library Editor

- Create new library items (text, image, URL)
- Edit existing library items
- Multi-page content support
- Image upload with base64 encoding
- Preview content before saving

### Playlist Editor

- Create new playlists
- Edit playlist names
- Add/remove library items
- Reorder items (drag and drop)
- Search and add library items

### User Management

- View all users
- Create new users
- Edit user details (name, email, role, locale)
- Delete users
- Change user passwords

### Role & Permission Management

- View all roles
- Create new roles
- Edit role names
- Assign permissions to roles
- Delete roles (except admin role)

### Display Control

- Power On/Off TV
- Volume Up/Down
- Requires `ViewDisplay` permission
- Sends HDMI CEC commands via WebSocket

### User Profile

- View own profile information
- Edit name, email, locale
- Change password (with current password verification)
- Logout button

## 🔐 Permissions

The application uses a permission-based access control system:

- **ViewPlaylist**: Access playlist view (default for all users)
- **ViewLibraryEditor**: Access library editor
- **ViewPlaylistEditor**: Access playlist editor
- **ViewSettings**: Access settings page
- **ViewDisplay**: Access display control
- And more...

Routes are protected by `permissionGuard` which checks user permissions.

## 🌐 Internationalization (i18n)

The application supports multiple languages:

- **English** (en) - Default
- **Slovenian** (sl)
- And more...

Users can change their locale in the user profile. The application uses a custom `TranslationService` and `TranslatePipe` for translations.

### Adding Translations

Edit `translation.service.ts` to add new translation keys:

```typescript
private translations = {
  en: {
    'key': 'English text',
    // ...
  },
  sl: {
    'key': 'Slovensko besedilo',
    // ...
  }
};
```

## 🔌 WebSocket Integration

The admin app uses WebSocket for:

- **Real-time Content Display**: See what's currently displayed
- **Selection Synchronization**: Sync playlist/item selections across instances
- **Display Control**: Send TV control commands

### WebSocket Messages Sent

- `SelectPlaylist`: When a playlist is selected
- `SelectLibraryItem`: When a library item is selected
- `Action`: TV control commands (powerOn, powerOff, volumeUp, volumeDown)
- `Change`: Request to change displayed content

### WebSocket Messages Received

- `SelectPlaylist`: Sync playlist selection from other admin instances
- `SelectLibraryItem`: Sync item selection from other admin instances
- `text`, `image`, `url`: Current content being displayed

## 🎨 Styling

- **Global Styles**: `src/styles.css` contains unified button styles (`.btn-save`, `.btn-cancel`)
- **Component Styles**: Each component has its own SCSS file
- **Font Awesome**: Icons from Font Awesome Free
- **Responsive**: Mobile-friendly design with hamburger menu

## 📱 Responsive Design

- Desktop: Full navigation bar with all buttons
- Mobile: Hamburger menu for navigation
- Touch-friendly buttons and interactions

## 🔧 Configuration

### API Endpoint

The application connects to the server at `http://localhost:8080`. To change this, update:

- `auth.service.ts`: Login endpoint
- `playlist.service.ts`: API endpoints
- `websocket.service.ts`: WebSocket URL

### Port

Default port is `4200`. To change:

```bash
ng serve --port 4201
```

Or modify `angular.json` scripts.

## 🏗️ Building for Production

```bash
npm run build
```

Output: `dist/media-player-admin/`

The build includes:
- Production optimizations
- AOT compilation
- Tree shaking
- Minification

### Budget Configuration

The build has budget limits configured in `angular.json`:
- Component styles: 10KB max
- Initial bundle: 1MB max

## 🧪 Development

### Running Tests

```bash
npm test
```

### Code Structure

- **Standalone Components**: All components are standalone (no NgModules)
- **Services**: Injectable services for shared functionality
- **Guards**: Route guards for authentication and permissions
- **Pipes**: Custom pipes for translations and date formatting

## 🐛 Troubleshooting

### Login Issues

- Verify server is running on port 8080
- Check browser console for errors
- Verify credentials are correct
- Check CORS configuration on server

### WebSocket Connection Issues

- Verify server WebSocket is running
- Check connection status indicator
- Review browser console for errors
- Verify WebSocket URL in `websocket.service.ts`

### Permission Issues

- Verify user has required permissions
- Check role assignments
- Review permission guard configuration

### Build Errors

- Check Node.js and Angular CLI versions
- Clear `node_modules` and reinstall
- Verify TypeScript version compatibility

## 📦 Dependencies

### Main Dependencies

- `@angular/*`: Angular framework (v17)
- `@fortawesome/fontawesome-free`: Icons
- `crypto-js`: Password hashing (MD5)
- `rxjs`: Reactive programming

### Dev Dependencies

- `@angular/cli`: Angular CLI
- `@angular-devkit/build-angular`: Build tools
- `typescript`: TypeScript compiler

## 📄 License

ISC
