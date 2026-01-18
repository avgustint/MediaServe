# MediaServer Admin v2

Complete rewrite of the MediaServer admin application with consistent design system and improved architecture.

## Project Status

### ✅ Completed

- Project setup and configuration
- Design system foundation (variables, mixins, components, utilities)
- Core services (API, Auth, User, WebSocket, Translation)
- Core guards (Auth, Permission)
- Shared pipes (Translation, FormatText, LocalizedDate)
- Shared feedback components (Loading, Toast, ErrorPopup, ConfirmDialog)
- Basic app shell structure

### 🚧 In Progress

- Shared UI components
- Layout components
- Feature modules

### 📋 To Do

See the plan file for detailed implementation tasks.

## Getting Started

```bash
npm install
npm start
```

## Architecture

- **Feature-based structure**: Components organized by feature domain
- **Consistent design system**: All styling uses CSS variables and mixins
- **Reusable components**: Shared UI components in `shared/ui/`
- **Modern Angular**: Standalone components, signals-ready architecture

## Development

This is a complete rewrite. The old admin app remains in `admin/` folder for reference.
